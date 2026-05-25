const BASE = '/api'  // proxied to http://localhost:8000 by Vite

async function get(path) {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export async function* streamResearch(query, depth = 'full') {
  const r = await fetch(BASE + '/v1/intelligence/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, depth }),
  })
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try { yield JSON.parse(line.slice(6)) } catch {}
    }
  }
}

export const api = {
  health:        ()               => get('/v1/../health'),
  quote:         (ticker)        => get(`/v1/market/stocks/${ticker}`),
  candles:       (ticker, n=60)  => get(`/v1/market/stocks/${ticker}/candles?limit=${n}`),
  fundamentals:  (ticker)        => get(`/v1/market/stocks/${ticker}/fundamentals`),
  analyst:       (ticker)        => get(`/v1/market/stocks/${ticker}/analyst`),
  news:          (ticker, n=10)  => get(`/v1/market/stocks/${ticker}/news?limit=${n}`),
  screen:        (query, limit=20) => post('/v1/screener/screen', { query, limit }),
  researchSync:  (query, depth='full') => post('/v1/intelligence/research/sync', { query, depth }),
  compare:       (tickers, query='Compare these stocks') =>
                   fetch(BASE + '/v1/intelligence/compare?' + new URLSearchParams({ query }), {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(tickers),
                   }).then(r => r.json()),
}
