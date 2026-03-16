# AI Copilot System Review

## Overview

The Block70 AI Copilot generates **personalized insights** for each user from portfolio data, signals, capital flows, radar events, and narratives. Users see alerts (e.g. “2 tokens in your portfolio triggered radar events — RNDR whale accumulation, AKT volume spike”) and can act via suggested actions: watch token, set alert, view opportunity.

## Data Inputs

| Input | Source | Use |
|-------|--------|-----|
| **User portfolio** | `Portfolio`, `PortfolioTokenBalance` | Risk concentration, whale overlap, portfolio token radar alerts |
| **Tracked tokens** | `TokenWatch` (user_identifier) | Filter opportunity alerts to tokens the user cares about |
| **Signals** | `Signal` | Opportunity detection, confidence inputs |
| **Wallet activity** | `WalletProfile`, smart money overlap service | Whale overlap with portfolio tokens |
| **Capital flows** | `CapitalFlow` | Opportunity detection, narrative flow summary |
| **Radar events** | `RadarEvent` | Portfolio token alerts, opportunity detection |
| **Narratives** | `MarketNarrative`, `NarrativeAnalyzer` | Narrative momentum alerts |

## Insight Generation Flow

1. **CopilotEngine.generate_insights(user_id)**  
   - Loads portfolio tokens and tracked tokens.  
   - Runs **PortfolioAnalyzer**: risk concentration, opportunities per token, whale overlap (radar, capital flow, smart wallet).  
   - Creates **portfolio_alert** insights for concentration, whale overlap, and “portfolio token triggered radar”.  
   - Runs **OpportunityAnalyzer**: aggregates from signals, capital flows, market opportunities, radar; filters by portfolio/tracked tokens.  
   - Creates **opportunity_alert** insights with suggested actions.  
   - Runs **NarrativeCopilot**: momentum and capital flow summary.  
   - Creates **narrative_alert** insights.  
   - **CopilotConfidenceEngine** scores each insight; only those above `min_confidence` are persisted.  
   - High-confidence events (e.g. portfolio risk, whale accumulation, opportunity) trigger **UserNotification** rows (`copilot_*` types).

2. **Persistence**  
   - All insights are stored as **AICopilotInsight** (user_id, insight_type, title, summary, confidence_score, related_tokens, suggested_actions).  
   - **CopilotPerformance** can be used to record accuracy (was_accurate, outcome_score) for tuning.

## Performance and Tuning

- **Confidence scoring**: Reuses `ConfidenceScoring` (signals, flows, radar, wallet reputation) with Copilot-specific bumps for portfolio/narrative relevance.  
- **Performance tracking**: `CopilotPerformance` is linked 1:1 to `AICopilotInsight`; optional evaluation pipeline can set `was_accurate` / `outcome_score` and `evaluated_at`.  
- **Review checklist**:  
  - Data inputs: portfolio and TokenWatch up to date; signals/radar/flows/narratives populated.  
  - Insight generation: thresholds (`min_confidence`, `max_insights`) and deduplication in CopilotEngine.  
  - Notifications: only high-confidence events create UserNotification.  
  - API: GET `/api/v1/copilot/insights`, `/portfolio`, `/opportunities`; POST `/api/v1/copilot/insights/generate` (auth required).

## API Summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/copilot/insights` | List user’s Copilot insights (optional type filter) |
| GET | `/api/v1/copilot/portfolio` | Portfolio analysis (risk, opportunities, whale overlap) |
| GET | `/api/v1/copilot/opportunities` | Detected opportunities (signals, flows, radar) |
| POST | `/api/v1/copilot/insights/generate` | Generate and persist insights for current user |

## Frontend

- **/copilot**: Dashboard (portfolio insights, market alerts, opportunities, narratives); “Generate insights” calls POST generate.  
- **/copilot/feed**: Personalized insight feed (list of CopilotAlert).  
- **/copilot/chat**: Placeholder chat UI (ready for backend wiring).  
- **Copilot** link in top nav opens the Copilot dashboard.  
- **copilot-alert.tsx**: Renders title, summary, confidence score, related tokens, and suggested actions (watch token, set alert, view opportunity).

## Suggested Actions

- **watch_token** → link to `/signals/{token}`.  
- **set_alert** → link to `/alerts`.  
- **view_opportunity** → link to `/radar/{token}` (or opportunity detail when available).

## Notifications

The notification engine is extended via **UserNotification** with types:

- `copilot_portfolio_risk`  
- `copilot_whale_accumulation`  
- `copilot_high_confidence_opportunity`  

Created when generating insights for confidence ≥ 0.6 on the corresponding alert types.
