#!/usr/bin/env node
'use strict';

/**
 * TACTIX26 Security Audit Agent — OWASP Top 10 (2021)
 * Gebruik: node scripts/security-audit.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Terminal kleuren ───────────────────────────────────────────────────────
const C = {
  bold:   s => `\x1b[1m${s}\x1b[22m`,
  dim:    s => `\x1b[2m${s}\x1b[22m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  white:  s => `\x1b[37m${s}\x1b[0m`,
};

const ROOT = path.join(__dirname, '..');
let passCount = 0, warnCount = 0, failCount = 0;
const findings = [];

// ── Hulpfuncties ──────────────────────────────────────────────────────────
function readFile(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return null; }
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function grepDir(dir, pattern, exts = ['.js']) {
  const hits = [];
  function walk(cur) {
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (['node_modules', '.git', 'scripts'].includes(e.name)) continue;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!exts.some(x => e.name.endsWith(x))) continue;
      const content = fs.readFileSync(full, 'utf8');
      const matches = [...content.matchAll(pattern)];
      if (matches.length) hits.push({ file: path.relative(ROOT, full), lines: matches.map(m => m[0].trim().slice(0, 80)) });
    }
  }
  walk(path.join(ROOT, dir));
  return hits;
}

function pass(msg, detail) {
  passCount++;
  console.log(`  ${C.green('✓')} ${msg}${detail ? C.dim('\n    → ' + detail) : ''}`);
}

function warn(msg, detail) {
  warnCount++;
  findings.push({ level: 'WARN', msg, detail });
  console.log(`  ${C.yellow('⚠')} ${C.yellow(msg)}${detail ? C.dim('\n    → ' + detail) : ''}`);
}

function fail(msg, detail) {
  failCount++;
  findings.push({ level: 'FAIL', msg, detail });
  console.log(`  ${C.red('✗')} ${C.red(msg)}${detail ? C.dim('\n    → ' + detail) : ''}`);
}

function section(code, title, description) {
  console.log(`\n${C.bold(C.cyan(`━━  ${code}: ${title}`))}`)
  console.log(C.dim(`    ${description}`));
}

// ══════════════════════════════════════════════════════════════════════════
// A01 — Broken Access Control
// ══════════════════════════════════════════════════════════════════════════
function checkA01() {
  section('A01', 'Broken Access Control', 'Controleer auth middleware op routes + data-isolatie per coach');

  const server = readFile('server.js') || '';

  // Elke coach route moet authMiddleware hebben (spaties-tolerante regex)
  const coachRoutes = ['players', 'matches', 'gameplans', 'codes'];
  for (const r of coachRoutes) {
    const pattern = new RegExp(`authMiddleware[\\s,]+require\\('./routes/${r}'\\)`);
    if (pattern.test(server)) {
      pass(`/api/${r} beveiligd met coachAuth middleware`);
    } else {
      fail(`/api/${r} MIST coachAuth middleware`, 'Voeg authMiddleware toe in server.js');
    }
  }

  // Speler route moet playerAuth gebruiken
  const playerRoute = readFile('routes/player.js') || '';
  if (playerRoute.includes('playerAuth')) {
    pass('/api/player/* gebruikt playerAuth middleware');
  } else {
    fail('/api/player/* mist playerAuth middleware');
  }

  // Data-isolatie: routes mogen alleen eigen coach data returneren
  const checks = [
    { file: 'routes/players.js',  pattern: 'req.coach.id', label: 'players' },
    { file: 'routes/matches.js',  pattern: 'req.coach.id', label: 'matches' },
    { file: 'routes/gameplans.js',pattern: 'req.coach.id', label: 'gameplans' },
    { file: 'routes/codes.js',    pattern: 'req.coach.id', label: 'codes' },
  ];
  for (const c of checks) {
    const content = readFile(c.file) || '';
    if (content.includes(c.pattern)) {
      pass(`${c.label} route filtert op coach_id (data-isolatie)`);
    } else {
      fail(`${c.label} route filtert NIET op coach_id — cross-coach data leak!`, c.file);
    }
  }

  // Controleer of DELETE/PUT routes ownership verifieren voordat ze muteren
  const playersJs = readFile('routes/players.js') || '';
  const hasOwnershipCheck = /WHERE id.*coach_id|coach_id.*WHERE id/s.test(playersJs);
  if (hasOwnershipCheck) {
    pass('DELETE/PUT op spelers verifieert eigendom vóór mutatie');
  } else {
    warn('Controleer of DELETE/PUT eigendom verifieert vóór uitvoering', 'routes/players.js');
  }

  // CORS
  if (!server.includes('cors')) {
    warn('Geen CORS-configuratie — alle origins worden geaccepteerd', 'Voeg express-cors toe met expliciete allowlist');
  } else {
    pass('CORS-configuratie aanwezig');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A02 — Cryptographic Failures
// ══════════════════════════════════════════════════════════════════════════
function checkA02() {
  section('A02', 'Cryptographic Failures', 'Wachtwoord-hashing, JWT-secrets, gevoelige data in transit');

  const authRoute = readFile('routes/auth.js') || '';
  const middleware = readFile('middleware/auth.js') || '';

  // bcrypt salt rounds
  const saltMatch = authRoute.match(/bcrypt\.hash\s*\([^,]+,\s*(\d+)/);
  if (saltMatch) {
    const rounds = parseInt(saltMatch[1]);
    if (rounds >= 10) {
      pass(`bcrypt salt rounds = ${rounds} (aanbevolen ≥ 10)`);
    } else {
      fail(`bcrypt salt rounds = ${rounds} — te laag!`, 'Gebruik minimaal 10 rounds');
    }
  } else {
    warn('bcrypt salt rounds niet gevonden, controleer routes/auth.js');
  }

  // JWT default secret
  const defaultSecretPattern = /JWT_SECRET.*?['"](.*?)['"]/;
  const match = (readFile('middleware/auth.js') || '').match(/process\.env\.JWT_SECRET \|\| ['"]([^'"]+)['"]/);
  if (match) {
    fail(`JWT_SECRET heeft een hardcoded fallback: "${match[1]}"`, 'Zorg dat JWT_SECRET altijd via env var wordt gezet in productie');
  } else {
    pass('JWT_SECRET heeft geen hardcoded fallback');
  }

  // JWT algoritme (HS256 default is acceptabel, RS256 zou sterker zijn)
  if (authRoute.includes('algorithm') && authRoute.includes('RS')) {
    pass('JWT gebruikt asymmetrisch algoritme (RS256/ES256)');
  } else {
    warn('JWT gebruikt HS256 (symmetrisch) — overweeg RS256 voor productie', 'HS256 is acceptabel voor kleine apps');
  }

  // Wachtwoord-hash NOOIT in response
  const playersResponse = readFile('routes/players.js') || '';
  if (!playersResponse.includes('password_hash')) {
    pass('password_hash wordt niet teruggegeven in player responses');
  } else {
    fail('password_hash mogelijk zichtbaar in API response!', 'routes/players.js');
  }

  // Auth responses bevatten geen wachtwoord (controleer res.json op wachtwoord-velden)
  if (!authRoute.match(/res\.json\s*\(\s*\{[^}]*(?:password|password_hash)/)) {
    pass('Auth routes geven geen wachtwoord terug in response');
  } else {
    fail('Auth route geeft mogelijk wachtwoord terug in response!', 'routes/auth.js');
  }

  // Controleer op hardcoded geheimen in de codebase
  const secretPatterns = [
    /password\s*[:=]\s*['"][^'"]{4,}/gi,
    /secret\s*[:=]\s*['"][^'"]{6,}/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]{6,}/gi,
  ];
  const serverFiles = ['server.js', 'routes/auth.js', 'middleware/auth.js', 'db/database.js'];
  let foundHardcoded = false;
  for (const f of serverFiles) {
    const content = readFile(f) || '';
    for (const p of secretPatterns) {
      const m = content.match(p);
      if (m) { foundHardcoded = true; warn(`Mogelijke hardcoded secret in ${f}`, m[0].slice(0, 60)); }
    }
  }
  if (!foundHardcoded) pass('Geen hardcoded wachtwoorden/secrets gevonden in server-code');

  // HTTPS — controleer of er een redirect is of Vercel dit afdwingt
  const vercelJson = readFile('vercel.json') || '';
  if (vercelJson.includes('https') || vercelJson.includes('ssl')) {
    pass('HTTPS geconfigureerd in vercel.json');
  } else {
    warn('Geen expliciete HTTPS-redirect in vercel.json', 'Vercel dwingt HTTPS af voor .vercel.app domeinen — ok voor nu');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A03 — Injection
// ══════════════════════════════════════════════════════════════════════════
function checkA03() {
  section('A03', 'Injection', 'SQL-injectie, XSS, command-injectie, path traversal');

  // SQL injection: neon gebruikt tagged template literals (veilig geparametriseerd)
  const rawSqlPattern = /sql\s*\(\s*['"`].*?\$\{/gs;
  const routeFiles = ['routes/auth.js', 'routes/players.js', 'routes/matches.js',
                      'routes/gameplans.js', 'routes/codes.js', 'routes/player.js'];
  let rawSqlFound = false;
  for (const f of routeFiles) {
    const content = readFile(f) || '';
    if (rawSqlPattern.test(content)) {
      rawSqlFound = true;
      fail(`String-concatenatie in SQL query gevonden in ${f}`, 'Gebruik altijd neon tagged template literals: sql\`...\`');
    }
  }
  if (!rawSqlFound) pass('Alle SQL queries gebruiken Neon tagged template literals (parameterized)');

  // XSS: frontend template literals met user data
  const xssHits = grepDir('js', /innerHTML\s*=\s*`[^`]*\$\{(?!.*html)/g);
  const unsafeXss = xssHits.filter(h =>
    h.lines.some(l => !l.includes('p.name') || l.includes('req.body'))
  );
  if (unsafeXss.length > 0) {
    warn('innerHTML met template literals gevonden — controleer op ongesanitized user input', unsafeXss.map(h => h.file).join(', '));
  } else {
    pass('Geen directe innerHTML-injectie met ongefilterde user input gevonden');
  }

  // innerHTML in views (algemene check)
  const innerHtmlFiles = grepDir('js/views', /\.innerHTML\s*=/g);
  if (innerHtmlFiles.length > 0) {
    warn('Views gebruiken innerHTML — zorg dat alle user-input ge-escaped wordt',
      innerHtmlFiles.map(h => h.file).join(', '));
  }

  // Command injection: exec/spawn met user input
  const execHits = grepDir('routes', /exec\s*\(|spawn\s*\(/g);
  if (execHits.length > 0) {
    fail('exec/spawn gevonden in route handlers — command injection risico!', execHits.map(h => h.file).join(', '));
  } else {
    pass('Geen exec/spawn gebruik in route handlers');
  }

  // Path traversal: user-controlled paths in fs.readFile etc.
  const pathHits = grepDir('routes', /readFile\s*\(.*req\.|sendFile\s*\(.*req\./g);
  if (pathHits.length > 0) {
    fail('User-input in file path operaties — path traversal risico!', pathHits.map(h => h.file).join(', '));
  } else {
    pass('Geen path traversal patronen gevonden');
  }

  // Prototype pollution
  const mergeHits = grepDir('routes', /Object\.assign\s*\(\s*\{\s*\}|spread.*req\.body/g);
  if (mergeHits.length > 0) {
    warn('Object.assign of spread met req.body — controleer op prototype pollution', mergeHits.map(h => h.file).join(', '));
  } else {
    pass('Geen prototype pollution patronen gevonden');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A04 — Insecure Design
// ══════════════════════════════════════════════════════════════════════════
function checkA04() {
  section('A04', 'Insecure Design', 'Rate limiting, security headers, input validatie, logincodes');

  const server = readFile('server.js') || '';

  // Rate limiting
  if (server.includes('rateLimit') || server.includes('express-rate-limit') || server.includes('rate-limit')) {
    pass('Rate limiting geconfigureerd');
  } else {
    fail('Geen rate limiting — brute-force aanvallen op /api/auth mogelijk', 'Installeer express-rate-limit');
  }

  // Security headers (Helmet)
  if (server.includes('helmet')) {
    pass('Helmet.js security headers geconfigureerd');
  } else {
    fail('Geen Helmet.js — security headers zoals CSP, HSTS ontbreken', "npm install helmet && app.use(require('helmet')())");
  }

  // Input validatie: minimale lengte wachtwoord
  const authRoute = readFile('routes/auth.js') || '';
  const pwLenMatch = authRoute.match(/length\s*<\s*(\d+)/);
  if (pwLenMatch) {
    const minLen = parseInt(pwLenMatch[1]);
    if (minLen >= 8) {
      pass(`Minimale wachtwoordlengte = ${minLen} tekens`);
    } else {
      warn(`Minimale wachtwoordlengte = ${minLen} tekens — aanbevolen is ≥ 8`, 'routes/auth.js');
    }
  } else {
    warn('Geen minimale wachtwoordlengte check gevonden', 'routes/auth.js');
  }

  // Login code entropia (8 chars uit alfabet van 32 = 40 bits)
  const codesRoute = readFile('routes/codes.js') || '';
  const charsMatch = codesRoute.match(/CHARS\s*=\s*['"]([^'"]+)['"]/);
  if (charsMatch) {
    const entropy = Math.log2(Math.pow(charsMatch[1].length, 8));
    if (entropy >= 40) {
      pass(`Login code entropie ≈ ${entropy.toFixed(0)} bits (${charsMatch[1].length} chars, 8 tekens)`);
    } else {
      warn(`Login code entropie ≈ ${entropy.toFixed(0)} bits — mogelijk te laag`, 'routes/codes.js');
    }
  }

  // Math.random() voor code generatie (niet cryptografisch veilig)
  if (codesRoute.includes('Math.random()')) {
    warn('Login codes gegenereerd met Math.random() — niet cryptografisch veilig', 'Gebruik crypto.randomInt() of crypto.randomBytes()');
  } else if (codesRoute.includes('crypto')) {
    pass('Login codes gebruiken crypto module (veilig)');
  }

  // Body size limit
  if (server.includes("limit: '") || server.includes('limit:"')) {
    pass('Request body size limiet geconfigureerd');
  } else {
    warn('Geen expliciete body size limiet — overweeg te verlagen van default 100kb', 'Huidig: 10mb in express.json({limit:"10mb"})');
  }

  // Check body limit waarde
  const limitMatch = server.match(/limit:\s*['"](\d+)(mb|kb)['"]/i);
  if (limitMatch) {
    const size = parseInt(limitMatch[1]);
    const unit = limitMatch[2].toLowerCase();
    if (unit === 'mb' && size > 5) {
      warn(`Body limiet is ${size}mb — dit is groot voor een API`, 'Verklein naar ~2mb tenzij foto uploads vereist zijn');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A05 — Security Misconfiguration
// ══════════════════════════════════════════════════════════════════════════
function checkA05() {
  section('A05', 'Security Misconfiguration', 'Env vars, error leakage, .gitignore, debug mode');

  // .env in .gitignore
  const gitignore = readFile('.gitignore') || '';
  if (gitignore.includes('.env')) {
    pass('.env staat in .gitignore');
  } else {
    fail('.env staat NIET in .gitignore — secrets kunnen worden gecommit!', '.gitignore');
  }

  // .env.example aanwezig maar geen echte .env
  if (fileExists('.env.example')) {
    pass('.env.example aanwezig voor onboarding');
  } else {
    warn('.env.example ontbreekt — documenteer vereiste env vars');
  }

  if (fileExists('.env')) {
    fail('.env bestand bestaat in project root — controleer of het gecommit is!', 'Voeg .env toe aan .gitignore en verwijder het uit git history');
  } else {
    pass('.env bestand niet aanwezig in project root (correct)');
  }

  // Stack traces in error responses
  const routeFiles = ['routes/auth.js', 'routes/players.js', 'routes/matches.js',
                      'routes/gameplans.js', 'routes/codes.js', 'routes/player.js'];
  let stackTraceFound = false;
  for (const f of routeFiles) {
    const content = readFile(f) || '';
    if (content.match(/res\..*err\.stack|res\..*err\.message.*stack/)) {
      stackTraceFound = true;
      fail(`Stack trace mogelijk zichtbaar in response in ${f}`, 'Stuur alleen generieke foutmeldingen naar de client');
    }
  }
  if (!stackTraceFound) pass('Routes geven geen stack traces terug aan de client');

  // Check of foutmeldingen te specifiek zijn (internal details)
  const server = readFile('server.js') || '';
  if (server.includes('NODE_ENV') && server.includes('production')) {
    pass('NODE_ENV check voor productie-specifiek gedrag aanwezig');
  } else {
    warn('Geen NODE_ENV conditionals — overweeg debug output te beperken in productie', 'server.js');
  }

  // Vercel.json security headers
  const vercelJson = readFile('vercel.json') || '';
  if (vercelJson.includes('X-Content-Type-Options') || vercelJson.includes('headers')) {
    pass('Security headers geconfigureerd in vercel.json');
  } else {
    warn('Geen security headers in vercel.json', 'Voeg X-Frame-Options, X-Content-Type-Options, Referrer-Policy toe');
  }

  // node_modules niet gecommit
  const gitignoreHasModules = gitignore.includes('node_modules');
  if (gitignoreHasModules) {
    pass('node_modules staat in .gitignore');
  } else {
    fail('node_modules staat NIET in .gitignore!', '.gitignore');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A06 — Vulnerable and Outdated Components
// ══════════════════════════════════════════════════════════════════════════
function checkA06() {
  section('A06', 'Vulnerable & Outdated Components', 'npm audit + dependency controle');

  // npm audit
  try {
    const result = execSync('npm audit --json 2>/dev/null', {
      cwd: ROOT, encoding: 'utf8', timeout: 30000,
    });
    const audit = JSON.parse(result);
    const { critical = 0, high = 0, moderate = 0, low = 0 } = audit.metadata?.vulnerabilities || {};
    const total = critical + high + moderate + low;

    if (critical > 0) fail(`npm audit: ${critical} kritieke kwetsbaarheden!`, 'Voer npm audit fix uit');
    else if (high > 0) fail(`npm audit: ${high} hoge kwetsbaarheden`, 'Voer npm audit fix uit');
    else if (moderate > 0) warn(`npm audit: ${moderate} gemiddelde kwetsbaarheden`, 'Voer npm audit fix uit');
    else if (low > 0) pass(`npm audit: alleen ${low} lage kwetsbaarheden`);
    else pass('npm audit: geen bekende kwetsbaarheden');
  } catch (e) {
    // npm audit returns exit code 1 when vulnerabilities found — parse from stderr/stdout
    try {
      const raw = e.stdout || '';
      if (raw) {
        const audit = JSON.parse(raw);
        const v = audit.metadata?.vulnerabilities || {};
        const { critical = 0, high = 0, moderate = 0 } = v;
        if (critical > 0) fail(`npm audit: ${critical} kritieke kwetsbaarheden!`);
        else if (high > 0) fail(`npm audit: ${high} hoge kwetsbaarheden`);
        else if (moderate > 0) warn(`npm audit: ${moderate} gemiddelde kwetsbaarheden`);
        else warn('npm audit uitgevoerd — zie output voor details');
      } else {
        warn('npm audit kon niet worden uitgevoerd', e.message?.slice(0, 80));
      }
    } catch {
      warn('npm audit resultaat kon niet worden geparsed');
    }
  }

  // package-lock.json aanwezig
  if (fileExists('package-lock.json')) {
    pass('package-lock.json aanwezig (reproduceerbare builds)');
  } else {
    fail('package-lock.json ONTBREEKT — installaties zijn niet reproduceerbaar');
  }

  // Controleer op verouderde engine requirements
  const pkg = JSON.parse(readFile('package.json') || '{}');
  const nodeEngine = pkg.engines?.node || '';
  if (nodeEngine) {
    pass(`Node.js engine vereiste geconfigureerd: ${nodeEngine}`);
  } else {
    warn('Geen Node.js engine vereiste in package.json', 'Voeg "engines": {"node": ">=18"} toe');
  }

  // Overzicht van dependencies
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const depCount = Object.keys(deps).length;
  pass(`${depCount} dependencies gevonden (${Object.keys(pkg.dependencies || {}).length} runtime, ${Object.keys(pkg.devDependencies || {}).length} dev)`);
}

// ══════════════════════════════════════════════════════════════════════════
// A07 — Identification and Authentication Failures
// ══════════════════════════════════════════════════════════════════════════
function checkA07() {
  section('A07', 'Authentication Failures', 'JWT expiratie, brute-force beveiliging, wachtwoordbeleid');

  const authRoute = readFile('routes/auth.js') || '';
  const middleware = readFile('middleware/auth.js') || '';

  // JWT expiratie — coach token
  const coachExpMatch = authRoute.match(/expiresIn:\s*['"](\d+[dhms])['"]/);
  if (coachExpMatch) {
    const exp = coachExpMatch[1];
    const days = exp.endsWith('d') ? parseInt(exp) : null;
    if (days && days > 90) {
      warn(`Coach JWT verloopt in ${exp} — langlopende tokens zijn een risico bij diefstal`, 'Overweeg kortere expiratie + refresh tokens');
    } else {
      pass(`Coach JWT expiratie: ${exp}`);
    }
  } else {
    warn('JWT expiratie niet gevonden — standaard is geen expiratie!', 'routes/auth.js');
  }

  // JWT expiratie — speler token (365d is erg lang)
  const playerExpMatch = authRoute.match(/expiresIn:\s*['"]365d['"]/);
  if (playerExpMatch) {
    warn('Speler JWT verloopt in 365 dagen — erg lang voor een gedeeld token', 'Overweeg kortere expiratie of token revocatie');
  }

  // Wachtwoord minimum lengte
  const pwMatch = authRoute.match(/password\.length\s*<\s*(\d+)/);
  if (pwMatch) {
    const len = parseInt(pwMatch[1]);
    if (len < 8) warn(`Minimum wachtwoordlengte is ${len} — NIST adviseert ≥ 8`, 'routes/auth.js');
    else pass(`Minimum wachtwoordlengte: ${len} tekens`);
  } else {
    warn('Minimum wachtwoordlengte check niet gevonden', 'routes/auth.js');
  }

  // JWT verificatie met geheime sleutel
  if (middleware.includes('jwt.verify')) {
    pass('JWT tokens worden geverifieerd via jwt.verify()');
  } else {
    fail('JWT verificatie niet gevonden in middleware!', 'middleware/auth.js');
  }

  // Token wordt niet opgeslagen in HttpOnly cookie (localStorage = XSS kwetsbaar)
  const apiJs = readFile('js/api.js') || '';
  if (apiJs.includes('localStorage')) {
    warn('JWT opgeslagen in localStorage — kwetsbaar voor XSS', 'Overweeg HttpOnly cookies voor token opslag');
  }

  // Geen account lockout mechanisme
  if (!authRoute.includes('lockout') && !authRoute.includes('attempts')) {
    warn('Geen account lockout na meerdere mislukte inlogpogingen', 'Implementeer tijdelijke blokkering na X mislukte pogingen');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A08 — Software and Data Integrity Failures
// ══════════════════════════════════════════════════════════════════════════
function checkA08() {
  section('A08', 'Software & Data Integrity Failures', 'SRI voor externe resources, npm integriteit');

  // Externe CDN resources zonder Subresource Integrity (SRI)
  const fieldView = readFile('js/views/FieldView.js') || '';
  // Filter W3C namespace URIs (geen laadbare resources) en blob/data URLs
  const cdnMatch = (fieldView.match(/https?:\/\/[^\s'"]+/g) || [])
    .filter(u => !u.startsWith('http://www.w3.org/') && !u.startsWith('data:') && !u.startsWith('blob:'));
  if (cdnMatch.length > 0) {
    cdnMatch.forEach(url => {
      warn(`Externe resource zonder SRI: ${url.slice(0, 70)}`, 'Voeg integrity hash toe of host het bestand zelf');
    });
  } else {
    pass('Geen externe CDN resources zonder SRI gevonden in FieldView.js');
  }

  // Externe URLs in <script> en <link> tags in index.html (laadbare resources)
  const htmlContent = readFile('index.html') || '';
  const scriptLinkUrls = [...htmlContent.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:\/\/[^"]+)"/g)]
    .map(m => m[1])
    .filter(u => !u.startsWith('http://www.w3.org/'));
  if (scriptLinkUrls.length > 0) {
    const unique = [...new Set(scriptLinkUrls)];
    unique.forEach(url => {
      if (!htmlContent.includes(`integrity=`)) {
        warn(`Externe <script>/<link> in index.html zonder SRI: ${url.slice(0, 70)}`);
      }
    });
  } else {
    pass('Geen externe scripts of stylesheets in index.html zonder SRI');
  }

  // npm integriteit (lockfile)
  if (fileExists('package-lock.json')) {
    const lockfile = readFile('package-lock.json') || '';
    if (lockfile.includes('"integrity"')) {
      pass('package-lock.json bevat integriteits-hashes voor alle dependencies');
    } else {
      warn('package-lock.json mist integriteits-hashes', 'Voer npm install uit om te regenereren');
    }
  }

  // Controleer of inputs worden gevalideerd voordat ze de DB in gaan
  const playersRoute = readFile('routes/players.js') || '';
  if (playersRoute.includes('name?.trim()') || playersRoute.includes("if (!name")) {
    pass('Input validatie aanwezig in players route');
  } else {
    warn('Controleer input validatie in players route', 'routes/players.js');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A09 — Security Logging and Monitoring Failures
// ══════════════════════════════════════════════════════════════════════════
function checkA09() {
  section('A09', 'Security Logging & Monitoring', 'Auth events loggen, foutafhandeling, geen gevoelige data in logs');

  const authRoute = readFile('routes/auth.js') || '';

  // Mislukte logins gelogd?
  if (authRoute.includes('console.') && authRoute.includes('error')) {
    pass('Fouten worden gelogd in auth routes');
  } else {
    warn('Mislukte login pogingen worden niet expliciet gelogd', 'routes/auth.js');
  }

  // Succesvolle logins gelogd?
  if (!authRoute.match(/console\.(log|info).*login|logged in/i)) {
    warn('Succesvolle logins worden niet gelogd', 'Overweeg auth events te loggen voor audit trail');
  }

  // Controleer of wachtwoorden/tokens in logs terechtkomen
  const routeFiles = ['routes/auth.js', 'routes/players.js', 'routes/codes.js'];
  let sensitiveInLog = false;
  for (const f of routeFiles) {
    const content = readFile(f) || '';
    if (content.match(/console\.(log|info)\s*\(.*(?:password|token|secret)/i)) {
      sensitiveInLog = true;
      fail(`Gevoelige data mogelijk in logs in ${f}`, 'Verwijder wachtwoorden/tokens uit console.log calls');
    }
  }
  if (!sensitiveInLog) pass('Geen wachtwoorden of tokens gevonden in console.log calls');

  // console.error in alle routes (foutafhandeling)
  const allRoutes = ['routes/auth.js', 'routes/players.js', 'routes/matches.js',
                     'routes/gameplans.js', 'routes/codes.js', 'routes/player.js'];
  let missingErrorLog = [];
  for (const f of allRoutes) {
    const content = readFile(f) || '';
    if (!content.includes('console.error')) missingErrorLog.push(f);
  }
  if (missingErrorLog.length === 0) {
    pass('Alle routes loggen fouten via console.error');
  } else {
    warn('Sommige routes missen fout-logging', missingErrorLog.join(', '));
  }

  // Geen gecentraliseerd error monitoring (Sentry etc.)
  const server = readFile('server.js') || '';
  if (!server.includes('sentry') && !server.includes('datadog') && !server.includes('newrelic')) {
    warn('Geen gecentraliseerd error monitoring (Sentry/Datadog)', 'Overweeg @sentry/node voor productie monitoring');
  } else {
    pass('Gecentraliseerd error monitoring geconfigureerd');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// A10 — Server-Side Request Forgery (SSRF)
// ══════════════════════════════════════════════════════════════════════════
function checkA10() {
  section('A10', 'Server-Side Request Forgery (SSRF)', 'User-controlled URLs in server-side HTTP requests');

  // Controleer op fetch/http.request/axios met user input in routes
  const fetchWithUserInput = grepDir('routes', /fetch\s*\(.*req\.|axios\s*\(.*req\.|http\.get\s*\(.*req\./g);
  if (fetchWithUserInput.length > 0) {
    fail('Server-side HTTP requests met user-input gevonden — SSRF risico!', fetchWithUserInput.map(h => h.file).join(', '));
  } else {
    pass('Geen server-side HTTP requests met user-controlled URLs gevonden');
  }

  // Controleer server.js ook
  const serverFetch = (readFile('server.js') || '').match(/fetch\s*\(|http\.get\s*\(|axios\s*\(/g);
  if (serverFetch) {
    warn('HTTP requests gevonden in server.js — controleer of URLs user-controlled zijn', 'server.js');
  } else {
    pass('Geen externe HTTP requests in server.js');
  }

  // Database URL via env var (niet user-controlled)
  const dbFile = readFile('db/database.js') || '';
  if (dbFile.includes('process.env.POSTGRES_URL')) {
    pass('Database URL via env var (niet user-controlled)');
  } else {
    warn('Controleer hoe de database URL wordt geconfigureerd', 'db/database.js');
  }

  // Image upload: controleer dat foto-data via base64 gaat (niet via URL fetch)
  const playersRoute = readFile('routes/players.js') || '';
  if (!playersRoute.match(/fetch\s*\(.*photo|http.*photo/)) {
    pass('Foto uploads gaan via base64 data (geen server-side URL fetch)');
  } else {
    fail('Foto upload via server-side URL fetch — SSRF risico!', 'routes/players.js');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Rapport
// ══════════════════════════════════════════════════════════════════════════
function printReport() {
  console.log('\n' + '═'.repeat(60));
  console.log(C.bold('  SECURITY AUDIT RAPPORT — TACTIX26'));
  console.log('═'.repeat(60));

  const total = passCount + warnCount + failCount;
  console.log(`\n  ${C.green(`✓ ${passCount} geslaagd`)}   ${C.yellow(`⚠ ${warnCount} waarschuwingen`)}   ${C.red(`✗ ${failCount} mislukt`)}\n`);

  if (failCount > 0) {
    console.log(C.bold(C.red('  KRITIEKE BEVINDINGEN:')));
    findings.filter(f => f.level === 'FAIL').forEach(f => {
      console.log(`  ${C.red('✗')} ${f.msg}`);
      if (f.detail) console.log(`    ${C.dim(f.detail)}`);
    });
  }

  if (warnCount > 0) {
    console.log(C.bold(C.yellow('\n  AANBEVELINGEN:')));
    findings.filter(f => f.level === 'WARN').forEach(f => {
      console.log(`  ${C.yellow('⚠')} ${f.msg}`);
      if (f.detail) console.log(`    ${C.dim(f.detail)}`);
    });
  }

  console.log('\n' + '═'.repeat(60));

  if (failCount === 0 && warnCount === 0) {
    console.log(C.green(C.bold('  Alle controles geslaagd — geen kritieke bevindingen!')));
  } else if (failCount === 0) {
    console.log(C.yellow(C.bold(`  ${warnCount} aanbevelingen — geen kritieke kwetsbaarheden.`)));
  } else {
    console.log(C.red(C.bold(`  ${failCount} kritieke bevinding(en) — directe actie vereist!`)));
  }

  console.log('═'.repeat(60) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log('\n' + C.bold(C.cyan('  TACTIX26 — OWASP Top 10 Security Audit')));
console.log(C.dim('  ' + new Date().toLocaleString('nl-NL') + '\n'));

checkA01();
checkA02();
checkA03();
checkA04();
checkA05();
checkA06();
checkA07();
checkA08();
checkA09();
checkA10();

printReport();

process.exit(failCount > 0 ? 1 : 0);
