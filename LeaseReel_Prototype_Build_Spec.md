# LeaseReel — Compliance & Governance Prototype
### Build Specification & Demo Brief · v1

> **What this document is.** A complete build spec for a working prototype that demonstrates the three capabilities the LeaseReel/AI Asset Manager use-case doc explicitly marks as **BUILD — core proprietary**: (1) Fair Housing compliance screening, (2) lead capture & CRM routing, and (3) the corporate governance pane. It is written so it can be handed directly to a coding agent (Claude Code) as a build prompt, and also read on its own as a briefing before the meeting.
>
> **What this document is *not*.** It does not touch the parts the doc says to **BUY** (AI video generation via Higgsfield/Opus Clip, social scheduling APIs). Those are deliberately out of scope — see §9.

---

## 1. Why this slice

The use-case doc draws a hard line in §2.2 between what the platform *buys* and what it *builds*. The buy list (content generation, scheduling) is "already solved." The build list is where the moat lives:

| Doc's BUILD item | Demonstrated here |
|---|---|
| Fair Housing compliance screening — *"No incumbent owns this… this is our open lane."* | **Yes — the centerpiece.** A weighted, categorized, explainable screening engine. |
| Lead capture & CRM routing — *"owned system of record… the data must be ours."* | **Yes.** Inbound social interactions captured and routed into an owned pipeline. |
| Corporate governance dashboard — *"single-pane portfolio-wide oversight."* | **Yes.** One pane showing every post's compliance status and every lead, portfolio-wide, with an audit trail. |
| AI video generation, scheduling | **No — deliberately.** These are BUY items; building them would be wasted effort and off-strategy. |

The point of the prototype is not to be production-ready. It is to make the moat **tangible** — to show that the person building this understood *which three things matter* and can build a credible first version of each. Everything below is engineered toward that impression.

---

## 2. Product overview

Three connected modules, one continuous flow:

```
  ┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
  │  1. COMPLIANCE       │     │  2. LEAD CAPTURE      │     │  3. GOVERNANCE PANE  │
  │  Screen ad copy →    │ →   │  Inbound DM/comment → │ →   │  Portfolio-wide view │
  │  scored + explained  │     │  routed to pipeline   │     │  of posts + leads +  │
  │  + suggested rewrite │     │  (owned record)       │     │  audit trail         │
  └─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

A user (a corporate leasing manager or owner) can:
1. Paste draft ad copy for a property post, run it through the **compliance engine**, and get a score, a publish/hold/block decision, per-issue explanations, and compliant rewrites.
2. Log an inbound social interaction (a DM, comment, or click) as a **lead**, which routes into an owned pipeline tied to a property.
3. See everything at once in the **governance pane**: portfolio compliance rate, blocked posts, lead volume by source and property, and a running audit ledger.

---

## 3. The compliance engine (centerpiece)

This is the piece that must feel like real IP. It is built as a **weighted, context-aware, three-tier rule engine** — grounded in the actual framework HUD-aligned fair-housing guidance uses, not an invented blocklist.

### 3.1 The three tiers

Real fair-housing advertising guidance sorts language into three buckets, and **context decides the bucket** — the same root word can be fine or forbidden depending on whether it describes *the property* or *the person*.

| Tier | Meaning | Effect on score | Example |
|---|---|---|---|
| **Violation** | Explicit reference to a protected class, or exclusion of one | Heavy penalty; forces **Blocked** | "Perfect for a young Christian couple, no kids" |
| **Caution** | Coded / subjective language historically tied to steering or preference | Moderate penalty; can trigger **Needs review** | "Exclusive executive community in a safe area" |
| **Acceptable** | Describes the property, not the occupant | No penalty (some log a positive signal) | "Renovated 2BR with a family room and wheelchair-accessible entry" |

The engine's credibility comes from getting the **context calls** right:

- ✅ "wheelchair **accessible**" → *Acceptable* (describes a property feature)
- ❌ "no wheelchairs" / "able-bodied only" → *Violation* (excludes by disability)
- ✅ "family room," "master bedroom" → *Acceptable* (describes a room)
- ❌ "great **for families**," "perfect **for** empty nesters" → *Violation* (describes the occupant / familial status)
- ✅ "gated community" → *Acceptable* (property feature)
- ⚠️ "exclusive," "private," "restricted" → *Caution* (historically coded)

An engine that flags "no wheelchairs" **but not** "wheelchair accessible" is the single most convincing thing in the whole demo. It proves the system understands *intent*, which is exactly what the doc means by a compliance layer generic schedulers can't replicate.

### 3.2 Protected classes (federal + state-dependent)

Every finding is tagged with the class it implicates. Federal classes are always active; state-dependent classes are flagged separately — this maps directly to Francisco's "multi-state licensing framework" concern in the doc.

**Federal (Fair Housing Act — always enforced):**
race · color · religion · sex · disability · familial status · national origin

**State / local-dependent (flag as "state-dependent"):**
sexual orientation · gender identity · source of income (e.g. housing vouchers / Section 8) · marital status · age · military / veteran status

Tagging source-of-income as *state-dependent* rather than a flat violation is a deliberate sophistication signal: it shows the engine knows the law isn't uniform, which is the whole reason the platform needs a licensed broker in the loop.

### 3.3 Scoring model

```
score = 100
for each finding:
    if tier == "violation":  score -= 40   AND set hard_block = true
    if tier == "caution":    score -= 12
if "equal housing opportunity" / "EHO" present: log safe-harbor signal (+5, capped at 100)
score = max(score, 0)
```

**Status bands:**

| Condition | Status | Action label |
|---|---|---|
| Any violation present | **Blocked** | "Do not publish" |
| No violations, score ≥ 80 | **Cleared** | "Cleared to publish" |
| No violations, score 50–79 | **Needs review** | "Hold for corporate review" |
| No violations, score < 50 | **Needs review** | "Hold for corporate review" |

A violation always blocks regardless of total score — you can't average your way out of an explicit exclusion. That rule alone mirrors how real enforcement works (one "no kids" sinks the whole ad).

### 3.4 What each finding returns

For every match, the engine returns a structured finding — this is what powers both the reviewer UI and the audit trail:

```json
{
  "phrase": "no kids",
  "tier": "violation",
  "class": ["familial status"],
  "scope": "federal",
  "rationale": "Excludes families with children, a protected class under the Fair Housing Act.",
  "suggested_rewrite": "Describe the unit's features instead (e.g. '2 bedrooms, quiet street'). Do not reference who may live there."
}
```

The **suggested rewrite** is what turns the tool from a detector into a co-pilot — it doesn't just flag, it teaches the agent how to fix it. That is the difference between "a filter" and "a product."

### 3.5 Seed rule set

Ship the prototype with this starter dataset. It is real, categorized, and enough to make the demo land. (Store as a JSON/CSV the engine loads; keep it editable so the rule set looks like a maintained asset, not hardcoded strings.)

**VIOLATION — familial status:**
`no children` · `no kids` · `adults only` · `adult community` · `mature adults` · `empty nesters` · `perfect for singles` · `couples only` · `great for families` · `ideal for a family` · `no more than one child`

**VIOLATION — religion:**
`Christian` (as a preference) · `Catholic community` · `Jewish` · `Muslim` · `church-going` · `no [religion]` · `godly household`

**VIOLATION — race / color / national origin:**
`whites only` · `no [race]` · `Caucasian` · `integrated` · `English only` · `must speak English` · `no immigrants` · ethnic-preference references

**VIOLATION — disability:**
`no wheelchairs` · `able-bodied` · `healthy only` · `not for handicapped` · `no HIV` · `physically fit` · `must be able to climb stairs`

**VIOLATION — sex / orientation *(orientation = state-dependent)*:**
`male only` · `female only` · `no gays` · `straight tenants` · `bachelor pad` *(caution in some contexts)*

**VIOLATION — source of income *(state-dependent)*:**
`no Section 8` · `no vouchers` · `no welfare` · `must be employed`

**CAUTION — coded / subjective:**
`exclusive` · `executive` · `private` · `restricted` · `limited` · `prestigious` · `traditional` · `family-oriented` · `family neighborhood` · `safe area` · `safe neighborhood` · `secure neighborhood` · `quiet building` · `walking distance` · `walk to` · `jog to` · `perfect for` · `ideal for` · `great for` · `diverse` · `mixed community`

**ACCEPTABLE (do NOT flag — include to prevent false positives):**
`wheelchair accessible` · `accessible` · `family room` · `master bedroom` · `gated community` · `great view` · `walk-in closet` · `renovated` · `spacious` · `hardwood floors` · `near golf course` · `Equal Housing Opportunity` *(also logged as safe-harbor positive)*

> Including the **Acceptable** list is not optional decoration — it is what stops the engine from embarrassing itself by flagging "family room" or "wheelchair accessible." A demo that over-flags looks naive; one that knows what's *fine* looks expert.

### 3.6 Matching notes

- Case-insensitive; match on word boundaries so "accessible" inside "wheelchair accessible" resolves to the *Acceptable* rule, not a partial hit.
- When a phrase overlaps tiers (e.g. text contains both "wheelchair accessible" and "no wheelchairs"), the more specific/longer match wins for that span; other spans evaluate independently.
- Keep the matcher simple (string/regex over the seed list). It does **not** need real NLP — resist the temptation. A clean rule engine that's explainable beats a black box you can't demo.

---

## 4. Data model (Supabase)

Three tables. Keep it lean.

**`posts`** — every ad copy submitted for screening
| column | type | notes |
|---|---|---|
| id | uuid (pk) | |
| property_id | uuid (fk → properties) | |
| agent_name | text | who submitted |
| platform | text | instagram / tiktok / facebook |
| body | text | the ad copy |
| score | int | 0–100 |
| status | text | cleared / needs_review / blocked |
| findings | jsonb | array of finding objects (§3.4) |
| created_at | timestamptz | audit timestamp |

**`leads`** — inbound social interactions, routed into the owned pipeline
| column | type | notes |
|---|---|---|
| id | uuid (pk) | |
| property_id | uuid (fk → properties) | |
| prospect_name | text | |
| source | text | instagram / tiktok / facebook |
| interaction_type | text | dm / comment / click / form_fill |
| message | text | |
| stage | text | new / contacted / toured / leased / lost |
| created_at | timestamptz | |

**`properties`** — the small portfolio the demo runs on
| column | type | notes |
|---|---|---|
| id | uuid (pk) | |
| name | text | e.g. "Maple Court" |
| units | int | |
| market | text | e.g. "Austin, TX" |

Seed 3–4 properties so the portfolio view has something to aggregate. `findings` as `jsonb` means the full audit record travels with the post — no lossy flattening.

---

## 5. Screens & flows

Four screens, left-rail navigation. Design detail in §6.

### 5.1 Overview (the governance pane) — landing screen

The "single pane" the doc promises. Three zones, top to bottom:

- **Portfolio summary tiles** (row of 4): Posts screened · % cleared · Blocked this period · Total leads. Numbers count up on load.
- **Compliance feed** (main column): reverse-chronological list of screened posts. Each row = status chip + property + agent + platform + timestamp + score. Click a row to expand the full findings (phrases, classes, rationales, rewrites). This is the **signature "compliance ledger"** — it reads like a monitoring terminal.
- **Leads pipeline** (side column): leads grouped by stage, or a compact table with source + property. Reinforces "no lead leaks — every interaction is here."

### 5.2 Compliance — the live checker

The screen that wins the demo. Layout: input on the left, result on the right.

- **Left:** property selector, agent name, platform, and a large textarea for the ad copy. A "Run compliance check" button.
- **Right (on run):**
  - Big status verdict: **Cleared** / **Needs review** / **Blocked**, color-coded, with the action label.
  - The score, shown as a number and a slim meter.
  - **Findings list:** each finding is a card — matched phrase highlighted, protected class as a tag, federal/state-dependent badge, plain-English rationale, and the suggested compliant rewrite in a distinct block.
  - A "Save to ledger" action that writes the post + findings to `posts` and drops it into the Overview feed.
- Prefill a **"Load example"** control with 3 canned inputs (one clean, one caution-only, one hard violation) so the demo runs even if nobody wants to type. The violation example should include *both* a real violation and a false-positive trap (e.g. "wheelchair accessible") so you can point out that the engine *didn't* flag the safe phrase.

### 5.3 Leads — capture + pipeline

- A capture form simulating an inbound interaction: prospect name, source, interaction type, message, property. Submit → writes to `leads` → appears instantly in the pipeline and in the Overview.
- Below the form: the pipeline, either as stage columns (new → contacted → toured → leased) or a filterable table. Show source and property on every lead — that's the "owned system of record" point made visual.

### 5.4 Audit — the compliance record

- A read-only, timestamped ledger of every compliance check ever run, newest first, in the monospace ledger style. Filterable by property and status. This is the literal "**audit trail**" the doc names as the enterprise differentiator — the thing a broker with liability exposure actually cares about. Keep it deliberately plain and record-like; its gravitas *is* the design.

---

## 6. Design system

The product is institutional compliance software for owners, brokers, and corporate leasing ops — people managing legal liability, not consumers. It should feel like something you'd trust with Fair Housing exposure: confident, quiet, precise. Not a cheerful startup dashboard.

**Avoid the AI-default looks** (cream+serif+terracotta; near-black+acid-green; broadsheet hairlines). The direction here is *institutional monitoring terminal meets modern SaaS.*

### 6.1 Palette

The signal colors are **functional, not decorative** — they *are* the information architecture (a post's compliance state is the most important fact on screen). Keep them serious and desaturated; no cartoon stoplight.

```
--ink:        #16181D   /* primary text, headers, structural */
--paper:      #F6F7F9   /* app background (cool, document-like, NOT cream) */
--surface:    #FFFFFF   /* cards, panels */
--line:       #E4E7EC   /* hairlines, borders */
--muted:      #6B7280   /* secondary text, labels */

--cleared:    #157F4C   /* deep considered green */
--review:     #A8710E   /* serious amber/ochre */
--blocked:    #A93226   /* authoritative brick red */

--accent:     #1E4D6B   /* institutional teal-blue: links, primary buttons */
```

Use signal colors only on status chips, verdicts, and meters — never as background wallpaper. Everything else stays ink-on-paper quiet so the signals carry weight.

### 6.2 Typography — three deliberate roles

| Role | Face | Use |
|---|---|---|
| Display | **Space Grotesk** | Wordmark, screen titles, the big verdict. Character + technical confidence. |
| Body / UI | **IBM Plex Sans** | All reading and controls. Institutional clarity (enterprise heritage). |
| Data / ledger | **IBM Plex Mono** | Timestamps, scores, the compliance feed and audit ledger. |

The **mono ledger is the signature texture** — the audit feed rendered in Plex Mono reads like a financial/monitoring record, which is exactly the gravitas a liability-conscious broker responds to. Load from Google Fonts.

### 6.3 Signature element

**The compliance ledger.** The Overview feed and the Audit screen render as a running, monospace, timestamped record — the interface equivalent of a legal audit log. Everything else is calm and disciplined; the ledger is the one memorable thing, and it embodies the doc's core promise ("every post carries an audit trail") in a single visual idea. Spend the boldness here; keep the rest quiet.

### 6.4 Motion (restrained)

- Score counts up on check completion; status chip settles with a subtle transition.
- Findings expand/collapse smoothly.
- Respect `prefers-reduced-motion` — disable count-ups and transitions when set.
- No ambient/decorative animation. Compliance software that fidgets looks untrustworthy.

### 6.5 Quality floor (non-negotiable)

Responsive to mobile; visible keyboard focus states; sufficient contrast on all signal colors against white; empty states that direct ("No posts screened yet — run your first check") rather than sit blank.

---

## 7. Copy & voice

Plain, active, operator-facing. Name things by what the user controls, not how the system works.

- Buttons: "Run compliance check," "Save to ledger," "Log lead" — the action keeps its name through to the confirmation ("Saved to ledger").
- Verdicts: "Cleared to publish," "Hold for corporate review," "Do not publish."
- Rationales: one sentence, plain English, no legalese dump. "Excludes families with children, a protected class."
- Empty states: an instruction, not a mood. "No leads yet — log an inbound message to start the pipeline."
- Never apologize in errors; say what happened and the fix.

---

## 8. Tech stack & build sequence

**Stack** (matches existing capability — no new tooling to learn):
- Frontend: HTML / CSS / vanilla JS (or a light single-file React if preferred). No framework overhead needed.
- Data: Supabase (Postgres + JS client).
- Deploy: Netlify.
- Fonts: Google Fonts (Space Grotesk, IBM Plex Sans, IBM Plex Mono).

**Build order** (each step ships something demoable — front-load the centerpiece):

1. **Compliance engine, standalone** — the rule dataset (§3.5) + scorer (§3.3) + finding output (§3.4) as a pure JS module. Unit-test it against the three canned examples. *This is the thing that must be right; build it first, in isolation.*
2. **Compliance screen** (§5.2) wired to the engine, with "Load example." At this point you can already demo the single most impressive part.
3. **Supabase + `posts`** — persist checks; "Save to ledger."
4. **Overview / governance pane** (§5.1) reading from `posts`.
5. **Leads** (§5.3) — `leads` table, capture form, pipeline, feed into Overview.
6. **Audit screen** (§5.4).
7. **Design pass** — apply §6 fully; tighten spacing, states, mobile, reduced-motion.
8. **Seed data** — 3–4 properties, a handful of pre-run posts and leads so every screen looks alive on first load (never demo an empty product).

If time runs short, steps 1–4 alone are a strong, coherent demo. Steps 5–8 are polish and completeness.

---

## 9. Explicitly out of scope (and why)

State these plainly if asked — knowing what *not* to build is itself a signal you understood the strategy:

- **AI video generation** — a BUY item (Higgsfield / Opus Clip). Not our moat; building it wastes effort.
- **Real social publishing / scheduling** — a BUY item (unified publishing API). Simulated here.
- **Auth / user accounts / roles** — not needed to demonstrate the three core capabilities; adds days for no demo value.
- **The AI Asset Manager intelligence engine** — that's the platform's *horizon*; this prototype is the LeaseReel *wedge* that feeds it. Showing the wedge working is the right scope for a first conversation.

The discipline is the point: engineering effort is concentrated exactly where the doc says the moat is, and nowhere else.

---

## 10. How this maps back to the doc (for the meeting)

If you want to speak to it directly, this is the one-liner per module:

- **Compliance engine** → §2.2 *"Fair Housing compliance screening — BUILD — core proprietary layer… this is our open lane."* Built, with context-aware tiers and multi-state class tagging.
- **Lead capture** → §2.2 *"Lead capture & CRM routing — BUILD — owned system of record… the data must be ours."* Built as an owned pipeline.
- **Governance pane + audit** → §2.1 step 5 & §2.3 *"single governance pane… Fair Housing audit trail included."* Built as the signature ledger.
- **What's mocked** → the BUY items in §2.2. Deliberately not built.

The prototype is small on purpose. It is not a claim that the platform is done — it's proof that the person across the table can build the three things the doc says are the hardest and most defensible, and knew to leave the rest alone.

---

*LeaseReel — Compliance & Governance Prototype · Build Spec v1*
