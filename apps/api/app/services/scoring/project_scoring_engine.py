from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProjectScoreInputs:
    """
    Inputs to the candidate project scoring engine.

    All component scores are expected to be in [0, 1].
    """

    dev_activity_score: float
    social_activity_score: float
    confidence_score: float


@dataclass
class ProjectScoreResult:
    """
    Scoring output for a candidate project.
    """

    dev_activity_score: float
    social_activity_score: float
    confidence_score: float
    potential_opportunity_score: float


class ProjectScoringEngine:
    """
    Scoring engine for CandidateProject records.

    Computes component scores and a composite potential_opportunity_score
    that summarizes how promising a project looks based on:

    - dev_activity_score      (builder traction, harder to fake)
    - social_activity_score   (narrative heat, easier to move but important)
    - confidence_score        (overall confidence derived from upstream logic)

    Default formula:

      potential_opportunity_score =
          dev_activity_score    * 0.40 +
          social_activity_score * 0.35 +
          confidence_score      * 0.25
    """

    def score(self, inputs: ProjectScoreInputs) -> ProjectScoreResult:
        dev = self._clamp(inputs.dev_activity_score)
        social = self._clamp(inputs.social_activity_score)
        conf = self._clamp(inputs.confidence_score)

        potential = (
            dev * 0.40
            + social * 0.35
            + conf * 0.25
        )
        potential = self._clamp(potential)

        return ProjectScoreResult(
            dev_activity_score=dev,
            social_activity_score=social,
            confidence_score=conf,
            potential_opportunity_score=potential,
        )

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

