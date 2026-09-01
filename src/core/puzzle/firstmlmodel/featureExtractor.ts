/**
 * Feature Extractor for Connection Compatibility Classification (Phase 58).
 * Extracts 16 normalized numerical features in R^16 from interface pairs.
 */
import type { CanonicalInterface } from "../canonical/types";
import type { ConnectionCompatibilityFeatureVector } from "./types";

export class ConnectionFeatureExtractor {
  /**
   * Extracts a 16-element feature vector from two canonical interfaces.
   */
  static extractFeatures(
    ifaceA: CanonicalInterface,
    ifaceB: CanonicalInterface,
    isCompatibleGroundTruth: boolean
  ): ConnectionCompatibilityFeatureVector {
    const vec: number[] = new Array(16).fill(0.0);

    const typeA = ifaceA.interfaceType || (ifaceA as any).type || "tab";
    const typeB = ifaceB.interfaceType || (ifaceB as any).type || "slot";

    const wA = ifaceA.profile?.width || (ifaceA as any).geometry?.width || 20.0;
    const wB = ifaceB.profile?.width || (ifaceB as any).geometry?.width || 20.0;
    const dA = ifaceA.profile?.depth || (ifaceA as any).geometry?.depth || 3.0;
    const dB = ifaceB.profile?.depth || (ifaceB as any).geometry?.depth || 3.0;
    const clearance = ifaceA.profile?.clearance || (ifaceA as any).parameters?.clearanceMm || 0.15;

    // Feature 0: Width A ratio
    vec[0] = Math.min(1.0, wA / 100.0);
    // Feature 1: Width B ratio
    vec[1] = Math.min(1.0, wB / 100.0);
    // Feature 2: Width delta
    vec[2] = Math.min(1.0, Math.abs(wA - wB) / 50.0);
    // Feature 3: Depth A ratio
    vec[3] = Math.min(1.0, dA / 10.0);
    // Feature 4: Depth B ratio
    vec[4] = Math.min(1.0, dB / 10.0);
    // Feature 5: Clearance ratio
    vec[5] = Math.min(1.0, clearance / 1.0);
    // Feature 6: Interface Type Match
    vec[6] = typeA === typeB ? 1.0 : 0.0;

    // Normal vectors dot product
    const nA = ifaceA.localFrame?.normal || (ifaceA as any).normal || { x: 0, y: 1, z: 0 };
    const nB = ifaceB.localFrame?.normal || (ifaceB as any).normal || { x: 0, y: -1, z: 0 };
    const dot = nA.x * nB.x + nA.y * nB.y + nA.z * nB.z;

    // Feature 7: Normal vector dot product
    vec[7] = dot;
    // Feature 8: Normal vector anti-parallel alignment (opposite normals yield 1.0)
    vec[8] = dot < -0.5 ? 1.0 : 0.0;
    // Feature 9: Fit tolerance A
    vec[9] = Math.min(1.0, (ifaceA.tolerance || 0.15) / 1.0);
    // Feature 10: Fit tolerance B
    vec[10] = Math.min(1.0, (ifaceB.tolerance || 0.15) / 1.0);
    // Feature 11: Tolerance delta
    vec[11] = Math.abs(vec[9] - vec[10]);
    // Feature 12: Complementary Port Check (tab matching slot)
    vec[12] = (typeA === "tab" && typeB === "slot") || (typeA === "slot" && typeB === "tab") ? 1.0 : 0.0;
    // Feature 13: Finger Joint Complementary Check
    vec[13] = typeA === "finger" && typeB === "finger" ? 1.0 : 0.0;
    // Feature 14: Valid positive dimensions check
    vec[14] = wA > 0 && wB > 0 && dA > 0 && dB > 0 ? 1.0 : 0.0;
    // Feature 15: Bias
    vec[15] = 1.0;

    return {
      vector: vec,
      interfaceAId: ifaceA.id,
      interfaceBId: ifaceB.id,
      groundTruthCompatible: isCompatibleGroundTruth,
    };
  }
}
