// Summarize a QA pair into a short topic title via the free Gemini API
// (Google AI Studio key). Called from the side panel (extension origin has
// host permission for generativelanguage.googleapis.com, so no CORS issue).

export const DEFAULT_MODEL = 'gemini-2.5-flash'

const endpoint = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

export async function summarize(
  apiKey: string,
  model: string,
  question: string,
  answer: string,
): Promise<string> {
  const prompt =
    `為以下這組「提問＋回答」取一個精簡的主題標題，讓人一眼看懂這段在講什麼。\n` +
    `要求：繁體中文、最多 14 個字、只輸出標題本身，不要引號、標點或任何說明。\n\n` +
    `提問：${question}\n\n回答：${answer.slice(0, 1500)}`

  const res = await fetch(endpoint(model || DEFAULT_MODEL, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 40 },
    }),
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Gemini 免費額度暫時用完了（429）。請稍後再試、換一把金鑰，或改用其他模型（⚙）。')
    }
    const body = (await res.text()).slice(0, 200)
    throw new Error(`Gemini API ${res.status}：${body}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return text
    .trim()
    .replace(/^["「『]+|["」』]+$/g, '')
    .replace(/\n+/g, ' ')
    .slice(0, 30)
}
