from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.pipeline.opportunity_pipeline import OpportunityPipeline


class MinerAgent:
    """
    Agent that runs the miner ROI pipeline end-to-end.
    """

    def __init__(self) -> None:
        self._pipeline = OpportunityPipeline()

    def run_once(self, db: Session) -> list[Opportunity]:
        return self._pipeline.run_mining(db)


def run_miner_scan(db: Session) -> list[Opportunity]:
    """
    Convenience function used by jobs, CLI, or startup hooks.
    """
    agent = MinerAgent()
    return agent.run_once(db)

