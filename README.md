# Cosa?

SENSO è un assistente vocale di educazione finanziaria che ti parla con i tuoi numeri reali, ti spiega il perché delle tue scelte e ti guida verso decisioni migliori - senza giudicare, senza grafici, solo con la verità in faccia e un percorso concreto da seguire.

[Leggi il concept completo](./CONCEPT.md)

# Perché?

## PUNKATHON

### ​Cos'è PUNKATHON

​Un hackathon AI di una giornata.

​Niente pitch deck. Niente slide teoriche.

​Una giornata per progettare e consegnare una soluzione AI funzionante. Poi festeggiamo insieme.

​📍 OGR Torino — 📅 Sabato 11 aprile 2026 — ⏰10:30 AM

### ​La Challenge

**​Educazione finanziaria. But do it punk!**

​Progetta una soluzione AI che renda l'educazione finanziaria concreta, accessibile e desiderabile per i giovani.

​Può essere un prodotto, un tool, una piattaforma, un'esperienza digitale o un format tech-enabled. Deve funzionare. Deve essere dimostrabile. Deve usare AI in modo non decorativo.

​Puoi integrare tecnologie AI come voice, LLM o automazioni — l’importante è che siano parte centrale dell’esperienza.

### ​Chi può partecipare

​Developer, AI engineer, builder, profili tech-oriented.

#### ​Modalità:

    - ​Individuale o in team (massimo 2 persone)
    - ​I team devono presentarsi già formati — nessun matchmaking in loco

#### 📌 Puoi arrivare con:

    ​- Un concept già definito
    ​- Una codebase di partenza
    ​- Un MVP parziale o un proof of concept

**​📌Sviluppo e demo vengono finalizzati durante l'hackathon.**

​Candidature tramite questo form su Luma. I posti sono limitati.

### ​Cosa aspettarsi

​Troverai altri builder con cui confrontarti, accesso a ElevenLabs per costruire esperienze AI vocali reali, e una giuria che valuta sul prodotto, qualità del codice e creatività.

### ​Premi

​🥇 1000€
🥈 500€
🥉 250€

​🏆 Best Project built with ElevenLabs — 3 mesi di Scale Tier per ogni membro del team

​Tutti i partecipanti avranno accesso gratuito per 1 mese alla Creator Tier di ElevenLabs a partire dall'11 aprile.

### ​Agenda

​10:30 – 11:00 Accredito partecipanti
11:00 Inizio hackathon
13:00 Pranzo presso OGR Torino
18:00 – 19:00 Fine build sprint + demo
19:00 Aperitivo + proclamazione vincitori

### ​Chi siamo

    [​Devpunks](https://www.devpunks.com) Siamo una community di developer freelance e AI engineer selezionati tecnicamente e sempre aggiornati. Grazie a loro aiutiamo le aziende a scalare rapidamente i team IT e di prodotto con un modello Talent-as-a-Service — developer integrati velocemente, supportati da un fractional tech lead Devpunks che garantisce qualità e scelte tecnologiche strategiche.

    [​ElevenLabs](https://www.elevenlabs.io) è una piattaforma AI specializzata nella generazione e manipolazione della voce, utilizzata da developer e team di prodotto per integrare voice synthesis, dubbing e audio AI in applicazioni reali. Le loro API permettono di costruire esperienze vocali naturali e scalabili — dal text-to-speech a use case più avanzati come agenti conversazionali e contenuti audio dinamici.

    [​Banca Territori del Monviso](https://www.bancabtm.it) – Credito Cooperativo di Casalgrasso e Sant'Albano Stura è attiva da oltre 70 anni nelle provincie di Cuneo e Torino. Opera attraverso 21 filiali e un moderno Centro Direzionale a servizio dei suoi 10.500 soci e 30.000 clienti, per conto dei quali amministra masse che superano i 2,3 miliardi di euro. Con un CET1 ratio al 31.12.2025 del 30.60% è tra gli istituti più solidi del sistema bancario nazionale. Da ottobre ha inaugurato NEXT, la BTM Young Community per i giovani dai 18 ai 30 anni. Uno spazio di confronto e coinvolgimento dei giovani come parte attiva nelle scelte della banca.

### ​Location

OGR Torino
Corso Castelfidardo, 22, 10128 Torino TO, Italy

> Src: [Punkathon Hackathon Annuncio](https://luma.com/nzjeiyaz)

## Phase 1 Local Runtime

Follow these steps on a fresh machine.

1. Clone repository and enter project root.
2. Copy environment template:

   ```bash
   cp .env.example .env
   ```

3. Start all Phase 1 services (frontend + API + Postgres):

   ```bash
   docker compose up --build
   ```

4. Open the app:
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - API health endpoint: http://localhost:8000/health

5. Run auth smoke checks (in a new terminal):

   ```bash
   bash scripts/smoke-auth.sh
   ```

Expected output:

```text
Smoke checks passed: /health and /auth/signup are reachable.
```
