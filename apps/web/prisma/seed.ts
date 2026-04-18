// Upland seed script.
//
// Uses the MockSource fixtures and the full ingestion orchestrator so the
// seed path exercises the same transaction + deal-score + change-event logic
// as production. Running:
//
//   cd apps/web
//   DATABASE_URL=... DIRECT_URL=... npx tsx prisma/seed.ts

import { runIngestion } from "../lib/upland/ingestion";

async function main() {
  console.log("[seed] running upland ingestion with mock source");
  const summary = await runIngestion({ source: "mock" });
  console.log("[seed] done:", JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(() => {
    // PrismaClient keeps the process alive; force exit when the ingestion
    // promise resolves so `npx tsx prisma/seed.ts` terminates.
    process.exit(0);
  });
