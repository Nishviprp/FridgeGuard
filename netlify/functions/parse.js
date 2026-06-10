/**
 * Netlify Function: parse
 * Route:  POST /api/parse  → Claude API receipt → structured JSON items
 */
import Anthropic from '@anthropic-ai/sdk'
import { json, cors, getBody, requireAuth } from './_lib/utils.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a grocery receipt parser. Extract all food items from the provided text or list.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.
Each item MUST have exactly these fields:
- name: string (proper name, e.g. "Whole Milk", "Cheddar Cheese")
- category: one of exactly "Dairy", "Vegetable", "Fruit", "Meat", "Snack", "Beverage", "Other"
- estimatedExpiryDays: integer (realistic shelf life from purchase date)
- quantity: string (e.g. "1L", "500g", "2 pcs", "1 pack")

Shelf life reference: milk=7, eggs=21, chicken=3, beef=3, fish=2,
yogurt=14, cheese=30, butter=60, spinach=5, tomatoes=7, carrots=14,
bananas=5, apples=21, oranges=14, bread=7, juice=7, soda=180.

Example output (this exact format, no extra text):
[{"name":"Whole Milk","category":"Dairy","estimatedExpiryDays":7,"quantity":"1L"}]`

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' })

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const { text } = getBody(event)
  if (!text?.trim()) return json(400, { error: 'Receipt text is required' })

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: text.trim() }],
    })

    const raw     = message.content[0].text.trim()
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let items
    try {
      items = JSON.parse(jsonStr)
    } catch {
      return json(500, { error: 'Claude returned invalid JSON. Try rephrasing the input.' })
    }

    if (!Array.isArray(items))
      return json(500, { error: 'Unexpected response format from Claude.' })

    return json(200, { items })
  } catch (err) {
    console.error('Claude API error:', err)
    return json(500, { error: err.message || 'Receipt parsing failed' })
  }
}
