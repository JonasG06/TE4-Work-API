export default async (req) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "frontend";
    const limit = url.searchParams.get("limit") || "10";

    const api = `https://jobsearch.api.jobtechdev.se/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(api, { headers: { "User-Agent": "MarketSync-school-project" } });

    if (!res.ok) {
      const details = await res.text();
      return json(502, { error: "JobTech request failed", details });
    }

    const data = await res.json();
    const hits = data?.hits ?? [];

    const unified = hits.map(normalizeJobtechHit);
    return json(200, { jobs: unified });
  } catch (e) {
    return json(500, { error: "Server error", details: String(e) });
  }
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function safeGet(d, ...keys) {
  let cur = d;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return null;
  }
  return cur;
}

function normalizeJobtechHit(hit) {
  const workplace = hit.workplace_address || {};
  const employer = safeGet(hit, "employer", "name") || "";

  const municipality = workplace.municipality || "";
  const region = workplace.region || "";
  const location = [municipality, region].filter(Boolean).join(", ") || workplace.city || "";

  const description = safeGet(hit, "description", "text") || "";
  const requirementsText = safeGet(hit, "description", "requirements") || "";

  return {
    id: String(hit.id || ""),
    source: "jobtech",
    sourceUrl: hit.webpage_url || safeGet(hit, "application_details", "url") || "",
    title: hit.headline || hit.title || "",
    company: employer,
    location,
    employmentType: safeGet(hit, "employment_type", "label") || hit.employment_type || "",
    seniority: "",
    description,
    requirementsText,
    skills: [],
    publishedAt: hit.publication_date || "",
    expiresAt: hit.application_deadline || "",
  };
}
