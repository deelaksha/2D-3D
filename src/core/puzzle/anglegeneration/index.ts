/**
 * Automatic Joining-Angle Generation System (Phase 88).
 *
 * Deterministic candidate angle generation and 3-tier validation:
 *   - Tier 1: mathematically possible
 *   - Tier 2: geometrically valid
 *   - Tier 3: physically assemblable
 *
 * Rejection categorizations:
 *   - collision
 *   - invalid_connector_alignment
 *   - insufficient_clearance
 *   - impossible_insertion
 *   - invalid_geometry
 */

export * from "./types";
export * from "./candidateAngleGenerator";
export * from "./candidateAngleValidator";
export * from "./automaticJoiningAngleEngine";
