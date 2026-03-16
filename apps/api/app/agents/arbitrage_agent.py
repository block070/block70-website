from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.pipeline.opportunity_pipeline import OpportunityPipeline


class ArbitrageAgent:
    """
    Agent that runs the arbitrage pipeline end-to-end.
    """

    def __init__(self) -> None:
        self._pipeline = OpportunityPipeline()

    def run_once(self, db: Session) -> list[Opportunity]:
        return self._pipeline.run_arbitrage(db)


def run_arbitrage_scan(db: Session) -> list[Opportunity]:
    """
    Convenience function used by jobs, CLI, or startup hooks.
    """
    agent = ArbitrageAgent()
    return agent.run_once(db)

