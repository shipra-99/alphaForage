import React, { useRef, useEffect, useState } from 'react'
import { Send, BrainCircuit, Loader2, TrendingUp, TrendingDown, AlertTriangle, Zap } from 'lucide-react'
import { useResearchStore } from '../store/index.js'
import styles from './Research.module.css'

const EXAMPLES = [
  { icon: '📈', text: 'Is NVDA a good long-term buy at current prices?' },
  { icon: '⚖️', text: 'Compare Apple vs Microsoft for the next 3 years' },
  { icon: '🔍', text: "Analyze Tesla's bull and bear case in detail" },
  { icon: '🌍', text: 'What happens to tech stocks if Fed cuts rates 100bps?' },
  { icon: '💊', text: 'Best healthcare stocks with low P/E under 20' },
  { icon: '⚡', text: 'Undervalued AI companies with strong balance sheets' },
]

const AGENT_META = {
  technical:   { label: 'Technical',   desc: 'TA indicators & chart patterns' },
  fundamental: { label: 'Fundamental', desc: 'Financials & earnings quality' },
  sentiment:   { label: 'Sentiment',   desc: 'News & market sentiment' },
  valuation:   { label: 'Valuation',   desc: 'DCF & comparable analysis' },
  risk:        { label: 'Risk',        desc: 'Volatility & drawdown metrics' },
  macro:       { label: 'Macro',       desc: 'Macroeconomic environment' },
}

export default function Research() {
  const { messages, agentStates, isStreaming, depth, setDepth, sendQuery, clearMessages } = useResearchStore()
  const [query, setQuery] = useState('')
  const textareaRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const q = query.trim()
    if (!q || isStreaming) return
    setQuery('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendQuery(q)
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const hasAgents = Object.keys(agentStates).length > 0

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <BrainCircuit size={16} className={styles.topbarIcon} />
        <span className={styles.topbarTitle}>Research Chat</span>
        <div className={styles.depthToggle}>
          {['quick', 'full'].map(d => (
            <button
              key={d}
              className={`${styles.depthBtn} ${depth === d ? styles.depthActive : ''}`}
              onClick={() => setDepth(d)}
            >
              {d === 'quick' ? <Zap size={11} /> : null}
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <span className={styles.badge}>
          {isStreaming ? 'Analyzing…' : '7 agents ready'}
        </span>
        {messages.length > 0 && (
          <button className={styles.clearBtn} onClick={clearMessages}>Clear</button>
        )}
      </div>

      <div className={styles.body}>
        {/* Chat column */}
        <div className={styles.chatCol}>
          <div className={styles.messages}>
            {messages.length === 0 ? (
              <EmptyState onExample={(q) => { setQuery(q); textareaRef.current?.focus() }} />
            ) : (
              messages.map(msg => (
                msg.role === 'user'
                  ? <UserMessage key={msg.id} text={msg.text} />
                  : <AiMessage key={msg.id} msg={msg} />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className={styles.inputBar}>
            <div className={styles.inputWrap}>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={autoResize}
                placeholder="Analyze AAPL · Compare MSFT vs GOOGL · What if Fed cuts 100bps…"
                className={styles.textarea}
                rows={1}
                disabled={isStreaming}
              />
              <button
                className={styles.sendBtn}
                onClick={submit}
                disabled={!query.trim() || isStreaming}
              >
                {isStreaming
                  ? <Loader2 size={14} className={styles.spinning} />
                  : <Send size={14} />}
              </button>
            </div>
            <p className={styles.inputHint}>
              Enter to send · Shift+Enter for newline · AI analysis is not financial advice
            </p>
          </div>
        </div>

        {/* Agent panel */}
        {hasAgents && (
          <aside className={styles.agentPanel}>
            <div className={styles.agentPanelHeader}>
              <div className={styles.agentPanelTitle}>Agent Activity</div>
              <div className={styles.agentPanelSub}>Real-time reasoning</div>
            </div>
            <div className={styles.agentList}>
              {Object.entries(agentStates).map(([name, state]) => (
                <AgentCard key={name} name={name} state={state} />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onExample }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}><BrainCircuit size={26} /></div>
      <h2 className={styles.emptyTitle}>What do you want to research?</h2>
      <p className={styles.emptySub}>
        7 AI agents run in parallel — technical, fundamental, sentiment, valuation, risk & macro.
        Streamed live with confidence scoring and bull/bear cases.
      </p>
      <div className={styles.exampleGrid}>
        {EXAMPLES.map(ex => (
          <button key={ex.text} className={styles.exampleBtn} onClick={() => onExample(ex.text)}>
            <span className={styles.exampleIcon}>{ex.icon}</span>
            <span>{ex.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UserMessage({ text }) {
  return (
    <div className={styles.userRow}>
      <div className={styles.userBubble}>{text}</div>
    </div>
  )
}

function AiMessage({ msg }) {
  const { text, streaming, tickers, analysis } = msg
  const conf = analysis?.confidence ?? null
  const pct = conf !== null ? Math.round(conf * 100) : null
  const confColor = conf >= 0.7 ? 'var(--bull)' : conf >= 0.4 ? 'var(--warn)' : 'var(--bear)'
  const bd = analysis?.confidence_breakdown ?? {}
  const bdKeys = Object.keys(bd).filter(k => k !== 'overall')

  return (
    <div className={styles.aiRow}>
      <div className={styles.aiAvatar}>α</div>
      <div className={styles.aiContent}>
        {tickers?.length > 0 && (
          <div className={styles.tickers}>
            {tickers.map(t => <span key={t} className={styles.tickerChip}>{t}</span>)}
          </div>
        )}

        <div className={styles.aiBubble}>
          {text}
          {streaming && <span className={styles.cursor} />}
        </div>

        {!streaming && analysis && (
          <>
            {/* Confidence */}
            {conf !== null && (
              <div className={styles.confCard}>
                <div className={styles.confHeader}>
                  <span className={styles.confLabel}>AI Confidence</span>
                  <span className={styles.confPct} style={{ color: confColor }}>{pct}%</span>
                </div>
                <div className={styles.confTrack}>
                  <div
                    className={styles.confFill}
                    style={{ width: `${pct}%`, background: confColor }}
                  />
                </div>
                {bdKeys.length > 0 && (
                  <div className={styles.confBreakdown}>
                    {bdKeys.map(k => (
                      <div key={k} className={styles.confBdItem}>
                        <div className={styles.confBdVal}>{Math.round(bd[k] * 100)}%</div>
                        <div className={styles.confBdKey}>{k.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recommendation */}
            {analysis.recommendation && (
              <div className={styles.recCard}>
                <div className={styles.recLabel}>Recommendation</div>
                <div className={styles.recText}>{analysis.recommendation}</div>
              </div>
            )}

            {/* Bull / Bear */}
            {(analysis.bull_case || analysis.bear_case) && (
              <div className={styles.bbGrid}>
                <BullBearCard type="bull" data={analysis.bull_case} />
                <BullBearCard type="bear" data={analysis.bear_case} />
              </div>
            )}

            {/* Key risks */}
            {analysis.key_risks?.length > 0 && (
              <div className={styles.risksCard}>
                <div className={styles.risksLabel}><AlertTriangle size={11} /> Key Risks</div>
                {analysis.key_risks.map((r, i) => (
                  <div key={i} className={styles.riskItem}>
                    <span className={styles.riskBullet}>▸</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BullBearCard({ type, data }) {
  if (!data) return null
  const bull = type === 'bull'
  return (
    <div className={bull ? styles.bullCard : styles.bearCard}>
      <div className={styles.bbHeader}>
        {bull
          ? <><TrendingUp size={11} /><span className={styles.bullLabel}>Bull Case</span></>
          : <><TrendingDown size={11} /><span className={styles.bearLabel}>Bear Case</span></>}
        <span className={bull ? styles.bullProb : styles.bearProb}>
          {Math.round((data.probability ?? 0) * 100)}%
        </span>
      </div>
      <p className={styles.bbSummary}>{data.summary}</p>
      <ul className={styles.bbPoints}>
        {(data.key_points ?? []).map((pt, i) => (
          <li key={i} className={styles.bbPoint}>
            <span className={bull ? styles.bullDot : styles.bearDot}>{bull ? '+' : '−'}</span>
            <span>{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AgentCard({ name, state }) {
  const meta = AGENT_META[name] || { label: name, desc: '' }
  const cls = state.status === 'thinking' ? styles.agentThinking
            : state.signal === 'bullish'  ? styles.agentBull
            : state.signal === 'bearish'  ? styles.agentBear
            : styles.agentDone

  const confColor = state.confidence != null
    ? (state.confidence >= 0.7 ? 'var(--bull)' : state.confidence >= 0.4 ? 'var(--warn)' : 'var(--bear)')
    : 'var(--dim)'

  return (
    <div className={`${styles.agentCard} ${cls}`}>
      <div className={styles.agentRow}>
        {state.status === 'thinking'
          ? <div className={styles.spinner} />
          : <span className={styles.agentCheck}>✓</span>}
        <span className={styles.agentName}>{meta.label}</span>
        {state.signal && (
          <span className={
            state.signal === 'bullish' ? styles.sigBull
            : state.signal === 'bearish' ? styles.sigBear
            : styles.sigNeu
          }>{state.signal}</span>
        )}
      </div>
      <div className={styles.agentDesc}>{meta.desc}</div>
      {state.status === 'thinking' && (
        <div className={styles.dots}>
          <div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} />
        </div>
      )}
      {state.confidence != null && (
        <div className={styles.agentConfBar}>
          <div className={styles.agentConfFill} style={{ width: `${Math.round(state.confidence * 100)}%`, background: confColor }} />
        </div>
      )}
    </div>
  )
}
