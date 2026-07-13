# Creator Performance drill-down — MockData preview section

**Date:** 2026-07-13
**Scope:** Single file — `apps/web/src/routes/MockData.tsx`

## Problem

The "Creator Performance (Posts + Placements + CPS)" section in
`apps/web/src/routes/MockData.tsx` renders every creator in a campaign as a
fully-expanded card: post table + placement table + daily table + CPS chips,
all at once. For ~10 creators this is a wall of tables with no hierarchy — hard
to scan, hard to focus on one creator. The `· 10` in the heading is
`perf.length` (the creator count).

## Goal

Turn the section into a drill-down: each creator is a compact one-line summary
row; clicking a row expands that creator's full detail. Multiple rows may be
open at once. All data continues to come from the existing mock campaign layer
(`listCreatorPerformance`).

## Non-goals

- No changes to mock data, shared types, server schema, or other
  editor/report components.
- No new persisted `ComponentType` on slides (this is a dev preview page, not
  an editor block).
- No change to the campaign-level Placement Type Summary table.
- No change to data fetching logic or loading/empty states.

## Design

### State

`CreatorPerformanceSection` adds:

```ts
const [expanded, setExpanded] = useState<Set<string>>(new Set());
```

### Summary row (replaces the PerfCard header)

Each creator renders as an always-visible clickable row:

- Chevron `▸` when collapsed, `▾` when expanded.
- Creator name (primary text), then muted `handle · platform · tier`.
- Headline metrics on the right, drawn from existing fields:
  - `Posts` — `perf.summary.posts`
  - `Impr` — `perf.summary.totalImpressions`
  - `ER` — `perf.summary.avgEngagementRate`
  - `GMV` — `perf.cps.gmv`
  - `ROAS` — `perf.cps.roas`
- The whole row is the click target: `cursor-pointer`, subtle hover
  background. `onClick` toggles the creator's `creatorId` in `expanded`.

### Expansion behavior

- **Multi-expand:** each row toggles independently (set add on open, set
  delete on close). Several rows may be open simultaneously.
- **Reset on campaign change:** the existing `useEffect` keyed on
  `selectedId` clears `expanded` to an empty set, so stale ids never linger
  across campaigns.

### Expanded body

The existing `PerfCard` body markup — post table, placement table, daily
table, CPS chips — is re-hosted unchanged inside a conditional:

```tsx
{expanded.has(perf.creatorId) && ( /* existing body */ )}
```

### Preserved as-is

- Campaign `<select>` and its default-select-first behavior.
- Campaign-level `PlacementSummaryTable`, rendered above the rows when
  `summary.length > 0`.
- Loading and empty states.

## Interaction details

- Click target: the entire summary row (not just the chevron).
- The chevron changes glyph to reflect open/closed state.
- Summary row uses `flex-wrap` so on narrow viewports it wraps gracefully
  while staying one line at normal width.

## Testing

- Manual verification: select a campaign → all rows collapsed → click one →
  its tables appear → click another → both open → switch campaign → all
  collapse.
- `MockData.tsx` is a dev preview component with no existing unit tests. A
  light render test (click a row → expansion toggles, campaign switch →
  collapses) is optional, not required.

## Risks / notes

- Self-contained, single file, no persisted-schema impact — safe to stage
  only `MockData.tsx` on a busy tree.
