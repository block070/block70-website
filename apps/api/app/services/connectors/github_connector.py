from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List


@dataclass
class GitHubProjectActivityRaw:
    """
    Raw GitHub activity snapshot for a crypto / protocol repository.

    This connector is intentionally opinion-free: it captures structured
    activity metrics that a downstream signal extractor can turn into explicit
    opportunity or narrative signals.
    """

    project_name: str
    repo_slug: str  # e.g. "org/name"
    chain: str | None

    # Stars snapshot
    stars_total: int
    stars_30d_delta: int

    # Developer activity
    commits_7d: int
    contributors_7d: int

    # Repo lifecycle
    first_commit_at: datetime
    last_commit_at: datetime

    # Simple tags that help distinguish categories (L2, restaking, indexer, etc.)
    tags: list[str]

    detected_at: datetime


class GitHubActivityConnector:
    """
    Mock GitHub activity connector for crypto projects.

    In a future iteration, this connector can:
    - call the GitHub REST or GraphQL APIs
    - fetch stars history, commit activity, and contributor stats
    - filter for repos that mention on-chain contracts or popular narratives

    For now, it returns deterministic, hard-coded records that mimic:
    - new L2s with rapidly growing stars
    - restaking / points programs with heavy dev activity
    - indexer / infra projects quietly building with steady commits
    """

    def fetch_recent_activity(self) -> List[GitHubProjectActivityRaw]:
        """
        Return a list of project activity snapshots suitable for downstream
        signal extraction.
        """
        now = datetime.now(timezone.utc)
        month_ago = now - timedelta(days=30)
        year_ago = now - timedelta(days=365)

        projects: List[GitHubProjectActivityRaw] = [
            GitHubProjectActivityRaw(
                project_name="Neuron AI L2",
                repo_slug="neuron-labs/neuron-rollup",
                chain="ethereum",
                stars_total=4800,
                stars_30d_delta=2600,
                commits_7d=145,
                contributors_7d=18,
                first_commit_at=year_ago,
                last_commit_at=now - timedelta(hours=2),
                tags=["l2", "ai", "zk"],
                detected_at=now,
            ),
            GitHubProjectActivityRaw(
                project_name="Atlas Restaking",
                repo_slug="atlas-protocol/atlas-restaking",
                chain="ethereum",
                stars_total=3200,
                stars_30d_delta=1500,
                commits_7d=98,
                contributors_7d=14,
                first_commit_at=year_ago + timedelta(days=60),
                last_commit_at=now - timedelta(hours=4),
                tags=["restaking", "points"],
                detected_at=now,
            ),
            GitHubProjectActivityRaw(
                project_name="SolRail Bridge",
                repo_slug="solrail/bridge",
                chain="solana",
                stars_total=1900,
                stars_30d_delta=600,
                commits_7d=52,
                contributors_7d=9,
                first_commit_at=year_ago + timedelta(days=90),
                last_commit_at=now - timedelta(hours=6),
                tags=["bridge", "solana"],
                detected_at=now,
            ),
            GitHubProjectActivityRaw(
                project_name="Blockspace Indexer",
                repo_slug="blockspace-labs/indexer",
                chain="polygon",
                stars_total=1100,
                stars_30d_delta=280,
                commits_7d=73,
                contributors_7d=7,
                first_commit_at=year_ago + timedelta(days=120),
                last_commit_at=now - timedelta(hours=3),
                tags=["indexer", "infra"],
                detected_at=now,
            ),
            GitHubProjectActivityRaw(
                project_name="TAO Intent Router",
                repo_slug="tao-network/intent-router",
                chain=None,
                stars_total=850,
                stars_30d_delta=500,
                commits_7d=64,
                contributors_7d=6,
                first_commit_at=month_ago - timedelta(days=5),
                last_commit_at=now - timedelta(hours=1),
                tags=["intent", "router", "multi-chain"],
                detected_at=now,
            ),
        ]

        return projects

