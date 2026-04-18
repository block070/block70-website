// Prisma client singleton for the Upland data plane.
//
// Next.js in development hot-reloads on every save; without this singleton
// we would leak a new PrismaClient instance per file change and Supabase
// would quickly run out of connections. Pattern cribbed from Prisma's own
// "Best practice for instantiating Prisma Client" docs.

import "server-only";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var -- required for the HMR-safe global singleton
  var __uplandPrisma: PrismaClient | undefined;
}

export const uplandPrisma: PrismaClient =
  globalThis.__uplandPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__uplandPrisma = uplandPrisma;
}
