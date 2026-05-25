from typing import Optional
from dataclasses import dataclass, field


@dataclass
class AgentState:
    # Input
    query: str = ""
    depth: str = "full"       # "quick" | "full"

    # Parsed
    intent: str = "general"
    tickers: list[str] = field(default_factory=list)
    timeframe: str = "general"
    active_agents: list[str] = field(default_factory=list)

    # Per-agent outputs
    technical_output: Optional[dict] = None
    fundamental_output: Optional[dict] = None
    sentiment_output: Optional[dict] = None
    macro_output: Optional[dict] = None
    risk_output: Optional[dict] = None
    valuation_output: Optional[dict] = None

    # Synthesis
    conflicts: list[dict] = field(default_factory=list)
    confidence: float = 0.0
    confidence_breakdown: dict = field(default_factory=dict)
    evidence_chain: list[dict] = field(default_factory=list)
    bull_case: Optional[dict] = None
    bear_case: Optional[dict] = None
    recommendation: str = ""
    explanation: str = ""
    key_risks: list[str] = field(default_factory=list)
    invalidation_conditions: list[str] = field(default_factory=list)
    known_unknowns: list[str] = field(default_factory=list)

    # Streaming
    stream_events: list[dict] = field(default_factory=list)
