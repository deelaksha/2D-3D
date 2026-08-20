> ## 🔁 RE-AUDIT ROUND 2 (2026-08-18) — fresh skeptical pass over the *current* code
> A second from-scratch investigation (live app + 2 adversarial sub-audits) was run over the code *including* the round-1 fixes, treating them with suspicion. It found real bugs — several were **regressions introduced by round 1**. All items below were **fixed and verified live** (`tsc`/build clean, 7/7 tests, 0 runtime errors).
>
> **Regressions from round 1 (now fixed)**
> - **Gesture interleaving (P1)** — a keyboard action (Ctrl+V/D, arrow-nudge) fired *mid-drag* prematurely closed the canvas gesture → per-mousemove undo spam. Fixed: gestures are now **reference-counted** (`store.beginGesture/endGesture` nest; only the outermost pushes history). `store.ts`.
> - **`endGesture` never emitted (P2)** — Undo/Redo button stayed stale (disabled) right after a drag/nudge. Fixed: `endGesture` now calls `emit()`. Verified: after a draw the Undo button reads "Undo Draw Rect" immediately.
> - **Inspector Enter double-commit (P2)** — Enter ran `commit()` *then* `blur()`→`commit()` = two identical undo entries. Fixed: Enter now only blurs; `onBlur` is the single commit site.
> - **Connector-label toggle neutered (P2)** — round 1's contextual-only gate meant the "show connector labels" toggle could never show all labels. Fixed: contextual by default (`showConnectorLabels` default → false), and the toggle now reveals **all** labels (verified: 0→24, each on a plate).
>
> **Pre-existing bugs found & fixed**
> - **Delete/Cut destroyed locked parts (P2)** — keyboard Delete/Ctrl+X ignored `locked` (inconsistent with move/nudge/marquee). Fixed: bulk delete/cut skip locked; the explicit per-row ✕ still force-deletes. Verified: locked part survives Delete.
> - **Move cloned the whole project once *per selected part per frame* (P1 perf)** — Fixed: one batched `updatePartsTransform` commit per mousemove (one clone + one render regardless of selection size).
> - **Repeated paste stacked copies exactly on top (P2)** — Fixed: pastes now cascade (offset ×N). Verified 7→8→9 at stepped positions.
> - **`pointercancel` committed an interrupted drag (P3)** — Fixed: its own handler now `cancelGesture()`s (reverts).
> - **Receiver connector (hole/slot/notch) = 2 undo steps (P3)** — Fixed: connector + cut wrapped in one gesture.
> - **Material chip color-on-color contrast (P2)** — Fixed: text color now chosen by background luminance (WCAG).
> - **Lock state invisible at rest in Layers (P2)** — Fixed: a persistent 🔒 shows on locked rows; hidden rows dim; actions also reveal on focus.
> - **A11y**: dropdown triggers get `aria-haspopup`/`aria-expanded`; palette gets `role="dialog"`/`aria-modal`; unit `<select>` gets `aria-label`; empty palette row no longer looks clickable; `.wk-badge` now has a real pill background; `◆` badge glyph `aria-hidden`.
> - **TopBar label mismatch (P2)** — category launchers now derive labels from `CATEGORY_META` (so "Shapes/Connectors/Layout…" match the palette scope chip, instead of "Design/View" mapping confusingly to `geometry`/`layout`).
> - **PartsPanel stale docstring** describing the removed 3D-drag — deleted.
>
> **Round-2 findings deliberately deferred (still open):**
> - Inspector: undoing via the toolbar while a field is focused can re-commit the typed value on blur (largely mitigated — global Ctrl+Z is already blocked while typing). *(P2)*
> - Parts vs Layers are still two overlapping trees with no explained distinction. *(P2 — needs the merge/redesign)*
> - Escape mid-drag both cancels the drag AND clears selection (two window listeners). *(P3)*
> - TopBar menus still lack full arrow-key roving/focus-trap (have ARIA + Escape + Tab). *(P3)*
> - Emoji/unicode icon mix persists; favorites/recent rows don't show the active highlight (intentional). *(P3)*
> - When "show all labels" is on, adjacent connector labels can still lightly overlap (plates keep them legible). *(P3)*
>
> ---

> ## ✅ FIXES APPLIED (2026-08-18, same session)
> The following were implemented and **verified in the running app** (headless Chrome) + `tsc`/`vite build` clean + 7/7 tests pass. IDs refer to the register below.
>
> **Trust & correctness**
> - **UX-001** — `File` is now a real dropdown (New / Import / Export); **New project asks for confirmation** before replacing your work (verified: dismissing keeps all 7 parts).
> - **UX-002** — Real **Edit** dropdown (Undo, Redo, Duplicate, Delete, Select all — with shortcut hints); category buttons kept as honest palette launchers, separated by a divider.
> - **UX-027** — Dimension validation: width/height/thickness clamp to ≥ `0.1 mm` (verified: entering `-99` → `0.1`).
> - **UX-028** — Removed the dead "Drag into the 3D view" copy + drag handlers from PartsPanel.
> - **UX-029** — Added a 🪵 SVG favicon (kills the only console 404).
> - **UX-006** — Changing the display unit no longer pushes an undo entry (`store.patchSilent`).
>
> **Undo / commit granularity** (new `store.beginGesture/endGesture/patchSilent`, gesture-coalesced history)
> - **UX-003** — Inspector fields commit **once on blur/Enter**, not per keystroke.
> - **UX-004** — Canvas move/resize/rotate commit **once on pointer-up** (one drag = one undo).
> - **UX-005** — Drawing a shape is now **one** undo entry (verified: draw → single Ctrl+Z removes it).
>
> **Canvas ergonomics**
> - **UX-013** — **Marquee (rubber-band) selection** (verified: dragging a box selected 5 parts; Shift adds).
> - **UX-014** — **Ctrl+C/V/X, Ctrl+D, Ctrl+A, arrow-nudge** (Shift = 10×), and **Escape** cancels a draw/marquee or clears selection (verified: Ctrl+A→7, Ctrl+D→14, one undo→7).
> - **UX-015** — Canvas **zoom HUD** (−, %, +, Fit) bottom-right, with reusable `fitToContent`.
> - **UX-018** — Resize handles enlarged to 8px, rotate knob to 11px.
>
> **Connectors / panels / tools**
> - **UX-007** — Connector labels **decluttered**: shown only for the selected/hovered part, each on a readable background plate (verified: 24-label mush → 4 clean labels on selection).
> - **UX-010** — Parts badge now shows a `◆` connector glyph beside the count.
> - **UX-023** — **Favorites star** on every tool (state existed; now settable — verified toggling works).
> - **UX-024** — Disambiguated the duplicate "Slot" (geometry → "Slotted Hole"; connector Slot given a distinct icon).
> - **UX-026** — `mirrorX/mirrorY` now use the real `flip` tooltip animation instead of `move`.
> - **UX-031** — Active tool highlighted once (removed the duplicate highlight in Favorites/Recent rows).
>
> **Not yet done (recommended next):** UX-008 (connector type/direction badges), UX-009/011/012 (unify Parts+Layers tree, always-visible lock/eye state), UX-016 (resize rotated parts), UX-017 (absolute/edge snapping + smart guides), UX-020 (full shortcut registry), UX-021/022/025 (toolbox virtualization, fuzzy search, SVG icon set), UX-030 (onboarding). Bottom two connector labels can still lightly overlap — a fuller collision pass is the follow-up.
>
> ---

# WoodKit Designer — 2D Experience UX/Engineering Audit

**Auditor:** Senior UI/UX + frontend + design-tool engineer (investigation-only pass)
**Date:** 2026-08-18
**Build audited:** `main` working tree, `npm run dev` on `http://localhost:5555`
**Verdict source:** app run live (headless Chrome, real click/drag/keyboard interaction at 1280/1440/1920), full source read (30+ files), 2 deep sub-audits (Canvas2D, tool architecture).

> Product goal this is measured against: **a child-friendly *and* professional 2D designer for physical wooden construction kits** — draw parts, cut geometry, place & name connectors, organize parts like Photoshop layers, then (later) move to 3D and assemble. Must feel like Figma/Illustrator/simple-CAD, not old engineering software, and must scale to **1,000+ tools**.

---

## 1. EXECUTIVE SUMMARY

This is **not an unfinished prototype** — it is a genuinely well-architected foundation with a real design-token system, a data-driven tool registry, snapshot undo/redo, localStorage autosave, dynamic unit conversion, a child-friendly command palette, and a working draw→select→edit→organize loop. Build is clean (`tsc -b` + vite, 68 modules), 7 tests pass, and there are **zero runtime JS errors** (only a favicon 404).

The problems are **not** "it's broken" — they are **product-clarity and interaction-quality** problems that stand between this and a professional tool:

1. **The top menu bar lies.** It looks like File/Edit/View/… but `File` **instantly wipes your project with no confirmation and no undo**, and the other "menus" open a search palette instead of a dropdown. This is the single worst first-run experience.
2. **Commit granularity is wrong everywhere.** One logical action = many undo entries and many full-document deep-clones: per **keystroke** in the Inspector, per **mouse-move** during canvas drag, **2 entries per drawn shape**. This pollutes undo *and* is the main performance risk at scale.
3. **Connector labels overlap into unreadable mush** — there is literally zero label-collision logic, and connectors are the product's signature feature.
4. **Part vs. object, and Parts vs. Layers, are confusing.** Two near-duplicate right-hand trees; connectors are only revealed under "Layers"; the number badge on a part is unexplained.
5. **Canvas is missing table-stakes:** no marquee select, no copy/paste/duplicate/select-all shortcuts, no arrow-nudge, Escape doesn't cancel, no zoom buttons / re-fit control, rotated parts can't be resized.
6. **The architecture is ready for ~150 tools, not 1,000.** No list virtualization, substring-only search, no shortcut registry (declared Ctrl+D/G/A shortcuts silently do nothing), favorites has state but no button to set it, icons are an inconsistent emoji/unicode mix.
7. **Child-friendliness is half-done:** the command-palette copy is excellent ("*A tab pokes out to lock into a slot*"), but the toolbar itself still says "Union / Intersect / Divide / Transform," terminology a child won't parse.

**None of these require a rewrite.** They are targeted fixes on a sound base.

### CURRENT UX SCORE: **5.5 / 10**
Strong bones, professional visual system, but first-run trust is broken (destructive File), the hero feature (connectors) reads as clutter, and core canvas ergonomics are incomplete.

---

## 2. USER-JOURNEY SCORES (1–10)

| Dimension | Score | One-line reason |
|---|---|---|
| First-time understanding | 4 | Menu bar misleads; no onboarding; "Parts vs Layers" and the count-badge are unexplained. |
| Tool discoverability | 6 | Good categories + palette + search; but favorites unsettable, "create a hole/slot/tab" hard to map, connectors split across places. |
| 2D drawing | 6 | Click-drag draw works and feels ok, but forces a tool-switch after each shape and can't click-to-place a default. |
| Part creation | 6 | Draw→part is automatic and correct; "+ Add Part" works; but the design-object vs physical-part concept is never explained. |
| Part organization | 5 | Drag-reorder, rename, visibility, lock, duplicate all exist — but hidden behind hover, and Parts/Layers duplication confuses. |
| Connector creation | 6 | Palette copy is superb; placement single-click works. |
| Connector management | 3 | On-canvas labels overlap unreadably; no clear "this is a connection point" affordance; type/direction not visually legible. |
| Dimension editing | 6 | Inspector is well grouped, units convert live; but per-keystroke commits + **no validation** (accepts negative/zero). |
| Canvas interaction | 4 | No marquee, no copy/paste/nudge, Escape inert, no zoom UI, rotated parts unresizable, 6px handles, drag = undo spam. |
| Layer management | 5 | Feature-complete but emoji icons, hover-hidden actions, no collapse, connectors not labeled as connectors. |
| Property editing | 6 | Clean, grouped, unit-aware; validation + commit-granularity are the gaps. |
| Undo / redo | 4 | Robust snapshot engine, but wrong granularity (multi-entry per action) and `File`/import wipe history irreversibly. |
| Visual consistency | 7 | Excellent token system; loses points on icon inconsistency, emoji, hardcoded canvas colors. |
| Child friendliness | 5 | Palette descriptions great; toolbar/menu terminology still engineer-y; no visual "what does this do" for many tools. |
| Professional usability | 5 | Feels close, but missing canvas ergonomics + destructive File + label clutter break the illusion. |
| **Overall UX** | **5.5** | Great foundation; product clarity + interaction polish are the gap. |

---

## 3. CRITICAL ISSUES (P0 / P1)

There are **no P0** issues (the app runs, builds, saves, and you can complete the core loop). The P1s below are the ones that break trust or the hero workflow.

---

## 4. ISSUE REGISTER

> Format: ID · Category · Priority · Location · Problem · Why · Expected · Recommendation. **[CONFIRMED]** = reproduced live or proven in source. **[POSSIBLE]** = strong source signal, not fully reproduced.

### Data-loss / trust

**UX-001 · Data integrity · P1 · TopBar "File" button** — **[CONFIRMED]**
Clicking **File** calls `handleNew()` → `store.loadProject(makeProject())` (`TopBar.tsx:26-28`), which **immediately replaces the whole project and clears undo/redo history** (`store.ts:151-157`). No confirmation dialog. Autosave then overwrites the saved demo within 400ms (`io.ts:176-183`).
*Why:* A new user clicks "File" expecting a menu and instantly, irreversibly loses all work. Verified live: the House demo vanished to an empty "New project."
*Expected:* "File" opens a menu (New / Open / Save / Export / Import); "New" confirms if there are unsaved changes.
*Fix:* Convert File into a real dropdown; gate `handleNew` behind a confirm when `parts.length > 0`; keep a "revert" path.

**UX-002 · Mental model · P1 · Top menu bar** — **[CONFIRMED]**
`Design/Connect/Joinery/Transform/Measure/Edit/View` are not menus — each opens the **command palette scoped to one category** (`TopBar.tsx:8-20`). No dropdown ever appears (verified: clicking each produced no menu items). "Edit" shows edit *tools*, not Undo/Copy/Paste; there is no real File/Edit menu.
*Why:* It violates the universal menubar convention; users can't predict any menu's behavior; "where is Save?" has no answer.
*Expected:* Either real dropdown menus, OR drop the menubar metaphor and label these as what they are (e.g. a horizontal category launcher / "Tools ▾").
*Fix:* Replace with real menus for File/Edit/View, and move category launchers into clearly-labeled affordances (or rely on the left toolbox + ⌘K, which already do this job).

### Undo / commit granularity (systemic)

**UX-003 · Undo · P1 · Inspector numeric fields** — **[CONFIRMED]**
`NumField` commits on **every `onChange` keystroke** (`Inspector.tsx:101-104`) and each commit deep-clones the entire project and pushes an undo entry (`actions.ts:74-79,148-157`; `store.ts:140-147`). Typing "120" = up to 3 commits.
*Why:* Undo becomes unusable (undoes digit-by-digit); at large projects each keypress clones the whole document.
*Fix:* Commit on **blur / Enter** (keep live local text for display), or coalesce commits within a field-edit session into one history entry.

**UX-004 · Undo/Perf · P1 · Canvas move/resize/rotate** — **[CONFIRMED via source]**
Move calls `updatePartTransform(...)` and resize/rotate call `store.commit(...)` **on every pointer-move** (`Canvas2D.tsx:494,518,538`). One drag = dozens of full-project clones + dozens of undo entries.
*Why:* Undo spam (a single drag floods the 200-entry stack) + the primary lag source at 500–1000 objects.
*Fix:* Use transient live-drag state during the gesture; **commit once on pointer-up**.

**UX-005 · Undo · P2 · Draw = 2 undo entries** — **[CONFIRMED]**
Drawing one rectangle produces `Create Rect` **and** `Edit shape` (verified: 2 undo presses to remove one shape).
*Fix:* Create the part at final size in a single commit (pass dimensions into `createPart`), or wrap create+size in one labeled commit.

**UX-006 · Undo · P3 · Unit change is undoable** — **[CONFIRMED]**
Changing the display unit runs `store.commit("Change unit")` (`StatusBar.tsx:17-19`), so a view preference pollutes document history.
*Fix:* Store `displayUnit` as UI state (or commit without history), so undo doesn't step through unit toggles.

### Connectors (hero feature)

**UX-007 · Connector UX · P1 · Canvas connector labels** — **[CONFIRMED]**
Labels are drawn at a fixed offset from each glyph with **no collision detection, no background plate, no hide-on-overlap, `pointerEvents:none`** (`Canvas2D.tsx:985-996`). Verified: "Wall1-Left / Wall1-BottomRight / Wall4-Right" overlap into unreadable text on the demo.
*Why:* Connectors are the product's differentiator; today they read as visual noise.
*Fix:* Add label background plates, collision/de-clutter (hide labels below a zoom threshold or when overlapping, show on hover/selection), and/or leader lines. Short-term: default `showConnectorLabels` off and reveal on part hover/select.

**UX-008 · Connector UX · P2 · "This is a connection point" legibility** — **[CONFIRMED]**
Connector glyphs render by type but there's no consistent, learnable visual language for *point vs slot vs hole*, no direction indicator, and in the Layers tree connectors appear as bare `◆ name` with **no "connector" label or type chip** (`LayersPanel.tsx:154-165`).
*Fix:* Standardize connector iconography + a small type/direction badge on canvas and in the tree; label the tree children as connectors.

### Part vs object / panels

**UX-009 · Information architecture · P1 · Parts vs Layers duplication** — **[CONFIRMED]**
Two right-hand tabs list the same parts differently: **Parts** = flat list + material chip + unexplained count badge (`PartsPanel.tsx`); **Layers** = hierarchy with connectors as children + visibility/lock (`LayersPanel.tsx`). The connector hierarchy only exists under "Layers"; a user won't know to look there.
*Why:* The core "a Wall *part* contains geometry + connectors" concept is scattered across two tabs, neither of which states it.
*Fix:* Merge into **one** tree ("Parts" with expandable connectors, visibility/lock/reorder inline), or clearly differentiate roles (Parts = physical BOM, Layers = z-order) and cross-link them.

**UX-010 · Discoverability · P2 · Count badge unexplained** — **[CONFIRMED]**
The number badge on each part (`4`, `2`, …) is the connector count but is unlabeled except a `title` tooltip (`PartsPanel.tsx:61-63`).
*Fix:* Add a tiny connector glyph next to the number, or label on hover more prominently.

**UX-011 · Discoverability · P2 · Row actions hidden until hover** — **[CONFIRMED]**
Visibility/lock/duplicate/delete are `opacity:0` until row hover (`app.css:121-122`); the lock/hidden **state** isn't shown at rest (only a leading `■/□`). No touch support.
*Fix:* Always show state icons (a persistent lock/eye when locked/hidden); reveal the full action cluster on hover/focus, but keep state visible.

**UX-012 · Consistency · P3 · Redundant visibility indicators** — **[CONFIRMED]**
Each Layers row shows both a leading `■/□` visibility glyph *and* a separate 👁/🕶 toggle button (`LayersPanel.tsx:88,120`) — two representations of the same state.
*Fix:* One eye toggle that also communicates state.

### Canvas ergonomics

**UX-013 · Canvas · P2 · No marquee/rubber-band select** — **[CONFIRMED]**
Clicking empty canvas only clears; there is no drag-to-select-many (`Canvas2D.tsx:440-443`, no `marquee` drag mode).
*Fix:* Add rubber-band selection (drag on empty space).

**UX-014 · Canvas/Keyboard · P2 · Missing standard shortcuts** — **[CONFIRMED]**
No Ctrl+C/V/X, Ctrl+D (duplicate), Ctrl+A (select all), arrow-key nudge; Escape only closes the palette and does **not** cancel an in-progress draw or clear selection (`App.tsx:77-89`).
*Fix:* Wire copy/paste/cut/duplicate/select-all + arrow nudge (Shift = 10× step); make Escape cancel draw → else clear selection.

**UX-015 · Canvas · P2 · No zoom controls / re-fit** — **[CONFIRMED]**
Zoom is wheel-only; zoom-to-fit runs once automatically but there is **no button or shortcut** to re-fit, zoom in/out, or reset (`Canvas2D.tsx:243-269`). Declared `Shift+1`/`Shift+0` shortcuts don't fire (see UX-020).
*Fix:* Add a small canvas HUD (zoom %, +/−, Fit, 100%) — the `.wk-hud-card` styles already exist and are unused.

**UX-016 · Canvas · P2 · Rotated parts cannot be resized** — **[CONFIRMED via source]**
Resize handles are disabled unless `rotation % 360 === 0` (`Canvas2D.tsx:354`).
*Fix:* Support resize in the part's local frame when rotated.

**UX-017 · Canvas · P3 · Snapping snaps the delta, not the edge** — **[CONFIRMED via source]**
Move snapping rounds the movement delta (`snapDelta`, `Canvas2D.tsx:295-299`), so an off-grid part stays permanently off-grid; angle snap is hardcoded 15° and coupled to grid-snap (`:534`).
*Fix:* Snap absolute edges/positions; add smart alignment guides; decouple angle-snap from grid-snap.

**UX-018 · Canvas · P3 · Handles are 6px (below grab target)** — **[CONFIRMED via source]**
Handle visuals are 6×6px, rotate knob 9px (`Canvas2D.tsx:905-932`); hit radius is more forgiving (9–10px) but the visual is hard to see/target.
*Fix:* ≥8px visuals with clearer affordance; keep generous hit area.

**UX-019 · Canvas · P3 · Draw forces tool-switch + no click-to-place** — **[CONFIRMED via source]**
After each shape the tool auto-switches to Move (`Canvas2D.tsx:593-599`), and drags under `MIN_DRAW_MM=3` are rejected (`:562`) so you can't click to place a default-sized part.
*Fix:* Add a "keep tool active" option (or Alt to chain); allow click = place default-sized shape.

### Tool architecture / scale

**UX-020 · Shortcuts · P2 · Declared shortcuts never fire** — **[CONFIRMED via source]**
Only single-key, modifier-less shortcuts dispatch (`App.tsx:82-88`). Tools declaring `Ctrl+D` (duplicate), `Ctrl+G` (group), `Ctrl+A` (select all), `Shift+G`, `Shift+1/0` show a shortcut chip in their tooltip but **do nothing**.
*Fix:* Central keymap registry keyed by normalized chord, with collision detection; one dispatcher consulting it.

**UX-021 · Scale · P2 · No toolbox virtualization** — **[CONFIRMED via source]**
`LeftToolbox` mounts one `<button>` per tool for every expanded category and re-scans the registry per category per render (`LeftToolbox.tsx:193-220,194`). Fine at 93 tools; at 1000 it mounts 1000+ buttons.
*Fix:* Windowed lists (react-window), lazy category expansion, memoized `byCategory`.

**UX-022 · Scale · P3 · Substring-only search called "fuzzy"** — **[CONFIRMED via source]**
`registry.search` rebuilds a haystack string for all N tools per keystroke, AND-substring only (`registry.ts:45-69`).
*Fix:* Prebuilt index / real fuzzy (Fuse/uFuzzy) with precomputed fields.

**UX-023 · Feature-dead · P2 · Favorites has state but no way to set one** — **[CONFIRMED via source]**
`favoriteToolIds` + `toggleFavoriteTool` exist and a Favorites row renders, but no star/affordance ever calls the toggle (`actions.ts:398-402` unused by UI).
*Fix:* Add a star on tool buttons / palette rows.

**UX-024 · Consistency · P2 · "Slot" defined twice + icon collisions** — **[CONFIRMED via source]**
`name:"Slot"` exists as both `geometry.slot` (`geometry.tools.ts:257`) and `connector.slot` (`connector.tools.ts:44`), and `connector.slot`'s icon `▭` is identical to `geometry.rect`. Many glyphs are reused across different tools (`⊔`, `⧉`, `◎`, `⊟`…).
*Fix:* Disambiguate names ("Slot cutout" vs "Slot connector"); a dev-time uniqueness lint for id/name/icon/shortcut.

**UX-025 · Visual · P3 · Icon system is an inconsistent glyph/emoji mix** — **[CONFIRMED]**
Icons are strings mixing monochrome unicode (`▭ ○ △`), full-color emoji (`🪵 🧲 🔄 📏 🗑`), and multi-char strings (`🔍+`), plus filled-vs-outline inconsistency (`peg ●` vs `hole ◯`, `star ★`) — verified visually in the toolbox.
*Fix:* One SVG icon set with consistent stroke/fill/size.

**UX-026 · Tooltip · P3 · Animation coverage is partial; 3 renderers dead** — **[CONFIRMED via source]**
Geometry/connector/joinery/transform have real animated demos; **boolean, measure, material, align/distribute fall back to a generic pulse**; `flip`/`measure`/`grid` renderers exist but no tool references them; `mirrorX/Y` point at `"move"` instead of the existing `flip`.
*Fix:* Per-`kind` default animations; map mirror→flip; validator linking `tooltipAnimation` ids to renderers.

### Validation / errors / empty states

**UX-027 · Validation · P2 · No numeric validation (negative/zero accepted)** — **[CONFIRMED]**
Verified: setting Width to **-50** is accepted and stored (`Inspector.tsx` NumField → `setPartShape`, no clamp). Thickness/height likewise.
*Fix:* Clamp to sensible minimums (>0), show inline validation, and a helpful message ("Width must be greater than 0").

**UX-028 · Product gap · P2 · No 2D→3D path, but 3D affordances remain** — **[CONFIRMED]**
3D was removed, yet PartsPanel rows still say **"Drag … into the 3D view to place it"** (`PartsPanel.tsx:48`) and `handleDragStart` sets a `partId` payload for a 3D canvas that no longer exists. The intended workflow's "Move to 3D" step has no entry point.
*Fix:* Remove the dead 3D drag copy/handlers now; when 3D returns, add an explicit "View in 3D" affordance.

**UX-029 · Polish · P4 · Favicon 404** — **[CONFIRMED]**
`index.html` has no favicon → the only console error is a 404 for `/favicon.ico`.
*Fix:* Add an emoji/data-URI favicon (`🪵`).

**UX-030 · Empty states · P3 · Thin empty states** — **[CONFIRMED]**
Empty project shows "No parts yet — add one below." (good start) but the empty Inspector just says "Select a part or connector" and there's no first-run guidance toward the intended workflow.
*Fix:* Teach the next step ("Pick a shape on the left and drag on the canvas to make your first part").

**UX-031 · Consistency · P4 · Double active-tool highlight** — **[CONFIRMED]**
The active tool is highlighted in both the category grid and the Recent/Favorites row simultaneously (verified: two `.wk-tool--active` for Rectangle).
*Fix:* Single active indicator, or don't duplicate the active tool into Recent.

---

## 5. DETAILED LISTS

### UI ALIGNMENT / LAYOUT
- **[Good]** Token-driven shell grid (`app.css:24-39`); consistent panel heads, fields, chips, badges; consistent 4/8/12/16/24/32 spacing scale (`theme.css:42-48`). Alignment is generally clean.
- **[Confirmed]** `Import`/`Export` render as `wk-btn--ghost` buttons visually mixed into the menu bar row, making them read as menu items with different weight (UX-002 neighbor).
- **[Possible]** In static `--screenshot` captures a grey band appeared under the canvas; live measurement showed the SVG fills its container exactly (900×822). Likely a **pre-ResizeObserver first-paint flash**, not a persistent gap — verify by watching initial load; add an initial height so first paint fills.
- **[Confirmed]** No responsive breakpoints (only dark-mode `@media`); fixed 236+304px side rails. Fine ≥1280; below ~1100px the canvas gets cramped with no graceful degradation.

### TOOLBAR
- **[Good]** Collapsible categories with counts; search; Recent/Favorites rows; active/hover states; per-tool animated tooltips for core categories.
- Issues: UX-021 (no virtualization), UX-023 (favorites unsettable), UX-024 ("Slot" duplicate + icon clashes), UX-025 (icon mix), UX-026 (animation gaps), UX-031 (double active).
- **Child-friendliness:** category headers "COMBINE" with "Union/Intersect/Divide" and top menu "Transform" are engineer terms. Prefer "Cut / Join / Split", "Move · Rotate · Resize" (palette already does this well for connectors — extend that voice).

### CANVAS
- **[Good]** Multi-level grid + rulers + unit corner; cursor-anchored wheel zoom; forgiving 7px pick tolerance; animated selection box with live dimension badge; middle-mouse/space pan.
- Issues: UX-004 (commit-per-move), UX-007 (labels), UX-013 (marquee), UX-014 (shortcuts/Escape), UX-015 (zoom UI), UX-016 (rotated resize), UX-017 (snap), UX-018 (handles), UX-019 (draw flow).
- **[Confirmed via source]** Hardcoded canvas colors `CANVAS_BG="#0e2c54"`, grid `#ffffff` at magic opacities, label `#fff` (`Canvas2D.tsx:70,782-796`) — should be tokens.
- **[Perf]** Whole canvas re-renders on any store change; per-part world outlines recomputed each render; no `React.memo`/`useMemo` (`Canvas2D.tsx:624-647,701-713`).

### LAYER / PART
- Issues: UX-009 (Parts vs Layers), UX-010 (badge), UX-011 (hover-hidden), UX-012 (double visibility), UX-008 (connector legibility in tree). No group/ungroup UI though `addGroup` exists (`actions.ts:264`). No per-part collapse of connector children (always expanded).

### CONNECTOR
- Issues: UX-007 (label overlap — highest), UX-008 (legibility/direction/type). **[Good]** palette copy + full editor (type, position, size, tolerance, compatibility chips) in `Inspector.tsx:159-289`.

### PROPERTY PANEL
- **[Good]** Logical grouping (Part / Size / Appearance / Transform / Connectors / Constraints), live unit conversion (verified mm→cm relabels + converts), focus-buffered inputs.
- Issues: UX-003 (per-keystroke commit), UX-027 (no validation), always-shown Diameter field even for non-round connectors.

### ACCESSIBILITY
- **[Confirmed]** Focus rings exist on inputs (`app.css:131`). Gaps: many controls are glyph-only buttons with `title` but no `aria-label`; **state is communicated by color/emoji alone** (lock, visibility, status dot, material chip) — fails "don't rely on color only." Row actions hidden until hover are keyboard/touch-hostile. Canvas is not keyboard-operable. Contrast risk: material chip uses `material.color` as background with default text (`PartsPanel.tsx:55-60`).
- *Fix:* aria-labels on icon buttons; text/shape in addition to color for states; ensure chip contrast.

### PERFORMANCE
- Root causes (all **[Confirmed via source]**): full-document `structuredClone` per commit (`store.ts:140-147`), commit-per-mousemove/keystroke (UX-003/004), whole-canvas re-render with un-memoized geometry (`Canvas2D.tsx`). At 10–100 objects: fine. 500–1000: expect drag lag and undo-stack thrash. No virtualization in toolbox either (UX-021).
- *Fix order:* commit-on-release → memoize canvas subtrees + cache outlines → structural sharing (Immer/patches) later.

### CODE / ARCHITECTURE
- **[Good]** Framework-independent core; single-source `Project`; one `activateTool` invoke path; data-driven tool `kind` (no giant switch); `CONTRACT.md` discipline.
- Debt: dead 3D assembly actions/types still present (`actions.ts:317-358`, harmless but confusing), duplicate recent-use write (`runtime.ts:49-51` + `actions.ts:392-393`), `part.width/height` duplicated with `shape.width/height` (desync risk, `Canvas2D.tsx:521-524`, `actions.ts:153-155`), barrel `index.ts` requires manual edit per tool file (won't scale).

### CHILD-FRIENDLINESS
- **[Good]** Connector palette copy is exemplary. **[Gaps]** toolbar/menu terminology (Union/Intersect/Transform/Boolean), no plain-language names for boolean ops in the toolbox, no "what does this do" visual for boolean/measure/material tools (UX-026), technical field names (Tolerance, Orientation°) without a friendly hint.

### MISSING FEATURES (for the intended product)
Marquee select · copy/paste/duplicate/nudge · alignment/distribution UI (tools declared but unfired) · group/ungroup UI · smart guides/object snapping · zoom HUD/fit control · connector-compatibility *visualization* in 2D · explicit Save + "unsaved changes" indicator · onboarding/first-run · a real File/Edit menu · **the 2D→3D entry point** · per-part connector collapse · validation & error messaging.

---

## 6. TOP 20 FIXES (ordered by user-impact × frequency × leverage)

1. **UX-001** Make "File" non-destructive (real menu + confirm on New). *(trust)*
2. **UX-002** Fix/replace the misleading menu bar (real File/Edit/View or relabel). *(mental model)*
3. **UX-003** Inspector: commit on blur/Enter, not per keystroke. *(undo + perf)*
4. **UX-004** Canvas: commit transforms once on pointer-up (transient live-drag). *(undo + perf)*
5. **UX-007** Connector label de-clutter (plates + hide/hover + zoom threshold). *(hero feature)*
6. **UX-009** Unify Parts/Layers into one clear tree (physical part → connectors). *(IA)*
7. **UX-027** Validate dimensions (no negative/zero) with inline messaging.
8. **UX-014** Wire copy/paste/duplicate/select-all + arrow-nudge; Escape cancels/clears.
9. **UX-013** Marquee selection.
10. **UX-020** Central shortcut registry so declared shortcuts actually fire (+ collision lint).
11. **UX-015** Canvas zoom HUD (%, +/−, Fit, 100%).
12. **UX-028** Remove dead 3D drag copy/handlers; plan a real "View in 3D" entry.
13. **UX-005** One draw = one undo entry.
14. **UX-023** Add a favorites star (state already exists).
15. **UX-011/012** Always show lock/visibility state; single eye toggle; reveal actions on focus too.
16. **UX-024** Disambiguate duplicate "Slot" + add uniqueness lint.
17. **UX-016** Allow resizing rotated parts.
18. **UX-025** Replace glyph/emoji icons with one consistent SVG set.
19. **UX-008** Standardize connector iconography + type/direction badge (canvas + tree).
20. **UX-021** Toolbox virtualization + memoized category lookups (scale runway).

---

## 7. QUICK WINS

**< 30 min (each):**
- UX-029 add `🪵` favicon (kills the only console error).
- UX-028 delete "Drag into the 3D view" copy + dead drag handlers from PartsPanel.
- UX-027 clamp width/height/thickness to `> 0` at the action layer.
- UX-006 stop pushing "Change unit" to undo history.
- UX-031 don't render the active tool as active in both grid and Recent.
- UX-010 add a connector glyph beside the count badge.

**30–60 min:**
- UX-003 move Inspector commits to blur/Enter.
- UX-005 collapse draw into a single commit.
- UX-023 add favorites star button.
- UX-015 render the (already-styled) zoom HUD card.
- UX-018 bump handle visuals to ≥8px.

**1–2 hrs:**
- UX-014 copy/paste/duplicate/select-all/arrow-nudge + Escape behavior.
- UX-004 transient live-drag + commit-on-release.
- UX-007 connector-label plates + hide-on-overlap/hover reveal.
- UX-020 shortcut registry + dispatcher.

---

## 8. MAJOR IMPROVEMENTS
- **Menu/command model** (UX-001/002): real File/Edit/View menus + keep ⌘K; explicit Save + unsaved indicator.
- **Right-panel redesign** (UX-009/008/011): one tree that *shows* "physical part → geometry + named connectors," with inline visibility/lock/reorder, collapsible connectors, and a connector-compatibility hint.
- **Connector UX** (UX-007/008): canvas legibility (plates, de-clutter, direction/type), plus compatibility preview in 2D.
- **Canvas interaction** (UX-004/013/014/015/016/017): commit-on-release, marquee, clipboard/nudge, zoom HUD, rotated resize, absolute snapping + smart guides.
- **Property inspector** (UX-003/027): commit granularity + validation + contextual field visibility.
- **Tool registry for 1,000+** (UX-020/021/022/023/024/025): shortcut registry + virtualization + real fuzzy search + favorites UI + icon system + uniqueness lint + auto-registration.
- **Child-friendly voice**: extend the palette's plain-language descriptions to toolbar names/tooltips and boolean/measure/material animations.

---

## 9. RECOMMENDED IMPLEMENTATION ORDER
- **Phase 1 — Trust & correctness:** UX-001, UX-002, UX-027, UX-028, UX-029, UX-006. *(no more data loss, no dead 3D copy, no console error, valid dimensions)*
- **Phase 2 — Undo/perf granularity:** UX-003, UX-004, UX-005. *(one action = one undo; drag stops cloning the doc per frame)*
- **Phase 3 — Canvas ergonomics:** UX-013, UX-014, UX-015, UX-016, UX-018, UX-019, UX-017.
- **Phase 4 — Right-panel / part model:** UX-009, UX-010, UX-011, UX-012.
- **Phase 5 — Connector UX:** UX-007, UX-008.
- **Phase 6 — Tool discovery & shortcuts:** UX-020, UX-023, UX-024, UX-026, UX-031.
- **Phase 7 — Scale runway (1,000+ tools):** UX-021, UX-022, icon system UX-025, auto-registration, uniqueness lint.
- **Phase 8 — Child-friendly voice + onboarding:** UX-030 + terminology pass.
- **Phase 9 — Polish & a11y:** aria-labels, non-color state cues, contrast, responsive.

---

## 10. FINAL TALLY
- **Files inspected:** ~34 source files (App, main, TopBar, StatusBar, LeftToolbox, Canvas2D, CommandPalette, LayersPanel, PartsPanel, Inspector, ToolTooltip, animations, store, actions, units, io, registry, runtime, toolTypes, index, all 9 `*.tools.ts`, geometry/world, theme.css, app.css, index.html) + README/CONTRACT/package.
- **Components inspected:** ~11 UI components. **Routes/pages:** 1 (single-page, no router). **Tools inspected:** 93 across 9 populated categories (2 declared-but-empty).
- **Issues logged:** 31 (**~28 CONFIRMED**, 3 POSSIBLE/qualified). By type: UX/product **~14**, visual/consistency **~7**, functional/interaction **~6**, performance **~3**, architecture/scale **~5** (overlapping).
- **Priority mix:** P0 **0** · P1 **7** (UX-001,002,003,004,007,009) + trust cluster · P2 **~12** · P3 **~9** · P4 **~3**.
- **Runtime health:** build clean, 7/7 tests pass, **0 JS/React errors**, 1 network 404 (favicon).
- **Recommended next development phase:** **Phase 1 (Trust & correctness)** — start with UX-001 (non-destructive File) and UX-003/004 (commit granularity); they are low-risk, high-trust, and unblock everything after.

> Nothing here needs a rewrite. The foundation (tokens, registry, store, persistence) is good — the work is product clarity, connector legibility, canvas ergonomics, and commit granularity.
