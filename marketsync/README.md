# CV → Job Match (AI-baserad jobbmatchning)

Detta projekt är ett demo-system där en användare kan klistra in sitt CV och få en lista med relevanta jobb, rankade med en matchningsprocent (0–100 %).  
Matchningen baseras på en **helhetsbedömning med AI**, inte enbart på keyword-matching.

Projektet är byggt som en modern webbapplikation med frontend, serverless backend och extern AI-analys.

---

## 🚀 Funktionalitet
- Klistra in ett CV (fri text)
- Sök jobb via Arbetsförmedlingens JobTech API
- Visa jobblista med titel, företag och plats
- Klicka på **“Analysera”** för att:
  - jämföra CV + jobbannons
  - få en matchningsprocent
  - få en kort AI-baserad motivering

---

## 🧠 Hur matchningen fungerar
1. Jobb hämtas från **JobTech API**
2. CV + jobbannons skickas till **Gemini (LLM)**
3. AI:n gör en holistisk bedömning:
   - erfarenhet
   - rollnivå
   - teknisk match
   - sammanhang (inte bara ord)
4. Resultatet returneras som JSON:
   - `score` (0–100)
   - `summary` (kort motivering)

---

## 🛠️ Teknikval

### Frontend
- **React** – komponentbaserat UI
- **Vite** – snabb utvecklingsserver och build-tool

### Backend
- **Node.js** (serverless)
- **Netlify Functions** – API-endpoints (`/jobs`, `/analyze`)

### Externa API:er
- **JobTech API** – verkliga svenska jobbannonser
- **Google Gemini API** – AI-baserad matchningsanalys

---

## 📁 Projektstruktur

TE4-Work-API/
├── marketsync/                 # Frontend + serverless backend
│   ├── src/                    # React-kod
│   │   ├── App.jsx             # Huvudkomponent
│   │   ├── App.css             # Grundläggande styling
│   │   └── main.jsx            # React entry point
│   │
│   ├── public/                 # Statiska filer
│   │
│   ├── netlify/
│   │   └── functions/          # Serverless API (Node.js)
│   │       ├── jobs.mjs        # Hämtar jobb från JobTech API
│   │       └── analyze.mjs     # AI-analys (CV ↔ jobb)
│   │
│   ├── .env                    # API-nycklar (ej pushad)
│   ├── package.json            # Projektberoenden & scripts
│   └── vite.config.js          # Vite-konfiguration
│
├── netlify.toml                # Netlify konfiguration
├── .gitignore                  # Filer som inte ska pushas
└── README.md                   # Projektdokumentation

---

## ▶️ Köra projektet lokalt

### 1. Installera beroenden
```bash
cd marketsync
npm install

