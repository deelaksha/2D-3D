/**
 * Tool contract. The UI is generated from this metadata so the system scales
 * to 1000+ tools without hand-written buttons. A tool is pure metadata plus an
 * optional `execute` that calls the semantic actions in core/store/actions.
 */
import type { EditorMode } from "../core/store/store";
import type {
  ConnectorType,
  Part,
  Project,
  ShapeKind,
  Vec2,
} from "../core/model/types";
import type { UIState } from "../core/store/store";

export type ToolCategory =
  | "geometry"
  | "boolean"
  | "connector"
  | "joinery"
  | "transform"
  | "measure"
  | "layout"
  | "material"
  | "assembly"
  | "edit"
  | "view";

export const CATEGORY_META: Record<ToolCategory, { label: string; icon: string; order: number }> = {
  geometry: { label: "Shapes", icon: "▭", order: 0 },
  boolean: { label: "Combine", icon: "⬒", order: 1 },
  connector: { label: "Connectors", icon: "◗", order: 2 },
  joinery: { label: "Joinery", icon: "⊟", order: 3 },
  transform: { label: "Transform", icon: "✥", order: 4 },
  measure: { label: "Measure", icon: "📏", order: 5 },
  layout: { label: "Layout", icon: "▦", order: 6 },
  material: { label: "Material", icon: "🪵", order: 7 },
  assembly: { label: "Assembly", icon: "🧩", order: 8 },
  edit: { label: "Edit", icon: "✎", order: 9 },
  view: { label: "View", icon: "◉", order: 10 },
};

/** How the canvas should interpret selecting this tool. */
export type ToolKind = "command" | "draw" | "transform" | "connector" | "mode";

export type ToolParamType = "number" | "text" | "select" | "boolean";

export interface ToolParam {
  id: string;
  label: string;
  type: ToolParamType;
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: "mm" | "deg" | "%";
  options?: { value: string; label: string }[];
}

/** Runtime context handed to a tool's execute(). */
export interface ToolContext {
  project: Project;
  ui: UIState;
  /** World-space point (mm) where the tool was invoked, if any. */
  point?: Vec2;
  activePartId: string | null;
  activePart?: Part;
  selection: string[];
  /** Collected parameter values keyed by ToolParam.id. */
  params: Record<string, unknown>;
}

export interface ToolDefinition {
  id: string; // e.g. "geometry.rectangle"
  name: string;
  category: ToolCategory;
  subcategory?: string;
  icon: string;
  /** Child-friendly one-liner ("Cut one shape out of another"). */
  description: string;
  /** Longer explanation for the tooltip body. */
  hint?: string;
  shortcut?: string;
  /** Animation id understood by the TooltipAnimator. */
  tooltipAnimation?: string;
  supportedModes: EditorMode[];
  kind: ToolKind;
  /** For kind "draw": the shape this tool draws. */
  createsShape?: ShapeKind;
  /** For kind "connector": the connector type this tool places. */
  createsConnector?: ConnectorType;
  /** For kind "transform": the transform gesture. */
  transformMode?: "move" | "rotate" | "scale" | "mirrorX" | "mirrorY";
  parameters?: ToolParam[];
  /** Extra search keywords (synonyms, child words). */
  keywords?: string[];
  undoable?: boolean;
  /** Immediate action for kind "command"; optional for others. */
  execute?: (ctx: ToolContext) => void;
  /** Whether the tool is currently applicable. */
  isEnabled?: (ctx: ToolContext) => boolean;
}
