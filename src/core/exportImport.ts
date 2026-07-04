import type { AppState } from './types';
import { isAppState, sanitizeActiveFlags } from './storage';

/** Bumped only when the persisted/exported shape changes incompatibly. */
export const SCHEMA_VERSION = 1;

interface ExportEnvelope {
  schemaVersion: number;
  state: AppState;
}

/**
 * Serialise the full app state (SPEC §9) as a versioned JSON envelope:
 * `{ schemaVersion, state }`. The envelope carries the complete AppState plus a
 * schemaVersion so a future import can detect and migrate older exports.
 */
export function exportState(state: AppState): string {
  const envelope: ExportEnvelope = { schemaVersion: SCHEMA_VERSION, state };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Restore an AppState from an export produced by {@link exportState}. Validates
 * the envelope shape and throws a clear Error on anything malformed — it never
 * returns a partial or crashes on garbage. The returned state replaces all
 * current data (the UI confirms before applying).
 */
export function importState(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Import failed: the file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Import failed: not a recognised export file.');
  }

  const envelope = parsed as Record<string, unknown>;
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Import failed: unsupported export version (expected schema version ${SCHEMA_VERSION}).`,
    );
  }

  if (!isAppState(envelope.state)) {
    throw new Error('Import failed: the export is missing valid app state.');
  }

  return sanitizeActiveFlags(envelope.state);
}
