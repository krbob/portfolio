# UI Revamp Plan

## Goal

Rebuild the web UI so `portfolio` feels like a focused self-hosted investor product instead of a technically capable admin dashboard.

The backend model, read models, and operational depth stay intact.
The revamp is about product clarity, visual discipline, and usability.

## Diagnosis

The current frontend has three core problems:

1. The information hierarchy is too flat.
   The dashboard mixes investor-facing metrics, operational status, technical details, and secondary workflows in one long page.
2. The visual system is too loose.
   One large stylesheet and many panel variants make the UI feel inconsistent and accidental.
3. The copy is too explanatory.
   The app often describes its internals instead of helping the user act on their portfolio.

## Product direction

Use `folio` as a reference for product tone and interaction quality, not as a source of accounting logic.

The target experience should be:

- calm
- dense but legible
- dark, restrained, and financial rather than decorative
- minimal in copy
- explicit in status, valuation quality, and performance
- optimized for frequent reading and occasional editing

## Non-goals

- do not simplify the portfolio domain model to match `folio`
- do not move portfolio calculations into the browser
- do not reintroduce snapshot-centric accounting
- do not optimize for multi-user enterprise workflows

## Information architecture v2

Top-level navigation should be reduced to five product-facing areas:

1. `Dashboard`
2. `Holdings`
3. `Performance`
4. `Transactions`
5. `Settings`

### Dashboard

Purpose: answer "what is the state of the portfolio right now?"

Primary modules:

- total value
- daily move
- current allocation vs target
- one primary performance chart
- valuation issues / data quality
- recent important activity

### Holdings

Purpose: inspect current positions clearly.

Primary modules:

- holdings table
- account grouping
- filters and sorting
- valuation status
- detail drawer for selected holding

### Performance

Purpose: inspect results, history, and comparisons.

Primary modules:

- MWRR / TWR cards
- benchmark comparison
- period switchers
- value / contributions chart
- allocation history
- benchmark index chart

### Transactions

Purpose: maintain the canonical event stream.

Primary modules:

- transaction journal
- import flow
- import profiles
- import history / audit

### Settings

Purpose: keep operational and metadata workflows out of the investor dashboard.

Primary modules:

- accounts
- instruments
- state import/export
- backups
- audit log
- read-model cache diagnostics
- auth and integration settings when needed

## Visual direction

### Theme

- dark-first interface
- low-saturation zinc/slate base
- restrained accent colors
- no glassmorphism
- no serif headlines
- no marketing-style hero sections

### Typography

- main UI font: `IBM Plex Sans`
- numeric font: `IBM Plex Mono`
- fewer size jumps
- stronger reliance on weight, spacing, and tabular numerals

### Color semantics

- neutral surfaces: `zinc` / `slate`
- equities: cool blue
- bonds: amber
- cash: muted cyan or slate
- positive: emerald
- negative: red
- warning/issues: amber

### Surfaces

- one primary card treatment
- compact radius
- subtle borders
- shallow shadows or no shadows
- stronger separation via layout and spacing, not decorative effects

## Interaction principles

- every screen has one main job
- every card must earn its place
- defaults should favor reading, not explaining
- destructive actions remain explicit and safe
- operational details should be accessible but secondary
- empty and loading states should be calm and short

## Technical direction

Frontend foundation should move toward:

- Tailwind v4 for layout and visual consistency
- small shared primitive layer for app shell, cards, toolbars, tabs, badges, tables, dialogs
- `lightweight-charts` retained for financial charts
- centralized formatting for money, percentages, and dates with `pl-PL`
- progressive replacement of the monolithic `styles.css`

## Execution phases

## Phase 1: Foundation

- add design tokens and shared theme primitives
- add centralized formatting utilities
- rebuild app shell and navigation
- define reusable cards, badges, toolbars, segmented controls, and empty/error states
- keep old screens functional while moving them onto the new shell

## Phase 2: Dashboard rewrite

- rebuild dashboard from scratch
- remove technical sections like stack metadata from the main screen
- reduce dashboard to the highest-signal portfolio modules
- unify stat cards and allocation presentation

## Phase 3: Performance rewrite

- merge current returns/charts experience into one coherent flow
- unify period controls and legends
- improve benchmark presentation
- keep charts visually and semantically consistent

## Phase 4: Holdings rewrite

- replace current holdings section with a dense, product-grade table
- improve grouping, filtering, and drilldown
- show valuation state and allocation context without noise

## Phase 5: Transactions rewrite

- split journal, import, profiles, and import history into a clearer workflow
- improve step-by-step import UX
- surface conflict handling and duplicates before commit

## Phase 6: Settings and operations

- move data setup, backups, audit, and cache into a coherent operations area
- preserve trust and recoverability features while reducing clutter in primary screens

## Phase 7: Cleanup

- delete obsolete layout and style code
- remove dead classes and duplicate formatting helpers
- verify responsive behavior and visual consistency

## Done criteria

The revamp is successful when:

- the dashboard fits the main portfolio story without scrolling through unrelated operations
- every major screen has a clear purpose and lighter cognitive load
- typography, spacing, and color usage feel systematic
- formatting is localized and consistent
- the app looks like a mature product, not a demo of backend capabilities
