# `@block70/crypto-news-pipeline` (template pointer)

This package is a **documentation + inventory anchor** for reusing Block70’s RSS → topics → AI articles → publish flow on **other projects** (one deployment per project).

## Source of truth

Implement and run the pipeline from:

**[`apps/crypto-on-the-hour`](../../apps/crypto-on-the-hour)**

Do not duplicate the runtime here; fork or copy that app into a new repository per client, then:

1. Copy the app per **[`docs/rss-pipeline-copy-to-new-project.md`](../../docs/rss-pipeline-copy-to-new-project.md)**; set env vars in **[`docs/rss-article-pipeline.md`](../../docs/rss-article-pipeline.md)**.
2. Tune **[`MODULES.md`](./MODULES.md)** for what to keep, parameterize, or remove.
3. Run `npm run build` and `npm run verify:pipeline` in that app, then migrations, worker, and publishers per its `README` / `package.json`.

## Files in this package

| File | Purpose |
|------|---------|
| `MODULES.md` | Keep / strip / configure checklist for a generic fork. |
| `README.md` | This file. |

## Block70 internal note

When improving the reusable pipeline, change **`apps/crypto-on-the-hour`** first, then refresh `MODULES.md` and `docs/rss-article-pipeline.md` if behavior or env vars change.
