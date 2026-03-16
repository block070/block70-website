"""
AI Response Generator: produce human-readable answers from retrieved platform data.
"""

from __future__ import annotations

from app.services.ai.data_retrieval_engine import RetrievedData
from app.services.ai.ai_query_processor import ProcessedQuery


class ResponseGenerator:
    """
    Generate human-readable answers using retrieved data.
    No LLM required: template-based answers from real-time platform data.
    """

    def generate(
        self,
        processed: ProcessedQuery,
        data: RetrievedData,
    ) -> tuple[str, float]:
        """
        Return (response_text, confidence_score in 0..1).
        """
        intent = processed.intent
        token = processed.token_symbol
        parts: list[str] = []

        if intent == "whales_buying":
            parts.append(self._answer_whales(data))
        elif intent == "trending_narratives":
            parts.append(self._answer_narratives(data))
        elif intent == "unusual_volume":
            parts.append(self._answer_volume(data))
        elif intent == "token_info" and token:
            parts.append(self._answer_token(processed, data, token))
        else:
            parts.append(self._answer_general(processed, data))

        response_text = " ".join(p for p in parts if p).strip() or "No relevant data found for that query. Try asking about signals, narratives, or whale activity."
        confidence = self._confidence(processed, data)
        return response_text, confidence

    def _answer_whales(self, data: RetrievedData) -> str:
        if not data.wallet_activity:
            return "We don't have wallet leaderboard data available right now. Check the Smart Wallet leaderboard for top traders."
        top = data.wallet_activity[:5]
        names = [f"{w['wallet_address'][:8]}…" for w in top]
        return f"Top smart wallets by profit: {', '.join(names)}. View full leaderboard at /wallets/top for wallet activity and tokens they're buying."

    def _answer_narratives(self, data: RetrievedData) -> str:
        if not data.narratives:
            return "No narrative trend data available at the moment. Narrative scores update from market and social signals."
        top = data.narratives[:5]
        names = [n["name"] for n in top]
        return f"Trending narratives: {', '.join(names)}. See /narratives for details and related tokens."

    def _answer_volume(self, data: RetrievedData) -> str:
        if data.radar_events:
            tokens = list({e["token_symbol"] for e in data.radar_events[:5]})
            return f"Unusual activity (radar) for: {', '.join(tokens)}. Check /radar for volume spikes and events."
        if data.signals:
            by_token: dict[str, int] = {}
            for s in data.signals:
                t = s.get("token_symbol") or "?"
                by_token[t] = by_token.get(t, 0) + 1
            top_tokens = sorted(by_token.items(), key=lambda x: -x[1])[:5]
            return f"Recent signal activity by token: {', '.join(f'{t} ({c})' for t, c in top_tokens)}. See /signals for full feed."
        return "No unusual volume or radar events in the current dataset. Try /radar or /signals for live data."

    def _answer_token(
        self,
        processed: ProcessedQuery,
        data: RetrievedData,
        token: str,
    ) -> str:
        parts = [f"Data for {token}:"]
        if data.signals:
            parts.append(f"{len(data.signals)} recent signals (avg confidence {sum(s['confidence_score'] for s in data.signals) / len(data.signals) * 100:.0f}%).")
        if data.radar_events:
            parts.append(f"{len(data.radar_events)} radar events.")
        if data.capital_flows:
            parts.append(f"{len(data.capital_flows)} capital flow(s) involving {token}.")
        if data.ai_insights:
            parts.append(f"{len(data.ai_insights)} AI insight(s) mentioning {token}.")
        if data.opportunities:
            parts.append(f"{len(data.opportunities)} active opportunity/opportunities.")
        if len(parts) == 1:
            parts.append("No signals, radar, or flows in the current snapshot. Check /signals and /radar for this token.")
        return " ".join(parts) + f" View /signals/{token} and /coins/{token.lower()} for details."

    def _answer_general(self, processed: ProcessedQuery, data: RetrievedData) -> str:
        parts = []
        if data.signals:
            tokens = list({s["token_symbol"] for s in data.signals if s.get("token_symbol")})[:5]
            parts.append(f"Recent signals for: {', '.join(tokens)}.")
        if data.narratives:
            parts.append(f"Trending narratives: {', '.join(n['name'] for n in data.narratives[:3])}.")
        if data.opportunities:
            parts.append(f"Active opportunities: {len(data.opportunities)} found.")
        if data.radar_events:
            parts.append(f"Radar events: {len(data.radar_events)} in the latest data.")
        if not parts:
            return "No matching data. Try asking about 'whales buying', 'trending narratives', or 'tokens with unusual volume'."
        return " ".join(parts) + " Use the links below for full details."

    def _confidence(self, processed: ProcessedQuery, data: RetrievedData) -> float:
        score = 0.0
        if data.signals:
            score += 0.25
        if data.narratives:
            score += 0.2
        if data.opportunities:
            score += 0.2
        if data.radar_events:
            score += 0.15
        if data.ai_insights:
            score += 0.1
        if data.wallet_activity:
            score += 0.1
        if processed.token_symbol and (data.signals or data.radar_events):
            score += 0.1
        return min(1.0, score)
