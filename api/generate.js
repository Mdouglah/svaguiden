export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

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
        max_tokens: 3000,
        system: `Du är en erfaren SVA-lärare på gymnasienivå i Sverige. Du skapar KOMPLETTA, klara-att-använda lektioner för SVA-elever enligt Gy11. Läraren ska kunna ta ditt svar direkt in i klassrummet utan att förbereda något extra.

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
Kort guide (5–7 punkter) med tips för genomförandet: hur introducera texten, vad differentiera, vad extra stöd för svagare elever, utmaning för starka elever, och hur avsluta lektionen.`,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(200).json({ result: `Fel från API: ${data.error?.message || JSON.stringify(data)}` });
    }

    const text = data.content?.[0]?.text || 'Kunde inte generera lektion.';
    res.status(200).json({ result: text });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
