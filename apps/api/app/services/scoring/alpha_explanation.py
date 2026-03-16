from __future__ import annotations

from typing import Dict

from app.models import Opportunity


def explain_alpha_for_opportunity(
    opportunity: Opportunity,
    alpha_score: float,
) -> Dict[str, str]:
    """
    Generate a structured, human-readable explanation for why an opportunity
    ranked highly in the Alpha Ranking Engine.

    Explanation factors consider:
    - high ROI
    - high confidence
    - recent signals (freshness)
    - strong liquidity
    - low risk
    """
    factors: Dict[str, str] = {}

    roi = float(getattr(opportunity, "estimated_roi_percent", 0.0) or 0.0)
    confidence = float(getattr(opportunity, "confidence_score", 0.0) or 0.0)
    freshness = float(getattr(opportunity, "freshness_score", 0.0) or 0.0)
    liquidity = float(getattr(opportunity, "liquidity_score", 0.0) or 0.0)
    risk = float(getattr(opportunity, "risk_score", 0.0) or 0.0)

    # High ROI
    if roi >= 100:
        factors["high_roi"] = f"Estimated ROI of ~{roi:.0f}% over the evaluation window."
    elif roi >= 40:
        factors["high_roi"] = f"Solid estimated ROI of ~{roi:.0f}%, attractive versus typical benchmarks."

    # High confidence
    if confidence >= 0.85:
        factors["high_confidence"] = (
            "Very high confidence score driven by consistent signals and data agreement."
        )
    elif confidence >= 0.65:
        factors["high_confidence"] = (
            "Healthy confidence score indicating multiple confirming signals."
        )

    # Recent signals / freshness
    if freshness >= 0.85:
        factors["recent_signals"] = "Signals are extremely fresh; this opportunity was detected very recently."
    elif freshness >= 0.6:
        factors["recent_signals"] = "Signals are reasonably recent, keeping this opportunity timely."

    # Strong liquidity
    if liquidity >= 0.8:
        factors["strong_liquidity"] = (
            "Strong liquidity, making it easier to size into and out of the trade."
        )
    elif liquidity >= 0.5:
        factors["strong_liquidity"] = (
            "Adequate liquidity for most position sizes."
        )

    # Low risk
    if risk <= 0.25:
        factors["low_risk"] = (
            "Risk profile is relatively low given the current data and scoring."
        )
    elif risk <= 0.45:
        factors["low_risk"] = (
            "Risk is moderate and acceptable relative to the upside on offer."
        )

    # Build a short summary tying factors together.
    pieces = []
    if "high_roi" in factors:
        pieces.append("high expected ROI")
    if "high_confidence" in factors:
        pieces.append("strong signal confidence")
    if "recent_signals" in factors:
        pieces.append("very recent detection")
    if "strong_liquidity" in factors:
        pieces.append("good liquidity")
    if "low_risk" in factors:
        pieces.append("favorable risk profile")

    if pieces:
        summary = (
            f"Ranked as alpha due to "
            + ", ".join(pieces[:-1])
            + (", and " + pieces[-1] if len(pieces) > 1 else pieces[0])
            + "."
        )
    else:
        summary = (
            "Ranked as alpha based on its overall score, balancing upside, "
            "confidence, freshness, liquidity, and risk."
        )

    factors["summary"] = summary
    factors["alpha_score"] = f"{alpha_score * 100:.0f}%"

    return factors

