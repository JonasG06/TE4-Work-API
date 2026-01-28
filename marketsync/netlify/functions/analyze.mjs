const CACHE = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 min

export default async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    // ✅ RÄTT sätt i Netlify nya runtime:
    const { job, resumeText } = await req.json();

    const key = `${job.id}::${resumeText.slice(0, 2000)}`; // räcker för demo
const hit = CACHE.get(key);
if (hit && (Date.now() - hit.t) < TTL_MS) return json(200, hit.v);


    if (!job || !resumeText) return json(400, { error: "Missing job or resumeText" });

     const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";


    console.log("Using model:", model);
    console.log("API key present:", !!apiKey);
    if (!apiKey) return json(500, { error: "Missing GEMINI_API_KEY" });

    const prompt = `
You are an experienced technical recruiter + hiring manager.
Evaluate overall fit holistically (not just keyword overlap).

Do NOT score purely by keyword overlap. Consider:
- role responsibilities match
- level/seniority match
- relevant projects/impact
- domain fit (e.g., product vs consultancy)
- evidence of delivering similar work
- missing requirements that matter for this role

Return ONLY a single JSON object. No markdown. No commentary. No extra text.
Schema (must match exactly):
{
  "score": 0-100 integer,
  "summary": string,
  "technical_match": string[],
  "requirement_gap": string[],
  "strategic_advice": string[]
}

Rules:
- Output MUST start with "{" and end with "}".
- Use Swedish for summary and lists.
- Keep each list item short.
- score must be integer 0-100.

JOB:
${JSON.stringify(job)}

RESUME:
${resumeText}
`.trim();

    const modelPath = model.startsWith("models/") ? model : `models/${model}`;
const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

   const schema = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    summary: { type: "STRING" },
    technical_match: { type: "ARRAY", items: { type: "STRING" } },
    requirement_gap: { type: "ARRAY", items: { type: "STRING" } },
    strategic_advice: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["score", "summary", "technical_match", "requirement_gap", "strategic_advice"],
};

const gemRes = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
      responseSchema: schema
    },
  }),
});

if (gemRes.status === 429) {
  const details = await gemRes.text();
  // Försök plocka ut "retry in Xs" om det finns i texten
  const m = details.match(/retry in ([0-9.]+)s/i);
  const retrySeconds = m ? Number(m[1]) : 30;

  return json(429, { error: "Rate limited", retrySeconds, details });
}


    
    if (!gemRes.ok) {
  const details = await gemRes.text();
  return json(gemRes.status, { error: "Gemini failed", details });
}


    const gemData = await gemRes.json();

// ✅ 1) Ta ALLA parts och slå ihop till en sträng
const text = (gemData?.candidates?.[0]?.content?.parts || [])
  .map((p) => p?.text || "")
  .join("")
  .trim();

// ✅ 2) Försök parsa direkt / med brace-matcher
let parsed = safeParseJson(text);

// ✅ 3) Om det inte gick: be Gemini reparera till giltig JSON
if (!parsed) {
  const repairPrompt = `
You will be given a response that should be JSON but is invalid or incomplete.
Return ONLY valid JSON matching this schema, with no extra text.

Schema:
{
  "score": integer 0-100,
  "summary": string,
  "technical_match": string[],
  "requirement_gap": string[],
  "strategic_advice": string[]
}

Input:
${text}
  `.trim();

  const repairRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!repairRes.ok) {
    const details = await repairRes.text();
    return json(502, { error: "Gemini repair failed", details, raw: text });
  }

  const repairData = await repairRes.json();
  const repairedText = (repairData?.candidates?.[0]?.content?.parts || [])
    .map((p) => p?.text || "")
    .join("")
    .trim();

  parsed = safeParseJson(repairedText);

  if (!parsed) {
    // fortfarande inte JSON: skicka tillbaka raw så ni kan se i UI
    return json(200, {
      score: 50,
      summary: "Kunde inte tolka AI-svaret som JSON. Försök igen.",
      technical_match: [],
      requirement_gap: [],
      strategic_advice: [],
      raw: repairedText || text,
    });
  }
}

const value = sanitize(parsed);
CACHE.set(key, { t: Date.now(), v: value });
return json(200, value);

// ✅ 4) om parsed finns: returnera den sanerat
return json(200, sanitize(parsed));

  } catch (e) {
    return json(500, { error: "Server error", details: String(e) });
  }
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function safeParseJson(s) {
  if (!s) return null;

  // 1) Försök direkt
  try {
    return JSON.parse(s);
  } catch {}

  // 2) Om svaret innehåller extra text, plocka ut första kompletta JSON-objektet
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      const candidate = s.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }

  // Om vi kommer hit: JSON blev avklippt och saknar sista "}"
  return null;
}


function sanitize(o) {
  return {
    score: clampInt(o.score, 0, 100),
    summary: typeof o.summary === "string" ? o.summary : "",
    technical_match: Array.isArray(o.technical_match) ? o.technical_match.map(String).slice(0, 8) : [],
    requirement_gap: Array.isArray(o.requirement_gap) ? o.requirement_gap.map(String).slice(0, 8) : [],
    strategic_advice: Array.isArray(o.strategic_advice) ? o.strategic_advice.map(String).slice(0, 6) : [],
  };
}

function clampInt(n, min, max) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}
