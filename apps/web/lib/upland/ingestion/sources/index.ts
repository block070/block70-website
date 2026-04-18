// Source factory -- picks the right ingestion source based on env.
//
// Defaults to MockSource so nothing bad happens if ingestion is triggered
// without the real Upland credentials set.

import { MockSource } from "./MockSource";
import { UplandOfficialSource } from "./UplandOfficialSource";
import type { PropertySource } from "./PropertySource";

export type SourceName = "mock" | "upland-official";

export function createSource(name?: SourceName): PropertySource {
  const effective: SourceName =
    name ??
    (UplandOfficialSource.isEnabled() ? "upland-official" : "mock");
  switch (effective) {
    case "upland-official":
      return new UplandOfficialSource();
    case "mock":
    default:
      return new MockSource();
  }
}

export { MockSource, UplandOfficialSource };
export type { PropertySource, NormalizedProperty } from "./PropertySource";
