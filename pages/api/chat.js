export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, systemPrompt } = req.body
  if (!messages || !systemPrompt) return res.status(400).json({ error: 'Missing fields' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: err })
    }

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || 'No response.'
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
