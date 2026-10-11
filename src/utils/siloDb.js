import { ACTIVE_SILO_KEY } from "./siloScope";
import { readRegistry } from "./vsoRegistry";

export const SILO_DB_SEPARATOR = "__s_";

export const PER_VETERAN_DB_BASES = Object.freeze([
  "VetRateAutoBackup",
  "VetRateMyPacket",
  "VetRate_CFileStream",
  "VetRate_UserDocVectors",
  "VetRateVKB",
  "keyval-store",
  "VetRateBugSquasher",
  "VetRateFeatureRequests",
  "VetRate_SiloSnapshot",
]);

export class SiloScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = "SiloScopeError";
    this.code = "SILO_SCOPE_UNRESOLVED";
  }
}

export function dbNameForSilo(base, silo) {
  return silo.legacy ? base : `${base}${SILO_DB_SEPARATOR}${silo.id}`;
}

function resolveScope() {
  const state = readRegistry();
  if (state.state === "absent") return { silo: null };
  if (state.state === "corrupt") {
    return {
      error: new SiloScopeError(
        "The veteran registry is unreadable, so no veteran workspace can be opened.",
      ),
    };
  }
  const activeId = localStorage.getItem(ACTIVE_SILO_KEY);
  const silo = state.registry.silos.find((entry) => entry.id === activeId);
  if (!silo) {
    return {
      error: new SiloScopeError(
        "No active veteran workspace is selected, so no database can be opened.",
      ),
    };
  }
  return { silo };
}

// Resolved once at module load: every veteran switch reloads the page, so the
// active workspace cannot change underneath a loaded app. An unresolved scope
// fails on use rather than falling back to the unsuffixed (legacy) names.
const scope = resolveScope();

export function siloDbName(base) {
  if (scope.error) throw scope.error;
  return scope.silo ? dbNameForSilo(base, scope.silo) : base;
}
