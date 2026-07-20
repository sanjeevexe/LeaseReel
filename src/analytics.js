// Derived analytics for the governance, performance, and intelligence views.
// Everything here is pure: it takes the seeded/live records and computes the
// numbers the AI Asset Manager use case asks for (compliance rate, channel ROI,
// cost-per-lease, social-attributed leases per vacant unit, owner signals).

const money = (value) => Math.round(Number(value) || 0);

export function portfolioStats(posts) {
  const screened = posts.length;
  const cleared = posts.filter((p) => p.status === "cleared").length;
  const needsReview = posts.filter((p) => p.status === "needs_review").length;
  const blocked = posts.filter((p) => p.status === "blocked").length;
  const published = posts.filter((p) => p.published).length;
  return {
    screened,
    cleared,
    needs_review: needsReview,
    blocked,
    published,
    cleared_pct: screened ? Math.round((cleared / screened) * 100) : 0,
    blocked_pct: screened ? Math.round((blocked / screened) * 100) : 0
  };
}

export function propertyCompliance(posts, properties) {
  return properties
    .map((property) => {
      const rows = posts.filter((p) => p.property_id === property.id);
      const cleared = rows.filter((p) => p.status === "cleared").length;
      const blocked = rows.filter((p) => p.status === "blocked").length;
      return {
        property,
        screened: rows.length,
        cleared,
        blocked,
        needs_review: rows.filter((p) => p.status === "needs_review").length,
        cleared_pct: rows.length ? Math.round((cleared / rows.length) * 100) : null
      };
    })
    .sort((a, b) => (b.screened || 0) - (a.screened || 0));
}

export function agentLeaderboard(posts, agents, properties) {
  const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
  return agents
    .map((agent) => {
      const rows = posts.filter((p) => p.agent_name === agent.name);
      const blocked = rows.filter((p) => p.status === "blocked").length;
      const needsReview = rows.filter((p) => p.status === "needs_review").length;
      const cleared = rows.filter((p) => p.status === "cleared").length;
      // Risk score: blocks weigh most, reviews moderate, clears reduce.
      const risk = rows.length ? Math.round(((blocked * 3 + needsReview) / rows.length) * 33) : 0;
      return {
        name: agent.name,
        role: agent.role,
        property: propName(agent.property_id),
        screened: rows.length,
        cleared,
        needs_review: needsReview,
        blocked,
        cleared_pct: rows.length ? Math.round((cleared / rows.length) * 100) : null,
        risk: Math.min(100, risk)
      };
    })
    .sort((a, b) => b.risk - a.risk || b.blocked - a.blocked);
}

export function leadFunnel(leads) {
  const count = (stage) => leads.filter((l) => l.stage === stage).length;
  const nw = count("new");
  const contacted = count("contacted");
  const toured = count("toured");
  const leased = count("leased");
  const lost = count("lost");
  const active = leads.length - lost;
  // Funnel is cumulative reach: everyone entered as a lead; progressively fewer
  // remain at each deeper stage. Model reached-stage as at-or-beyond that stage.
  const order = { new: 0, contacted: 1, toured: 2, leased: 3 };
  const reached = (min) => leads.filter((l) => l.stage !== "lost" && order[l.stage] >= min).length;
  const stageReach = {
    captured: active,
    contacted: reached(1),
    toured: reached(2),
    leased: reached(3)
  };
  return {
    counts: { new: nw, contacted, toured, leased, lost },
    total: leads.length,
    active,
    leased,
    lost,
    stageReach,
    lead_to_lease_pct: leads.length ? Math.round((leased / leads.length) * 100) : 0
  };
}

export function channelStats(channelPerformance) {
  const rows = channelPerformance.map((c) => ({
    ...c,
    cost_per_lead: c.leads ? money(c.spend / c.leads) : 0,
    cost_per_lease: c.leases ? money(c.spend / c.leases) : 0,
    lead_to_lease_pct: c.leads ? Math.round((c.leases / c.leads) * 100) : 0
  }));
  const owned = rows.find((r) => r.owned);
  const paid = rows.filter((r) => !r.owned);
  const paidSpend = paid.reduce((s, r) => s + r.spend, 0);
  const paidLeases = paid.reduce((s, r) => s + r.leases, 0);
  const paidBlendedCpl = paidLeases ? money(paidSpend / paidLeases) : 0;
  const totalLeases = rows.reduce((s, r) => s + r.leases, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  return {
    rows,
    owned,
    paid_blended_cost_per_lease: paidBlendedCpl,
    owned_cost_per_lease: owned?.cost_per_lease || 0,
    cost_advantage_pct: paidBlendedCpl
      ? Math.round(((paidBlendedCpl - (owned?.cost_per_lease || 0)) / paidBlendedCpl) * 100)
      : 0,
    social_share_pct: totalLeases ? Math.round(((owned?.leases || 0) / totalLeases) * 100) : 0,
    total_leases: totalLeases,
    total_leads: totalLeads
  };
}

export function pilotSummary(properties) {
  const agg = (list, window) => {
    const sum = { social_leases: 0, cpl_weighted: 0, dom_weighted: 0, vac_weighted: 0, leases: 0, units: 0 };
    for (const p of list) {
      const w = p[window] || {};
      sum.social_leases += w.social_leases || 0;
      sum.leases += w.social_leases || 0;
      sum.units += p.units || 0;
      sum.cpl_weighted += (w.cost_per_lease || 0) * (w.social_leases || 0);
      sum.dom_weighted += (w.days_on_market || 0) * (p.units || 0);
      sum.vac_weighted += (w.vacancy_rate || 0) * (p.units || 0);
    }
    return {
      social_leases: sum.social_leases,
      cost_per_lease: sum.leases ? money(sum.cpl_weighted / sum.leases) : 0,
      days_on_market: sum.units ? Math.round(sum.dom_weighted / sum.units) : 0,
      vacancy_rate: sum.units ? Number((sum.vac_weighted / sum.units).toFixed(1)) : 0
    };
  };

  const pilots = properties.filter((p) => p.cohort === "pilot");
  const controls = properties.filter((p) => p.cohort === "control");
  const pilotBaseline = agg(pilots, "baseline");
  const pilotCurrent = agg(pilots, "current");
  const controlCurrent = agg(controls, "current");

  const pct = (from, to) => (from ? Math.round(((to - from) / from) * 100) : 0);

  return {
    pilots,
    controls,
    baseline: pilotBaseline,
    current: pilotCurrent,
    control: controlCurrent,
    deltas: {
      social_leases_pct: pct(pilotBaseline.social_leases, pilotCurrent.social_leases),
      cost_per_lease_pct: pct(pilotBaseline.cost_per_lease, pilotCurrent.cost_per_lease),
      days_on_market_pct: pct(pilotBaseline.days_on_market, pilotCurrent.days_on_market),
      vs_control_cost_pct: pct(controlCurrent.cost_per_lease, pilotCurrent.cost_per_lease)
    }
  };
}

// Social-attributed leases per vacant unit — the headline "90-day bar" metric.
export function socialLeasesPerVacantUnit(properties, window = "current") {
  const pilots = properties.filter((p) => p.cohort === "pilot");
  const leases = pilots.reduce((s, p) => s + (p[window]?.social_leases || 0), 0);
  const vacant = pilots.reduce((s, p) => s + (p.vacant_units || 0), 0);
  return vacant ? Number((leases / vacant).toFixed(2)) : 0;
}

export function vacancyExposure(properties) {
  // Monthly rent at risk across vacant units — the NOI-leakage framing.
  return properties.reduce((s, p) => s + (p.vacant_units || 0) * (p.avg_rent || 0), 0);
}

// The AI Asset Manager layer: turn LeaseReel's leasing/compliance data into
// owner-facing recommendations. Mirrors use-case §3.4 (recommend / execute).
export function ownerSignals(properties, posts, leads, channels) {
  const signals = [];
  const cs = channels || channelStats([]);

  // 1. Channel reallocation — the clearest ROI move.
  if (cs.owned && cs.cost_advantage_pct > 0) {
    const shiftable = Math.round(
      cs.rows.filter((r) => !r.owned).reduce((s, r) => s + r.spend, 0) * 0.15
    );
    signals.push({
      severity: "high",
      kind: "Marketing ROI",
      title: "Shift paid spend toward LeaseReel social",
      property: "Portfolio",
      insight: `LeaseReel is closing leases at $${cs.owned.cost_per_lease} vs a blended $${cs.paid_blended_cost_per_lease} across paid sources — a ${cs.cost_advantage_pct}% cost advantage.`,
      action: `Reallocate ~$${shiftable.toLocaleString()} / quarter from the highest-cost paid channels into social.`,
      mode: "recommend",
      feeds: "Campaign spend vs. lease outcomes",
      source: "pilot-window"
    });
  }

  // 2. Vacancy exposure vs. leasing velocity, per property.
  properties
    .filter((p) => p.cohort === "pilot")
    .forEach((p) => {
      const exposure = (p.vacant_units || 0) * (p.avg_rent || 0);
      const dom = p.current?.days_on_market || 0;
      if (p.vacant_units >= 12 || (exposure >= 25000 && dom >= 28)) {
        signals.push({
          severity: p.vacant_units >= 15 ? "high" : "medium",
          kind: "Vacancy exposure",
          title: `Raise social cadence at ${p.name}`,
          property: p.name,
          insight: `${p.vacant_units} vacant units ≈ $${Math.round(exposure).toLocaleString()}/mo at risk, with ${dom}-day time-on-market.`,
          action: `Auto-launch a social campaign for the vacant units via LeaseReel; hold paid ad spend flat.`,
          mode: "execute",
          feeds: "Time-on-market per vacant unit",
          source: "pilot-window"
        });
      }
    });

  // 3. Compliance / agent coaching.
  const blockedByAgent = {};
  posts
    .filter((p) => p.status === "blocked")
    .forEach((p) => {
      blockedByAgent[p.agent_name] = (blockedByAgent[p.agent_name] || 0) + 1;
    });
  Object.entries(blockedByAgent)
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .forEach(([agent, n]) => {
      signals.push({
        severity: n >= 2 ? "high" : "medium",
        kind: "Compliance risk",
        title: `Fair Housing coaching flag: ${agent}`,
        property: "Portfolio",
        insight: `${agent} generated ${n} blocked draft${n > 1 ? "s" : ""} this period — each was stopped before publish and logged to the audit trail.`,
        action: "Route flagged agents a two-minute Fair Housing refresher; corporate liability contained at the draft stage.",
        mode: "recommend",
        feeds: "Compliance screening + audit trail",
        source: "live-session"
      });
    });

  // 4. Control-property onboarding opportunity.
  const controls = properties.filter((p) => p.cohort === "control");
  if (controls.length && cs.owned) {
    const worst = controls
      .slice()
      .sort((a, b) => (b.current?.cost_per_lease || 0) - (a.current?.cost_per_lease || 0))[0];
    if (worst) {
      signals.push({
        severity: "low",
        kind: "Expansion",
        title: `Onboard ${worst.name} to LeaseReel`,
        property: worst.name,
        insight: `${worst.name} (control) is leasing from social at $${worst.current?.cost_per_lease}/lease vs the pilot cohort's far lower cost-per-lease.`,
        action: "Add as the next pilot property; establish a 90-day baseline first.",
        mode: "recommend",
        feeds: "Lead generation by source and campaign",
        source: "pilot-window"
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return signals.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
