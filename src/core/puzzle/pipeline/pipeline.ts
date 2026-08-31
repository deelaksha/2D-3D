/**
 * Main Parametric 2D Geometry Generation Pipeline Entrypoint.
 */
import type { PipelineInput, PipelineOutput } from "./types";
import { generateExact2DGeometry } from "./generator";
import { validateGeneratedGeometry } from "./validator";

export function runParametricGeometryPipeline(input: PipelineInput): PipelineOutput {
  // 1. Generate exact 2D geometry & sampled outlines deterministically
  const { boundary, vertices, sampledOutline, hash } = generateExact2DGeometry(input);

  // 2. Run geometric validation (closed boundary, self-intersection, degenerate edges, min feature size)
  const validationReport = validateGeneratedGeometry(input, boundary, vertices, sampledOutline);

  return {
    exactBoundary: boundary,
    sampledOutlines: [sampledOutline],
    validationReport,
    deterministicHash: hash,
  };
}
