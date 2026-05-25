"""
Supervisor — orchestrates agents, resolves conflicts, computes confidence, synthesizes.
Replaces LangGraph StateGraph with a plain async function. Same logic, no framework overhead.
"""
import asyncio
import json
from app.agents.state import AgentState
from app.agents.base import llm_json
from app.agents.agents import (
    technical_agent, fundamental_agent, sentiment_agent,
    valuation_agent, risk_agent, macro_agent,
)

INTENT_TO_AGENTS = {
    "stock_analysis":    ["technical", "fundamental", "sentiment", "risk", "valuation"],
    "portfolio_check":   ["risk", "macro"],
    "macro_query":       ["macro", "sentiment"],
    "screener":          ["fundamental", "technical", "risk"],
    "comparison":        ["fundamental", "valuation", "risk", "technical"],
    "scenario_analysis": ["macro", "risk"],
    "event_impact":      ["macro", "sentiment", "risk"],
    "general":           ["fundamental", "sentiment"],
}

AGENT_WEIGHTS = {
    "stock_analysis": {"technical": 0.15, "fundamental": 0.30, "sentiment": 0.15, "risk": 0.15, "valuation": 0.25},
    "portfolio_check": {"risk": 0.50, "macro": 0.50},
    "macro_query": {"macro": 0.60, "sentiment": 0.40},
    "comparison": {"fundamental": 0.30, "valuation": 0.30, "risk": 0.20, "technical": 0.20},
}

AGENT_FN = {
    "technical": technical_agent,
    "fundamental": fundamental_agent,
    "sentiment": sentiment_agent,
    "valuation": valuation_agent,
    "risk": risk_agent,
    "macro": macro_agent,
}


async def parse_intent(state: AgentState) -> AgentState:
    result = await llm_json(
        system="""Parse this financial query. Respond ONLY with JSON:
{"intent":"stock_analysis"|"portfolio_check"|"macro_query"|"screener"|"comparison"|"scenario_analysis"|"event_impact"|"general","tickers":[],"timeframe":"short_term"|"long_term"|"general"}""",
        user=state.query,
        fast=True,
    )
    intent = result.get("intent", "general")
    tickers = result.get("tickers", [])
    if state.tickers:  # caller-supplied tickers take precedence
        tickers = state.tickers

    active = INTENT_TO_AGENTS.get(intent, ["fundamental", "sentiment"])
    if state.depth == "quick":
        active = active[:2]

    state.intent = intent
    state.tickers = tickers
    state.timeframe = result.get("timeframe", "general")
    state.active_agents = active
    state.stream_events.append({"type": "intent_parsed", "intent": intent, "tickers": tickers})
    return state


async def run_agents(state: AgentState) -> AgentState:
    """Run active agents in parallel, stream start/complete events."""
    tasks = []
    names = []
    for name in state.active_agents:
        fn = AGENT_FN.get(name)
        if fn:
            state.stream_events.append({"type": "agent_start", "agent": name})
            tasks.append(fn(state))
            names.append(name)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for name, result in zip(names, results):
        if isinstance(result, Exception):
            print(f"[agent error] {name}: {result}")
            continue
        setattr(state, f"{name}_output", result)
        state.stream_events.append({"type": "agent_complete", "agent": name, "signal": result.get("signal")})

    return state


def _compute_confidence(state: AgentState) -> tuple[float, dict]:
    outputs = {n: getattr(state, f"{n}_output") for n in state.active_agents if getattr(state, f"{n}_output", None)}
    if not outputs:
        return 0.3, {"data_quality": 0.3, "signal_agreement": 0.3, "overall": 0.3}

    weights = AGENT_WEIGHTS.get(state.intent, {})
    total_w = sum(weights.get(a, 0.2) for a in outputs)
    weighted_conf = sum(outputs[a].get("confidence", 0.5) * weights.get(a, 0.2) for a in outputs) / max(total_w, 0.01)

    signals = [outputs[a].get("signal") for a in outputs if outputs[a].get("signal")]
    if signals:
        dominant = max(set(signals), key=signals.count)
        agreement = signals.count(dominant) / len(signals)
    else:
        agreement = 0.5

    conflicts = []
    bullish = [k for k, v in outputs.items() if v.get("signal") == "bullish"]
    bearish = [k for k, v in outputs.items() if v.get("signal") == "bearish"]
    if bullish and bearish:
        conflicts.append({
            "between": [bullish[0], bearish[0]],
            "description": f"{bullish[0].capitalize()} bullish vs {bearish[0].capitalize()} bearish",
        })

    state.conflicts = conflicts
    conflict_penalty = len(conflicts) * 0.05
    overall = round(min(0.95, max(0.15, weighted_conf - conflict_penalty)), 3)

    return overall, {"data_quality": round(weighted_conf, 3), "signal_agreement": round(agreement, 3), "overall": overall}


async def synthesize(state: AgentState) -> AgentState:
    outputs_summary = {}
    for name in state.active_agents:
        out = getattr(state, f"{name}_output", None)
        if out:
            outputs_summary[name] = {"signal": out.get("signal"), "key_finding": out.get("key_finding"), "confidence": out.get("confidence")}

    confidence, breakdown = _compute_confidence(state)

    result = await llm_json(
        system=f"""You are a senior financial analyst synthesizing multi-agent research.

Agent outputs:
{json.dumps(outputs_summary, indent=2)}

Generate a structured JSON response:
{{"recommendation":"concise actionable recommendation (1-2 sentences)","explanation":"3-4 sentence explanation","bull_case":{{"summary":"string","key_points":["3 points"],"probability":0-1}},"bear_case":{{"summary":"string","key_points":["3 points"],"probability":0-1}},"key_risks":["3 risks"],"invalidation_conditions":["2-3 conditions"],"known_unknowns":["2-3 items"]}}

Be specific. Reference actual agent findings.""",
        user=f"Query: {state.query}\nIntent: {state.intent}\nTickers: {state.tickers}",
    )

    state.confidence = confidence
    state.confidence_breakdown = breakdown
    state.recommendation = result.get("recommendation", "")
    state.explanation = result.get("explanation", "")
    state.bull_case = result.get("bull_case", {})
    state.bear_case = result.get("bear_case", {})
    state.key_risks = result.get("key_risks", [])
    state.invalidation_conditions = result.get("invalidation_conditions", [])
    state.known_unknowns = result.get("known_unknowns", [])
    state.stream_events.append({"type": "synthesis_complete", "confidence": confidence})
    return state


async def run_research(query: str, tickers: list[str] | None = None, depth: str = "full") -> AgentState:
    """Entry point — runs the full pipeline: intent → agents → synthesis."""
    state = AgentState(query=query, tickers=tickers or [], depth=depth)
    state = await parse_intent(state)
    state = await run_agents(state)
    state = await synthesize(state)
    return state
