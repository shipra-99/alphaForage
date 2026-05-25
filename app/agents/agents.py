"""
All sub-agents — same logic as before, consolidated into one file.
Each agent: fetch data → LLM analysis → return structured output.
"""
import asyncio
import json
import math
from app.agents.state import AgentState
from app.agents.base import llm_json, get_quote, get_candles, get_fundamentals, get_analyst, get_news


# ── Shared technical indicators ───────────────────────────────────────────────

def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    gains = [max(closes[i] - closes[i-1], 0) for i in range(1, len(closes))]
    losses = [max(closes[i-1] - closes[i], 0) for i in range(1, len(closes))]
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 2)


def _sma(closes: list[float], period: int) -> float:
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    return round(sum(closes[-period:]) / period, 4)


def _volatility(closes: list[float]) -> float:
    if len(closes) < 2:
        return 0.0
    returns = [(closes[i] - closes[i-1]) / closes[i-1] for i in range(1, len(closes))]
    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / len(returns)
    return round(math.sqrt(variance) * math.sqrt(252) * 100, 2)


def _max_drawdown(closes: list[float]) -> float:
    if not closes:
        return 0.0
    peak = closes[0]
    max_dd = 0.0
    for p in closes:
        if p > peak:
            peak = p
        dd = (peak - p) / peak
        if dd > max_dd:
            max_dd = dd
    return round(-max_dd * 100, 2)


# ── Technical ─────────────────────────────────────────────────────────────────

async def technical_agent(state: AgentState) -> dict:
    ticker = state.tickers[0] if state.tickers else None
    if not ticker:
        return {"signal": "neutral", "confidence": 0.3, "key_finding": "No ticker", "data": {}}

    candles = await get_candles(ticker, "1d", 60)
    closes = [c["close"] for c in candles if c.get("close")]

    rsi = _rsi(closes)
    sma20, sma50, sma200 = _sma(closes, 20), _sma(closes, 50), _sma(closes, 200)
    price = closes[-1] if closes else 0

    indicators = {
        "rsi_14": rsi, "sma_20": sma20, "sma_50": sma50, "sma_200": sma200,
        "price": price, "above_sma50": price > sma50, "golden_cross": sma50 > sma200,
    }

    result = await llm_json(
        system="""You are a technical analysis agent. Analyze indicators and return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","trend":"uptrend"|"downtrend"|"sideways","key_levels":{"support":number,"resistance":number},"signals":[]}""",
        user=f"Ticker: {ticker}\nIndicators: {json.dumps(indicators)}",
        fast=True,
    )
    result["data"] = indicators
    return result or {"signal": "neutral", "confidence": 0.5, "key_finding": f"RSI={rsi}", "data": indicators}


# ── Fundamental ───────────────────────────────────────────────────────────────

async def fundamental_agent(state: AgentState) -> dict:
    ticker = state.tickers[0] if state.tickers else None
    if not ticker:
        return {"signal": "neutral", "confidence": 0.3, "key_finding": "No ticker", "data": {}}

    fundamentals, analyst = await asyncio.gather(
        get_fundamentals(ticker), get_analyst(ticker), return_exceptions=True
    )
    if isinstance(fundamentals, Exception): fundamentals = {}
    if isinstance(analyst, Exception): analyst = {}

    result = await llm_json(
        system="""You are a fundamental analysis agent. Return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","quality_score":0-10,"growth_trajectory":"accelerating"|"decelerating"|"stable"|"declining","balance_sheet_health":"strong"|"adequate"|"concerning"|"weak","earnings_quality":"high"|"medium"|"low","red_flags":[],"data":{}}""",
        user=f"Ticker: {ticker}\nRatios: {json.dumps(fundamentals or {})}\nAnalyst: {json.dumps(analyst or {})}",
    )
    result["data"] = {**(fundamentals or {}), "analyst": analyst}
    return result


# ── Sentiment ─────────────────────────────────────────────────────────────────

async def sentiment_agent(state: AgentState) -> dict:
    ticker = state.tickers[0] if state.tickers else None
    news_items = await get_news(ticker, 10) if ticker else []
    news_text = "\n".join(f"- {n.get('title','')}" for n in news_items[:6])

    result = await llm_json(
        system="""You are a sentiment analysis agent. Return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","overall_sentiment":-1.0_to_1.0,"sentiment_trend":"improving"|"deteriorating"|"stable","news_summary":"2-3 sentences","key_catalysts":[],"risk_events":[]}""",
        user=f"Ticker: {ticker or 'N/A'}\nNews:\n{news_text or 'No news'}",
        fast=True,
    )
    result["data"] = {"news_count": len(news_items)}
    return result


# ── Valuation ─────────────────────────────────────────────────────────────────

async def valuation_agent(state: AgentState) -> dict:
    ticker = state.tickers[0] if state.tickers else None
    if not ticker:
        return {"signal": "neutral", "confidence": 0.3, "key_finding": "No ticker", "data": {}}

    fundamentals, quote = await asyncio.gather(
        get_fundamentals(ticker), get_quote(ticker), return_exceptions=True
    )
    if isinstance(fundamentals, Exception): fundamentals = {}
    if isinstance(quote, Exception): quote = {}
    price = (quote or {}).get("price", 0)

    result = await llm_json(
        system="""You are a valuation agent. Return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","fair_value_range":{"bear":number,"base":number,"bull":number},"current_premium_discount":number,"valuation_method":"string","margin_of_safety":number,"is_undervalued":boolean,"valuation_commentary":"2-3 sentences"}""",
        user=f"Ticker: {ticker}\nPrice: {price}\nRatios: {json.dumps(fundamentals or {})}",
    )
    result["data"] = {"price": price}
    return result


# ── Risk ──────────────────────────────────────────────────────────────────────

async def risk_agent(state: AgentState) -> dict:
    ticker = state.tickers[0] if state.tickers else None
    closes = []
    fundamentals = {}
    if ticker:
        candles, fund = await asyncio.gather(
            get_candles(ticker, "1d", 252), get_fundamentals(ticker), return_exceptions=True
        )
        closes = [c["close"] for c in (candles if isinstance(candles, list) else []) if c.get("close")]
        fundamentals = fund if isinstance(fund, dict) else {}

    vol = _volatility(closes)
    mdd = _max_drawdown(closes)
    beta = (fundamentals or {}).get("beta", 1.0) or 1.0

    risk_data = {"annual_volatility_pct": vol, "max_drawdown_pct": mdd, "beta": beta,
                 "debt_to_equity": (fundamentals or {}).get("debt_to_equity"),
                 "current_ratio": (fundamentals or {}).get("current_ratio")}

    result = await llm_json(
        system="""You are a risk analysis agent. Return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","risk_level":"low"|"medium"|"high"|"very_high","var_1d_pct":number,"key_risks":[],"risk_mitigants":[]}""",
        user=f"Ticker: {ticker or 'N/A'}\nRisk Metrics: {json.dumps(risk_data)}",
        fast=True,
    )
    result["data"] = risk_data
    return result


# ── Macro ─────────────────────────────────────────────────────────────────────

async def macro_agent(state: AgentState) -> dict:
    result = await llm_json(
        system="""You are a macro analyst. Assess the macroeconomic environment relevant to this query. Return JSON:
{"signal":"bullish"|"bearish"|"neutral","confidence":0-1,"key_finding":"1 sentence","rate_environment":"rising"|"falling"|"stable","inflation_trend":"rising"|"falling"|"stable","economic_cycle":"expansion"|"peak"|"contraction"|"trough","key_risks":[],"sector_impacts":{}}""",
        user=f"Query: {state.query}\nTickers: {state.tickers}",
        fast=True,
    )
    return result
