/**
 * Tool aggregation. Each category module exports a `ToolDefinition[]`; this
 * barrel registers them all. Adding a new tool file = import + spread here.
 */
import { registry } from "./registry";
import { geometryTools } from "./geometry.tools";
import { booleanTools } from "./boolean.tools";
import { connectorTools } from "./connector.tools";
import { joineryTools } from "./joinery.tools";
import { transformTools } from "./transform.tools";
import { measureTools } from "./measure.tools";
import { layoutTools } from "./layout.tools";
import { materialTools } from "./material.tools";
import { editTools } from "./edit.tools";

export function registerAllTools(): void {
  registry.registerAll([
    ...geometryTools,
    ...booleanTools,
    ...transformTools,
    ...measureTools,
    ...layoutTools,
    ...materialTools,
    ...editTools,
  ]);
}

export { registry } from "./registry";
