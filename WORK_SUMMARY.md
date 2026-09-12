# LeaseReel Prototype Work Summary

This is a historical build log — it documents how the prototype evolved, session by
session. It is not the current state summary; some numbers below (test counts, rule
counts) were accurate as of their own session and were later superseded. For the
current state, see `README.md` (how to run it, current screen list) and
`CHANGELOG.md` (the most recent session's changes, including the final rule/test
counts: 96 rules, 20 tests).

## Revamp (v3) — highlights

This pass substantially upgraded the prototype from four screens to six and
pushed it toward the owner-side AI Asset Manager thesis in the use case, while
keeping the compliance engine (the moat) as the centerpiece.

New / upgraded:

- **Compliance co-pilot.** Ad copy now renders with matched phrases highlighted
  in place (violation / caution / informational / acceptable). Added one-click
  **auto-fix & re-check** — the engine strips the flagged phrases, tidies the
  copy, and re-scores to show it clearing. Added a **publish gate**: blocked
  copy cannot be published; publishing writes `published=true` to the ledger.
- **Governance Overview.** Status-mix donut, 8-week stacked screening-volume
  chart, per-property compliance health bars, pipeline snapshot, and a top-two
  owner-signals teaser — a real single-pane oversight view.
- **Performance (new).** The use case's 90-day bar made tangible:
  social-attributed leases per vacant unit, cost-per-lease vs. blended paid
  channels, lead-to-lease conversion, days-on-market, and pilot-vs-baseline-vs-
  control comparisons, plus a property-level outcomes table with vacancy
  exposure ($ rent at risk). Benchmarks grounded in 2025-26 multifamily ranges.
- **Signals (new).** AI Asset Manager intelligence preview — owner
  recommendations (recommend vs. execute) generated from LeaseReel's leasing,
  compliance, and channel data, plus the "what LeaseReel data feeds the AI
  Context Foundation" mapping from the doc. Honestly framed as the horizon module.
- **Leads.** Added a lead-to-lease funnel and source-attribution view above the
  stage board.
- **Design.** Elevated the institutional monitoring-terminal aesthetic: refined
  rail, denser ledger, inline SVG/HTML data-viz, cohort/mode/publish chips, a
  top-tab mobile layout, and reduced-motion support.
- **Engine/analytics.** Added `segment()`, `autoFix()`, `fixAndRecheck()` to the
  engine; new `src/analytics.js` (portfolio stats, agent leaderboard, funnel,
  channel ROI, pilot summary, owner-signal generation) and `src/charts.js`
  (dependency-free inline SVG/HTML charts).
- **Data.** Enriched seed with property financials, vacancy, channel spend/
  attribution, 90-day pilot/baseline/control windows, an agent roster, a weekly
  compliance trend, and published/draft state. Schema + storage key bumped to v3.
- **Tests.** 18 passing (12 original engine + 6 new co-pilot/analytics).

## Built

- A vanilla HTML/CSS/JS prototype for LeaseReel Compliance & Governance.
- Four screens:
  - Overview governance pane
  - Live Compliance checker
  - Leads capture and pipeline
  - Audit ledger
- Seeded demo data:
  - 4 properties
  - Example screened posts
  - Example leads across pipeline stages
- A local demo storage layer that persists in browser storage.
- A Supabase-ready storage adapter and SQL schema.

## Compliance Engine

- Implemented as a standalone pure JavaScript module in `src/complianceEngine.js`.
- Rule data lives in editable JSON at `src/data/compliance-rules.json`.
- Implements:
  - Violation / Caution / Acceptable tiers
  - Federal and state-dependent class tagging
  - Weighted scoring
  - Hard block behavior for violations
  - Equal Housing Opportunity / EHO safe-harbor signal
  - Longest-match overlap handling
  - Acceptable phrase suppression so phrases like `wheelchair accessible`, `family room`, and `master bedroom` do not over-flag
- Added unit tests in `tests/complianceEngine.test.js`.

## Product Behavior

- Compliance screen supports:
  - Property, agent, and platform fields
  - Three canned examples
  - Verdict, score, meter, findings, protected-class tags, scope badges, rationales, suggested rewrites
  - Save to ledger
- Overview screen shows:
  - Portfolio summary metrics
  - Monospace compliance feed
  - Compact leads pipeline
- Leads screen supports:
  - Inbound lead capture
  - Source and interaction type
  - Stage-based pipeline
  - Stage updates
- Audit screen supports:
  - Read-only timestamped ledger
  - Filters by property and status
  - Full finding details

## Design

- Applied the institutional compliance software direction from the spec.
- Uses the required palette, status colors, typography roles, ledger texture, restrained motion, focus states, and responsive layouts.
- Verified desktop and mobile behavior in the browser.

## Supabase

- Schema is in `supabase/schema.sql`.
- The app uses local seeded storage by default.
- If `window.LEASEREEL_SUPABASE` is provided before `src/app.js` loads, it switches to the Supabase REST adapter.

## Verification

- `npm test` passes.
- Syntax checks passed for the app, engine, storage, and server files.
- Browser-verified:
  - Overview loads with seeded data
  - Compliance check runs correctly
  - Violation example blocks while logging acceptable context
  - Save to ledger updates Overview
  - Lead logging updates the pipeline
  - Audit filters work
  - Mobile layout has no measured horizontal overflow at 390px

## Noted Assumption

- The spec lists `bachelor pad` under violation language but says `caution in some contexts`; it was implemented as a Caution rule to avoid over-blocking.

## Hardening Pass

- Fixed hyphenated phrase matching so `Adults-only`, `No-kids`, and similar punctuation variants match the same rules as spaced phrases.
- Made broad caution rules context-aware:
  - `great for`, `perfect for`, and `ideal for` now require a person-type follow-on.
  - `limited` and `restricted` now require `limited to` / `restricted to` person-type constructions.
  - `quiet building` no longer flags ordinary service/property copy.
- Added `src/data/state-jurisdiction.json` with a dated, maintainable jurisdiction reference for state-dependent classes.
- Added state/city/HOPA fields to seed properties and Supabase schema.
- Added a New York City seed property to demonstrate source-of-income blocking vs. Texas non-blocking visibility.
- Added a HOPA-qualified senior property and senior-housing rules:
  - HOPA-preferred phrases clear with an explicit HOPA exemption signal only when the selected property is verified HOPA-qualified.
  - The same senior-housing copy blocks on ordinary properties.
  - `adults only` and similar language becomes a caution, not a block, on a HOPA-qualified property.
- Added jurisdiction notes in the findings UI:
  - Example: `Protected in TX: No` means the finding is shown but does not block.
  - Example: `Protected in NY: Yes` means the same phrase blocks publish.
- Added a short compliance disclaimer to the Overview and Compliance screens.
- Added pattern-based refusal-construction coverage for simple paraphrases like:
  - `We do not rent to families with kids.`
  - `Will not accept Section 8.`
  - `Not suitable for large families.`
- Bumped local demo storage to `leasereel-prototype-v2` so the hardened seed data loads cleanly.

## Hardening Verification

- `npm test` now runs 12 tests and passes.
- Added explicit tests for:
  - Hyphenated protected-class phrases
  - False-positive caution phrases
  - Texas vs. New York state-dependent source-of-income behavior
  - HOPA-qualified vs. non-HOPA senior-housing behavior
  - Adult-only phrasing on HOPA-qualified property
  - Refusal-construction paraphrases

## Still Out Of Scope

- Broad semantic paraphrase detection beyond the narrow refusal-construction patterns.
- Multi-tenant authentication, users, roles, or permissions.
- Production legal review, e-sign evidence collection, or licensed-counsel rule approval workflow.
- Real social publishing/scheduling APIs and AI video generation.

## Run

```bash
npm test
npm run dev
```

Open `http://127.0.0.1:5173`.
