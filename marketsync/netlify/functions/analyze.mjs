export default async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    // ✅ RÄTT sätt i Netlify nya runtime:
    const { job, resumeText } = await req.json();

    if (!job || !resumeText) return json(400, { error: "Missing job or resumeText" });

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
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

Return ONLY valid JSON with exactly these keys:
{
  "score": number,
  "summary": string,
  "technical_match": string[],
  "requirement_gap": string[],
  "strategic_advice": string[]
}

Rules:
- score MUST be an integer 0-100.
- No markdown. No extra keys.

JOB:
${JSON.stringify(job)}

RESUME:
${resumeText}
`.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const gemRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });

    if (!gemRes.ok) {
      const details = await gemRes.text();
      return json(502, { error: "Gemini failed", details });
    }

    const gemData = await gemRes.json();
    const text = gemData?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";

    const parsed = safeParseJson(text);
    if (!parsed) return json(500, { error: "Gemini returned non-JSON", raw: text });

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
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
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
