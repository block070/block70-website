import "dotenv/config";
import { initSentry } from "./lib/sentry.js";
import { listen } from "./api/server.js";

initSentry("api");

listen().catch((e) => {
  console.error(e);
  process.exit(1);
});
