"""
Signal Detection Engine.

Generates normalized Signal records from data pipelines. Sources include:
- wallet activity
- market data
- radar engine (RadarSignal)
- liquidity monitor
- social signals

All outputs are normalized to the app.models.Signal shape and can be persisted.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import RadarSignal, Signal, OpportunitySignal, Opportunity
from app.services.signals.wallet_signals import WalletSignal
from app.services.signals.social_signals import SocialActivitySignal


def _signal_already_persisted_for_radar(db: Session, radar: RadarSignal) -> bool:
    """
    Best-effort dedupe to avoid re-inserting the same signal every scheduler tick.

    We match on core dimensions and a tight created_at window around the radar signal.
    This avoids adding schema/migrations while keeping inserts bounded.
    """
    if radar.created_at is None:
        return False
    source = radar.source or "radar"
    window_start = radar.created_at.replace()  # keep tzinfo
    window_end = radar.created_at.replace()
    from datetime import timedelta

    window_start = radar.created_at - timedelta(minutes=2)
    window_end = radar.created_at + timedelta(minutes=2)

    q = (
        db.query(Signal)
        .filter(Signal.signal_type == radar.signal_type)
        .filter(Signal.chain == radar.chain)
        .filter(Signal.source == source)
    )
    # token_symbol can be null; keep the match symmetric
    if radar.token_symbol is None:
        q = q.filter(Signal.token_symbol.is_(None))
    else:
        q = q.filter(Signal.token_symbol == radar.token_symbol)

    q = q.filter(Signal.created_at >= window_start).filter(Signal.created_at <= window_end)
    return q.first() is not None


def _radar_to_signal(radar: RadarSignal) -> Signal:
    """Convert a RadarSignal to a normalized Signal (in-memory, not persisted)."""
    title = _title_for_signal_type(radar.signal_type, radar.token_symbol)
    description = _description_for_signal_type(
        radar.signal_type,
        radar.token_symbol,
        radar.metadata_json,
    )
    token_address: Optional[str] = None
    if radar.metadata_json and isinstance(radar.metadata_json, dict):
        token_address = (radar.metadata_json.get("token_address") or
                        radar.metadata_json.get("token_addresses"))
        if isinstance(token_address, list):
            token_address = token_address[0] if token_address else None
    return Signal(
        signal_type=radar.signal_type,
        token_symbol=radar.token_symbol,
        token_address=token_address,
        chain=radar.chain,
        title=title,
        description=description,
        signal_strength=float(radar.signal_strength or 0.0),
        confidence_score=float(radar.confidence_score or 0.0),
        source=radar.source or "radar",
        metadata_json=dict(radar.metadata_json) if radar.metadata_json else None,
    )


def _title_for_signal_type(signal_type: str, token_symbol: Optional[str]) -> str:
    token = token_symbol or "token"
    if signal_type == "wallet_accumulation":
        return f"Wallet accumulation: {token}"
    if signal_type == "large_buy":
        return f"Large buy: {token}"
    if signal_type == "large_sell":
        return f"Large sell: {token}"
    if signal_type == "dex_volume_spike":
        return f"DEX volume spike: {token}"
    if signal_type == "liquidity_increase":
        return f"Liquidity increase: {token}"
    if signal_type == "liquidity_drop":
        return f"Liquidity drop: {token}"
    if signal_type == "volume_spike":
        return f"Volume spike: {token}"
    if signal_type == "social_mentions_spike":
        return f"Social mentions spike: {token}"
    if signal_type == "dev_activity_spike":
        return f"Dev activity spike: {token}"
    if signal_type == "radar_event":
        return f"Radar event: {token}"
    return f"{signal_type}: {token}"


def _description_for_signal_type(
    signal_type: str,
    token_symbol: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> str:
    meta = metadata or {}
    if signal_type == "wallet_accumulation":
        usd = meta.get("usd_value")
        return f"Wallet accumulation for {token_symbol or 'token'}" + (
            f" (${usd:,.0f})" if isinstance(usd, (int, float)) else ""
        )
    if signal_type in ("liquidity_increase", "liquidity_drop", "volume_spike"):
        pct = meta.get("change_percent")
        return f"{signal_type.replace('_', ' ')} for {token_symbol or 'token'}" + (
            f" ({pct}% change)" if pct is not None else ""
        )
    if signal_type == "social_mentions_spike":
        return f"Social mentions spike for {token_symbol or 'token'}"
    if signal_type == "dev_activity_spike":
        return f"Developer activity spike (commits/contributors)"
    return f"Signal: {signal_type} for {token_symbol or 'token'}"


class SignalDetectionEngine:
    """
    Generates normalized Signal records from wallet, market, radar, liquidity,
    and social pipelines. Use run_from_radar() to backfill from existing
    RadarSignal rows, or use the from_* methods to convert pipeline outputs
    into Signal records.
    """

    def __init__(self) -> None:
        pass

    def from_radar_signals(
        self,
        db: Session,
        radar_signals: List[RadarSignal],
        *,
        persist: bool = True,
    ) -> List[Signal]:
        """
        Convert RadarSignal records (from radar engine, liquidity monitor, etc.)
        into normalized Signal records. Optionally persist to the signals table.
        """
        if not radar_signals:
            return []
        out: List[Signal] = []
        for r in radar_signals:
            if persist and _signal_already_persisted_for_radar(db, r):
                continue
            sig = _radar_to_signal(r)
            if r.created_at:
                # Signal.created_at is server_default; for in-memory copy we keep radar time
                pass
            if persist:
                db.add(sig)
                out.append(sig)
            else:
                out.append(sig)
        if persist and out:
            db.commit()
            for s in out:
                db.refresh(s)
        return out

    def from_wallet_signals(
        self,
        db: Session,
        wallet_signals: List[WalletSignal],
        *,
        chain: Optional[str] = None,
        persist: bool = True,
    ) -> List[Signal]:
        """Convert WalletSignal records into normalized Signal records."""
        if not wallet_signals:
            return []
        out: List[Signal] = []
        for w in wallet_signals:
            title = _title_for_signal_type(w.signal_type, w.token_symbol)
            description = (
                f"Wallet {w.signal_type.replace('_', ' ')} for {w.token_symbol} "
                f"(${w.usd_value:,.0f})"
            )
            sig = Signal(
                signal_type=w.signal_type,
                token_symbol=w.token_symbol,
                token_address=None,
                chain=chain,
                title=title,
                description=description,
                signal_strength=min(1.0, (w.usd_value / 1_000_000.0) * 0.5 + w.confidence * 0.5),
                confidence_score=w.confidence,
                source="wallet_activity",
                metadata_json={
                    "wallet_address": w.wallet_address,
                    "usd_value": w.usd_value,
                    "timestamp": w.timestamp.isoformat() if w.timestamp else None,
                },
            )
            if persist:
                db.add(sig)
                out.append(sig)
            else:
                out.append(sig)
        if persist and out:
            db.commit()
            for s in out:
                db.refresh(s)
        return out

    def from_social_signals(
        self,
        db: Session,
        social_signals: List[SocialActivitySignal],
        *,
        chain: Optional[str] = None,
        persist: bool = True,
    ) -> List[Signal]:
        """Convert SocialActivitySignal records into normalized Signal records."""
        if not social_signals:
            return []
        out: List[Signal] = []
        for s in social_signals:
            title = _title_for_signal_type(s.signal_type, s.token_symbol)
            description = f"Social: {s.signal_type.replace('_', ' ')} for {s.token_symbol}"
            sig = Signal(
                signal_type=s.signal_type,
                token_symbol=s.token_symbol,
                token_address=None,
                chain=chain,
                title=title,
                description=description,
                signal_strength=s.signal_strength,
                confidence_score=s.confidence_score,
                source="social_signals",
                metadata_json={
                    "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                },
            )
            if persist:
                db.add(sig)
                out.append(sig)
            else:
                out.append(sig)
        if persist and out:
            db.commit()
            for s in out:
                db.refresh(s)
        return out

    def from_market_data(
        self,
        db: Session,
        token_symbol: str,
        token_address: Optional[str],
        chain: Optional[str],
        *,
        signal_type: str = "market_volume_spike",
        title: Optional[str] = None,
        description: Optional[str] = None,
        signal_strength: float = 0.0,
        confidence_score: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None,
        persist: bool = True,
    ) -> Signal:
        """
        Create a single Signal from market data pipeline (e.g. volume/mcap move).
        """
        sig = Signal(
            signal_type=signal_type,
            token_symbol=token_symbol,
            token_address=token_address,
            chain=chain,
            title=title or f"Market: {signal_type} for {token_symbol}",
            description=description or f"Market data signal for {token_symbol}",
            signal_strength=signal_strength,
            confidence_score=confidence_score,
            source="market_data",
            metadata_json=metadata,
        )
        if persist:
            db.add(sig)
            db.commit()
            db.refresh(sig)
        return sig

    def run_from_radar(
        self,
        db: Session,
        since: Optional[datetime] = None,
        *,
        limit: int = 500,
    ) -> List[Signal]:
        """
        Load RadarSignal rows from the database (optionally since a time),
        convert to normalized Signal records, and persist to the signals table.
        Use this to backfill or sync signals from the radar/liquidity/social
        pipelines that already write RadarSignal.
        """
        q = db.query(RadarSignal).order_by(RadarSignal.created_at.desc())
        if since is not None:
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
            q = q.filter(RadarSignal.created_at >= since)
        radar_list: List[RadarSignal] = q.limit(limit).all()
        return self.from_radar_signals(db, radar_list, persist=True)

    def run_from_opportunity_signals(
        self,
        db: Session,
        since: Optional[datetime] = None,
        *,
        limit: int = 500,
    ) -> List[Signal]:
        """
        Convert recent OpportunitySignal rows into normalized Signal rows.

        This ensures /signals can show real data even when RadarSignal producers
        are quiet, as long as real pipelines (wallet/arbitrage) are emitting
        OpportunitySignal rows.
        """
        q = db.query(OpportunitySignal, Opportunity).outerjoin(
            Opportunity, Opportunity.id == OpportunitySignal.opportunity_id
        ).order_by(OpportunitySignal.created_at.desc())
        if since is not None:
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
            q = q.filter(OpportunitySignal.created_at >= since)

        rows = q.limit(limit).all()
        out: List[Signal] = []
        for sig_row, opp in rows:
            payload = sig_row.payload or {}
            token_symbol = None
            if isinstance(payload, dict):
                token_symbol = payload.get("token_symbol") or payload.get("pair")
            if not token_symbol and opp is not None:
                token_symbol = opp.base_symbol or opp.asset_symbol
            token_symbol = str(token_symbol).split("/")[0] if token_symbol else None

            s = Signal(
                signal_type=sig_row.signal_type,
                token_symbol=token_symbol,
                token_address=None,
                chain=(opp.chain if opp is not None else None),
                title=_title_for_signal_type(sig_row.signal_type, token_symbol),
                description=None,
                signal_strength=min(1.0, float(sig_row.confidence or 0.0)),
                confidence_score=float(sig_row.confidence or 0.0),
                source=sig_row.source or (opp.source if opp is not None else None) or "opportunity_signals",
                metadata_json={"opportunity_id": sig_row.opportunity_id, "value": sig_row.signal_value},
            )
            db.add(s)
            out.append(s)

        if out:
            db.commit()
            for s in out:
                db.refresh(s)
        return out
