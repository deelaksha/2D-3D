/**
 * Parameter Evaluation Engine for 2D Parametric Pieces.
 *
 * Resolves named parameter values, mathematical expressions, and range constraints.
 */
import type { ParametricDefinition } from "./types";

export function evaluateParameterStore(
  parameters: Record<string, ParametricDefinition>,
  overrides: Record<string, number> = {},
): Record<string, number> {
  const resolved: Record<string, number> = {};

  // First pass: copy current or default values
  for (const [key, param] of Object.entries(parameters)) {
    let val = overrides[key] !== undefined ? overrides[key] : param.value ?? param.defaultValue;

    // Apply min/max bounds if defined
    if (param.minValue !== undefined && val < param.minValue) val = param.minValue;
    if (param.maxValue !== undefined && val > param.maxValue) val = param.maxValue;

    resolved[key] = val;
    resolved[param.name] = val;
  }

  // Second pass: evaluate simple math expressions if present
  for (const [key, param] of Object.entries(parameters)) {
    if (param.expression && overrides[key] === undefined) {
      try {
        const val = evaluateSimpleExpression(param.expression, resolved);
        if (!Number.isNaN(val) && Number.isFinite(val)) {
          resolved[key] = val;
          resolved[param.name] = val;
        }
      } catch {
        // Fallback to existing value if evaluation fails
      }
    }
  }

  return resolved;
}

function evaluateSimpleExpression(expr: string, context: Record<string, number>): number {
  // Simple evaluator replacing known parameter identifiers with numbers
  let safeExpr = expr;
  for (const [varName, varVal] of Object.entries(context)) {
    if (varName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
      const regex = new RegExp(`\\b${varName}\\b`, "g");
      safeExpr = safeExpr.replace(regex, String(varVal));
    }
  }

  // Sanity check: expression must now only contain numbers, spaces, and math operators (+, -, *, /, (, ))
  if (!/^[\d\s\.\+\-\*\/\(\)]+$/.test(safeExpr)) {
    return NaN;
  }

  // Use Function evaluation for simple arithmetic math
  return Function(`"use strict"; return (${safeExpr})`)();
}
