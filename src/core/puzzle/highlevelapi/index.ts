/**
 * High-Level Autonomous Puzzle Generator API (Phase 92)
 *
 * Single high-level API entrypoint for end-to-end puzzle generation:
 * requirement -> 2D -> 3D -> Assembly -> Verification -> Repair -> Validated Result.
 */

export * from './types';
export * from './requirementParser';
export * from './highLevelPuzzleGenerator';
