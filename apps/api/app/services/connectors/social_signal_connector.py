from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List


@dataclass
class SocialActivityRaw:
    """
    Normalized social activity snapshot for a token or project.

    This connector intentionally stays opinion-free and only reports
    basic metrics that downstream signal extractors can interpret.
    """

    token_symbol: str
    mention_count: int
    engagement_score: float  # 0–1 normalized engagement / quality signal
    timestamp: datetime


class SocialSignalConnector:
    """
    Connector for social activity signals across X (Twitter) and curated
    crypto announcement feeds.

    Design:
    - In future iterations, this connector can:
      - call X/Twitter APIs or ingest firehose/streaming data
      - subscribe to curated announcement feeds (project blogs, discords, etc.)
      - detect new project announcements, rapid mention growth, and
        high-engagement posts in near-real-time.
    - For the current MVP, it returns a deterministic mock dataset that
      mimics:
      - newly announced tokens
      - projects experiencing rapid mention spikes
      - high-engagement narratives around existing assets

    Downstream:
    - A dedicated signal extractor can turn these raw records into
      explicit "new_project_announcement", "mention_surge", or
      "high_engagement_post" signals, or feed narrative detection.
    """

    def fetch_recent_activity(self) -> List[SocialActivityRaw]:
        """
        Return a list of normalized SocialActivityRaw records for the most
        active / interesting tokens in the recent window.

        Currently uses deterministic mock data suitable for local
        development and testing.
        """
        now = datetime.now(timezone.utc)

        # Example mock distribution:
        # - New AI infra token (TAO-AI) with strong engagement
        # - Restaking protocol token (RSTK) with accelerating mentions
        # - L2 / rollup token (NEURON) with steady but high-engagement chatter
        return [
            SocialActivityRaw(
                token_symbol="TAO-AI",
                mention_count=5200,
                engagement_score=0.88,
                timestamp=now,
            ),
            SocialActivityRaw(
                token_symbol="RSTK",
                mention_count=3400,
                engagement_score=0.81,
                timestamp=now,
            ),
            SocialActivityRaw(
                token_symbol="NEURON",
                mention_count=4100,
                engagement_score=0.79,
                timestamp=now,
            ),
            SocialActivityRaw(
                token_symbol="SOL",
                mention_count=6100,
                engagement_score=0.72,
                timestamp=now,
            ),
        ]

