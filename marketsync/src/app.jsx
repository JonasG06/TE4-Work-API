import { useState } from "react";
import "./App.css";

export default function App() {
  const [cv, setCv] = useState("");
  const [q, setQ] = useState("frontend");
  const [jobs, setJobs] = useState([]);
  const [analysisById, setAnalysisById] = useState({});
  const [loading, setLoading] = useState(false);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/jobs?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
    }
  }

  async function analyze(job) {
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, resumeText: cv }),
      });
      const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Non-JSON from server:", text);
  alert("Servern kraschade och returnerade inte JSON. Kolla terminalen.");
  return;
}

if (!res.ok) {
  alert("Analyze error: " + JSON.stringify(data));
  return;
}

      setAnalysisById(prev => ({ ...prev, [job.id]: data }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h2>CV → Job Match</h2>

      <div style={{ display: "grid", gap: 8 }}>
        <label>Sökord (JobTech):</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="frontend" />

        <label>Klistra in ditt CV:</label>
        <textarea value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Klistra in CV här..." />

        <button onClick={fetchJobs} disabled={loading}>
          {loading ? "Jobbar..." : "Hämta jobb"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {jobs.map((j) => {
            const score = analysisById[j.id]?.score;
            return (
              <div key={j.id} className="card">
                <div>
                  <div className="title">{j.title}</div>
                  <div className="meta">{j.company} • {j.location}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <a href={j.sourceUrl} target="_blank" rel="noreferrer">Annons</a>
                    <button onClick={() => analyze(j)} disabled={loading || !cv}>
                      Analysera
                    </button>
                  </div>
                  {analysisById[j.id]?.summary && (
                    <div className="summary">{analysisById[j.id].summary}</div>
                  )}
                </div>
                <div className="badge">{score ?? "--"}</div>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3>Detaljer</h3>
          <p>Klicka “Analysera” på ett jobb för att se matchning.</p>
          <p style={{ fontSize: 12, color: "#666" }}>
            Obs: Score kommer från Gemini (holistisk bedömning, inte bara keyword overlap).
          </p>
        </div>
      </div>
    </div>
  );
}
