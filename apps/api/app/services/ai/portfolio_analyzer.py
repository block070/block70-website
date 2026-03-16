"""
AI Copilot: analyze user portfolios for risk concentration, opportunities, whale overlap.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.models import (
    Portfolio,
    PortfolioTokenBalance,
    RadarEvent,
    CapitalFlow,
    SmartWallet,
)
from app.services.portfolio.smart_money_overlap import detect_smart_money_overlap


@dataclass
class PortfolioRiskConcentration:
    """Risk concentration in a single token or small set."""
    token_symbol: str
    allocation_pct: float
    value_usd: float
    risk_level: str  # low | medium | high


@dataclass
class PortfolioOpportunity:
    """Opportunity detected for a portfolio token."""
    token_symbol: str
    reason: str
    confidence: float


@dataclass
class WhaleOverlapItem:
    """Portfolio token with overlapping smart-money / whale activity."""
    token_symbol: str
    overlap_type: str  # radar_event | capital_flow | smart_wallet
    description: str


@dataclass
class PortfolioAnalysisResult:
    """Full portfolio analysis for the Copilot."""
    risk_concentrations: List[PortfolioRiskConcentration]
    opportunities: List[PortfolioOpportunity]
    whale_overlaps: List[WhaleOverlapItem]
    portfolio_tokens: List[str]
    total_value_usd: float


class PortfolioAnalyzer:
    """
    Analyze user portfolios: risk concentration, opportunities, whale overlap.
    """

    def analyze(
        self,
        db: Session,
        user_id: int,
        *,
        risk_allocation_threshold_pct: float = 40.0,
    ) -> PortfolioAnalysisResult:
        """Run full portfolio analysis for a user."""
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
        if not portfolio:
            return PortfolioAnalysisResult(
                risk_concentrations=[],
                opportunities=[],
                whale_overlaps=[],
                portfolio_tokens=[],
                total_value_usd=0.0,
            )

        balances = (
            db.query(PortfolioTokenBalance)
            .filter(PortfolioTokenBalance.portfolio_id == portfolio.id)
            .all()
        )
        total = float(portfolio.total_value_usd or 0.0)
        if total <= 0 and balances:
            total = sum(float(b.value_usd or 0) for b in balances)

        tokens = [b.token_symbol for b in balances]
        risk_concentrations = self._risk_concentration(balances, total, risk_allocation_threshold_pct)
        opportunities = self._detect_opportunities(db, tokens)
        whale_overlaps = self._whale_overlap(db, portfolio, tokens)

        return PortfolioAnalysisResult(
            risk_concentrations=risk_concentrations,
            opportunities=opportunities,
            whale_overlaps=whale_overlaps,
            portfolio_tokens=tokens,
            total_value_usd=total,
        )

    def _risk_concentration(
        self,
        balances: List[PortfolioTokenBalance],
        total_usd: float,
        threshold_pct: float,
    ) -> List[PortfolioRiskConcentration]:
        out = []
        if total_usd <= 0:
            return out
        for b in balances:
            val = float(b.value_usd or 0)
            pct = (val / total_usd) * 100.0
            if pct >= threshold_pct:
                risk = "high" if pct >= 60 else "medium"
                out.append(
                    PortfolioRiskConcentration(
                        token_symbol=b.token_symbol,
                        allocation_pct=pct,
                        value_usd=val,
                        risk_level=risk,
                    )
                )
        return out

    def _detect_opportunities(
        self,
        db: Session,
        portfolio_tokens: List[str],
    ) -> List[PortfolioOpportunity]:
        out = []
        for symbol in portfolio_tokens[:20]:
            events = (
                db.query(RadarEvent)
                .filter(RadarEvent.token_symbol == symbol)
                .order_by(RadarEvent.created_at.desc())
                .limit(5)
                .all()
            )
            if events:
                severity_avg = sum(e.severity_score for e in events) / len(events)
                if severity_avg >= 0.5:
                    out.append(
                        PortfolioOpportunity(
                            token_symbol=symbol,
                            reason="Recent radar activity (volume/price/liquidity)",
                            confidence=min(1.0, severity_avg),
                        )
                    )
        return out

    def _whale_overlap(
        self,
        db: Session,
        portfolio: Portfolio,
        portfolio_tokens: List[str],
    ) -> List[WhaleOverlapItem]:
        out = []
        if not portfolio_tokens:
            return out

        for symbol in portfolio_tokens:
            events = (
                db.query(RadarEvent)
                .filter(RadarEvent.token_symbol == symbol)
                .order_by(RadarEvent.created_at.desc())
                .limit(3)
                .all()
            )
            for e in events:
                if (e.event_type or "").lower().find("whale") >= 0 or (e.description or "").lower().find("whale") >= 0:
                    out.append(
                        WhaleOverlapItem(
                            token_symbol=symbol,
                            overlap_type="radar_event",
                            description=e.description or f"{e.event_type}",
                        )
                    )
                    break

            flow = (
                db.query(CapitalFlow)
                .filter(
                    (CapitalFlow.source_asset == symbol) | (CapitalFlow.destination_asset == symbol),
                )
                .order_by(CapitalFlow.timestamp.desc())
                .first()
            )
            if flow and flow.amount and float(flow.amount) > 1_000_000:
                out.append(
                    WhaleOverlapItem(
                        token_symbol=symbol,
                        overlap_type="capital_flow",
                        description=f"Large flow: ${flow.amount:,.0f}",
                    )
                )

        overlap_list = detect_smart_money_overlap(db, portfolio.id)
        for item in overlap_list:
            if isinstance(item, dict):
                sym = item.get("token_symbol") or item.get("symbol")
                if sym and sym not in [o.token_symbol for o in out]:
                    out.append(
                        WhaleOverlapItem(
                            token_symbol=sym,
                            overlap_type="smart_wallet",
                            description=item.get("message", "Smart money overlap"),
                        )
                    )
        return out
