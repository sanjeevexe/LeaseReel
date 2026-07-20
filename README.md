# LeaseReel Compliance & Governance Prototype

Working prototype for the build-owned moat in the use case, extended toward the
owner-side AI Asset Manager thesis. Six connected screens:

- **Overview** — portfolio governance pane (compliance ledger, status mix, 8-week volume, per-property health, leads snapshot, top owner signals).
- **Compliance** — live Fair Housing checker with in-place annotated copy, context-aware findings, one-click **auto-fix & re-check**, and a **publish gate** (blocked copy cannot publish).
- **Leads** — owned pipeline with lead-to-lease funnel, source attribution, and stage board.
- **Performance** — the use case's 90-day bar: social-attributed leases per vacant unit, cost-per-lease vs. paid channels, conversion, and pilot-vs-baseline-vs-control comparisons.
- **Signals** — AI Asset Manager intelligence preview: owner recommendations derived from LeaseReel's own leasing/compliance/channel data, mapped to the AI Context Foundation.
- **Audit** — timestamped, immutable compliance record with annotated copy.

## Run locally

```bash
npm test          # 18 tests: compliance engine + co-pilot helpers + analytics
npm run dev
```

Open `http://localhost:5173`.

The app seeds six properties (with financials, vacancy, and 90-day pilot/baseline
data), example screened posts, and example leads into local browser storage on
first load. Texas, New York, and a HOPA-qualified senior-housing property let the
same copy be tested across jurisdiction and exemption contexts.

## Static previews

`LeaseReel_preview_*.html` are self-contained snapshots (inline CSS, no server)
of the Overview, Compliance, Performance, and Signals screens — open any of them
directly in a browser to see the design without running the dev server.

## Supabase

Run `supabase/schema.sql` in a Supabase project, then provide credentials before `src/app.js` loads:

```html
<script>
  window.LEASEREEL_SUPABASE = {
    url: "https://your-project.supabase.co",
    anonKey: "your-anon-key"
  };
</script>
```

When credentials are present, the storage adapter reads and writes `properties`, `posts`, and `leads` through the Supabase REST API. When they are absent, it uses the seeded local demo ledger.

## Compliance Data

- Rules: `src/data/compliance-rules.json`
- Jurisdiction reference: `src/data/state-jurisdiction.json`
- Seed properties/posts/leads: `src/data/seed.js`

The jurisdiction reference is dated and intentionally separate from the engine so it can be reviewed and maintained by legal/compliance owners.
