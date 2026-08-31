/**
 * Interface Compatibility Checking Engine.
 *
 * Evaluates mating compatibility between two explicit connection interfaces:
 *  - Gender role complementarity ("insert" + "receiver" vs same-gender rejection)
 *  - Connection type matching (e.g. "tab_slot", "interlock", "edge_contact")
 *  - Dimensional profile fit within mechanical tolerances
 *  - 3D joining angle range overlap
 */
import type { CompatibilityResult, ConnectionInterfaceSystem } from "./types";

export function checkInterfaceCompatibility(
  ifaceA: ConnectionInterfaceSystem,
  ifaceB: ConnectionInterfaceSystem,
): CompatibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 1.0;

  // 1. Same-interface rejection
  if (ifaceA.id === ifaceB.id) {
    return {
      compatible: false,
      score: 0.0,
      reasons: ["Cannot mate an interface with itself."],
    };
  }

  // 2. Gender Role Compatibility Check
  const genderA = ifaceA.compatibility.genderRole;
  const genderB = ifaceB.compatibility.genderRole;

  const allowOverride =
    ifaceA.compatibility.allowSameGenderOverride || ifaceB.compatibility.allowSameGenderOverride;

  let genderCompatible = false;
  if (genderA === "insert" && genderB === "receiver") genderCompatible = true;
  else if (genderA === "receiver" && genderB === "insert") genderCompatible = true;
  else if (genderA === "neutral" && genderB === "neutral") genderCompatible = true;
  else if (allowOverride) genderCompatible = true;

  if (!genderCompatible) {
    reasons.push(
      `Incompatible gender roles: '${genderA}' cannot mate with '${genderB}' without explicit override.`,
    );
    score -= 0.6;
  }

  // 3. Connection Type Compatibility Check
  const typeAAllowed = ifaceA.compatibility.allowedTypes.includes(ifaceB.type);
  const typeBAllowed = ifaceB.compatibility.allowedTypes.includes(ifaceA.type);

  if (!typeAAllowed || !typeBAllowed) {
    reasons.push(
      `Connection type mismatch: interface A (${ifaceA.type}) and interface B (${ifaceB.type}) are not in each other's allowed types list.`,
    );
    score -= 0.4;
  }

  // 4. Dimensional Profile Fit Check
  const widthDiff = Math.abs(ifaceA.profile.width - ifaceB.profile.width);
  const maxTol = Math.max(ifaceA.tolerance, ifaceB.tolerance);

  if (widthDiff > maxTol) {
    reasons.push(
      `Profile width mismatch: width difference (${widthDiff.toFixed(2)}mm) exceeds tolerance limit (${maxTol.toFixed(2)}mm).`,
    );
    score -= 0.3;
  } else if (widthDiff > 0) {
    warnings.push(`Slight width variance: ${widthDiff.toFixed(2)}mm within tolerance.`);
  }

  // 5. 3D Joining Angle Range Overlap Check
  const rangeA = ifaceA.kinematicConstraints.allowedAngleRange;
  const rangeB = ifaceB.kinematicConstraints.allowedAngleRange;

  const overlapMin = Math.max(rangeA.minAngleDeg, rangeB.minAngleDeg);
  const overlapMax = Math.min(rangeA.maxAngleDeg, rangeB.maxAngleDeg);

  if (overlapMin > overlapMax) {
    reasons.push(
      `No overlapping 3D joining angle range: interface A allowed [${rangeA.minAngleDeg}°, ${rangeA.maxAngleDeg}°] vs interface B allowed [${rangeB.minAngleDeg}°, ${rangeB.maxAngleDeg}°].`,
    );
    score -= 0.5;
  }

  const compatible = reasons.length === 0 && score > 0.0;
  score = Math.max(0.0, Math.min(1.0, score));

  return {
    compatible,
    score,
    reasons,
    warnings,
  };
}
