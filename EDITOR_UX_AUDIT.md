# PPTGenerator Editor UX Audit Report

Auditor: AI agent
Date: 2026-07-29
Scope: `apps/web/src/editor/` — drag/resize, selection, keyboard shortcuts, undo/redo, property panel, page management, auto-save, export, theme switching, text editing, z-index/layering.

---

## Summary

The editor is **architecturally solid** and feature-complete for an MVP: undo/redo (50-step), auto-save with debounce + beforeunload flush, snap-to-grid + safe-area clamping, marquee + multi-select with align/distribute, copy/cut/paste/duplicate, drag-to-canvas from component library, keyboard shortcuts, preview mode, export (PDF/images/share). Code quality is good with clear separation of concerns.

However, there are a number of **concrete UX problems** ranging from data-loss risks to interaction rough edges. Below are the findings sorted by severity.

---

## P0 — Critical (data loss / broken core flows)

### P0-1: Auto-save debounce races with `beforeunload` — dirty window can still lose data
- **File:** `useAutosave.ts` lines 31-48
- **Problem:** On `beforeunload`, the code calls `flushSync()` which uses `fetch(url, { keepalive: true })`. The `keepalive` body limit is **64KB**. A project with many pages + components can easily serialize to >64KB (the `pages` array includes full component `data` with rich defaults like `creator-works-list` which has deeply nested insights arrays). When the payload exceeds 64KB, the browser **silently drops** the `keepalive` request — data is lost with no user feedback.
- **Fix:** Add a size check before `flushSync()`. If `body.length > 60000`, fall back to a synchronous `XMLHttpRequest` with `depricated` `sendBeacon`, or better: warn the user "your project is large, please save manually" when approaching the limit. Also consider that `navigator.sendBeacon` has the same 64KB limit, so a true fix needs either: (a) `fetch(keepalive)` with chunked/last-known-good save, or (b) periodic full saves so the beforeunload only needs to flush the delta.

### P0-2: `flushSync` doesn't reset `dirty` / `saving` — re-entry hazard on rapid navigation
- **File:** `store.ts` lines 356-386
- **Problem:** `flushSync()` intentionally doesn't touch `dirty`/`saving` (comment says "调用点即 unload, store 即将销毁"). But `visibilitychange` also triggers `saveNow()` → `save()` which sets `saving=true` during the request. If the user rapidly tabs in/out, multiple concurrent saves can fire. The `save()` guard checks `s.saving` at entry but there's a window between the `set({ saving: true })` and the async completion where another `visibilitychange` fires and sees `saving=true` → skips. If the first save fails, the skipped second save means dirty data persists with no retry until the next `dirtyTick` change.
- **Fix:** Acceptable risk for MVP, but add a retry mechanism: if `saveError` is set, the next `dirtyTick` increment should always retry regardless of `saving` state.

### P0-3: No confirmation dialog for page deletion — accidental irreversible data loss
- **File:** `PageSidebar.tsx` lines 186-197
- **Problem:** The delete page button (✕) immediately calls `deletePage(p.id)` with **no confirmation dialog**. Unlike component deletion (which has undo via history), deleting a page destroys all its components. Undo *does* restore the page (history snapshot includes `pages`), but there's no visual feedback or "are you sure?" prompt. A misclick on the small ✕ button (next to 📋 and 💾 which are also small) silently nukes a page.
- **Fix:** Add a lightweight inline confirmation (two-step click) or a small confirmation popover. At minimum, show a toast "Page deleted — Undo?" with a button that calls `undo()`.

---

## P1 — High (significantly degrades core editing experience)

### P1-1: No inline text editing on canvas — text can only be edited via the property panel
- **File:** `BasicComponents.tsx` lines 41-58 (`TextComponent`), `CanvasComponent.tsx`
- **Problem:** `TextComponent` renders `data.content` as plain text in a `pointer-events: none` div. Double-clicking a text component on canvas does **nothing** — it only opens the property panel where the user must find the "content" input field. This is a major friction point for the most common editing action (editing text). Every competitor (Figma, Canva, Google Slides) supports double-click-to-edit-text inline.
- **Fix:** Add a double-click handler on `CanvasComponent` (or specifically for `text`/`title-block` types) that switches to a `contentEditable` overlay positioned over the component. On blur, write back `data.content` via `updateComponentData`. This is a significant feature addition but is the #1 UX gap.

### P1-2: `ListField` color `<input type="color">` breaks on `value="auto"`
- **File:** `ListField.tsx` line 37
- **Problem:** The color input has `value={it.color}` where `it.color` can be `"auto"` (the default from `getDefaultData`). An `<input type="color">` **requires** a 7-character hex value (`#RRGGBB`). When given `"auto"`, the browser resets it to `#000000` silently. This means: (a) the displayed color is black (misleading), and (b) if the user interacts with the picker at all, the value becomes a real hex — they can never get back to `"auto"` (chartPalette coloring). The user has no way to reset a single bar/slice to auto-color.
- **Fix:** When `it.color === 'auto'`, render a separate "Auto" toggle button or a swatch that shows the resolved palette color, with a click action that sets `color: 'auto'`. Only show the `<input type="color">` when color is a real hex.

### P1-3: Drag doesn't prevent component overlap — no collision detection
- **File:** `Canvas.tsx` lines 71-109, `snap.ts`
- **Problem:** The snap system only snaps to grid and safe-area edges. There is no component-to-component collision/overlap prevention or "smart guides" (alignment to other components' edges/centers). Components freely overlap, and there's no snapping to sibling component edges. This is a common expectation in modern editors (Figma, PowerPoint smart guides).
- **Fix (P1 scope):** This is a feature gap, not a bug. For a quick win, add snapping to sibling component edges/centers within a threshold (similar to `snapMove` but checking other components). This dramatically improves layout precision.

### P1-4: Resize handles are 8×8px and partially off-canvas — hard to grab at canvas edges
- **File:** `CanvasComponent.tsx` lines 7-16, 105-127
- **Problem:** Resize handles are positioned at `-4px` from edges (e.g., `left: -4, top: -4` for NW). When a component is at the canvas edge (x=0 or against the safe area), half the handle is outside the component and may be clipped by the canvas `overflow: hidden` ancestor. The 8px target is also below the recommended 44×44px touch target for pointer ergonomics (though 8px is acceptable for mouse). At high zoom-out levels, the handles become very small in screen space.
- **Fix:** Scale handle size inversely with zoom (e.g., `8 / zoom` px) so they remain grabbable at any zoom level. Ensure handles render above any clipping (consider `z-index` or rendering outside the `overflow: hidden` wrapper).

### P1-5: `NumberField` commits history on every blur — typing in X/Y/W/H floods undo stack
- **File:** `NumberField.tsx` lines 29-32
- **Problem:** Each `onBlur` calls `commit()` which pushes a new history snapshot. If a user types a value, clicks away (commit 1), types again (commit 2), etc., the undo stack fills with micro-states. Combined with `useDataUpdate` in `TextField.tsx` which also commits on every keystroke (via `helpers.tsx` line 19), the 50-step history can be exhausted in seconds of normal text editing.
- **Fix:** Debounce history commits for property panel edits (e.g., coalesce commits within 500ms into one snapshot). Or use a "transaction" pattern: begin editing → commit on blur only if the value actually changed from the pre-focus state.

### P1-6: `useDataUpdate` commits on every keystroke — history pollution + performance
- **File:** `helpers.tsx` lines 12-21
- **Problem:** `useDataUpdate` is used by `TextField`, `TableField`, `ListField`, `SelectField`. It calls `updateComponent` + `commit()` on **every** `onChange` (every keystroke). For text fields, this means typing "Hello World" creates 11 history snapshots. It also forces a full `clone(pages)` on every keystroke (via `pushHistory`), which for large projects causes jank.
- **Fix:** Separate "live update" (no history) from "commit" (history). `updateComponent` already doesn't push history; the issue is `commit()` being called per-keystroke. Change `useDataUpdate` to: call `updateComponent` on `onChange`, call `commit` on `onBlur` only. Apply this to `TextField`, `TableField`, `ListField`.

---

## P2 — Medium (polish issues that frustrate users)

### P2-1: Z-index inconsistency between editor canvas and preview/export
- **File:** `Canvas.tsx` line 339 vs `PageView.tsx` line 24
- **Problem:** The **editor** (`Canvas.tsx`) renders components in **array order** (no sort) — so z-index = array position. The **preview/export** (`PageView.tsx`) sorts by `comp.z ?? 0`. If any component has a `z` value set (e.g., from import or manual JSON edit), the preview will show a different stacking order than the editor. The editor's `bringForward`/`sendBackward` manipulate array order, not the `z` field, so `z` is never managed by the editor — but if data comes in with `z` values, preview and editor diverge.
- **Fix:** Either (a) sort components by `z ?? arrayIndex` in the editor too, or (b) strip `z` on load and use array-order exclusively. Option (b) is simpler and matches current editor behavior.

### P2-2: Page reordering via HTML5 drag has no visual drop indicator
- **File:** `PageSidebar.tsx` lines 108-114
- **Problem:** Pages are draggable for reordering, but there's no visual indication of where the page will be dropped. The only feedback is `opacity-40` on the dragged item. No drop line/placeholder between target pages. Users must guess the drop position.
- **Fix:** Add a `dragOverIndex` state and render a 2px accent-colored line between pages at the insertion point. Track this via `onDragOver` computing the nearest gap.

### P2-3: Component library fixed at 120px height — too small for browsing
- **File:** `ComponentPanel.tsx` line 138
- **Problem:** The component panel is `h-[120px]` with horizontal scrolling for items. With ~30 components across 5 groups, and tiny 56px-wide buttons, finding a specific component requires scrolling horizontally and switching tabs. The fixed height wastes vertical space that could show more components. On smaller screens, this area is cramped.
- **Fix:** Consider making the panel height adaptive or allowing collapse/expand. Alternatively, use a vertical grid layout when space permits. At minimum, make the tab bar wrap or use a dropdown for group selection.

### P2-4: No mobile/responsive preview — preview is always at desktop scale
- **File:** `PreviewOverlay.tsx`, `PageView.tsx`
- **Problem:** The preview overlay renders at `fitScale(canvasWidth, canvasHeight, viewportW, viewportH)` — always fitting the canvas aspect ratio. There's no option to preview how slides look on mobile (phone aspect ratio), in a 16:9 projector, or as a printed page. The canvas dimensions are fixed at project creation.
- **Fix:** Add a "device frame" toggle in preview mode (desktop/mobile/tablet) that overlays a device chrome and shows how content fits. This is a feature addition; for MVP, at minimum show the canvas dimensions and aspect ratio label.

### P2-5: `execCommand` is deprecated — rich text editing may break in future browsers
- **File:** `RichTextField.tsx` lines 34-37
- **Problem:** The rich text editor uses `document.execCommand('bold')` etc., which is deprecated and may be removed from browsers. Currently works in all major browsers but is on the deprecation path.
- **Fix:** Acceptable for MVP. Plan migration to `Selection` API + manual range manipulation, or adopt a library like `@lexical/react` or `tiptap` for future-proofing.

### P2-6: Undo/redo clears selection silently
- **File:** `store.ts` lines 1255-1281
- **Problem:** Both `undo()` and `redo()` set `selectedIds: []` (clear selection). After undoing, the user has no idea which component was affected — the canvas selection just disappears. This is disorienting when the user is iterating on a specific component's position/properties.
- **Fix:** After undo/redo, try to re-select the component(s) that were selected before the undo (if they still exist in the restored snapshot).

### P2-7: No keyboard shortcut for locking/unlocking components
- **File:** `useEditorKeyboard.ts`
- **Problem:** The keyboard shortcut file handles delete, copy, cut, paste, duplicate, undo, redo, select-all, nudge, and pan. But there's no shortcut for `toggleLock` (Ctrl+L or similar). Locking is only available via the right-click context menu. Users who lock components frequently must right-click every time.
- **Fix:** Add `Ctrl/Cmd+L` → `toggleLock` for the selected component. Also consider `Ctrl/Cmd+Shift+L` for "lock all selected".

### P2-8: Export menu doesn't save before exporting — may export stale data
- **File:** `ExportMenu.tsx` lines 24-66
- **Problem:** `handlePdf` and `handleImages` call `projectsApi.exportPdf(projectId)` / `exportImages(projectId)` directly, without ensuring the latest edits are saved first. If the user has unsaved changes (dirty=true) and clicks "Export PDF", the export renders the **last saved version**, not the current canvas. There's no "Save & Export" flow.
- **Fix:** Before export, check `dirty`. If true, either (a) auto-save and wait before exporting, or (b) show a warning "You have unsaved changes. Save before exporting?" with a "Save & Export" button.

### P2-9: No "fit to screen" / "reset zoom" button
- **File:** `Canvas.tsx` lines 378-398
- **Problem:** The zoom controls only have `−` and `+` buttons (0.1 increments) and a percentage display. There's no quick "fit to screen" or "reset to 100%" button. After panning/zooming around, getting back to the default view requires repeated clicking. The initial fit-to-viewport happens once on mount but can't be re-triggered.
- **Fix:** Add a "Fit" button (or make the percentage label clickable) that re-runs the `fitScale` calculation and resets pan to (0,0).

### P2-10: Page thumbnail may be stale — no memoization guard on component data changes
- **File:** `PageSidebar.tsx` line 200, `PageThumbnail.tsx`
- **Problem:** `<PageThumbnail page={p} ... />` receives the full page object. If `PageThumbnail` is memoized by `page` reference, it updates correctly. But if a component's data changes (e.g., editing text), the page object reference changes (immutable updates), so the thumbnail re-renders — which is correct but potentially expensive for complex pages with many charts. This could cause lag in the sidebar during editing.
- **Fix:** Verify `PageThumbnail` uses efficient rendering (simplified SVG/DOM, not full component renderers with charts). Consider debouncing thumbnail updates.

---

## P3 — Low (minor polish / nice-to-have)

### P3-1: No empty state guidance on canvas
- **File:** `Canvas.tsx`
- **Problem:** When a page has no components, the canvas is blank with just grid lines. There's no "Drag components here" or "Click + to add content" hint. New users may not know how to start.
- **Fix:** Add a centered, faint placeholder text/illustration when `components.length === 0`.

### P3-2: Context menu position can overflow viewport
- **File:** `ContextMenu.tsx` line 39
- **Problem:** The context menu is positioned at `{ left: x, top: y }` (the click coordinates) with no viewport boundary check. Right-clicking near the right or bottom edge of the screen causes the menu to render partially off-screen (or trigger scrollbars).
- **Fix:** After rendering, measure the menu size and flip/shift position if it would overflow `window.innerWidth/Height`.

### P3-3: Project name input has no max length
- **File:** `EditorTopbar.tsx` line 50-54
- **Problem:** The project name `<input>` has `className="w-56"` but no `maxLength`. A very long name overflows the topbar layout and may cause backend validation errors on save.
- **Fix:** Add `maxLength={100}` and/or `truncate` styling on overflow.

### P3-4: No visual indicator for locked components in the page sidebar / layer list
- **File:** (no layer list exists)
- **Problem:** Locked components show a 🔒 badge on the canvas, but there's no layer list panel where users can see/select/toggle lock on all components at once. Finding a locked component that's behind others requires clicking around.
- **Fix:** Consider adding a collapsible "Layers" panel (common in design tools) listing all components with lock/visibility toggles. This is a feature request.

### P3-5: `RichTextField` `onInput` commits on every keystroke — same history pollution as P1-6
- **File:** `RichTextField.tsx` line 89
- **Problem:** `onInput={commit}` calls `sanitizeRichText` + `onChange` on every input event. This is explicitly documented as necessary (to sync canvas when focus is stolen), but it has the same history-pollution issue as P1-6.
- **Fix:** Same as P1-6 fix — debounce the history commit, not the live update.

### P3-6: Theme switching has no transition animation
- **File:** `Editor.tsx` lines 36-53, `theme.tsx`
- **Problem:** When the user changes theme colors/fonts in the settings overlay, CSS variables update instantly (no transition). This is functionally correct but feels abrupt. A subtle cross-fade or color transition would improve perceived quality.
- **Fix:** Add `transition: background-color 0.2s, color 0.2s` to canvas-level elements. Acceptable to skip for MVP.

### P3-7: Search in component library only searches label/description, not type aliases
- **File:** `ComponentPanel.tsx` lines 102-106
- **Problem:** The search filters by `label` and `description` only. If a user searches "KPI" they'll find "指标卡" (indicator-card, description "KPI 数据卡片") but searching "chart" won't find 柱状图/折线图/饼图 unless the description contains it. Chinese/English mixed search could miss matches.
- **Fix:** Add a `keywords` field to `PaletteItem` with common aliases (Chinese + English) and include it in the search filter.

### P3-8: No undo/redo button disabled state feedback when history is empty on load
- **File:** `EditorTopbar.tsx` lines 65-80
- **Problem:** On fresh project load, `history` has one snapshot (the initial state) and `historyIndex=0`. `canUndo()` returns `false`, so the undo button is `disabled:opacity-40`. This is correct, but there's no tooltip explaining *why* it's disabled ("Nothing to undo"). Minor discoverability issue.
- **Fix:** Add dynamic `title` attributes: `disabled ? "Nothing to undo" : "Undo (Ctrl+Z)"`.

---

## Architecture Notes (positive findings)

- **History system** is well-designed: 50-step cap, snapshot includes pages + currentPageId + projectMeta, undo/redo restore cleanly.
- **Snap system** (`snap.ts`) is well-factored as pure functions with clear separation between "magnetic snap" (can bleed outside safe area) and "hard clamp" (hard wall). Good testability.
- **HMR persistence** (`store.ts` lines 1316-1324) is thoughtful — persists data fields on Vite HMR, prevents blank canvas during development.
- **`CanvasComponent` memo** with custom comparator (line 132) is a good performance optimization.
- **Multi-select** with align/distribute/equal-size is a strong feature set.
- **Error boundaries** wrap Canvas, PropertyPanel, and Preview — good resilience.

---

## Prioritized Fix Recommendations

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0-1 | Auto-save >64KB payload drop | Medium | Prevents data loss |
| P0-3 | Page delete confirmation | Small | Prevents accidental data loss |
| P1-1 | Inline text editing | Large | Core UX gap |
| P1-2 | ListField color='auto' bug | Small | Fixes broken color picker |
| P1-5/P1-6 | History pollution from per-keystroke commits | Medium | Fixes undo/redo usability |
| P2-1 | Z-index editor vs preview mismatch | Small | Prevents export divergence |
| P2-8 | Export without saving | Small | Prevents stale exports |
| P2-9 | Fit-to-screen button | Small | Navigation quality-of-life |
| P2-6 | Undo/redo preserves selection | Small | Reduces disorientation |
