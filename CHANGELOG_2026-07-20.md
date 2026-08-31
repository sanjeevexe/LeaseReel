# LeaseReel Prototype — Session Changelog: July 20, 2026

Working session ahead of a walkthrough with Sanjeev's boss. Covers a full frontend
redesign plus a set of functional fixes identified in a codebase audit against the
project's use-case doc and build spec. This file documents the **final state** reached
by the end of the session, not the intermediate iterations along the way. See
`WORK_SUMMARY.md` for the pre-session (v3) baseline and `README.md` for how to run
the app; this file picks up from there.

Git: all changes below are committed on `master` (current HEAD `0ea8671`). The tag
`approved-navy-theme` (commit `7b1885f`) marks the pre-session baseline in case any
of today's UI direction needs to be rolled back and compared.

---

## UI / design overhaul

**Typography.** Replaced the original Space Grotesk + IBM Plex Sans pairing with
**Libre Franklin** for all UI text and headings (brand name, nav, headers, body,
buttons), and kept **IBM Plex Mono** scoped to data — timestamps, scores, IDs,
ledger/audit rows, chips. Libre Franklin was chosen deliberately over more common
choices like Inter (the single most common "AI-generated app" tell) or Public Sans
(tried first, then rejected) for a more distinctive, institutional feel appropriate to
compliance/audit software.

**Light/dark theme, toggleable.** The app now ships with a full light and dark theme,
switchable from a toggle at the bottom of the sidebar. Choice persists via
`localStorage` (`leasereel-theme`) and applies with no flash on reload — a small
inline script in `index.html`'s `<head>` sets the `data-theme` attribute on `<html>`
before the stylesheet paints. Every component is driven off CSS custom properties
(`--ink`, `--paper`, `--navy`, `--cleared`, etc.), so the whole UI repaints from one
attribute flip; there is no per-component theme logic.

- **Light theme**: a true black/white grayscale foundation (`--ink #121212`,
  `--paper #f7f7f7`, neutral grays for borders/muted text — no blue tint in the
  neutrals) with **navy blue reintroduced as deliberate accent touches**
  (`--navy #1d4a7a`) on the primary button, active nav indicator, links, eyebrow
  labels, and the "informational" compliance-finding tier. The blue is scoped to
  those specific spots rather than saturating the whole palette.
- **Dark theme**: near-black background (`--paper #0a0a0a`) with near-white text,
  and a **distinct steel-gray accent** (`--navy #9aa1ab`) for the same accent spots —
  chosen instead of white-as-accent so those elements don't blend into the body text.
  Status colors (green/amber/red) are brightened versions of the light-theme hues,
  retuned for contrast against black.

**Color discipline.** Per the original build spec's own rule ("signal colors are
functional, not decorative"), red/amber/green fills are now reserved strictly for
true compliance signals: post status, finding tier, verdict, score meter, audit
findings. Categorical metadata that isn't a compliance signal — lead pipeline stage,
pilot/control cohort, AI Asset Manager recommend-vs-execute mode — was converted from
colored pill fills to neutral outlined tags with a small leading dot.

**Small fixes along the way.** The "Needs review" status chip was wrapping to two
lines in the fixed-width ledger/audit columns; it now renders "Review" in those
compact contexts (full "Needs review" text is preserved via a hover tooltip, and
stays spelled out in the large verdict banner and the audit filter dropdown where
there's room). Also fixed two real bugs surfaced while reworking the palette: a
dead `--accent` CSS variable still referenced in `charts.js` from an earlier rename
(would have rendered several chart bars invisible), and a stray light-blue border
left on `.finding-note` from an intermediate palette pass.

---

## Compliance engine — protected-class coverage expanded

An audit found that the engine's code declared six state-dependent protected
classes (source of income, sexual orientation, gender identity, marital status, age,
military/veteran status) but three of them — marital status, age, and military/veteran
status — had **zero actual rules**, and gender identity had jurisdiction data but no
matching rules either. Copy like "married couples only" or "no veterans" cleared with
no flag despite the doc naming these as tracked classes.

Fixed: added 13 new rules across those four classes (rule set: 83 → **96 rules**,
version bumped to `2026.07.20`), plus jurisdiction reference entries for marital
status and military/veteran status in `src/data/state-jurisdiction.json` (gender
identity and age already had partial entries). Added two new tests covering the new
classes and a Texas-vs-New-Jersey jurisdiction-gating case. Full suite: **20/20
passing**.

---

## Leads / CRM — stage-change history

Moving a lead through the pipeline previously overwrote its `stage` field in place
with no record of prior transitions — a gap against the "owned system of record"
positioning. Added `stage_history` (an ordered `{ stage, at }` array) to every lead,
updated on each stage change, persisted through both the local-storage repository and
the Supabase REST adapter (schema updated: `leads.stage_history jsonb`). Lead cards
now show the transition path and a last-updated timestamp once a lead has moved more
than once.

---

## Performance / Signals — live vs. snapshot data made explicit

Overview and Leads are fully live (derived from whatever posts/leads exist in the
session). Performance and most of Signals are **not** — channel spend/ROI, the
weekly compliance-volume trend, and the 90-day pilot baseline/current numbers are
seeded snapshot data that doesn't recompute when you log a lead or run a check
mid-demo. That's expected (a 90-day pilot comparison can't be computed live from a
few clicks), but it wasn't visible in the UI, so it risked reading as staged if
someone interacted with the app expecting it to move.

Fixed: added an explicit `pilotWindow` snapshot descriptor (`src/data/seed.js`) with
real dates (window ending Jul 14, 2026, synced same day), surfaced as visible
captions — "Pilot-window snapshot · synced [date]" — on the Performance screen header,
the property-outcomes table, and each Signals card. The one signal that genuinely is
live (compliance coaching flags, derived from session posts) is now explicitly
labeled "Live from this session's checks" instead of being lumped in with the rest.

---

## Known follow-ups (raised by the audit, not addressed today)

Carried forward for whoever picks this up next:

- Supabase RLS policies are wide open (`using (true)` on all tables) — acceptable
  for a prototype per the build spec's explicit auth-out-of-scope call, but worth
  flagging if asked about production readiness.
- The four `LeaseReel_preview_*.html` static snapshot exports still have the
  pre-session styling baked in inline and are now visually stale against the live
  app.
- Auto-fix's rewrite logic (`applyRewrites` / `tidy()` in `complianceEngine.js`) is
  regex-based text cleanup, not grammar-aware — fine for the canned demo examples,
  worth a spot-check against free-typed input before a live demo.
- No git history exists prior to this session's `Initial commit` (`7b1885f`) — the
  full project history before today wasn't under version control.
