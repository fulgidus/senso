---
marp: true
theme: default
paginate: true
style: |
  @import url('https://cdn.jsdelivr.net/npm/@fontsource-variable/geist/index.min.css');
  section { font-family: 'Geist Variable', system-ui, sans-serif; background: #112D4E; color: #F9F7F7; }
  h1, h2 { color: #5B9BD5; }
  h3 { color: #3F72AF; font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.12em; }
  strong { color: #5B9BD5; }
  em { color: #a8c4e0; }
  code { background: #1e4472; color: #5B9BD5; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
  blockquote { border-left: 4px solid #3F72AF; padding: 8px 20px; background: rgba(91,155,213,0.1); border-radius: 0 6px 6px 0; }
  th { background: #1e4472; color: #5B9BD5; text-align: left; }
  td { border-color: #1e4472; }
  table { font-size: 0.82em; }
  section.lt { background: #F9F7F7; color: #112D4E; }
  section.lt h1, section.lt h2 { color: #112D4E; }
  section.lt strong { color: #3F72AF; }
  section.lt em { color: #5B9BD5; }
  section.lt code { background: #DBE2EF; color: #3F72AF; }
  section.lt th { background: #DBE2EF; color: #112D4E; }
  section.lt td { border-color: #DBE2EF; }
  section.lt blockquote { background: rgba(63,114,175,0.08); }
---

<!-- _paginate: false -->
<!-- _class: lead -->

# S.E.N.S.O.

### Sistema Educativo per Numeri, Spese e Obiettivi

> Finalmente qualcuno che ti dice la verità sui tuoi soldi.

`PUNKATHON 2026` · OGR Torino · 11 Aprile

---

<!-- _class: lt -->

# Il Problema

- Solo il **35%** dei giovani italiani 18-34 capisce inflazione, interessi e rischio
  *(Banca d'Italia, 2023)*
- Il BNPL in Italia è cresciuto del **+85%** in 2 anni — chi lo usa di più è chi ne sa di meno
  *(CRIF, 2024)*
- Il **63%** delle famiglie italiane non ha un fondo di emergenza
  *(Intesa Sanpaolo / Centro Einaudi, 2023)*

> I giovani non imparano la finanza leggendo libri.
> Imparano facendo scelte — e spesso sbagliando. Noi interveniamo esattamente lì.

---

## La Soluzione

Un **mentore vocale AI** che ti conosce e ti parla con i **tuoi numeri reali**.

1. 📤 **Carica** — estratti conto CSV, buste paga, ricevute, screenshot
2. 🎤 **Chiedi** — "Posso comprare un iPhone a rate?" — anche a voce
3. 💡 **Impara** — risposta grounded + ragionamento trasparente + risorse educative + azioni concrete

> Demo completa dal caricamento alla raccomandazione vocale in meno di 90 secondi.

---

### Il Cuore Tecnico

## AI Centrale, Non Decorativa

- **7 Tool LLM** — profilo, transazioni, regole italiane, memoria, timeline, preferenze, contenuti
- **Structured Output** — `response_format` JSON Schema enforced, non istruzioni prose
- **Ragionamento Trasparente** — ogni risposta mostra QUALI dati ha usato e PERCHÉ
- **Voice In / Voice Out** — Web Speech API STT + ElevenLabs TTS con 4 voci, fallback automatico
- **Safety a 3 Livelli** — input guard → persona boundaries → output scanner
- **Classificazione Merchant 3-Tier** — regole → LLM small → LLM large + mappa crowdsourced
- **Knowledge Base Italia** — IRPEF 2025, INPS, bonus, 730, TFR, regime forfettario

---

<!-- _class: lt -->

## 4 Mentori, 1 Etica

*Tono diverso. Principi finanziari identici. Safety boundaries condivisi.*

| | Persona | Stile | Esempio |
|---|---|---|---|
| 🧓 | **Mentore Saggio** | Calmo, diretto | *"Con 300€ di margine, le rate ti mangiano un terzo."* |
| 😏 | **Amico Sarcastico** | Ironico, affettuoso | *"280€/mese in delivery? Ci paghi una vacanza."* |
| 💪 | **Sergente Hartman** | Duro, motivante | *"Zero risparmi a 25 anni? Sveglia. 50€/mese."* |
| 🎉 | **Cheerleader** | Entusiasta, positiva | *"30€ risparmiati! Piccoli passi, grandi risultati!"* |

---

### Architettura

## Stack Tecnico

| Layer | Tecnologie |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript · Tailwind 4 + shadcn/ui · **PWA standalone** |
| **Backend** | FastAPI 0.135 + Pydantic v2 · SQLAlchemy ORM · PostgreSQL 16 |
| **AI** | Gemini Flash + OpenAI fallback · BM25 retrieval · Jinja2 prompt templates |
| **Voice** | ElevenLabs TTS (4 voci persona) · Web Speech API STT |
| **Sicurezza** | AES-GCM encryption at rest · PBKDF2 · NaCl E2E messaging · ZDR headers |
| **Ingestion** | OCR 3-tier (Tesseract → LLM text → LLM vision) · 7 moduli parser |
| **Infra** | Docker Compose · Nginx · Let's Encrypt TLS |

---

<!-- _class: lt -->

## Il Progetto in Numeri

| Metrica | Valore | Metrica | Valore |
|---|---|---|---|
| Fasi completate | **30** / 31 | Piani eseguiti | **126** |
| Test funzionali | **349** | Commit | **558** |
| Tool LLM | **7** | Personas coach | **4** |
| Moduli ingestion | **7** | Contenuti educativi | **16** articoli + video + slide |

### Evoluzione

*"Quanto Mi Costa Davvero"* calcolatore BNPL · *"Primo Stipendio"* simulatore IRPEF ·
*Financial Time Machine* · Connettori bancari diretti · *Fraud & Scam Gym*

---

<!-- _paginate: false -->
<!-- _class: lead -->

# Non insegniamo finanza.

## Aiutiamo a prendere decisioni migliori.

S.E.N.S.O. è una PWA — scansiona, installa, usa.

| ![w:160](qr-prototype.png) | ![w:160](qr-repo.png) |
|:---:|:---:|
| *senso.dev.vps.fulgid.us* | *github.com/fulgidus/senso* |

`S.E.N.S.O.` · Alessio · PUNKATHON 2026
