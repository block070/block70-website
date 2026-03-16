from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Literal

from pydantic import BaseModel

from app.services.connectors.github_activity_connector import (
    GitHubRepoActivityRaw,
)


class GitHubActivitySignal(BaseModel):
  """
  Structured signal describing notable GitHub developer activity for a repo.

  Signals focus on:
  - rapid star growth
  - sudden commit spikes
  - multiple contributors joining a project
  """

  signal_type: Literal[
      "github_rapid_star_growth",
      "github_commit_spike",
      "github_contributor_surge",
  ]
  repo_name: str
  repo_url: str
  signal_strength: float  # 0–1
  confidence_score: float  # 0–1
  timestamp: datetime


class GitHubActivitySignalExtractor:
    """
    Converts normalized GitHubRepoActivityRaw records into explicit signals
    about developer traction.

    Heuristics (tunable):
    - rapid star growth   -> high stars combined with elevated commits
    - commit spike        -> unusually high commits_last_week
    - contributor surge   -> larger teams / more active contributors

    This extractor does not call the GitHub API directly; it expects
    pre-normalized activity from GitHubActivityConnector.
    """

    def __init__(
        self,
        *,
        min_star_threshold: int = 1_000,
        min_commit_threshold: int = 40,
        min_contributor_threshold: int = 8,
    ) -> None:
        self.min_star_threshold = int(min_star_threshold)
        self.min_commit_threshold = int(min_commit_threshold)
        self.min_contributor_threshold = int(min_contributor_threshold)

    def extract(self, raw_items: List[GitHubRepoActivityRaw]) -> List[GitHubActivitySignal]:
        signals: List[GitHubActivitySignal] = []

        for raw in raw_items:
            ts = raw.timestamp.astimezone(timezone.utc)

            # Rapid star growth proxy: absolute stars + commits support.
            if raw.stars >= self.min_star_threshold and raw.commits_last_week > 0:
                strength = self._clamp(
                    (raw.stars / 5_000.0) * 0.6 + (raw.commits_last_week / 150.0) * 0.4
                )
                confidence = self._clamp(0.6 + strength * 0.4)
                signals.append(
                    GitHubActivitySignal(
                        signal_type="github_rapid_star_growth",
                        repo_name=raw.repo_name,
                        repo_url=raw.repo_url,
                        signal_strength=strength,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

            # Commit spike: treat high weekly commit volume as a signal.
            if raw.commits_last_week >= self.min_commit_threshold:
                strength = self._clamp(raw.commits_last_week / 120.0)
                confidence = self._clamp(0.5 + strength * 0.5)
                signals.append(
                    GitHubActivitySignal(
                        signal_type="github_commit_spike",
                        repo_name=raw.repo_name,
                        repo_url=raw.repo_url,
                        signal_strength=strength,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

            # Contributor surge: emphasize teams with many recent contributors.
            if raw.contributors >= self.min_contributor_threshold:
                strength = self._clamp(raw.contributors / 25.0)
                confidence = self._clamp(0.5 + strength * 0.5)
                signals.append(
                    GitHubActivitySignal(
                        signal_type="github_contributor_surge",
                        repo_name=raw.repo_name,
                        repo_url=raw.repo_url,
                        signal_strength=strength,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

        return signals

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

