import Anthropic from '@anthropic-ai/sdk'
import { setCors, requireAuth } from './_lib/utils.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a grocery receipt parser. Extract all food items from the provided text or list.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.
Each item MUST have exactly these fields:
- name: string (proper name, e.g. "Whole Milk", "Cheddar Cheese")
- category: one of exactly "Dairy", "Vegetable", "Fruit", "Meat", "Snack", "Beverage", "Other"
- estimatedExpiryDays: integer (realistic shelf life from purchase date)
- quantity: string (e.g. "1L", "500g", "2 pcs", "1 pack")

Shelf life reference: milk=7, eggs=21, chicken breast=3, ground beef=3, fish=2,
yogurt=14, cheese=30, butter=60, spinach=5, tomatoes=7, carrots=14, bananas=5,
apples=21, oranges=14, bread=7, juice=7, soda=180.

Example output (this exact format):
[{"name":"Whole Milk","category":"Dairy","estimatedExpiryDays":7,"quantity":"1L"}]`

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res)) return

  const { text } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ error: 'Receipt text is required' })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.trim() }],
    })

    const raw = message.content[0].text.trim()
    // Strip possible markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let items
    try {
      items = JSON.parse(jsonStr)
    } catch {
      return res.status(500).json({ error: 'Claude returned invalid JSON. Try rephrasing the input.' })
    }

    if (!Array.isArray(items)) {
      return res.status(500).json({ error: 'Unexpected response format from Claude.' })
    }

    return res.status(200).json({ items })
  } catch (err) {
    console.error('Claude API error:', err)
    return res.status(500).json({ error: err.message || 'Receipt parsing failed' })
  }
}
