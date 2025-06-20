const SCORE_PENALTY = {
  violation: 40,
  caution: 12,
  informational: 0,
  acceptable: 0
};

const TIER_RANK = {
  violation: 3,
  caution: 2,
  informational: 1,
  acceptable: 1
};

const STATE_DEPENDENT_CLASSES = new Set([
  "source of income",
  "sexual orientation",
  "gender identity",
  "marital status",
  "age",
  "military / veteran status"
]);

export const STATUS = {
  blocked: {
    label: "Blocked",
    actionLabel: "Do not publish"
  },
  needs_review: {
    label: "Needs review",
    actionLabel: "Hold for corporate review"
  },
  cleared: {
    label: "Cleared",
    actionLabel: "Cleared to publish"
  }
};

export const SEVERITY = {
  violation: "high",
  caution: "medium",
  informational: "low",
  acceptable: "none"
};

export function createComplianceEngine(ruleSet, jurisdictionData = {}) {
  if (!ruleSet?.rules?.length) {
    throw new Error("Compliance engine requires a populated rule set.");
  }

  const compiledRules = ruleSet.rules.map(compileRule);

  return {
    version: ruleSet.version,
    ruleCount: compiledRules.length,
    check(body, context = {}) {
      return evaluateCompliance(body, compiledRules, context, jurisdictionData);
    },
    // Co-pilot helpers built on top of a check result.
    segment(body, result) {
      return segmentText(body, result);
    },
    autoFix(body, result) {
      return applyRewrites(body, result);
    },
    fixAndRecheck(body, context = {}) {
      const first = evaluateCompliance(body, compiledRules, context, jurisdictionData);
      const fix = applyRewrites(body, first);
      const rechecked = evaluateCompliance(fix.text, compiledRules, context, jurisdictionData);
      return { original: first, fix, result: rechecked };
    }
  };
}

// Break the ad copy into ordered segments so the UI can render the source text
// with each matched phrase highlighted in place (violation / caution / ok).
// This is the "show, don't tell" view: the reviewer sees exactly what tripped.
export function segmentText(body, result) {
  const text = String(body || "");
  const spans = [];

  for (const finding of result?.findings || []) {
    if (!Number.isFinite(finding.start) || !Number.isFinite(finding.end)) continue;
    spans.push({
      start: finding.start,
      end: finding.end,
      tier: finding.effective_tier || finding.tier,
      kind: "finding",
      finding
    });
  }
  for (const match of result?.acceptable_matches || []) {
    if (!Number.isFinite(match.start) || !Number.isFinite(match.end)) continue;
    spans.push({
      start: match.start,
      end: match.end,
      tier: "acceptable",
      kind: match.safe_harbor ? "safe_harbor" : "acceptable",
      match
    });
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // skip any overlap defensively
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), tier: null });
    }
    segments.push({
      text: text.slice(span.start, span.end),
      tier: span.tier,
      kind: span.kind,
      finding: span.finding || null,
      match: span.match || null
    });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), tier: null });
  }
  return segments;
}

// Produce a machine-cleaned draft: strip the violation/caution phrases the
// engine flagged, tidy the leftover punctuation, and hand back a reviewable
// draft. This is the detector-to-co-pilot move — it doesn't just flag, it fixes.
export function applyRewrites(body, result) {
  const text = String(body || "");
  const removable = (result?.findings || [])
    .filter((finding) => {
      const tier = finding.effective_tier || finding.tier;
      return tier === "violation" || tier === "caution";
    })
    .filter((finding) => Number.isFinite(finding.start) && Number.isFinite(finding.end))
    .sort((a, b) => b.start - a.start); // remove right-to-left to keep indices valid

  const changes = [];
  let output = text;
  for (const finding of removable) {
    const replacement = finding.neutral_replacement || "";
    changes.push({
      phrase: finding.phrase,
      tier: finding.effective_tier || finding.tier,
      class: finding.class,
      replacement
    });
    output = output.slice(0, finding.start) + replacement + output.slice(finding.end);
  }

  return { text: tidy(output), changes };
}

function tidy(value) {
  let out = String(value || "");
  out = out.replace(/\s+([,.;:!?])/g, "$1"); // no space before punctuation
  out = out.replace(/([,.;:])\s*(?=[,.;:])/g, ""); // collapse doubled punctuation
  out = out.replace(/\s{2,}/g, " "); // collapse runs of whitespace
  out = out.replace(/(^|[.!?]\s+)([,;:\s]+)/g, "$1"); // drop leading connectors after a stop
  out = out.replace(/\s*,\s*,/g, ","); // stray comma pairs
  out = out.replace(/^[\s,;:.]+/, ""); // trim leading punctuation
  out = out.replace(/^(in|with|and|but|for|near|to|plus)\b[\s,]*/i, ""); // drop dangling lead-in
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/,\s*\./g, "."); // ", ." -> "."
  out = out.replace(/[,;:]\s*$/g, "."); // trailing connector -> period
  if (out && !/[.!?]$/.test(out)) out += ".";
  if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

export function evaluateCompliance(body, rules, context = {}, jurisdictionData = {}) {
  const text = String(body || "");
  const candidates = rules.flatMap((rule) => collectMatches(text, rule));
  const selectedMatches = selectLongestNonOverlapping(candidates);
  const selectedRules = selectedMatches.map(toRuleMatch);
  const contextualized = applyContext(
    selectedRules.filter((match) => match.tier !== "acceptable").map(toFinding),
    context,
    jurisdictionData
  );
  const acceptableMatches = [
    ...selectedRules
    .filter((match) => match.tier === "acceptable")
      .map(toAcceptableMatch),
    ...contextualized.acceptable_matches
  ];
  const findings = contextualized.findings;
  const safeHarborSignals = acceptableMatches.filter((match) => match.safe_harbor);

  let score = 100;
  let hardBlock = false;

  for (const finding of findings) {
    const effectiveTier = finding.effective_tier || finding.tier;
    score -= SCORE_PENALTY[effectiveTier] || 0;
    if (finding.blocks_publish !== false && effectiveTier === "violation") {
      hardBlock = true;
    }
  }

  if (safeHarborSignals.length > 0) {
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));
  const status = hardBlock ? "blocked" : score >= 80 ? "cleared" : "needs_review";

  return {
    score,
    status,
    status_label: STATUS[status].label,
    action_label: STATUS[status].actionLabel,
    hard_block: hardBlock,
    findings,
    acceptable_matches: acceptableMatches,
    safe_harbor_signals: safeHarborSignals,
    checked_at: new Date().toISOString(),
    context
  };
}

function compileRule(rule) {
  const pattern = rule.pattern || phraseToPattern(rule.phrase);
  return {
    ...rule,
    regex: new RegExp(pattern, "gi")
  };
}

function phraseToPattern(phrase) {
  const parts = String(phrase)
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(escapeRegex);
  return `(?<![A-Za-z0-9])${parts.join("[\\s-]+")}(?![A-Za-z0-9])`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMatches(text, rule) {
  const matches = [];
  const regex = new RegExp(rule.regex.source, rule.regex.flags);
  let match = regex.exec(text);

  while (match) {
    matches.push({
      rule,
      phrase: match[0],
      start: match.index,
      end: match.index + match[0].length
    });

    if (match.index === regex.lastIndex) {
      regex.lastIndex += 1;
    }

    match = regex.exec(text);
  }

  return matches;
}

function selectLongestNonOverlapping(candidates) {
  const selected = [];
  const sorted = [...candidates].sort((a, b) => {
    const byLength = lengthOf(b) - lengthOf(a);
    if (byLength !== 0) return byLength;

    const byTier = (TIER_RANK[b.rule.tier] || 0) - (TIER_RANK[a.rule.tier] || 0);
    if (byTier !== 0) return byTier;

    return a.start - b.start;
  });

  for (const candidate of sorted) {
    if (!selected.some((existing) => overlaps(existing, candidate))) {
      selected.push(candidate);
    }
  }

  return selected.sort((a, b) => a.start - b.start || lengthOf(b) - lengthOf(a));
}

function lengthOf(match) {
  return match.end - match.start;
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function toRuleMatch(match) {
  return {
    id: match.rule.id,
    phrase: match.phrase,
    rule_phrase: match.rule.phrase,
    tier: match.rule.tier,
    class: match.rule.classes,
    scope: match.rule.scope,
    rationale: match.rule.rationale,
    suggested_rewrite: match.rule.suggested_rewrite,
    neutral_replacement: match.rule.neutral_replacement,
    safe_harbor: Boolean(match.rule.safe_harbor),
    hopa_preferred: Boolean(match.rule.hopa_preferred),
    hopa_caution: Boolean(match.rule.hopa_caution),
    start: match.start,
    end: match.end
  };
}

function toFinding(match) {
  return {
    id: match.id,
    phrase: match.phrase,
    rule_phrase: match.rule_phrase,
    tier: match.tier,
    original_tier: match.tier,
    effective_tier: match.tier,
    blocks_publish: match.tier === "violation",
    class: match.class,
    scope: match.scope,
    rationale: match.rationale,
    suggested_rewrite: match.suggested_rewrite,
    neutral_replacement: match.neutral_replacement,
    severity: SEVERITY[match.tier] || "none",
    hopa_preferred: match.hopa_preferred,
    hopa_caution: match.hopa_caution,
    start: match.start,
    end: match.end
  };
}

function toAcceptableMatch(match) {
  return {
    phrase: match.phrase,
    rule_phrase: match.rule_phrase,
    tier: match.tier,
    class: match.class,
    scope: match.scope,
    rationale: match.rationale,
    safe_harbor: match.safe_harbor,
    start: match.start,
    end: match.end
  };
}

function applyContext(findings, context, jurisdictionData) {
  const acceptedFromContext = [];
  const contextualFindings = [];

  for (const finding of findings) {
    const hopaResult = applyHopaContext(finding, context);

    if (hopaResult.acceptable_match) {
      acceptedFromContext.push(hopaResult.acceptable_match);
    }

    if (!hopaResult.finding) {
      continue;
    }

    contextualFindings.push(applyJurisdictionContext(hopaResult.finding, context, jurisdictionData));
  }

  return {
    findings: contextualFindings,
    acceptable_matches: acceptedFromContext
  };
}

function applyHopaContext(finding, context) {
  if (!context?.hopa_qualified || !finding.class?.includes("familial status")) {
    return { finding };
  }

  const hopaNote =
    "HOPA-qualified property: familial-status restrictions are evaluated under the verified senior-housing exemption.";

  if (finding.hopa_preferred) {
    return {
      finding: null,
      acceptable_match: {
        phrase: finding.phrase,
        rule_phrase: finding.rule_phrase,
        tier: "acceptable",
        class: finding.class,
        scope: "hopa-exemption",
        rationale: `${hopaNote} This is preferred senior-housing phrasing when the property qualification is documented.`,
        safe_harbor: false,
        start: finding.start,
        end: finding.end
      }
    };
  }

  if (finding.hopa_caution) {
    return {
      finding: {
        ...finding,
        tier: "caution",
        effective_tier: "caution",
        blocks_publish: false,
        scope: "hopa-exemption",
        hopa_note: `${hopaNote} HUD best practice still favors '55 and older community' or 'age-restricted housing' over adult-only phrasing.`,
        rationale:
          "The property is HOPA-qualified, so this is not a familial-status block, but the phrasing invites review under senior-housing advertising best practices.",
        suggested_rewrite:
          "Use '55 and older community' or 'age-restricted housing' if the property has documented HOPA qualification."
      }
    };
  }

  return {
    finding: {
      ...finding,
      tier: "informational",
      effective_tier: "informational",
      blocks_publish: false,
      scope: "hopa-exemption",
      hopa_note: hopaNote,
      rationale: `${hopaNote} Logged for visibility but not treated as a publishing block for this property.`
    }
  };
}

function applyJurisdictionContext(finding, context, jurisdictionData) {
  if (!shouldGateByJurisdiction(finding, jurisdictionData)) {
    return finding;
  }

  const state = normalizeState(context?.state || context?.property?.state);
  const city = context?.city || context?.property?.city || "";

  if (!state) {
    return {
      ...finding,
      jurisdiction: {
        state: "",
        protected: true,
        note: "No property state supplied; applying the conservative blocking posture."
      }
    };
  }

  const classStatuses = finding.class.map((className) => ({
    class: className,
    ...getClassProtection(className, state, city, jurisdictionData)
  }));
  const protectedNow = classStatuses.some((status) => status.protected);
  const label = `Protected in ${state}: ${protectedNow ? "Yes" : "No"}`;
  const note = classStatuses
    .map((status) => status.note)
    .filter(Boolean)
    .join(" ");

  if (protectedNow) {
    return {
      ...finding,
      jurisdiction: {
        state,
        city,
        protected: true,
        class_statuses: classStatuses,
        label,
        note
      }
    };
  }

  return {
    ...finding,
    tier: "informational",
    effective_tier: "informational",
    blocks_publish: false,
    jurisdiction: {
      state,
      city,
      protected: false,
      class_statuses: classStatuses,
      label,
      note: `${note} Flagged for visibility; this state reference does not make the phrase a publishing block for the selected property.`.trim()
    }
  };
}

function shouldGateByJurisdiction(finding, jurisdictionData) {
  if (finding.scope !== "state-dependent") return false;
  if (!finding.class?.length) return false;

  const knownClasses = Object.keys(jurisdictionData?.classes || {});
  if (!knownClasses.length) return false;

  return finding.class.every((className) => STATE_DEPENDENT_CLASSES.has(className));
}

function getClassProtection(className, state, city, jurisdictionData) {
  const classData = jurisdictionData?.classes?.[className];
  if (!classData) {
    return {
      protected: true,
      note: `${className} is not in the jurisdiction reference; applying the conservative blocking posture.`
    };
  }

  const localOverride = getLocalOverride(className, state, city, jurisdictionData);
  if (localOverride) {
    return localOverride;
  }

  if (classData.preempted_states?.includes(state)) {
    return {
      protected: false,
      note: classData.state_notes?.[state] || `${state} is listed as preempting local ${className} protections.`
    };
  }

  const protectedByState = classData.protected_states?.includes(state) || false;
  return {
    protected: protectedByState,
    note:
      classData.state_notes?.[state] ||
      (protectedByState
        ? `${state} is listed as protecting ${className}.`
        : `${state} is not listed as protecting ${className} in the current state reference.`)
  };
}

function getLocalOverride(className, state, city, jurisdictionData) {
  const stateOverrides = jurisdictionData?.local_overrides?.[state];
  if (!stateOverrides || !city) return null;

  const cityOverride = stateOverrides[city];
  const classOverride = cityOverride?.[className];
  if (!classOverride) return null;

  return {
    protected: Boolean(classOverride.protected),
    note: classOverride.note || `${city}, ${state} has a local override for ${className}.`
  };
}

function normalizeState(state) {
  return String(state || "").trim().toUpperCase();
}
