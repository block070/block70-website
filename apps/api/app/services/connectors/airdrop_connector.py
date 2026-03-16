from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List


@dataclass
class AirdropOpportunityRaw:
    """
    Raw airdrop discovery record.

    This represents a candidate airdrop or incentive program before it has
    been normalized into the shared Opportunity model. It intentionally does
    not contain any scoring or judgment – just structured facts that a signal
    extractor can turn into explicit signals.
    """

    project_name: str
    chain: str
    estimated_value_usd: float
    difficulty: str  # e.g. "low", "medium", "high"
    tasks_required: str

    # Optional metadata about where the signal came from. These are hints for
    # downstream explainability (e.g. "GitHub", "Docs", "Explorer").
    source_github_repo: str | None = None
    source_docs_url: str | None = None
    source_explorer_url: str | None = None

    detected_at: datetime = datetime.now(timezone.utc)


class AirdropConnector:
    """
    Mock airdrop discovery connector.

    In a future iteration, this connector can:
    - scan GitHub repos for "points", "quest", or "testnet" programs
    - parse project documentation for incentive program details
    - inspect on-chain contract or holder data from explorers

    For now, it returns deterministic, hard-coded candidates that resemble
    real airdrop-style opportunities so the rest of the Opportunity Engine
    can be exercised end-to-end.
    """

    def fetch_candidates(self) -> List[AirdropOpportunityRaw]:
        """
        Return a list of candidate airdrop or incentive opportunities.

        Each record includes:
        - project_name
        - chain
        - estimated_value_usd
        - difficulty
        - tasks_required (human-readable summary)
        """
        now = datetime.now(timezone.utc)

        candidates: List[AirdropOpportunityRaw] = [
            AirdropOpportunityRaw(
                project_name="Neuron AI L2",
                chain="ethereum",
                estimated_value_usd=1500.0,
                difficulty="medium",
                tasks_required=(
                    "Bridge ETH to Neuron L2, make 3 swaps, provide liquidity for "
                    "at least 7 days, and interact with the governance portal."
                ),
                source_github_repo="github.com/neuron-labs/protocol",
                source_docs_url="https://docs.neuron.xyz/airdrop",
                detected_at=now,
            ),
            AirdropOpportunityRaw(
                project_name="Atlas Restaking Points",
                chain="ethereum",
                estimated_value_usd=3200.0,
                difficulty="high",
                tasks_required=(
                    "Restake LSTs into Atlas contracts, delegate to multiple operators, "
                    "and maintain positions for an entire epoch to maximize points."
                ),
                source_docs_url="https://docs.atlas.restaking/points",
                source_explorer_url="https://etherscan.io/address/0xatlas...",
                detected_at=now,
            ),
            AirdropOpportunityRaw(
                project_name="SolRail Bridge Quests",
                chain="solana",
                estimated_value_usd=600.0,
                difficulty="low",
                tasks_required=(
                    "Bridge assets between Solana and Ethereum, complete a simple quest "
                    "set (swap, deposit, withdraw) and hold the membership NFT."
                ),
                source_docs_url="https://solrail.xyz/quests",
                detected_at=now,
            ),
            AirdropOpportunityRaw(
                project_name="Blockspace Indexer Testnet",
                chain="polygon",
                estimated_value_usd=900.0,
                difficulty="medium",
                tasks_required=(
                    "Run a light indexer node on testnet, submit uptime proofs, and "
                    "index at least N blocks per day over a two-week period."
                ),
                source_github_repo="github.com/blockspace-labs/indexer",
                source_docs_url="https://docs.blockspace.xyz/testnet",
                detected_at=now,
            ),
        ]

        return candidates

