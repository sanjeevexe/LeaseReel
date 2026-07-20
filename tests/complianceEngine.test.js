import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createComplianceEngine } from "../src/complianceEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(
  readFileSync(resolve(__dirname, "../src/data/compliance-rules.json"), "utf8")
);
const jurisdiction = JSON.parse(
  readFileSync(resolve(__dirname, "../src/data/state-jurisdiction.json"), "utf8")
);
const engine = createComplianceEngine(rules, jurisdiction);

test("clears property-feature copy and logs acceptable/safe-harbor signals", () => {
  const result = engine.check(
    "Renovated 2BR with wheelchair accessible entry, family room, hardwood floors, and Equal Housing Opportunity."
  );

  assert.equal(result.status, "cleared");
  assert.equal(result.score, 100);
  assert.equal(result.findings.length, 0);
  assert.ok(result.acceptable_matches.some((match) => match.rule_phrase === "wheelchair accessible"));
  assert.ok(result.acceptable_matches.some((match) => match.rule_phrase === "family room"));
  assert.ok(result.safe_harbor_signals.some((match) => match.rule_phrase === "Equal Housing Opportunity"));
});

test("caution-only copy needs review without a hard block", () => {
  const result = engine.check(
    "Exclusive executive community in a safe neighborhood within walking distance of downtown."
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.hard_block, false);
  assert.equal(result.score, 52);
  assert.deepEqual(
    result.findings.map((finding) => finding.rule_phrase),
    ["Exclusive", "executive", "safe neighborhood", "walking distance"].map((phrase) => phrase.toLowerCase())
  );
});

test("hard violation blocks even when acceptable phrases are present", () => {
  const result = engine.check(
    "Great for families, with wheelchair accessible entry and a no kids policy."
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.hard_block, true);
  assert.ok(result.findings.some((finding) => finding.rule_phrase === "great for families"));
  assert.ok(result.findings.some((finding) => finding.rule_phrase === "no kids"));
  assert.ok(result.acceptable_matches.some((match) => match.rule_phrase === "wheelchair accessible"));
  assert.ok(!result.findings.some((finding) => finding.phrase.toLowerCase().includes("wheelchair accessible")));
});

test("longer overlapping violation wins over caution phrase", () => {
  const result = engine.check("This unit is great for families near transit.");

  assert.equal(result.status, "blocked");
  assert.deepEqual(
    result.findings.map((finding) => finding.rule_phrase),
    ["great for families"]
  );
});

test("acceptable property phrases do not create false positives", () => {
  const result = engine.check(
    "Spacious home with a walk-in closet, master bedroom, family room, gated community access, and a great view."
  );

  assert.equal(result.status, "cleared");
  assert.equal(result.findings.length, 0);
});

test("state-dependent source-of-income violations are tagged separately", () => {
  const result = engine.check("No Section 8, no vouchers, and must be employed.");

  assert.equal(result.status, "blocked");
  assert.ok(result.findings.every((finding) => finding.scope === "state-dependent"));
  assert.ok(result.findings.every((finding) => finding.class.includes("source of income")));
});

test("hyphenated protected-class phrases are treated like spaced phrases", () => {
  const adultsOnly = engine.check("Adults-only building.");
  const noKids = engine.check("No-kids policy strictly enforced.");
  const mixed = engine.check("Family-friendly, but adults-only after 10pm.");

  assert.equal(adultsOnly.status, "blocked");
  assert.ok(adultsOnly.findings.some((finding) => finding.rule_phrase === "adults only"));
  assert.equal(noKids.status, "blocked");
  assert.ok(noKids.findings.some((finding) => finding.rule_phrase === "no kids"));
  assert.equal(mixed.status, "blocked");
});

test("caution person-type phrases do not flag ordinary property or activity copy", () => {
  const probes = [
    "Great for entertaining, with a spacious open-concept kitchen.",
    "Perfect for commuters, steps from the train station.",
    "Ideal for remote workers with a dedicated office nook.",
    "Limited-time move-in special, $500 off first month.",
    "Restricted access parking garage for residents only."
  ];

  for (const body of probes) {
    const result = engine.check(body);
    assert.equal(result.status, "cleared", body);
    assert.equal(result.findings.length, 0, body);
  }
});

test("state-dependent source-of-income findings downgrade in Texas but block in New York", () => {
  const body = "No Section 8, no vouchers accepted.";
  const texas = engine.check(body, {
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    state: "TX",
    city: "Austin"
  });
  const newYork = engine.check(body, {
    property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    state: "NY",
    city: "New York"
  });

  assert.equal(texas.hard_block, false);
  assert.equal(texas.status, "cleared");
  assert.equal(texas.findings.length, 2);
  assert.ok(texas.findings.every((finding) => finding.effective_tier === "informational"));
  assert.ok(texas.findings.every((finding) => finding.jurisdiction?.protected === false));

  assert.equal(newYork.hard_block, true);
  assert.equal(newYork.status, "blocked");
  assert.ok(newYork.findings.every((finding) => finding.jurisdiction?.protected === true));
});

test("HOPA-qualified properties explain senior-housing clearance while non-HOPA properties block", () => {
  const body = "Senior living community, ages 55 and up, with renovated one-bedroom homes.";
  const seniorProperty = engine.check(body, {
    property_id: "1f81a926-3700-4077-a6dc-7c8f6ec3fbed",
    state: "AZ",
    city: "Scottsdale",
    hopa_qualified: true
  });
  const ordinaryProperty = engine.check(body, {
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    state: "TX",
    city: "Austin",
    hopa_qualified: false
  });

  assert.equal(seniorProperty.status, "cleared");
  assert.equal(seniorProperty.hard_block, false);
  assert.equal(seniorProperty.findings.length, 0);
  assert.ok(seniorProperty.acceptable_matches.some((match) => match.scope === "hopa-exemption"));

  assert.equal(ordinaryProperty.status, "blocked");
  assert.equal(ordinaryProperty.hard_block, true);
  assert.ok(ordinaryProperty.findings.some((finding) => finding.rule_phrase === "senior living community"));
});

test("adult-only phrasing becomes a HOPA caution, not a block, for verified senior housing", () => {
  const result = engine.check("Adults-only building.", {
    state: "AZ",
    city: "Scottsdale",
    hopa_qualified: true
  });

  assert.equal(result.status, "cleared");
  assert.equal(result.hard_block, false);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].tier, "caution");
  assert.equal(result.findings[0].scope, "hopa-exemption");
});

test("refusal-construction paraphrases are caught without adding a semantic layer", () => {
  const families = engine.check("We do not rent to families with kids.");
  const suitable = engine.check("Not suitable for large families.");
  const vouchersTexas = engine.check("Will not accept Section 8.", { state: "TX", city: "Austin" });
  const vouchersNewYork = engine.check("Will not accept Section 8.", { state: "NY", city: "New York" });

  assert.equal(families.status, "blocked");
  assert.ok(families.findings.some((finding) => finding.rule_phrase === "refusal to rent to families with children"));

  assert.equal(suitable.status, "blocked");
  assert.ok(suitable.findings.some((finding) => finding.rule_phrase === "not suitable for large families"));

  assert.equal(vouchersTexas.status, "cleared");
  assert.equal(vouchersTexas.hard_block, false);
  assert.ok(vouchersTexas.findings.every((finding) => finding.effective_tier === "informational"));

  assert.equal(vouchersNewYork.status, "blocked");
  assert.equal(vouchersNewYork.hard_block, true);
});

test("gender identity, marital status, age, and military-status language is caught and tagged", () => {
  const genderIdentity = engine.check("No transgender applicants, cisgender only please.");
  const marital = engine.check("Married couples only — no unmarried couples.");
  const age = engine.check("No seniors, must be under 30.");
  const military = engine.check("No military, no veterans, civilians only.");

  assert.equal(genderIdentity.status, "blocked");
  assert.ok(genderIdentity.findings.every((f) => f.class.includes("gender identity")));
  assert.ok(genderIdentity.findings.every((f) => f.scope === "state-dependent"));

  assert.equal(marital.status, "blocked");
  assert.ok(marital.findings.every((f) => f.class.includes("marital status")));

  assert.equal(age.status, "blocked");
  assert.ok(age.findings.every((f) => f.class.includes("age")));

  assert.equal(military.status, "blocked");
  assert.ok(military.findings.every((f) => f.class.includes("military / veteran status")));
});

test("newly covered state-dependent classes downgrade in Texas but block in a protecting state", () => {
  const body = "No veterans, civilians only.";
  const texas = engine.check(body, { state: "TX", city: "Austin" });
  const newJersey = engine.check(body, { state: "NJ", city: "Newark" });

  assert.equal(texas.status, "cleared");
  assert.equal(texas.hard_block, false);
  assert.ok(texas.findings.every((finding) => finding.effective_tier === "informational"));
  assert.ok(texas.findings.every((finding) => finding.jurisdiction?.protected === false));

  assert.equal(newJersey.status, "blocked");
  assert.equal(newJersey.hard_block, true);
  assert.ok(newJersey.findings.every((finding) => finding.jurisdiction?.protected === true));
});
