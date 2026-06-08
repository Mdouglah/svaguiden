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
        max_tokens: 1500,
        system: `Du är en erfaren SVA-lärare och pedagogisk expert på gymnasienivå i Sverige. Du skapar detaljerade, praktiska lektionsplaner anpassade för SVA-elever på gymnasiet enligt Gy11. Svara alltid på svenska. Använd tydliga rubriker med ## och ###. Strukturera alltid lektionsplanen med: Syfte & mål, Koppling till Gy11, Lektionsstruktur (med tider), Övningar & material, Differentiering, och Bedömning.`,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(200).json({ result: `Fel från API: ${data.error?.message || JSON.stringify(data)}` });
    }

    const text = data.content?.[0]?.text || 'Kunde inte generera lektionsplan.';
    res.status(200).json({ result: text });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
