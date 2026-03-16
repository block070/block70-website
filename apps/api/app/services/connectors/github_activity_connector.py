from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import os
from typing import List, Optional

import requests


@dataclass
class GitHubRepoActivityRaw:
    """
    Normalized GitHub repository activity snapshot for developer-traction
    detection.

    This shape is intentionally simple so that downstream signal extractors
    (e.g. Opportunity Hunter or narrative engines) can turn it into explicit
    Opportunity or CandidateProject records.
    """

    repo_name: str
    repo_url: str
    stars: int
    commits_last_week: int
    contributors: int
    timestamp: datetime


class GitHubActivityConnector:
    """
    GitHub developer activity connector for crypto / protocol repositories.

    It attempts to fetch live data from the GitHub REST API when a
    GITHUB_TOKEN and a list of repositories are configured via environment
    variables. When live access is unavailable, it falls back to a
    deterministic mock dataset so the rest of the pipeline can function
    locally.

    Configuration:
    - GITHUB_TOKEN: personal access token (optional but recommended)
    - GITHUB_REPOS: comma-separated list of repo slugs, e.g.
      'neuron-labs/neuron-rollup,atlas-protocol/atlas-restaking'
    """

    API_BASE = "https://api.github.com"

    def __init__(self) -> None:
        self._token = os.getenv("GITHUB_TOKEN")
        repos_env = os.getenv("GITHUB_REPOS", "")
        self._repos: List[str] = [
            slug.strip() for slug in repos_env.split(",") if slug.strip()
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def fetch_activity(self) -> List[GitHubRepoActivityRaw]:
        """
        Return a list of normalized GitHubRepoActivityRaw records.

        Prefers live GitHub data when configured; otherwise returns a
        deterministic mock dataset suitable for local development.
        """
        if self._token and self._repos:
            try:
                return self._fetch_live()
            except Exception:
                # Fall through to mock data on any failure to keep the
                # Opportunity Hunter running in degraded mode.
                pass

        return self._fetch_mock()

    # ------------------------------------------------------------------
    # Live GitHub API implementation
    # ------------------------------------------------------------------
    def _headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "block70-opportunity-hunter",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def _fetch_live(self) -> List[GitHubRepoActivityRaw]:
        results: List[GitHubRepoActivityRaw] = []
        now = datetime.now(timezone.utc)

        for slug in self._repos:
            try:
                repo = self._get_repo(slug)
                if not repo:
                    continue

                stars = int(repo.get("stargazers_count", 0) or 0)
                repo_url = repo.get("html_url") or f"https://github.com/{slug}"

                commits_last_week = self._get_commits_last_week(slug)
                contributors = self._get_contributor_count(slug)

                results.append(
                    GitHubRepoActivityRaw(
                        repo_name=repo.get("full_name") or slug,
                        repo_url=repo_url,
                        stars=stars,
                        commits_last_week=commits_last_week,
                        contributors=contributors,
                        timestamp=now,
                    )
                )
            except Exception:
                # Skip problematic repos but continue with others.
                continue

        return results

    def _get_repo(self, slug: str) -> Optional[dict]:
        resp = requests.get(
            f"{self.API_BASE}/repos/{slug}",
            headers=self._headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        return resp.json()

    def _get_commits_last_week(self, slug: str) -> int:
        """
        Use the /stats/commit_activity endpoint, which returns weekly totals
        for the last year. We sum the most recent week.
        """
        resp = requests.get(
            f"{self.API_BASE}/repos/{slug}/stats/commit_activity",
            headers=self._headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return 0

        data = resp.json()
        if not isinstance(data, list) or not data:
            return 0

        last_week = data[-1]
        return int(last_week.get("total", 0) or 0)

    def _get_contributor_count(self, slug: str) -> int:
        """
        Approximate contributor activity by counting distinct contributors
        returned from /contributors. This is a heuristic but sufficient for
        signal extraction.
        """
        resp = requests.get(
            f"{self.API_BASE}/repos/{slug}/contributors",
            headers=self._headers(),
            params={"per_page": 100},
            timeout=10,
        )
        if resp.status_code != 200:
            return 0

        data = resp.json()
        if not isinstance(data, list):
            return 0

        return len(data)

    # ------------------------------------------------------------------
    # Mock fallback
    # ------------------------------------------------------------------
    def _fetch_mock(self) -> List[GitHubRepoActivityRaw]:
        """
        Deterministic mock dataset used when live GitHub access is not
        available. Mirrors the flavor of the existing GitHubActivityConnector
        but in the simpler normalized shape expected by downstream consumers.
        """
        now = datetime.now(timezone.utc)

        return [
            GitHubRepoActivityRaw(
                repo_name="neuron-labs/neuron-rollup",
                repo_url="https://github.com/neuron-labs/neuron-rollup",
                stars=4800,
                commits_last_week=145,
                contributors=18,
                timestamp=now,
            ),
            GitHubRepoActivityRaw(
                repo_name="atlas-protocol/atlas-restaking",
                repo_url="https://github.com/atlas-protocol/atlas-restaking",
                stars=3200,
                commits_last_week=98,
                contributors=14,
                timestamp=now,
            ),
            GitHubRepoActivityRaw(
                repo_name="solrail/bridge",
                repo_url="https://github.com/solrail/bridge",
                stars=1900,
                commits_last_week=52,
                contributors=9,
                timestamp=now,
            ),
            GitHubRepoActivityRaw(
                repo_name="blockspace-labs/indexer",
                repo_url="https://github.com/blockspace-labs/indexer",
                stars=1100,
                commits_last_week=73,
                contributors=7,
                timestamp=now,
            ),
        ]

