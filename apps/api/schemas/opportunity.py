from pydantic import BaseModel


class Opportunity(BaseModel):
    id: int
    type: str
    title: str
    description: str

    # Scoring dimensions (0–1 normalized)
    upside: float
    risk: float
    difficulty: float
    liquidity: float
    confidence: float
    freshness: float

    source: str

