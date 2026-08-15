/**
 * Public barrel for the Pi routing adapter surface (pi-sdd-030-routing-adapter;
 * design D1 §3.1). Exports the full WU1–WU3 surface: Pi-owned types, the
 * seven-stage preflight, the 18-cell route selector, and the bounded executor.
 *
 * Authority boundary: this surface proposes routes, preflights work, and
 * executes authorized work; Core owns materiality, gates, transitions,
 * approvals, and fiscal authority (REQ-BOUND-001). No local transition matrix
 * exists anywhere in this module.
 */
    
export * from "./types.js";
export * from "./preflight.js";
export * from "./route-selector.js";
export * from "./executor.js";
