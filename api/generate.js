// ─────────────────────────────────────────────────────────────
// Skapar en SVA-lektion med AI.
// Skydd: webbsidan skickar bara lärarens val (inte fri text till AI:n),
// servern kontrollerar varje val, bygger frågan själv och använder en
// fast systeminstruktion. Bara anrop från appens egen adress tillåts.
// ─────────────────────────────────────────────────────────────

// Adresser som får anropa funktionen. Fler kan läggas till i Vercel som
// miljövariabeln ALLOWED_ORIGINS (kommaseparerad), t.ex. en egen domän.
function tillatnaAdresser() {
  const lista = ['https://svaguiden.vercel.app'];
  if (process.env.VERCEL_URL) lista.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) lista.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  if (process.env.ALLOWED_ORIGINS) {
    lista.push(...process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return lista;
}

const SYSTEM = `Du är en erfaren SVA-lärare på gymnasienivå i Sverige. Du skapar KOMPLETTA, klara-att-använda lektioner för SVA-elever enligt Gy11. Läraren ska kunna ta ditt svar direkt in i klassrummet utan att förbereda något extra.

Svara ALLTID på svenska och strukturera svaret exakt så här med dessa rubriker:

## 📖 Lektionstext
Skriv en original text på 150–250 ord anpassad till elevernas nivå och det valda temat. Texten ska vara engagerande och relevant för gymnasieelever. För nybörjare: enkla meningar, vanliga ord. För avancerade: mer komplexa meningar och akademiskt språk.

## ❓ Förståelsefrågor
Skriv 5 frågor om texten, numrerade 1–5. Blanda faktafrågor och reflektionsfrågor. Anpassa svårighetsgrad till elevnivån.

## 📚 Ordlista
Lista 10 viktiga ord från texten. Format: **ord** – enkel förklaring på svenska (max en mening).

## ✍️ Skrivuppgift
En konkret skrivuppgift kopplad till texten och lektionsfokus. Ange: vad eleven ska skriva, hur långt (antal meningar/ord), och ett tydligt syfte.

## 👩‍🏫 Lärarguide
Kort guide (5–7 punkter) med tips för genomförandet: hur introducera texten, vad differentiera, vad extra stöd för svagare elever, utmaning för starka elever, och hur avsluta lektionen.`;

// Tillåtna val – samma som knapparna på sidan
const KURSER = ['SVA 1', 'SVA 2', 'SVA 3'];
const TIDER = ['Nyligen anländ (0–1 år)', '1–3 år i Sverige', 'Etablerad (3+ år)'];
const NIVAER = ['Nybörjare', 'Medelnivå', 'Avancerad'];
const FOKUS = ['Läsförståelse', 'Skrivuppgift', 'Muntlig kommunikation', 'Grammatik & struktur', 'Ordförråd & fraser', 'Litteratur & textanalys', 'Argumentation', 'Hörförståelse'];
const LANGDER = ['40 minuter', '60 minuter', '80 minuter'];

const MAX_FRITEXT = 150;   // max antal tecken i fälten modersmål, klassinfo och tema
const MAX_BODY = 2000;     // max storlek på hela förfrågan (tecken)
const MAX_TOKENS = 3000;   // tak för AI-svarets längd

function fritext(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length <= MAX_FRITEXT ? t : null;
}

// Samma text som webbsidan byggde tidigare, nu byggd på servern
function byggFraga(s) {
  let p = `Skapa en KOMPLETT lektion för ${s.kurs} på gymnasiet.\n\n`;
  p += `Elevprofil:\n- Tid i Sverige: ${s.tid}\n- Nivå: ${s.niva}\n`;
  if (s.modersmal) p += `- Modersmål: ${s.modersmal}\n`;
  if (s.klass) p += `- Klassinfo: ${s.klass}\n`;
  p += `\nLektionsfokus: ${s.fokus.join(', ')}\nLektionslängd: ${s.langd}\n`;
  if (s.tema) p += `Tema: ${s.tema}\n`;
  p += `\nLektionen ska vara klar att använda direkt i klassrummet. Anpassa textnivå, ordförråd och uppgifter exakt till elevprofilen och ${s.kurs}:s kursmål i Gy11.`;
  return p;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Endast POST är tillåtet.' });
  }

  const origin = req.headers.origin;
  if (!origin || !tillatnaAdresser().includes(origin)) {
    return res.status(403).json({ error: 'Förfrågan kommer inte från SVAGuiden.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > MAX_BODY) {
    return res.status(400).json({ error: 'Ogiltig förfrågan.' });
  }

  const val = {
    kurs: body.kurs,
    tid: body.tid,
    niva: body.niva,
    langd: body.langd,
    fokus: body.fokus,
    modersmal: fritext(body.modersmal),
    klass: fritext(body.klass),
    tema: fritext(body.tema),
  };

  const giltigt =
    KURSER.includes(val.kurs) &&
    TIDER.includes(val.tid) &&
    NIVAER.includes(val.niva) &&
    LANGDER.includes(val.langd) &&
    Array.isArray(val.fokus) && val.fokus.length > 0 && val.fokus.length <= FOKUS.length &&
    val.fokus.every((f) => FOKUS.includes(f)) &&
    val.modersmal !== null && val.klass !== null && val.tema !== null;

  if (!giltigt) {
    return res.status(400).json({ error: `Kontrollera dina val. Fritextfälten får vara högst ${MAX_FRITEXT} tecken.` });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages: [{ role: 'user', content: byggFraga(val) }]
      })
    });

    if (!response.ok) {
      // Detaljerna loggas på servern (syns i Vercels loggar), inget känsligt till besökaren
      console.error('Anthropic-fel:', response.status, await response.text());
      return res.status(502).json({ error: 'AI-tjänsten svarade inte. Försök igen om en stund.' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Kunde inte generera lektion.';
    return res.status(200).json({ result: text });

  } catch (err) {
    console.error('Serverfel:', err);
    return res.status(500).json({ error: 'Något gick fel. Försök igen.' });
  }
}
