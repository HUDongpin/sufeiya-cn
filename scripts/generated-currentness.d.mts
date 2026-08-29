export type GeneratedFilePair = readonly [source: string, generated: string];

export const VERSIONED_LEGACY_SOURCE_PUBLIC_PAIRS: readonly GeneratedFilePair[];
export const MATERIALIZED_LEGACY_RUNTIME_PAIRS: readonly GeneratedFilePair[];
export function findStaleFilePairs(
  root: string,
  pairs: readonly GeneratedFilePair[],
): Promise<string[]>;
