import { create } from 'zustand'
import { streamResearch, api } from '../lib/api.js'

let msgId = 0
const uid = () => `m${++msgId}`

export const useResearchStore = create((set, get) => ({
  messages: [],
  agentStates: {},   // { [agentName]: { status, signal, confidence } }
  isStreaming: false,
  depth: 'full',

  setDepth: (d) => set({ depth: d }),

  clearMessages: () => set({ messages: [], agentStates: {} }),

  sendQuery: async (query) => {
    if (get().isStreaming) return
    const { depth } = get()

    const userMsg = { id: uid(), role: 'user', text: query }
    const aiId = uid()
    const aiMsg = { id: aiId, role: 'ai', text: 'Routing to agents…', streaming: true, tickers: [], analysis: null }

    set(s => ({
      messages: [...s.messages, userMsg, aiMsg],
      agentStates: {},
      isStreaming: true,
    }))

    const patch = (updater) => set(s => ({
      messages: s.messages.map(m => m.id === aiId ? { ...m, ...updater(m) } : m),
    }))

    try {
      for await (const event of streamResearch(query, depth)) {
        if (event.type === 'intent_parsed') {
          patch(m => ({ tickers: event.tickers || m.tickers }))
        }
        if (event.type === 'agent_start') {
          set(s => ({ agentStates: { ...s.agentStates, [event.agent]: { status: 'thinking', signal: null, confidence: null } } }))
        }
        if (event.type === 'agent_complete') {
          set(s => ({ agentStates: { ...s.agentStates, [event.agent]: { ...s.agentStates[event.agent], status: 'done', signal: event.signal } } }))
        }
        if (event.type === 'synthesis_complete') {
          patch(() => ({ text: 'Synthesizing…' }))
        }
        if (event.type === 'result') {
          // enrich agent confidences
          set(s => {
            const next = { ...s.agentStates }
            Object.entries(event.agent_outputs || {}).forEach(([name, out]) => {
              if (next[name]) next[name] = { ...next[name], confidence: out.confidence }
            })
            return { agentStates: next }
          })
          patch(() => ({
            text: event.explanation || event.recommendation || 'Analysis complete.',
            streaming: false,
            tickers: event.tickers || [],
            analysis: {
              confidence: event.confidence,
              confidence_breakdown: event.confidence_breakdown,
              recommendation: event.recommendation,
              explanation: event.explanation,
              bull_case: event.bull_case,
              bear_case: event.bear_case,
              key_risks: event.key_risks,
              invalidation_conditions: event.invalidation_conditions,
              known_unknowns: event.known_unknowns,
              agents_activated: event.agents_activated,
            },
          }))
        }
        if (event.type === 'error') {
          patch(() => ({ text: `Error: ${event.message}`, streaming: false }))
        }
      }
    } catch (err) {
      patch(() => ({ text: `Connection error: ${err.message}. Is the API running on :8000?`, streaming: false }))
    }

    set({ isStreaming: false })
  },
}))

export const useMarketStore = create((set, get) => ({
  cache: {},
  loading: {},

  fetch: async (ticker) => {
    if (get().loading[ticker]) return
    set(s => ({ loading: { ...s.loading, [ticker]: true } }))
    try {
      const data = await api.quote(ticker)
      set(s => ({ cache: { ...s.cache, [ticker]: data } }))
    } catch {}
    set(s => ({ loading: { ...s.loading, [ticker]: false } }))
  },
}))
