"""
Build and maintain category junction + aggregate snapshots (Block70 directory).

Limits CoinGecko by refreshing /coins/{id} categories only when `categories_synced_at`
is older than COINGECKO_CATEGORIES_REFRESH_DAYS (default 30).
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Sequence, Tuple

from sqlalchemy import delete, exists, func
from sqlalchemy.orm import Session

from app.models import Coin
from app.models.category_snapshot import CategoryAggregateSnapshot, CoinCryptoCategory, CryptoCategory
from app.models.market_data import MarketData
from app.services.category_slug_resolver import resolve_all_category_tags, resolve_primary_category
from app.services.connectors.coingecko_connector import fetch_coin_details

logger = logging.getLogger(__name__)

UNCATEGORIZED_SLUG = "uncategorized"
DEFAULT_REFRESH_DAYS = 30
CG_THROTTLE_SEC = float(os.getenv("COINGECKO_CATEGORY_DETAIL_DELAY", "2.5"))


def coin_categories_stale(coin: Coin) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_refresh_days())
    ts = coin.categories_synced_at
    return ts is None or ts < cutoff


def _refresh_days() -> int:
    raw = (os.getenv("COINGECKO_CATEGORIES_REFRESH_DAYS") or "").strip()
    if not raw:
        return DEFAULT_REFRESH_DAYS
    try:
        return max(1, min(365, int(raw)))
    except ValueError:
        return DEFAULT_REFRESH_DAYS


def _ensure_dim(db: Session, slug: str, name: str) -> None:
    slug = (slug or "").strip() or UNCATEGORIZED_SLUG
    name = (name or slug).strip() or slug
    row = db.query(CryptoCategory).filter(CryptoCategory.slug == slug).first()
    if row:
        if name and row.name != name and slug == UNCATEGORIZED_SLUG:
            row.name = name
        return
    db.add(CryptoCategory(slug=slug, name=name))


def apply_coingecko_categories_to_coin(
    db: Session,
    coin: Coin,
    categories_raw: Sequence[str],
    *,
    set_sync_timestamp: bool = True,
) -> None:
    """
    Replace junction rows for this coin from CoinGecko categories list.
    Updates coin.category / coin.category_slug to primary; optional categories_synced_at.
    """
    tags = resolve_all_category_tags(list(categories_raw))
    if not tags:
        # keep legacy-only rows if any; do not wipe
        return

    db.execute(delete(CoinCryptoCategory).where(CoinCryptoCategory.coin_id == coin.id))

    for rank, (_, slug) in enumerate(tags):
        _ensure_dim(db, slug, slug.replace("-", " ").title())
        db.add(
            CoinCryptoCategory(
                coin_id=coin.id,
                category_slug=slug,
                rank_in_coin=rank,
                source="coingecko",
            )
        )

    primary_disp, primary_slug = resolve_primary_category(list(categories_raw))
    if primary_disp:
        coin.category = primary_disp
    if primary_slug:
        coin.category_slug = primary_slug.strip().lower()
    elif tags:
        coin.category_slug = tags[0][1]

    if set_sync_timestamp:
        coin.categories_synced_at = datetime.now(timezone.utc)


def sync_legacy_junction_gaps(db: Session) -> int:
    """
    For coins with no junction rows, insert a single legacy assignment from
    category_slug / category text / uncategorized.
    """
    _ensure_dim(db, UNCATEGORIZED_SLUG, "Uncategorized")

    has_link = exists().where(CoinCryptoCategory.coin_id == Coin.id)
    coins = db.query(Coin).filter(~has_link).all()
    added = 0
    for coin in coins:
        slug = (coin.category_slug or "").strip().lower()
        name = (coin.category or "").strip()
        if slug:
            _ensure_dim(db, slug, name or slug.replace("-", " ").title())
            db.add(
                CoinCryptoCategory(
                    coin_id=coin.id,
                    category_slug=slug,
                    rank_in_coin=0,
                    source="legacy",
                )
            )
            added += 1
            continue
        if name:
            tags = resolve_all_category_tags([name])
            if tags:
                disp, s = tags[0]
                _ensure_dim(db, s, disp)
                db.add(
                    CoinCryptoCategory(
                        coin_id=coin.id,
                        category_slug=s,
                        rank_in_coin=0,
                        source="legacy",
                    )
                )
            else:
                db.add(
                    CoinCryptoCategory(
                        coin_id=coin.id,
                        category_slug=UNCATEGORIZED_SLUG,
                        rank_in_coin=0,
                        source="legacy",
                    )
                )
            added += 1
            continue
        db.add(
            CoinCryptoCategory(
                coin_id=coin.id,
                category_slug=UNCATEGORIZED_SLUG,
                rank_in_coin=0,
                source="legacy",
            )
        )
        added += 1
    return added


def compute_block70_score(
    price: float,
    market_cap: float,
    volume_24h: float,
    change_24h_pct: float | None,
    change_7d_pct: float | None,
) -> int:
    """Mirror apps/web/lib/coins-scanner.ts computeBlock70Score."""
    p24 = change_24h_pct if isinstance(change_24h_pct, (int, float)) and math.isfinite(change_24h_pct) else 0.0
    p7 = change_7d_pct if isinstance(change_7d_pct, (int, float)) and math.isfinite(change_7d_pct) else 0.0
    vol = max(0.0, float(volume_24h or 0.0))
    mcap = max(1.0, float(market_cap or 1.0))
    liquidity_signal = min(18.0, math.log10(vol / mcap + 1.0) * 9.0)
    mom = p24 * 0.55 + p7 * 0.45
    momentum_scaled = min(42.0, max(-42.0, mom * 1.35))
    raw = 50.0 + momentum_scaled * 0.82 + liquidity_signal * 0.45
    return int(round(min(100.0, max(0.0, raw))))


def _latest_md_map(db: Session, coin_ids: List[int]) -> Dict[int, MarketData]:
    if not coin_ids:
        return {}
    inner = (
        db.query(
            MarketData.coin_id.label("cid"),
            func.max(MarketData.timestamp).label("mx"),
        )
        .filter(MarketData.coin_id.in_(coin_ids))
        .group_by(MarketData.coin_id)
        .subquery()
    )
    rows = (
        db.query(MarketData)
        .join(
            inner,
            (MarketData.coin_id == inner.c.cid) & (MarketData.timestamp == inner.c.mx),
        )
        .all()
    )
    return {r.coin_id: r for r in rows}


def recompute_category_snapshots(db: Session) -> int:
    """
    Rebuild category_aggregate_snapshots from coins + latest market_data + junction.
    """
    sync_legacy_junction_gaps(db)

    slug_rows = db.query(CoinCryptoCategory.category_slug).distinct().all()
    slugs = [s[0] for s in slug_rows if s and s[0]]
    now = datetime.now(timezone.utc)
    updated = 0

    for slug in slugs:
        coin_ids = [
            r[0]
            for r in db.query(CoinCryptoCategory.coin_id)
            .filter(CoinCryptoCategory.category_slug == slug)
            .all()
        ]
        coins = db.query(Coin).filter(Coin.id.in_(coin_ids)).all()
        if not coins:
            continue

        dim = db.query(CryptoCategory).filter(CryptoCategory.slug == slug).first()
        display_name = dim.name if dim else slug.replace("-", " ").title()

        md_by_coin = _latest_md_map(db, [c.id for c in coins])

        scored: List[Tuple[Coin, int, float | None, float, float, float]] = []
        total_mcap = 0.0
        total_vol = 0.0
        weighted_ch = 0.0
        mcap_for_ch = 0.0

        for c in coins:
            md = md_by_coin.get(c.id)
            p = float(md.price) if md and md.price is not None else float(c.price or 0.0)
            mcap = float(md.market_cap if md and md.market_cap is not None else (c.market_cap or 0.0))
            vol = float(md.volume_24h if md and md.volume_24h is not None else (c.volume_24h or 0.0))
            p24 = md.price_change_24h if md else None
            p7 = md.price_change_7d if md else None
            score = compute_block70_score(p, mcap, vol, p24, p7)
            scored.append((c, score, p24, p, mcap, vol))
            total_mcap += max(0.0, mcap)
            total_vol += max(0.0, vol)
            if mcap > 0 and p24 is not None and isinstance(p24, (int, float)) and math.isfinite(p24):
                weighted_ch += mcap * float(p24)
                mcap_for_ch += mcap

        scored.sort(key=lambda x: -x[1])
        top = scored[:40]
        top_payload = [
            {
                "slug": c.slug,
                "name": c.name,
                "symbol": c.symbol,
                "change24hPct": (float(ch) if ch is not None and math.isfinite(float(ch)) else None),
                "block70Score": sc,
            }
            for c, sc, ch, _p, _mc, _v in top[:5]
        ]

        if top:
            avg_b70 = int(round(sum(t[1] for t in top) / len(top)))
            chans = [t[2] for t in top if t[2] is not None and isinstance(t[2], (int, float)) and math.isfinite(float(t[2]))]
            avg_ch = sum(float(x) for x in chans) / len(chans) if chans else None
        else:
            avg_b70 = 0
            avg_ch = None

        mcap_ch24 = (weighted_ch / mcap_for_ch) if mcap_for_ch > 0 else None

        row = db.query(CategoryAggregateSnapshot).filter(CategoryAggregateSnapshot.category_slug == slug).first()
        if row is None:
            row = CategoryAggregateSnapshot(
                category_slug=slug,
                name=display_name,
                computed_at=now,
                market_cap=total_mcap,
                volume_24h=total_vol,
                market_cap_change_24h=mcap_ch24,
                avg_block70=avg_b70,
                avg_change_24h=avg_ch,
                coin_count=len(coins),
                top_coins_json=json.dumps(top_payload),
            )
            db.add(row)
        else:
            row.name = display_name
            row.computed_at = now
            row.market_cap = total_mcap
            row.volume_24h = total_vol
            row.market_cap_change_24h = mcap_ch24
            row.avg_block70 = avg_b70
            row.avg_change_24h = avg_ch
            row.coin_count = len(coins)
            row.top_coins_json = json.dumps(top_payload)
        updated += 1

    db.commit()
    return updated


def refresh_stale_coin_categories_from_coingecko(db: Session, batch_size: int | None = None) -> Dict[str, int]:
    """
    Fetch /coins/{id} for coins whose categories_synced_at is null or older than TTL.
    Respects per-request throttling between calls.
    """
    batch = batch_size
    if batch is None:
        try:
            batch = max(1, int(os.getenv("COINGECKO_CATEGORY_REFRESH_BATCH", "30")))
        except ValueError:
            batch = 30

    days = _refresh_days()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(Coin)
        .filter((Coin.categories_synced_at.is_(None)) | (Coin.categories_synced_at < cutoff))
        .order_by(Coin.market_cap.desc().nullslast())
        .limit(batch)
        .all()
    )

    ok = 0
    err = 0
    for i, coin in enumerate(rows):
        if i > 0 and CG_THROTTLE_SEC > 0:
            time.sleep(CG_THROTTLE_SEC)
        try:
            payload = fetch_coin_details(coin.slug, vs_currency="usd")
            raw = payload.get("categories_raw") or []
            if raw:
                apply_coingecko_categories_to_coin(db, coin, raw, set_sync_timestamp=True)
            else:
                # No categories in payload: bump timestamp to avoid hammering broken ids
                coin.categories_synced_at = datetime.now(timezone.utc)
            ok += 1
        except Exception as e:
            logger.debug("category refresh failed for %s: %s", coin.slug, e)
            err += 1

    db.commit()
    return {"refreshed": ok, "errors": err, "batch_requested": len(rows)}


def categories_for_coin_ids(db: Session, coin_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    """Return {coin_id: [{slug, name, primary}, ...]} ordered by rank."""
    if not coin_ids:
        return {}
    rows = (
        db.query(
            CoinCryptoCategory.coin_id,
            CoinCryptoCategory.category_slug,
            CoinCryptoCategory.rank_in_coin,
            CryptoCategory.name,
        )
        .join(CryptoCategory, CryptoCategory.slug == CoinCryptoCategory.category_slug)
        .filter(CoinCryptoCategory.coin_id.in_(coin_ids))
        .order_by(CoinCryptoCategory.coin_id, CoinCryptoCategory.rank_in_coin)
        .all()
    )
    out: Dict[int, List[Dict[str, Any]]] = {}
    for cid, slug, rank, name in rows:
        out.setdefault(cid, []).append(
            {"slug": slug, "name": name or slug, "primary": rank == 0}
        )
    return out
