#!/usr/bin/env python3
"""
Insert sample active narrative opportunities so /api/v1/narratives/* and the web
narratives dashboard have data to show.

Idempotent: skips slugs that already exist.

Run inside the API container from /app:

    docker compose exec api python scripts/seed_narrative_opportunities.py

Optional: delete seeded rows (by slug prefix) then re-seed:

    docker compose exec api python scripts/seed_narrative_opportunities.py --replace
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models import Opportunity, OpportunityStatus

SEED_SLUG_PREFIX = "seed-narrative-dashboard-"

SAMPLES: list[dict] = [
    {
        "title": "AI infrastructure narrative gaining traction",
        "slug": f"{SEED_SLUG_PREFIX}ai-infra-btc",
        "asset_symbol": "BTC",
        "summary": (
            "Synthetic seed: AI / compute narrative cluster tied to BTC as anchor "
            "so the intelligence dashboard can aggregate attention and sentiment."
        ),
        "total_score": 0.72,
        "confidence_score": 0.65,
        "upside_score": 0.55,
        "risk_score": 0.25,
        "freshness_score": 0.9,
        "risk_level": "medium",
        "source": "seed_script",
    },
    {
        "title": "Real-world assets narrative gaining traction",
        "slug": f"{SEED_SLUG_PREFIX}rwa-eth",
        "asset_symbol": "ETH",
        "summary": (
            "Synthetic seed: RWA / tokenization narrative for dashboard sparklines."
        ),
        "total_score": 0.68,
        "confidence_score": 0.62,
        "upside_score": 0.52,
        "risk_score": 0.3,
        "freshness_score": 0.85,
        "risk_level": "medium",
        "source": "seed_script",
    },
    {
        "title": "Meme rotation narrative gaining traction",
        "slug": f"{SEED_SLUG_PREFIX}meme-sol",
        "asset_symbol": "SOL",
        "summary": "Synthetic seed: liquidity / meme rotation narrative cluster.",
        "total_score": 0.55,
        "confidence_score": 0.5,
        "upside_score": 0.48,
        "risk_score": 0.45,
        "freshness_score": 0.8,
        "risk_level": "high",
        "source": "seed_script",
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replace",
        action="store_true",
        help=f"Delete existing rows with slug starting with {SEED_SLUG_PREFIX!r}, then insert.",
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        if args.replace:
            deleted = (
                db.query(Opportunity)
                .filter(Opportunity.slug.startswith(SEED_SLUG_PREFIX))
                .delete(synchronize_session=False)
            )
            db.commit()
            print(f"Removed {deleted} existing seed narrative row(s).")

        inserted = 0
        skipped = 0
        for row in SAMPLES:
            exists = (
                db.query(Opportunity.id)
                .filter(Opportunity.slug == row["slug"])
                .first()
            )
            if exists:
                skipped += 1
                continue
            o = Opportunity(
                title=row["title"],
                slug=row["slug"],
                type="narrative",
                chain=None,
                status=OpportunityStatus.ACTIVE.value,
                summary=row["summary"],
                thesis=None,
                asset_symbol=row["asset_symbol"],
                base_symbol=row["asset_symbol"],
                quote_symbol=None,
                source=row["source"],
                source_ref=None,
                estimated_cost=None,
                estimated_upside=None,
                estimated_roi_percent=None,
                confidence_score=row["confidence_score"],
                upside_score=row["upside_score"],
                freshness_score=row["freshness_score"],
                liquidity_score=0.0,
                accessibility_score=0.0,
                risk_score=row["risk_score"],
                difficulty_score=0.0,
                total_score=row["total_score"],
                risk_level=row["risk_level"],
                difficulty_level=None,
                detected_at=now,
                expires_at=None,
                last_seen_at=now,
                dedup_key=f"seed:{row['slug']}",
                raw_payload={"seed": True},
            )
            db.add(o)
            inserted += 1

        db.commit()
        print(f"Inserted {inserted} narrative opportunity(ies), skipped {skipped} (already present).")
        if inserted or args.replace:
            print(
                "Verify: curl -sS http://localhost:8000/api/v1/narratives/trending?limit=5 | head -c 400"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
