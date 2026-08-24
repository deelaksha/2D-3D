/**
 * Central, metadata-driven tool registry. Panels, the command palette and the
 * canvas all read from here. Registering a tool is the ONLY step needed to make
 * it appear in the UI — this is what lets the system grow to 1000+ tools.
 */
import type { ToolCategory, ToolDefinition } from "./toolTypes";

class ToolRegistry {
  private map = new Map<string, ToolDefinition>();
  private order: string[] = [];

  register(tool: ToolDefinition): void {
    if (this.map.has(tool.id)) {
      // Last registration wins but keep original position; warn in dev.
      if (import.meta.env?.DEV) console.warn(`Tool re-registered: ${tool.id}`);
    } else {
      this.order.push(tool.id);
    }
    this.map.set(tool.id, tool);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const t of tools) this.register(t);
  }

  get(id: string): ToolDefinition | undefined {
    return this.map.get(id);
  }

  all(): ToolDefinition[] {
    return this.order.map((id) => this.map.get(id)!).filter(Boolean);
  }

  byCategory(cat: ToolCategory): ToolDefinition[] {
    return this.all().filter((t) => t.category === cat);
  }

  categories(): ToolCategory[] {
    const seen = new Set<ToolCategory>();
    for (const t of this.all()) seen.add(t.category);
    return [...seen];
  }

  /** Fuzzy-ish ranked search over name / description / keywords / id. */
  search(query: string, limit = 30): ToolDefinition[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.all().slice(0, limit);
    const terms = q.split(/\s+/);
    const scored: { t: ToolDefinition; score: number }[] = [];
    for (const t of this.all()) {
      const hay = [t.name, t.description, t.id, t.subcategory ?? "", ...(t.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const term of terms) {
        const i = hay.indexOf(term);
        if (i < 0) {
          score = -1;
          break;
        }
        // Earlier + name matches rank higher.
        score += t.name.toLowerCase().includes(term) ? 10 : 3;
        score += i === 0 ? 5 : 0;
      }
      if (score >= 0) scored.push({ t, score });
    }
    scored.sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name));
    return scored.slice(0, limit).map((s) => s.t);
  }

  get size(): number {
    return this.map.size;
  }
}

/** Application-wide registry singleton. */
export const registry = new ToolRegistry();
