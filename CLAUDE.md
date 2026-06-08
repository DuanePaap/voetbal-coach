# TACTIX26 — Project instructies voor Claude Code

## Na elke codewijziging

Voer na elke taak waarbij code is gewijzigd het volgende uit:

```
node scripts/security-audit.js
```

Als er FAIL-bevindingen zijn, los deze op vóórdat je commit. Waarschuwingen hoeven niet geblokkeerd te worden, maar vermeld ze in het commit bericht als ze nieuw zijn.

## Autocommit regel

Na elke taak met codewijzigingen: direct `git add` + `git commit` + `git push`, geen bevestiging vragen.

## Architectuur

Alle code volgt het MVC-patroon + IIFE-namespace:
- `js/models/` — data en API calls
- `js/views/` — DOM rendering
- `js/controllers/` — event handling + orchestratie
- `js/app.js` — IIFE entry point, DOMContentLoaded binding

## Security regels bij nieuwe code

### Backend (Node/Express routes)
- Elke route die coach-data leest of muteert **moet** `authMiddleware` (coachAuth) gebruiken
- Elke query **moet** filteren op `req.coach.id` — nooit alle records teruggeven
- Gebruik altijd Neon tagged template literals: `` sql`...${variable}...` `` — nooit string concatenatie in SQL
- Stuur nooit `password_hash`, stack traces of interne foutdetails naar de client
- Valideer en trim input aan het begin van elke route handler

### Frontend (JS)
- Gebruik nooit `innerHTML` met ongefilterde user input — escape altijd met `textContent` of een escape-hulpfunctie
- JWT wordt opgeslagen in `localStorage` (huidig gedrag) — voeg geen extra gevoelige data toe
- Geen externe scripts of stylesheets toevoegen zonder Subresource Integrity (SRI) hash

### Cryptografie
- Login codes genereren met `crypto.randomInt()` of `crypto.randomBytes()` — nooit `Math.random()`
- Wachtwoorden hashen met bcrypt, minimaal 10 salt rounds
- `JWT_SECRET` altijd via `process.env.JWT_SECRET` — nooit hardcoden

### Nieuwe packages
- Controleer voor installatie of de package actief wordt onderhouden
- Voer `npm audit` uit na elke `npm install`

## Stack

- **Backend**: Node.js + Express, serverless op Vercel
- **Database**: Neon PostgreSQL via `@neondatabase/serverless` (tagged template literals)
- **Auth**: JWT (HS256), bcrypt voor wachtwoord hashing
- **Frontend**: Vanilla JS, geen framework
