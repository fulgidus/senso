# Concept

## Nome

**S.E.N.S.O.** - *Sistema Educativo per Numeri, Spese e Obiettivi*

Nome proprio + acronimo. Il doppio senso è intenzionale: SENSO come "buon senso", la cosa che manca quando compri d'impulso.

## One-liner

Finalmente qualcuno che ti dice la verità sui tuoi soldi.

## USP

Non è un'app di budgeting. Non ti dà grafici. Ti **parla**, ti **guida**, ti **educa**. Carichi i tuoi dati finanziari reali e l'AI li digerisce - poi quando le dici "voglio comprare X", lei **sa già tutto di te** e ti risponde con i TUOI numeri. Ma non si ferma lì: ti spiega il *perché*, ti collega ad articoli e video per capire davvero, e ti propone soluzioni concrete tramite servizi della banca o partner convenzionati. Educazione finanziaria personalizzata, con un percorso, non una battuta.

## Target

- 18-30 anni
- Primo stipendio o reddito basso/medio
- Zero educazione finanziaria
- Abituati a parlare con assistenti vocali
- Comprano d'impulso e lo sanno

## Pitch Angle (per la giuria)

> *"I giovani non imparano la finanza leggendo libri. Imparano facendo scelte - e sbagliando. Noi interveniamo esattamente lì: ogni decisione diventa un momento di apprendimento concreto."*

| Criterio brief | Come SENSO lo soddisfa                                   |
| -------------- | -------------------------------------------------------- |
| Concreta       | Agisce su decisioni reali, non su teoria astratta        |
| Accessibile    | Voice-first, linguaggio semplice, zero jargon bancario   |
| Desiderabile   | Utile sul momento - non "educativo" nel senso noioso     |
| AI centrale    | LLM + profilo utente + voice + personas - non decorativa |

**Claim finale per il pitch:** *"Non insegniamo finanza. Aiutiamo le persone a prendere decisioni migliori. È così che imparano davvero."*

## Come funziona

### Fase 1 - Onboarding ("Fatti conoscere")
1. Upload documenti: CSV estratti conto, buste paga, ricevute, screenshot
2. L'LLM + RAG li smaltisce: estrae reddito, spese ricorrenti, pattern, abbonamenti, debiti
3. Ti restituisce un riassunto brutale: "Ok, guadagni X, spendi Y, ti restano Z. E spendi il 30% in delivery."
4. Da qui in poi, l'AI **conosce la tua situazione reale**

### Fase 2 - Conversazione ("Parla")
1. Bottone "Parla" → dici cosa vuoi comprare o che scelta stai valutando
2. L'AI incrocia la richiesta con i TUOI dati reali (RAG + profilo finanziario) e con la filosofia configurata (principi finanziari, tono, confini)
3. Ti risponde a voce con tono da mentore (o altra persona selezionata): diretto, con numeri precisi, e ti spiega il ragionamento
4. Insieme alla risposta vocale, l'app mostra **card azionabili**:
    - 📚 **Approfondisci**: articoli/video/presentazioni dalla knowledge base curata (es. "Come funzionano le rate", "Il vero costo di un abbonamento")
    - 🏦 **Agisci**: link a servizi della banca o partner convenzionati (es. conto deposito, piano di risparmio automatico, consulenza gratuita)
5. Puoi continuare: "e se aspetto?", "spiegami meglio le rate", "quali alternative ho?"

## Tono

- Da mentore: diretto, anche duro, ma **sempre dalla tua parte**
- Le cose te le dice per il tuo bene, non per farsi una risata
- Non giudica, non prende in giro: ti mostra i fatti e ti dà una strada
- Esempi:
    - "900€ di telefono con 300€ di margine mensile. Puoi farlo, ma ti blocchi per 3 mesi. Ti spiego un'alternativa che forse non hai considerato."
    - "Stai spendendo 280€/mese in delivery. Non è un giudizio - è che con quei soldi in 6 mesi ti paghi una vacanza vera. Vuoi che ti faccia vedere come?"
    - "Mettere via anche solo 30€ al mese cambia tutto. Sembra niente, ma tra un anno sono 360€ che oggi non hai. Ti mostro come automatizzarlo se vuoi."

## Filosofia & Personas (configurazione LLM)

La "coscienza" di SENSO è definita da una gerarchia di file in `personas/`:

- **`personas/ethos.md`** - i principi finanziari fondanti su cui si basa ogni risposta, indipendentemente dalla persona attiva
- **`personas/boundaries.md`** - comportamenti, temi e risposte vietati (linee guida soft)
- **`personas/hard-boundaries.yml`** - regex di sicurezza in uscita: censura, ban temporaneo, rilevamento prompt-injection
- **`personas/config.json`** - elenco delle personas disponibili (id, nome, descrizione, icona, file)
- **`personas/soul/{persona}.md`** - file comportamentale di ogni persona: tono, stile, esempi

Le personas selezionabili sono:

| ID                 | Nome                | Vibe                                   |
| ------------------ | ------------------- | -------------------------------------- |
| `mentore-saggio`   | Il Mentore Saggio   | Calmo, diretto, ti dà la strada        |
| `amico-sarcastico` | L'Amico Sarcastico  | Ironico, ti prende in giro con affetto |
| `hartman`          | Il Sergente Hartman | Duro, senza pietà, ma ti fa crescere   |
| `cheerleader`      | La Cheerleader      | Entusiasta, celebra ogni progresso     |

## Knowledge Base

L'AI ha accesso a un archivio di **contenuti educativi** (RAG) da collegare alle risposte:

- **Articoli**: guide brevi su temi finanziari (rate, interessi, fondo emergenza, investimenti base...)
- **Video**: video-pillole / tutorial (embedded da YouTube o piattaforma partner)
- **Fonti**: materiale della banca, enti di educazione finanziaria, contenuti curati, servizi esterni in tempo reale (es. tassi di interesse attuali, offerte del mese, comparatori di voli, comparatori di tariffe, comparatori di piattaforme di shopping, streaming, ecc.)

Quando l'AI risponde, pesca dal knowledge base i contenuti più rilevanti e li propone come approfondimento.

## Servizi & Partner (Funnel)

Ogni risposta può includere **azioni concrete** verso servizi reali:

- 🏦 **Servizi banca**: apertura conto risparmio, piano accumulo, consulenza gratuita
- 🤝 **Partner convenzionati**: assicurazioni, piattaforme investimento, corsi, viaggi, leasing, assicurazioni sulla vita, investimento, etc.
- ⚡ **Azioni rapide**: "attiva risparmio automatico", "prenota consulenza", "confronta offerte"

Il modello è: **l'AI educa → l'utente capisce → l'utente agisce tramite servizio reale**. Il funnel è naturale, non forzato: nasce dalla conversazione, non da un banner.

## Stack

- **Frontend**: Next.js + Tailwind (SPA, zero install, demo immediata)
- **Backend**: Python + FastAPI (Docker)
- **AI**: LLM swappable via config (default: Gemini 2.0 Flash; alternative: GPT-4o, Mistral)
- **Pipeline RAG**:
  - *Ingestione*: documenti uploadati (CSV, PDF, screenshot) → parsing → chunking → embedding → Qdrant
  - *Profilo utente*: struttura JSON estratta dall'LLM al primo upload, aggiornata incrementalmente
  - *Knowledge base*: articoli + video educativi → embedding → retrieval contestuale su Qdrant
  - *Servizi/partner*: catalogo in Postgres → matching con situazione utente
- **Voice**: ElevenLabs (TTS con voice config per persona) + Web Speech API (STT dal browser)
- **Storage**: Postgres (profilo utente, sessioni, catalogo servizi) + Qdrant (vettori KB + documenti)
- **Deploy locale / demo**: Docker Compose (fe + be + postgres + qdrant)
- **Config globale**: `config.json` (root) - API endpoints, lingue, feature flags, puntatori a personas/

## MVP scope

- [ ] **Onboarding**: upload CSV / busta paga (drag & drop)
- [ ] **Parsing + OCR**: LLM estrae dati strutturati (reddito, spese, categorie) dai documenti
- [ ] **Profilo finanziario**: schermata riassuntiva post-upload ("ecco la tua situazione")
- [ ] **Filosofia LLM**: system prompt con principi finanziari configurabili
- [ ] **Knowledge base**: set di articoli/video demo caricati come contesto RAG
- [ ] **Catalogo servizi**: JSON di servizi banca/partner con condizioni di matching
- [ ] **Matching RAG**: l'AI incrocia richiesta utente + profilo finanziario + knowledge base + servizi per generare risposta e azioni usando due chiamate simultanee a LLM (una per riposta, con un LLM forte tipo Gemini 3 Pro Thinking, e una per retrieval, con un LLM più leggero tipo Gemini 2.5 Flash)
- [ ] **Chat vocale**: bottone "Parla" + speech-to-text (possibilità di input diretto stile chat per chi non ha voglia di parlare)
- [ ] **AI response**: prompt con dati utente + filosofia + retrieval knowledge base + matching servizi
- [ ] **Card azionabili**: sotto la risposta vocale → link ad articoli, video, servizi
- [ ] **Output vocale**: ElevenLabs TTS
- [ ] **Email login + Google login**: per salvare sessioni e progressi (password, magic link (se c'e tempo) o OAuth)

## Demo flow

1. **10 sec** - Landing + drag & drop di un CSV estratto conto
2. **10 sec** - L'AI digerisce e mostra il profilo: "Guadagni 1400€, ne spendi 1100€, di cui 280€ in food delivery. Vediamo insieme cosa possiamo fare."
3. **5 sec** - Click su "Parla"
4. **10 sec** - Utente: "Voglio comprare un iPhone a rate"
5. **15 sec** - L'AI risponde a voce: "Con 300€ di margine mensile, le rate ti mangiano un terzo di quello che ti resta. Ma c'è un modo: se sposti anche solo 50€ al mese su un piano di accumulo, in 8 mesi ce l'hai senza debito."
6. **5 sec** - Appaiono card: 📚 "Come funzionano davvero le rate" (articolo) + 🏦 "Attiva piano accumulo" (servizio partner)
7. **10 sec** - Utente: "Spiegami meglio le rate"
8. **10 sec** - L'AI spiega con un esempio concreto sui suoi numeri + propone il video "Il costo nascosto delle rate"

Totale: ~75 secondi. Wow factor: **l'AI conosce i tuoi numeri, ti educa, e ti dà un'azione concreta**.

## Nice to have

- Connettori verso conti bancari per aggiornamento automatico (post-MVP)
- Modalità "sfida": l'AI ti dà un obiettivo di risparmio e ti segue settimana per settimana
- Storico conversazioni + progressi nel tempo
- Dashboard banca/partner: analytics su quanti funnel convertono
- Percorsi educativi: l'AI suggerisce un "corso" progressivo basato sulle tue lacune
- Personalizzazione della voce/personalità del mentore
- Notifiche proattive: "Ehi, questo mese stai spendendo più del solito in X"