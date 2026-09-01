/**
 * Ground-Truth Comparison Engine Master Coordinator.
 * Compares REFERENCE DESIGN vs GENERATED DESIGN across geometry, topology, and assembly.
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { ComparisonMode, ComparisonReport, ComparisonTolerances, StructuredDiffItem } from "./types";
import { ComparisonDiagnostics } from "./diagnostics";
import { GeometryComparisonEngine } from "./geometryComparison";
import { TopologyComparisonEngine } from "./topologyComparison";
import { AssemblyComparisonEngine } from "./assemblyComparison";
import type { GroundTruthAssemblyManifest } from "../benchmark/types";

export class GroundTruthComparisonEngine {
  static compare(
    refPuzzle: CanonicalPuzzle,
    genPuzzle: CanonicalPuzzle,
    mode: ComparisonMode = "tolerance",
    customTolerances?: Partial<ComparisonTolerances>,
    referenceManifest?: GroundTruthAssemblyManifest,
    diagnostics?: ComparisonDiagnostics
  ): ComparisonReport {
    const startTime = Date.now();
    const diag = diagnostics || new ComparisonDiagnostics();

    const tolerances: ComparisonTolerances = {
      linearToleranceMm: mode === "exact" ? 0.0001 : customTolerances?.linearToleranceMm ?? 0.5,
      angularToleranceDeg: mode === "exact" ? 0.0001 : customTolerances?.angularToleranceDeg ?? 1.0,
      profileToleranceMm: mode === "exact" ? 0.0001 : customTolerances?.profileToleranceMm ?? 0.2,
      allowPieceOrderMismatch: customTolerances?.allowPieceOrderMismatch ?? true,
    };

    diag.info("COMPARISON_START", `Starting ground-truth comparison [mode: ${mode}] between '${refPuzzle.metadata.id}' and '${genPuzzle.metadata.id}'.`);

    const geometry = GeometryComparisonEngine.compare(refPuzzle, genPuzzle, tolerances);
    const topology = TopologyComparisonEngine.compare(refPuzzle, genPuzzle, tolerances);
    const assembly = AssemblyComparisonEngine.compare(refPuzzle, genPuzzle, referenceManifest, tolerances);

    const allDiffItems: StructuredDiffItem[] = [
      ...geometry.diffItems,
      ...topology.diffItems,
      ...assembly.diffItems,
    ];

    const mismatchesOutsideTolerance = allDiffItems.filter((d) => !d.withinTolerance).length;
    const isMatched = mismatchesOutsideTolerance === 0;

    diag.info(
      "COMPARISON_COMPLETE",
      `Comparison complete: ${allDiffItems.length} properties evaluated, ${mismatchesOutsideTolerance} mismatch(es) outside tolerance (matched: ${isMatched}).`
    );

    return {
      referenceDesignId: refPuzzle.metadata.id,
      generatedDesignId: genPuzzle.metadata.id,
      mode,
      isMatched,
      totalPropertiesCompared: allDiffItems.length,
      mismatchesOutsideTolerance,
      geometry,
      topology,
      assembly,
      diffItems: allDiffItems,
      diagnostics: diag,
      durationMs: Date.now() - startTime,
    };
  }
}
