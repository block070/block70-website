from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from app.models import CandidateProject, RadarSignal
from app.services.connectors.github_activity_connector import (
    GitHubActivityConnector,
    GitHubRepoActivityRaw,
)
from app.services.connectors.social_signal_connector import (
    SocialSignalConnector,
    SocialActivityRaw,
)
from app.services.signals.github_signals import (
    GitHubActivitySignalExtractor,
    GitHubActivitySignal,
)
from app.services.signals.social_signals import (
    SocialSignalExtractor,
    SocialActivitySignal,
)


@dataclass
class _AggregatedSignals:
    dev_signals: List[GitHubActivitySignal]
    social_signals: List[SocialActivitySignal]


class OpportunityHunterPipeline:
    """
    High-level pipeline for hunting new crypto projects gaining traction
    across developer and social activity.

    Steps:
    1. Fetch GitHub developer activity via GitHubActivityConnector.
    2. Fetch social activity snapshots via SocialSignalConnector.
    3. Extract structured signals from both sources.
    4. Aggregate signals by project / token.
    5. Compute a composite project activity score.
    6. Persist CandidateProject records when the score exceeds a threshold.
    """

    def __init__(
        self,
        *,
        min_activity_score: float = 0.6,
        radar_threshold: float = 0.7,
    ) -> None:
        self._min_activity_score = float(min_activity_score)
        self._radar_threshold = float(radar_threshold)
        self._github_connector = GitHubActivityConnector()
        self._social_connector = SocialSignalConnector()
        self._github_extractor = GitHubActivitySignalExtractor()
        self._social_extractor = SocialSignalExtractor()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def run(self, db: Session) -> List[CandidateProject]:
        """
        Execute the Opportunity Hunter pipeline and return any newly created
        CandidateProject records.
        """
        github_raw = self._github_connector.fetch_activity()
        social_raw = self._social_connector.fetch_recent_activity()

        aggregated = self._extract_and_combine(github_raw, social_raw)

        created: List[CandidateProject] = []
        for key, signals in aggregated.items():
            activity_score, dev_score, social_score = self._compute_activity_score(
                signals
            )
            if activity_score < self._min_activity_score:
                continue

            project = self._upsert_candidate_project(
                db,
                key=key,
                dev_score=dev_score,
                social_score=social_score,
                activity_score=activity_score,
            )
            created.append(project)

            # When project activity is strong enough, emit a RadarSignal so
            # the Crypto Radar system can treat this as a token-level radar
            # event tied to the candidate project.
            if activity_score >= self._radar_threshold:
                token_symbol = (project.token_symbol or key).upper()
                radar = RadarSignal(
                    signal_type="dev_activity_spike",
                    token_symbol=token_symbol,
                    chain=project.chain,
                    signal_strength=activity_score,
                    confidence_score=activity_score,
                    source="Opportunity Hunter",
                    metadata_json={
                        "candidate_project_id": project.id,
                        "project_name": project.project_name,
                        "dev_activity_score": float(project.dev_activity_score or 0.0),
                        "social_activity_score": float(
                            project.social_activity_score or 0.0
                        ),
                        "activity_score": activity_score,
                    },
                )
                db.add(radar)

        if created:
            db.commit()

        return created

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _extract_and_combine(
        self,
        github_raw: List[GitHubRepoActivityRaw],
        social_raw: List[SocialActivityRaw],
    ) -> Dict[str, _AggregatedSignals]:
        """
        Extract signals from GitHub and social sources and aggregate them
        by a simple project key.

        For now, the aggregation key is:
        - token_symbol (from SocialActivityRaw), or
        - repo_name slug uppercased (from GitHubRepoActivityRaw) when there
          is no obvious token symbol mapping.

        This is intentionally simple and can be refined later with a
        mapping table (repo_slug -> token_symbol).
        """
        dev_signals = self._github_extractor.extract(github_raw)
        social_signals = self._social_extractor.extract(social_raw)

        combined: Dict[str, _AggregatedSignals] = defaultdict(
            lambda: _AggregatedSignals(dev_signals=[], social_signals=[])
        )

        # Aggregate dev signals by a symbol derived from repo_name.
        for sig in dev_signals:
            # Heuristic: treat the last path segment of the repo_name as
            # a pseudo token symbol (uppercased).
            slug = sig.repo_name.split("/")[-1].upper()
            key = slug
            combined[key].dev_signals.append(sig)

        # Aggregate social signals by token_symbol directly.
        for sig in social_signals:
            key = sig.token_symbol.upper()
            combined[key].social_signals.append(sig)

        return combined

    def _compute_activity_score(
        self,
        agg: _AggregatedSignals,
    ) -> Tuple[float, float, float]:
        """
        Compute a composite activity score from aggregated dev + social signals.

        Returns:
        - activity_score: overall project activity score (0–1)
        - dev_score: aggregated developer activity component (0–1)
        - social_score: aggregated social activity component (0–1)
        """
        if not agg.dev_signals and not agg.social_signals:
            return 0.0, 0.0, 0.0

        dev_score = 0.0
        if agg.dev_signals:
            # Use the max signal_strength across dev-related signals as a
            # proxy for dev activity.
            dev_score = max(s.signal_strength for s in agg.dev_signals)

        social_score = 0.0
        if agg.social_signals:
            social_score = max(s.signal_strength for s in agg.social_signals)

        # Blend dev and social components; give a slight edge to dev activity
        # since it's harder to fake than pure social buzz.
        activity_score = max(
            0.0, min(0.6 * dev_score + 0.4 * social_score, 1.0)
        )

        return activity_score, dev_score, social_score

    def _upsert_candidate_project(
        self,
        db: Session,
        *,
        key: str,
        dev_score: float,
        social_score: float,
        activity_score: float,
    ) -> CandidateProject:
        """
        Create or update a CandidateProject row for the aggregated key.

        For now, project_name and token_symbol are both derived from the key,
        and chain/source metadata are left null. Upstream mapping logic can
        hydrate richer metadata later.
        """
        token_symbol = key

        existing = (
            db.query(CandidateProject)
            .filter(CandidateProject.token_symbol == token_symbol)
            .order_by(CandidateProject.created_at.desc())
            .first()
        )

        if existing:
            existing.dev_activity_score = max(
                float(existing.dev_activity_score or 0.0), dev_score
            )
            existing.social_activity_score = max(
                float(existing.social_activity_score or 0.0), social_score
            )
            existing.confidence_score = max(
                float(existing.confidence_score or 0.0), activity_score
            )
            return existing

        project = CandidateProject(
            project_name=token_symbol,
            token_symbol=token_symbol,
            chain=None,
            source="Opportunity Hunter",
            source_url=None,
            description=None,
            dev_activity_score=dev_score,
            social_activity_score=social_score,
            confidence_score=activity_score,
            detected_at=None,
        )

        db.add(project)
        return project

