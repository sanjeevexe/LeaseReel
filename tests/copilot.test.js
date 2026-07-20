import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createComplianceEngine } from "../src/complianceEngine.js";
import * as analytics from "../src/analytics.js";
import {
  agents,
  channelPerformance,
  seedLeads,
  seedProperties
} from "../src/data/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(resolve(__dirname, "../src/data/compliance-rules.json"), "utf8"));
const jurisdiction = JSON.parse(readFileSync(resolve(__dirname, "../src/data/state-jurisdiction.json"), "utf8"));
const engine = createComplianceEngine(rules, jurisdiction);

test("segment() covers the whole string and tags matched spans", () => {
  const body = "Great for families, no kids, with a wheelchair accessible lobby.";
  const result = engine.check(body);
  const segments = engine.segment(body, result);
  assert.equal(segments.map((s) => s.text).join(""), body);
  assert.ok(segments.some((s) => s.tier === "violation"));
  assert.ok(segments.some((s) => s.tier === "acceptable"));
});

test("autoFix + recheck removes violations and clears the draft", () => {
  const body = "Great for families, no kids in upper-floor homes, with a wheelchair accessible lobby, spacious layouts, and hardwood floors.";
  const first = engine.check(body);
  assert.equal(first.status, "blocked");

  const outcome = engine.fixAndRecheck(body);
  assert.notEqual(outcome.result.status, "blocked");
  assert.ok(outcome.fix.changes.length >= 1);
  // The cleaned draft should no longer contain the excluded-class phrase.
  assert.ok(!/no kids/i.test(outcome.fix.text));
  // Acceptable property features survive the cleanup.
  assert.ok(/wheelchair accessible/i.test(outcome.fix.text));
});

test("autoFix preserves already-clean copy", () => {
  const body = "Renovated 2BR with hardwood floors and a family room. Equal Housing Opportunity.";
  const result = engine.check(body);
  const fix = engine.autoFix(body, result);
  assert.equal(fix.changes.length, 0);
});

test("channelStats shows LeaseReel beating blended paid cost-per-lease", () => {
  const cs = analytics.channelStats(channelPerformance);
  assert.ok(cs.owned_cost_per_lease > 0);
  assert.ok(cs.owned_cost_per_lease < cs.paid_blended_cost_per_lease);
  assert.ok(cs.cost_advantage_pct > 0);
});

test("pilotSummary improves current vs baseline for the pilot cohort", () => {
  const p = analytics.pilotSummary(seedProperties);
  assert.ok(p.current.social_leases > p.baseline.social_leases);
  assert.ok(p.current.cost_per_lease < p.baseline.cost_per_lease);
  assert.ok(p.deltas.cost_per_lease_pct < 0);
});

test("leadFunnel and ownerSignals produce sane, ordered output", () => {
  const funnel = analytics.leadFunnel(seedLeads);
  assert.ok(funnel.total === seedLeads.length);
  assert.ok(funnel.lead_to_lease_pct >= 0 && funnel.lead_to_lease_pct <= 100);

  const posts = []; // signals should still generate from channel + property data
  const cs = analytics.channelStats(channelPerformance);
  const signals = analytics.ownerSignals(seedProperties, posts, seedLeads, cs);
  assert.ok(signals.length > 0);
  const rank = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < signals.length; i++) {
    assert.ok(rank[signals[i - 1].severity] <= rank[signals[i].severity]);
  }
});
