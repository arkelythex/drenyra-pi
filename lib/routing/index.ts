/**
 * Public barrel for the Pi routing adapter surface (pi-sdd-030-routing-adapter;
 * design D1 §3.1). Exports the full WU1–WU3 surface: Pi-owned types, the
 * eight-stage preflight, and the bounded executor.
 *
 * Authority boundary: this surface preflights work and executes authorized
 * work; Core owns materiality, gates, transitions, approvals, fiscal
 * authority, AND the route decision (`routing/router.ts` `route()`) — the
 * former 18-cell selector was deleted when the Core router shipped
 * (REQ-BOUND-001). No local transition matrix or route table exists anywhere
 * in this module.
 */

export * from "./types.js";
export * from "./preflight.js";
export * from "./executor.js";
