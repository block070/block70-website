// Source factory -- picks the right ingestion source based on env.
//
// Defaults to MockSource so nothing bad happens if ingestion is triggered
// without the real Upland credentials set.

import { MockSource } from "./MockSource";
import {
  UplandOfficialSource,
  type UplandOfficialSourceOptions,
} from "./UplandOfficialSource";
import type { PropertySource } from "./PropertySource";

export type SourceName = "mock" | "upland-official";

export type CreateSourceOptions = {
  /** Explicit prop_ids for the Upland source. Ignored by mock. */
  propIds?: string[];
  /** Override request pacing (ms between detail calls). */
  rateLimitMs?: number;
  /** Strict mode: abort on any per-id fetch failure. Default false. */
  strict?: boolean;
};

export function createSource(
  name?: SourceName,
  opts: CreateSourceOptions = {},
): PropertySource {
  const effective: SourceName =
    name ?? (UplandOfficialSource.isEnabled() ? "upland-official" : "mock");
  switch (effective) {
    case "upland-official": {
      const upOpts: UplandOfficialSourceOptions = {
        propIds: opts.propIds,
        rateLimitMs: opts.rateLimitMs,
        strict: opts.strict,
      };
      return new UplandOfficialSource(upOpts);
    }
    case "mock":
    default:
      return new MockSource();
  }
}

export { MockSource, UplandOfficialSource };
export type { PropertySource, NormalizedProperty } from "./PropertySource";
