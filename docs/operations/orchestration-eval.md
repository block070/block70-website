# Evaluating Paperclip-class orchestration (optional)

This doc is for **operations**: formal “agent employee” roles, budgets, and multi-step workflows **outside** the IDE. It does **not** describe Block70 **product** agents (`docs/agents.md`).

**Primary guidance:** root **[AGENTS.md](../../AGENTS.md)** (Cursor baseline, verification gates, orchestration overview).

## When an orchestrator is worth trialing

- Non-code pipelines dominate (research, drafts, approvals, publishing).
- You want per-role spend caps and explicit handoffs more than ad hoc Cursor sessions.
- Code work should still land in **Git** and be implemented in-repo (e.g. via Cursor).

## Trial checklist

1. **Pick a candidate** — e.g. open-source [paperclipai/paperclip](https://github.com/paperclipai/paperclip) or a vendor with comparable role/budget features.
2. **Risk review** — API keys, data residency, what leaves the repo, and hard token/spend caps per role or workflow.
3. **Define 2–4 roles** — illustrative: researcher → drafter → reviewer → publisher; no production deploy rights for non-human steps without approval.
4. **Wire code touches to Git** — orchestrator outputs specs or tickets; humans or Cursor implement in this monorepo; merge and deploy through normal CI.
5. **Revisit after 2–4 weeks** — confirm value vs. running the same with Cursor rules + `AGENTS.md` gates alone.

## Default remains Cursor-first

Most Block70 software work should stay: project rules (`.cursor/rules/`), optional Skills, scoped tasks, and **`apps/web`** verification commands from `AGENTS.md`.
