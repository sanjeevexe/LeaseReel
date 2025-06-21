import { createComplianceEngine } from "./complianceEngine.js";
import { createRepository } from "./storage.js";
import {
  agents,
  channelPerformance,
  complianceExamples,
  complianceTrend,
  interactionTypes,
  pilotWindow,
  platforms,
  seedLeads,
  seedPostDrafts,
  seedProperties,
  stages
} from "./data/seed.js";
import * as analytics from "./analytics.js";
import * as charts from "./charts.js";

const app = document.querySelector("#app");
const statusOrder = ["blocked", "needs_review", "cleared"];
const statusLabels = {
  blocked: "Blocked",
  needs_review: "Needs review",
  cleared: "Cleared"
};
const actionLabels = {
  blocked: "Do not publish",
  needs_review: "Hold for corporate review",
  cleared: "Cleared to publish"
};
const navItems = [
  { view: "overview", label: "Overview", eyebrow: "Governance" },
  { view: "compliance", label: "Compliance", eyebrow: "Live checker" },
  { view: "leads", label: "Leads", eyebrow: "Owned pipeline" },
  { view: "performance", label: "Performance", eyebrow: "Owner outcomes" },
  { view: "signals", label: "Signals", eyebrow: "AI Asset Manager" },
  { view: "audit", label: "Audit", eyebrow: "Compliance record" }
];

const state = {
  view: "overview",
  properties: [],
  posts: [],
  leads: [],
  expandedPostIds: new Set(),
  currentCheck: null,
  auditFilters: { property_id: "all", status: "all" },
  complianceDraft: {
    property_id: "",
    agent_name: "Maya Patel",
    platform: "instagram",
    body: complianceExamples[2].body
  },
  toast: "",
  theme: getInitialTheme()
};

let engine;
let repository;

boot().catch((error) => {
  app.innerHTML = `<div class="fatal">Prototype failed to load. ${escapeHtml(error.message)}</div>`;
});

async function boot() {
  applyTheme(state.theme);
  const [ruleSet, jurisdictionData] = await Promise.all([
    fetchJson("./src/data/compliance-rules.json"),
    fetchJson("./src/data/state-jurisdiction.json")
  ]);
  engine = createComplianceEngine(ruleSet, jurisdictionData);
  const seedData = buildSeedData(engine);
  repository = createRepository(window.LEASEREEL_SUPABASE || {});
  await repository.initialize(seedData);
  await refreshState();
  state.complianceDraft.property_id = state.properties[0]?.id || "";
  render();
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function buildSeedData(complianceEngine) {
  return {
    properties: seedProperties,
    posts: seedPostDrafts.map((draft) => {
      const result = complianceEngine.check(draft.body, {
        property_id: draft.property_id,
        ...propertyContext(seedProperties.find((property) => property.id === draft.property_id)),
        agent_name: draft.agent_name,
        platform: draft.platform
      });
      return {
        id: draft.id,
        property_id: draft.property_id,
        agent_name: draft.agent_name,
        platform: draft.platform,
        body: draft.body,
        score: result.score,
        status: result.status,
        published: draft.published && result.status !== "blocked",
        findings: result.findings,
        created_at: daysAgo(draft.days_ago)
      };
    }),
    leads: seedLeads.map((lead) => ({
      id: lead.id,
      property_id: lead.property_id,
      prospect_name: lead.prospect_name,
      source: lead.source,
      interaction_type: lead.interaction_type,
      message: lead.message,
      stage: lead.stage,
      stage_history: [{ stage: lead.stage, at: daysAgo(lead.days_ago) }],
      created_at: daysAgo(lead.days_ago)
    }))
  };
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function refreshState() {
  const data = await repository.getState();
  state.properties = data.properties || [];
  state.posts = sortNewest(data.posts || []);
  state.leads = sortNewest(data.leads || []);
}

/* ---------------------------------------------------------------- shell --- */

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="rail">
        <div class="brand">
          <div class="brand-mark">LR</div>
          <div>
            <div class="brand-name">LeaseReel</div>
            <div class="brand-sub">Compliance &amp; Governance</div>
          </div>
        </div>
        <nav class="nav" aria-label="Primary">
          ${navItems.map(navButton).join("")}
        </nav>
        <div class="rail-foot">
          ${themeToggle()}
          <div class="rail-meta">
            <span>${repository?.kind === "supabase" ? "Supabase ledger" : "Local demo ledger"}</span>
            <span>Rule set ${escapeHtml(engine?.version || "")}</span>
            <span>${engine?.ruleCount || 0} active rules</span>
          </div>
        </div>
      </aside>
      <main class="workspace">
        ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
        ${renderView()}
      </main>
    </div>
  `;
  animateCounts();
}

function getInitialTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("leasereel-theme", theme);
  } catch {
    // localStorage unavailable (private mode, etc.) — theme still applies for this session.
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  render();
}

function themeToggle() {
  const isDark = state.theme === "dark";
  return `
    <button class="theme-toggle" data-action="toggle-theme" type="button" aria-pressed="${isDark}">
      <span class="theme-toggle-track ${isDark ? "is-dark" : ""}"><span class="theme-toggle-thumb"></span></span>
      <span class="theme-toggle-label">${isDark ? "Dark mode" : "Light mode"}</span>
    </button>
  `;
}

function navButton({ view, label }) {
  return `
    <button class="nav-item ${state.view === view ? "is-active" : ""}" data-view="${view}" type="button">
      <span class="nav-dot" aria-hidden="true"></span>
      <span>${label}</span>
    </button>
  `;
}

function renderView() {
  switch (state.view) {
    case "compliance":
      return renderCompliance();
    case "leads":
      return renderLeads();
    case "performance":
      return renderPerformance();
    case "signals":
      return renderSignals();
    case "audit":
      return renderAudit();
    default:
      return renderOverview();
  }
}

/* ------------------------------------------------------------- overview --- */

function renderOverview() {
  const stats = analytics.portfolioStats(state.posts);
  const funnel = analytics.leadFunnel(state.leads);
  const channels = analytics.channelStats(channelPerformance);
  const signals = analytics.ownerSignals(state.properties, state.posts, state.leads, channels);
  const byProperty = analytics.propertyCompliance(state.posts, state.properties).filter((r) => r.screened);

  const statusMix = charts.donut(
    [
      { value: stats.cleared, color: "var(--cleared)", label: "Cleared" },
      { value: stats.needs_review, color: "var(--review)", label: "Needs review" },
      { value: stats.blocked, color: "var(--blocked)", label: "Blocked" }
    ],
    { centerLabel: "cleared", centerValue: `${stats.cleared_pct}%`, label: "Compliance status mix" }
  );

  return `
    <section class="screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">Portfolio governance</p>
          <h1>Overview</h1>
          <p class="screen-lede">Single-pane oversight of every screened post and every lead, portfolio-wide.</p>
        </div>
        <button class="primary-action" data-view="compliance" type="button">Run compliance check</button>
      </header>

      <div class="summary-grid">
        ${metricTile("Posts screened", stats.screened, "", `${stats.published} published`)}
        ${metricTile("% cleared", stats.cleared_pct, "%", `${stats.cleared} of ${stats.screened}`)}
        ${metricTile("Blocked this period", stats.blocked, "", "stopped before publish", stats.blocked ? "blocked" : "")}
        ${metricTile("Total leads", state.leads.length, "", `${funnel.leased} leased`)}
      </div>

      <div class="governance-grid">
        <section class="panel ledger-panel">
          <div class="panel-header">
            <h2>Compliance ledger</h2>
            <span>${stats.screened} records</span>
          </div>
          ${state.posts.length ? renderComplianceFeed(state.posts.slice(0, 8)) : emptyState("No posts screened yet - run your first check.")}
        </section>

        <div class="governance-side">
          <section class="panel">
            <div class="panel-header"><h2>Portfolio compliance</h2><span>8-week</span></div>
            <div class="donut-block">
              ${statusMix}
              <ul class="legend">
                <li><span class="dot cleared"></span>Cleared <strong>${stats.cleared}</strong></li>
                <li><span class="dot review"></span>Needs review <strong>${stats.needs_review}</strong></li>
                <li><span class="dot blocked"></span>Blocked <strong>${stats.blocked}</strong></li>
              </ul>
            </div>
            <div class="mini-chart">
              <div class="mini-chart-head"><span>Weekly screening volume · through ${complianceTrend[complianceTrend.length - 1].week}</span><span>${complianceTrend[complianceTrend.length - 1].screened}/wk</span></div>
              ${charts.stackedBars(complianceTrend)}
            </div>
            <div class="prop-health">
              ${byProperty
                .slice(0, 5)
                .map(
                  (r) => `
                <div class="prop-health-row">
                  <span>${escapeHtml(r.property.name)}</span>
                  <div class="hbar-track slim"><span class="hbar-fill" style="width:${r.cleared_pct || 0}%; background:${healthColor(r)}"></span></div>
                  <span class="mono">${r.cleared_pct == null ? "—" : r.cleared_pct + "%"}</span>
                </div>`
                )
                .join("")}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>Leads pipeline</h2>
              <button class="text-action" data-view="leads" type="button">Open</button>
            </div>
            ${renderCompactPipeline(funnel)}
          </section>
        </div>
      </div>

      <section class="panel signal-teaser">
        <div class="panel-header">
          <h2>Owner signals</h2>
          <button class="text-action" data-view="signals" type="button">View all ${signals.length}</button>
        </div>
        <div class="signal-teaser-grid">
          ${signals.slice(0, 2).map(renderSignalCard).join("") || emptyState("No signals surfaced yet.")}
        </div>
      </section>

      ${complianceDisclaimer()}
    </section>
  `;
}

function healthColor(row) {
  if (row.blocked) return "var(--blocked)";
  if (row.cleared_pct != null && row.cleared_pct < 70) return "var(--review)";
  return "var(--cleared)";
}

function metricTile(label, value, suffix = "", caption = "", tone = "") {
  return `
    <article class="metric-tile ${tone}">
      <span>${label}</span>
      <strong data-count-to="${value}" data-suffix="${suffix}">0${suffix}</strong>
      ${caption ? `<em>${escapeHtml(caption)}</em>` : ""}
    </article>
  `;
}

function renderComplianceFeed(posts) {
  return `<div class="ledger-list">${posts.map(renderPostRow).join("")}</div>`;
}

function renderPostRow(post) {
  const property = getProperty(post.property_id);
  const expanded = state.expandedPostIds.has(post.id);
  return `
    <article class="ledger-row ${expanded ? "is-expanded" : ""}">
      <button class="ledger-head" data-action="toggle-post" data-post-id="${post.id}" type="button" aria-expanded="${expanded}">
        ${statusChip(post.status)}
        <span class="ledger-property">${escapeHtml(property?.name || "Unknown property")}</span>
        <span>${escapeHtml(post.agent_name)}</span>
        <span>${platformLabel(post.platform)}</span>
        <span class="ledger-time">${formatDate(post.created_at)}</span>
        <span class="publish-dot ${post.published ? "on" : ""}" title="${post.published ? "Published" : "Not published"}">${post.published ? "● live" : "○ draft"}</span>
        <span class="score-pill">${post.score}</span>
      </button>
      ${expanded ? renderPostDetail(post) : ""}
    </article>
  `;
}

function renderPostDetail(post) {
  const property = getProperty(post.property_id);
  const replay = engine.check(post.body, {
    property_id: post.property_id,
    ...propertyContext(property),
    agent_name: post.agent_name,
    platform: post.platform
  });
  return `
    <div class="post-detail">
      ${renderAnnotatedCopy(post.body, { findings: post.findings || [], acceptable_matches: replay.acceptable_matches || [] })}
      ${renderFindings(post.findings || [])}
      ${renderAcceptedSignals(replay.acceptable_matches || [], replay.safe_harbor_signals || [])}
    </div>
  `;
}

function renderCompactPipeline(funnel) {
  const byStage = groupBy(state.leads, "stage");
  return `
    <div class="compact-pipeline">
      ${stages
        .map(
          (stage) => `
        <div class="stage-strip">
          <span>${stageLabel(stage)}</span>
          <strong>${(byStage[stage] || []).length}</strong>
        </div>`
        )
        .join("")}
    </div>
    <div class="pipeline-note">
      <span>Lead-to-lease</span><strong class="mono">${funnel.lead_to_lease_pct}%</strong>
    </div>
  `;
}

/* ----------------------------------------------------------- compliance --- */

function renderCompliance() {
  const flow = ["Clip", "AI caption", "Screen", "Publish", "Route lead"];
  return `
    <section class="screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">Live checker</p>
          <h1>Compliance</h1>
          <p class="screen-lede">Screen ad copy before it publishes. The engine reads intent, not keywords.</p>
        </div>
      </header>

      <div class="workflow-strip" aria-label="LeaseReel workflow">
        ${flow
          .map(
            (step, i) => `
          <span class="workflow-step ${i === 2 ? "is-here" : ""}">${step}</span>
          ${i < flow.length - 1 ? '<span class="workflow-arrow" aria-hidden="true">→</span>' : ""}`
          )
          .join("")}
        <span class="workflow-tag">Buy the content · build the compliance layer</span>
      </div>

      <div class="checker-grid">
        <section class="panel input-panel">
          <form id="compliance-form">
            <div class="field-grid">
              <label>
                <span>Property</span>
                <select name="property_id" id="property_id">
                  ${state.properties.map((p) => option(p.id, propertyOptionLabel(p), state.complianceDraft.property_id)).join("")}
                </select>
              </label>
              <label>
                <span>Platform</span>
                <select name="platform" id="platform">
                  ${platforms.map((pl) => option(pl, platformLabel(pl), state.complianceDraft.platform)).join("")}
                </select>
              </label>
            </div>
            <label>
              <span>Agent name</span>
              <input name="agent_name" id="agent_name" value="${escapeAttribute(state.complianceDraft.agent_name)}" autocomplete="off" />
            </label>
            <label>
              <span>Load example</span>
              <select id="example-select">
                <option value="">Select example</option>
                ${complianceExamples.map((ex) => `<option value="${ex.id}">${escapeHtml(ex.label)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Ad copy</span>
              <textarea name="body" id="ad-body">${escapeHtml(state.complianceDraft.body)}</textarea>
            </label>
            <button class="primary-action full" type="submit">Run compliance check</button>
          </form>
        </section>
        <section class="panel result-panel">
          ${state.currentCheck ? renderCheckResult() : emptyState("No check run yet - load an example or paste ad copy.")}
        </section>
      </div>
      ${complianceDisclaimer()}
    </section>
  `;
}

function renderCheckResult() {
  const { result, draft, fix } = state.currentCheck;
  const property = getProperty(draft.property_id);
  const removable = (result.findings || []).filter((f) => {
    const t = f.effective_tier || f.tier;
    return t === "violation" || t === "caution";
  });
  const canPublish = result.status === "cleared";

  return `
    <div class="verdict ${result.status}">
      <div>
        <span>${statusLabels[result.status]}</span>
        <strong>${actionLabels[result.status]}</strong>
      </div>
      <div class="verdict-score" data-count-to="${result.score}">0</div>
    </div>
    <div class="score-meter ${result.status}" aria-label="Compliance score">
      <span style="width: ${result.score}%"></span>
    </div>
    <div class="result-meta">
      <span>${escapeHtml(property?.name || "Unknown property")}</span>
      <span>${escapeHtml(property?.market || "Unknown market")}</span>
      ${property?.hopa_qualified ? "<span>HOPA qualified</span>" : ""}
      <span>${escapeHtml(draft.agent_name)}</span>
      <span>${platformLabel(draft.platform)}</span>
    </div>

    <div class="result-section">
      <h2>Annotated copy</h2>
      ${renderAnnotatedCopy(draft.body, result)}
    </div>

    <div class="result-section">
      <h2>Findings ${result.findings.length ? `<span class="count-badge">${result.findings.length}</span>` : ""}</h2>
      ${result.findings.length ? renderFindings(result.findings) : emptyState("No findings - copy is cleared under the current rule set.")}
    </div>

    ${renderAcceptedSignals(result.acceptable_matches, result.safe_harbor_signals)}

    ${fix ? renderFixPreview(fix) : ""}

    <div class="action-row">
      ${
        removable.length && !fix
          ? `<button class="secondary-action" data-action="auto-fix" type="button">Auto-fix &amp; re-check</button>`
          : ""
      }
      <button class="secondary-action" data-action="save-check" type="button">Save to ledger</button>
      <button class="primary-action" data-action="publish-check" type="button" ${canPublish ? "" : "disabled"}>
        ${canPublish ? "Publish + log" : "Publish blocked"}
      </button>
    </div>
    ${canPublish ? "" : `<p class="publish-note">Publishing is gated until violations are resolved - corporate liability is contained at the draft stage.</p>`}
  `;
}

function renderFixPreview(fix) {
  const r = fix.result;
  return `
    <div class="fix-preview">
      <div class="fix-head">
        <h2>Suggested compliant draft</h2>
        ${statusChip(r.status)}
        <span class="score-pill">${r.score}</span>
      </div>
      <p class="fix-text">${escapeHtml(fix.fix.text)}</p>
      <div class="fix-changes">
        ${fix.fix.changes
          .map(
            (c) => `<span class="fix-change ${c.tier}">removed "${escapeHtml(c.phrase)}"</span>`
          )
          .join("")}
      </div>
      <div class="fix-actions">
        <button class="primary-action" data-action="apply-fix" type="button">Apply this draft</button>
        <span class="fix-disclaimer">Machine-cleaned draft — review wording before publishing.</span>
      </div>
    </div>
  `;
}

function renderAnnotatedCopy(body, result) {
  const segments = engine.segment(body, result);
  const html = segments
    .map((seg) => {
      const text = escapeHtml(seg.text);
      if (!seg.tier) return text;
      if (seg.tier === "acceptable") {
        const title = seg.match?.safe_harbor ? "Safe-harbor signal" : seg.match?.rationale || "Describes the property — acceptable";
        return `<span class="hl hl-ok" title="${escapeAttribute(title)}">${text}</span>`;
      }
      const finding = seg.finding || {};
      return `<mark class="hl hl-${seg.tier}" title="${escapeAttribute(finding.rationale || "")}">${text}</mark>`;
    })
    .join("");
  return `
    <div class="annotated">
      <p>${html}</p>
      <div class="annot-legend">
        <span><i class="hl-swatch violation"></i>Violation</span>
        <span><i class="hl-swatch caution"></i>Caution</span>
        <span><i class="hl-swatch informational"></i>Informational</span>
        <span><i class="hl-swatch ok"></i>Acceptable</span>
      </div>
    </div>
  `;
}

function renderFindings(findings) {
  if (!findings.length) return "";
  return `
    <div class="findings-list">
      ${findings
        .map(
          (finding) => `
        <article class="finding-card ${finding.effective_tier || finding.tier}">
          <div class="finding-topline">
            <mark>${escapeHtml(finding.phrase)}</mark>
            ${tierChip(finding.effective_tier || finding.tier)}
          </div>
          <div class="tag-row">
            ${(finding.class || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            <span>${escapeHtml(scopeLabel(finding.scope))}</span>
            ${finding.jurisdiction ? `<span class="tag-jur ${finding.jurisdiction.protected ? "on" : "off"}">${escapeHtml(finding.jurisdiction.label)}</span>` : ""}
          </div>
          <p>${escapeHtml(finding.rationale)}</p>
          ${finding.jurisdiction?.note ? `<div class="finding-note">${escapeHtml(finding.jurisdiction.note)}</div>` : ""}
          ${finding.hopa_note ? `<div class="finding-note">${escapeHtml(finding.hopa_note)}</div>` : ""}
          <div class="rewrite">
            <strong>Suggested rewrite</strong>
            <span>${escapeHtml(finding.suggested_rewrite)}</span>
          </div>
        </article>`
        )
        .join("")}
    </div>
  `;
}

function renderAcceptedSignals(acceptableMatches = [], safeHarborSignals = []) {
  if (!acceptableMatches.length && !safeHarborSignals.length) return "";
  const visible = [...acceptableMatches].sort((a, b) => a.start - b.start).slice(0, 10);
  return `
    <div class="accepted-block">
      <h2>Acceptable context logged</h2>
      <div class="accepted-list">
        ${visible.map((m) => `<span title="${escapeAttribute(m.rationale)}">${escapeHtml(m.phrase)}</span>`).join("")}
      </div>
      ${safeHarborSignals.length ? `<p>✓ Equal Housing Opportunity safe-harbor signal present.</p>` : ""}
      ${visible.some((m) => m.scope === "hopa-exemption") ? `<p>✓ HOPA senior-housing exemption signal present.</p>` : ""}
    </div>
  `;
}

/* ---------------------------------------------------------------- leads --- */

function renderLeads() {
  const funnel = analytics.leadFunnel(state.leads);
  const bySource = groupBy(state.leads, "source");
  const sourceItems = platforms.map((pl) => ({
    label: platformLabel(pl),
    value: (bySource[pl] || []).length,
    display: (bySource[pl] || []).length,
    color: "var(--navy)"
  }));

  return `
    <section class="screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">Owned pipeline</p>
          <h1>Leads</h1>
          <p class="screen-lede">Every DM, comment, click, and form fill captured into an owned system of record.</p>
        </div>
      </header>

      <div class="leads-layout">
        <section class="panel lead-form-panel">
          <div class="panel-header"><h2>Log inbound lead</h2></div>
          <form id="lead-form">
            <div class="field-grid">
              <label><span>Prospect name</span><input name="prospect_name" required autocomplete="off" /></label>
              <label><span>Property</span>
                <select name="property_id" required>
                  ${state.properties.map((p) => option(p.id, propertyOptionLabel(p))).join("")}
                </select>
              </label>
            </div>
            <div class="field-grid">
              <label><span>Source</span>
                <select name="source" required>${platforms.map((pl) => option(pl, platformLabel(pl))).join("")}</select>
              </label>
              <label><span>Interaction</span>
                <select name="interaction_type" required>${interactionTypes.map((t) => option(t, interactionLabel(t))).join("")}</select>
              </label>
            </div>
            <label><span>Message</span><textarea name="message" required></textarea></label>
            <button class="primary-action full" type="submit">Log lead</button>
          </form>
        </section>

        <div class="leads-analytics">
          <section class="panel">
            <div class="panel-header"><h2>Lead-to-lease funnel</h2><span class="mono">${funnel.lead_to_lease_pct}% convert</span></div>
            ${charts.funnel([
              { label: "Captured", value: funnel.stageReach.captured, color: "var(--navy)" },
              { label: "Contacted", value: funnel.stageReach.contacted, color: "var(--navy-light)" },
              { label: "Toured", value: funnel.stageReach.toured, color: "var(--navy-light)" },
              { label: "Leased", value: funnel.stageReach.leased, color: "var(--cleared)" }
            ])}
          </section>
          <section class="panel">
            <div class="panel-header"><h2>Leads by source</h2><span class="mono">${state.leads.length} total</span></div>
            ${charts.horizontalBars(sourceItems, { max: Math.max(...sourceItems.map((i) => i.value), 1) })}
          </section>
        </div>
      </div>

      <section class="pipeline-board">
        <div class="panel-header stack-head"><h2>Pipeline</h2><span class="mono">Drag stage via each card's selector</span></div>
        ${renderPipelineBoard()}
      </section>
    </section>
  `;
}

function renderPipelineBoard() {
  const byStage = groupBy(state.leads, "stage");
  return `
    <div class="pipeline-columns">
      ${stages
        .map(
          (stage) => `
        <section class="pipeline-column">
          <header><span>${stageLabel(stage)}</span><strong>${(byStage[stage] || []).length}</strong></header>
          <div class="lead-cards">
            ${(byStage[stage] || []).map(renderLeadCard).join("") || emptyState("No leads in this stage.")}
          </div>
        </section>`
        )
        .join("")}
    </div>
  `;
}

function renderLeadCard(lead) {
  const history = Array.isArray(lead.stage_history) ? lead.stage_history : [];
  const path = history.map((entry) => stageLabel(entry.stage)).join(" → ");
  const lastAt = history.length ? history[history.length - 1].at : lead.created_at;
  return `
    <article class="lead-card">
      <div>
        <strong>${escapeHtml(lead.prospect_name)}</strong>
        <span>${platformLabel(lead.source)} / ${interactionLabel(lead.interaction_type)}</span>
      </div>
      <p>${escapeHtml(lead.message)}</p>
      ${history.length > 1 ? `<div class="lead-history mono" title="Full stage history, oldest to newest">${escapeHtml(path)}</div>` : ""}
      <div class="lead-card-foot">
        <span>${escapeHtml(getProperty(lead.property_id)?.name || "Unknown")}</span>
        <select class="lead-stage-select" data-lead-id="${lead.id}" aria-label="Lead stage">
          ${stages.map((stage) => option(stage, stageLabel(stage), lead.stage)).join("")}
        </select>
      </div>
      <span class="lead-history-time mono">Updated ${formatDate(lastAt)}</span>
    </article>
  `;
}

/* ---------------------------------------------------------- performance --- */

function renderPerformance() {
  const pilot = analytics.pilotSummary(state.properties);
  const channels = analytics.channelStats(channelPerformance);
  const funnel = analytics.leadFunnel(state.leads);
  const slpvuCurrent = analytics.socialLeasesPerVacantUnit(state.properties, "current");
  const slpvuBase = analytics.socialLeasesPerVacantUnit(state.properties, "baseline");
  const exposure = analytics.vacancyExposure(state.properties);

  const channelBars = channels.rows.map((c) => ({
    label: c.channel,
    value: c.cost_per_lease,
    display: `$${c.cost_per_lease}`,
    color: c.owned ? "var(--cleared)" : "var(--navy)"
  }));

  return `
    <section class="screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">Owner outcomes · 90-day pilot</p>
          <h1>Performance</h1>
          <p class="screen-lede">The bar the use case sets: beat the pre-pilot baseline and lookalike controls on social-attributed leases, cost-per-lease, and conversion.</p>
          <p class="snapshot-note">${pilotWindow.label} — a periodic pilot-cycle rollup, last synced ${formatDateOnly(pilotWindow.synced_at)}. It does not recompute from checks or leads you log in this session; see Overview and Leads for that live activity.</p>
        </div>
      </header>

      <div class="summary-grid">
        ${metricTile("Social leases / vacant unit", slpvuCurrent, "", `was ${slpvuBase} at baseline`, "good")}
        ${metricTile("Cost per lease · social", channels.owned_cost_per_lease, "", `${channels.cost_advantage_pct}% under paid`, "good", "$")}
        ${metricTile("Lead-to-lease · social", funnel.lead_to_lease_pct, "%", "owned pipeline", "good")}
        ${metricTile("Vacant rent at risk", Math.round(exposure / 1000), "k", "monthly, portfolio", exposure ? "review" : "", "$")}
      </div>

      <div class="perf-grid">
        <section class="panel">
          <div class="panel-header"><h2>Social-attributed leases</h2><span class="mono up">+${pilot.deltas.social_leases_pct}%</span></div>
          ${charts.compareBars(
            [
              { label: "Pilot baseline", value: pilot.baseline.social_leases, display: pilot.baseline.social_leases, color: "var(--muted-2)" },
              { label: "Pilot current", value: pilot.current.social_leases, display: pilot.current.social_leases, color: "var(--cleared)" },
              { label: "Control", value: pilot.control.social_leases, display: pilot.control.social_leases, color: "var(--navy)" }
            ],
            { note: "90-day window, pilot cohort vs. control" }
          )}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>Cost per lease</h2><span class="mono down">${pilot.deltas.cost_per_lease_pct}%</span></div>
          ${charts.compareBars(
            [
              { label: "Pilot baseline", value: pilot.baseline.cost_per_lease, display: `$${pilot.baseline.cost_per_lease}`, color: "var(--muted-2)" },
              { label: "Pilot current", value: pilot.current.cost_per_lease, display: `$${pilot.current.cost_per_lease}`, color: "var(--cleared)" },
              { label: "Control", value: pilot.control.cost_per_lease, display: `$${pilot.control.cost_per_lease}`, color: "var(--navy)" }
            ],
            { note: `${Math.abs(pilot.deltas.vs_control_cost_pct)}% below control`, lowerBetter: true }
          )}
        </section>
        <section class="panel">
          <div class="panel-header"><h2>Days on market</h2><span class="mono down">${pilot.deltas.days_on_market_pct}%</span></div>
          ${charts.compareBars(
            [
              { label: "Pilot baseline", value: pilot.baseline.days_on_market, display: `${pilot.baseline.days_on_market}d`, color: "var(--muted-2)" },
              { label: "Pilot current", value: pilot.current.days_on_market, display: `${pilot.current.days_on_market}d`, color: "var(--cleared)" },
              { label: "Control", value: pilot.control.days_on_market, display: `${pilot.control.days_on_market}d`, color: "var(--navy)" }
            ],
            { note: "time from listing to signed lease", lowerBetter: true }
          )}
        </section>
      </div>

      <section class="panel">
        <div class="panel-header"><h2>Cost per lease by channel</h2><span class="mono">blended paid $${channels.paid_blended_cost_per_lease}</span></div>
        ${charts.horizontalBars(channelBars, { max: Math.max(...channelBars.map((b) => b.value)) })}
        <p class="panel-foot">LeaseReel closes leases at <strong>$${channels.owned_cost_per_lease}</strong> — ${channels.cost_advantage_pct}% below the blended paid cost-per-lease, while owning the prospect data.</p>
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Property-level outcomes</h2><span class="mono">${state.properties.length} assets · through ${formatDateOnly(pilotWindow.synced_at)}</span></div>
        ${renderPropertyTable()}
      </section>

      ${complianceDisclaimer()}
    </section>
  `;
}

function renderPropertyTable() {
  const rows = state.properties
    .slice()
    .sort((a, b) => (a.cohort > b.cohort ? 1 : -1))
    .map((p) => {
      const exposure = (p.vacant_units || 0) * (p.avg_rent || 0);
      const cplDelta = (p.baseline?.cost_per_lease || 0) - (p.current?.cost_per_lease || 0);
      return `
        <tr>
          <td class="td-name">${escapeHtml(p.name)}<span>${escapeHtml(p.market)}</span></td>
          <td><span class="cohort-chip ${p.cohort}">${p.cohort}</span></td>
          <td class="mono">${p.vacant_units}</td>
          <td class="mono">$${Math.round(exposure / 1000)}k</td>
          <td class="mono">${p.baseline?.social_leases || 0} → <strong>${p.current?.social_leases || 0}</strong></td>
          <td class="mono">$${p.baseline?.cost_per_lease || 0} → <strong>$${p.current?.cost_per_lease || 0}</strong> ${cplDelta > 0 ? `<em class="down">-$${cplDelta}</em>` : ""}</td>
          <td class="mono">${p.baseline?.days_on_market || 0} → <strong>${p.current?.days_on_market || 0}d</strong></td>
        </tr>`;
    })
    .join("");
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Property</th><th>Cohort</th><th>Vacant</th><th>Rent at risk</th>
            <th>Social leases</th><th>Cost / lease</th><th>Days on mkt</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* -------------------------------------------------------------- signals --- */

function renderSignals() {
  const channels = analytics.channelStats(channelPerformance);
  const signals = analytics.ownerSignals(state.properties, state.posts, state.leads, channels);
  const mapping = [
    ["Social engagement by platform & property", "Marketing effectiveness signal per asset"],
    ["Lead generation by source & campaign", "Cost-per-lead and channel ROI at property level"],
    ["Lead-to-tour and tour-to-lease conversion", "Leasing team performance signal"],
    ["Time-on-market per vacant unit", "Vacancy risk feeding renewal & pricing models"],
    ["CRM prospect history", "Renter graph — who applies to what, where, at what price"]
  ];

  return `
    <section class="screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">AI Asset Manager · intelligence preview</p>
          <h1>Signals</h1>
          <p class="screen-lede">LeaseReel is the first module feeding the AI Context Foundation. Below: owner-facing recommendations derived from LeaseReel's leasing, compliance, and channel data — compliance signals are live from this session; marketing and vacancy signals reflect the ${pilotWindow.label}.</p>
        </div>
      </header>

      <div class="signals-grid">
        ${signals.map(renderSignalCard).join("") || emptyState("No signals surfaced — run more checks and log leads.")}
      </div>

      <section class="panel context-map">
        <div class="panel-header"><h2>What LeaseReel data feeds</h2><span>AI Context Foundation</span></div>
        <div class="map-rows">
          ${mapping
            .map(
              ([from, to]) => `
            <div class="map-row">
              <span class="map-from">${escapeHtml(from)}</span>
              <span class="map-arrow" aria-hidden="true">→</span>
              <span class="map-to">${escapeHtml(to)}</span>
            </div>`
            )
            .join("")}
        </div>
      </section>

      <p class="compliance-disclaimer">
        Preview of the AI Asset Manager horizon module. Recommendations are modeled from LeaseReel's own leasing, compliance, and channel data; strategic decisions always remain with the owner.
      </p>
    </section>
  `;
}

function renderSignalCard(signal) {
  return `
    <article class="signal-card ${signal.severity}">
      <div class="signal-top">
        <span class="signal-kind">${escapeHtml(signal.kind)}</span>
        <span class="mode-chip ${signal.mode}">${signal.mode === "execute" ? "Executes" : "Recommends"}</span>
      </div>
      <h3>${escapeHtml(signal.title)}</h3>
      <p class="signal-insight">${escapeHtml(signal.insight)}</p>
      <div class="signal-action">
        <span class="signal-action-label">Action</span>
        <span>${escapeHtml(signal.action)}</span>
      </div>
      <div class="signal-foot">
        <span class="signal-prop">${escapeHtml(signal.property)}</span>
        <span class="signal-feeds">feeds: ${escapeHtml(signal.feeds)}</span>
      </div>
      <span class="signal-source">${signal.source === "live-session" ? "Live from this session's checks" : `Pilot-window snapshot · synced ${formatDateOnly(pilotWindow.synced_at)}`}</span>
    </article>
  `;
}

/* ---------------------------------------------------------------- audit --- */

function renderAudit() {
  const filtered = state.posts.filter((post) => {
    const matchesProperty = state.auditFilters.property_id === "all" || post.property_id === state.auditFilters.property_id;
    const matchesStatus = state.auditFilters.status === "all" || post.status === state.auditFilters.status;
    return matchesProperty && matchesStatus;
  });

  return `
    <section class="screen audit-screen">
      <header class="screen-header">
        <div>
          <p class="eyebrow">Compliance record</p>
          <h1>Audit</h1>
          <p class="screen-lede">Timestamped, immutable record of every screening decision — the audit trail a liability-exposed broker relies on.</p>
        </div>
      </header>
      <section class="panel audit-panel">
        <div class="filters">
          <label><span>Property</span>
            <select id="audit-property">
              ${option("all", "All properties", state.auditFilters.property_id)}
              ${state.properties.map((p) => option(p.id, propertyOptionLabel(p), state.auditFilters.property_id)).join("")}
            </select>
          </label>
          <label><span>Status</span>
            <select id="audit-status">
              ${option("all", "All statuses", state.auditFilters.status)}
              ${statusOrder.map((s) => option(s, statusLabels[s], state.auditFilters.status)).join("")}
            </select>
          </label>
          <div class="audit-count"><span>${filtered.length}</span> records</div>
        </div>
        ${
          filtered.length
            ? `<div class="audit-ledger">${filtered.map(renderAuditRow).join("")}</div>`
            : emptyState("No audit records match the current filters.")
        }
      </section>
    </section>
  `;
}

function renderAuditRow(post) {
  const property = getProperty(post.property_id);
  const replay = engine.check(post.body, {
    property_id: post.property_id,
    ...propertyContext(property),
    agent_name: post.agent_name,
    platform: post.platform
  });
  return `
    <article class="audit-row">
      <div class="audit-line">
        <time>${formatDate(post.created_at)}</time>
        ${statusChip(post.status)}
        <span>${escapeHtml(property?.name || "Unknown property")}</span>
        <span>${escapeHtml(post.agent_name)}</span>
        <span>${platformLabel(post.platform)}</span>
        <span class="publish-dot ${post.published ? "on" : ""}">${post.published ? "● live" : "○ draft"}</span>
        <strong>${post.score}</strong>
      </div>
      ${renderAnnotatedCopy(post.body, { findings: post.findings || [], acceptable_matches: replay.acceptable_matches || [] })}
      ${post.findings?.length ? renderFindings(post.findings) : `<div class="audit-clear">No findings recorded — cleared to publish.</div>`}
      ${renderAcceptedSignals(replay.acceptable_matches || [], replay.safe_harbor_signals || [])}
    </article>
  `;
}

/* --------------------------------------------------------------- events --- */

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === "toggle-theme") {
    toggleTheme();
    return;
  }
  if (action === "toggle-post") {
    const id = actionButton.dataset.postId;
    state.expandedPostIds.has(id) ? state.expandedPostIds.delete(id) : state.expandedPostIds.add(id);
    render();
  }
  if (action === "save-check") await saveCurrentCheck(false);
  if (action === "publish-check") await saveCurrentCheck(true);
  if (action === "auto-fix") runAutoFix();
  if (action === "apply-fix") applyFix();
});

document.addEventListener("submit", async (event) => {
  if (event.target.id === "compliance-form") {
    event.preventDefault();
    runComplianceCheck(event.target);
  }
  if (event.target.id === "lead-form") {
    event.preventDefault();
    await saveLead(event.target);
  }
});

document.addEventListener("input", (event) => {
  if (["property_id", "agent_name", "platform", "ad-body"].includes(event.target.id)) {
    const key = event.target.id === "ad-body" ? "body" : event.target.id;
    state.complianceDraft[key] = event.target.value;
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "example-select" && event.target.value) {
    const example = complianceExamples.find((item) => item.id === event.target.value);
    if (example) {
      state.complianceDraft.body = example.body;
      if (example.property_id) {
        state.complianceDraft.property_id = example.property_id;
        const propEl = document.querySelector("#property_id");
        if (propEl) propEl.value = example.property_id;
      }
      const bodyEl = document.querySelector("#ad-body");
      if (bodyEl) bodyEl.value = example.body;
    }
  }

  if (event.target.id === "property_id" || event.target.id === "platform") {
    state.complianceDraft[event.target.id] = event.target.value;
    const form = event.target.closest("#compliance-form");
    if (form && state.currentCheck) {
      runComplianceCheck(form);
      return;
    }
  }

  if (event.target.id === "audit-property") {
    state.auditFilters.property_id = event.target.value;
    render();
  }
  if (event.target.id === "audit-status") {
    state.auditFilters.status = event.target.value;
    render();
  }
  if (event.target.classList.contains("lead-stage-select")) {
    await repository.updateLeadStage(event.target.dataset.leadId, event.target.value);
    await refreshState();
    showToast("Lead stage updated");
  }
});

function runComplianceCheck(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  state.complianceDraft = { ...data };
  const property = getProperty(data.property_id);
  const result = engine.check(data.body, {
    property_id: data.property_id,
    ...propertyContext(property),
    agent_name: data.agent_name,
    platform: data.platform
  });
  state.currentCheck = { draft: data, result, fix: null };
  render();
}

function runAutoFix() {
  if (!state.currentCheck) return;
  const { draft } = state.currentCheck;
  const property = getProperty(draft.property_id);
  const outcome = engine.fixAndRecheck(draft.body, {
    property_id: draft.property_id,
    ...propertyContext(property),
    agent_name: draft.agent_name,
    platform: draft.platform
  });
  state.currentCheck.fix = outcome;
  render();
}

function applyFix() {
  if (!state.currentCheck?.fix) return;
  const cleaned = state.currentCheck.fix.fix.text;
  state.complianceDraft.body = cleaned;
  const property = getProperty(state.complianceDraft.property_id);
  const result = engine.check(cleaned, {
    property_id: state.complianceDraft.property_id,
    ...propertyContext(property),
    agent_name: state.complianceDraft.agent_name,
    platform: state.complianceDraft.platform
  });
  state.currentCheck = { draft: { ...state.complianceDraft }, result, fix: null };
  render();
  showToast("Applied compliant draft");
}

function propertyContext(property) {
  return {
    property,
    property_name: property?.name || "",
    market: property?.market || "",
    city: property?.city || "",
    state: property?.state || "",
    hopa_qualified: Boolean(property?.hopa_qualified)
  };
}

async function saveCurrentCheck(publish) {
  if (!state.currentCheck) return;
  const { draft, result } = state.currentCheck;
  if (publish && result.status === "blocked") {
    showToast("Publishing blocked — resolve violations first");
    return;
  }
  const post = {
    id: makeId(),
    property_id: draft.property_id,
    agent_name: draft.agent_name,
    platform: draft.platform,
    body: draft.body,
    score: result.score,
    status: result.status,
    published: Boolean(publish),
    findings: result.findings,
    created_at: new Date().toISOString()
  };
  await repository.savePost(post);
  await refreshState();
  showToast(publish ? "Published + logged to ledger" : "Saved to ledger");
}

async function saveLead(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const createdAt = new Date().toISOString();
  const lead = {
    id: makeId(),
    property_id: data.property_id,
    prospect_name: data.prospect_name,
    source: data.source,
    interaction_type: data.interaction_type,
    message: data.message,
    stage: "new",
    stage_history: [{ stage: "new", at: createdAt }],
    created_at: createdAt
  };
  await repository.saveLead(lead);
  await refreshState();
  form.reset();
  showToast("Lead logged");
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
}

function animateCounts() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const counters = document.querySelectorAll("[data-count-to]");
  counters.forEach((element) => {
    const target = Number(element.dataset.countTo || 0);
    const suffix = element.dataset.suffix || "";
    if (reducedMotion) {
      element.textContent = `${target}${suffix}`;
      return;
    }
    const startedAt = performance.now();
    const duration = 650;
    function step(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const value = target % 1 === 0 ? Math.round(target * easeOutCubic(progress)) : (target * easeOutCubic(progress)).toFixed(2);
      element.textContent = `${value}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

/* --------------------------------------------------------------- helpers -- */

const chipLabels = { blocked: "Blocked", needs_review: "Review", cleared: "Cleared" };

function statusChip(status) {
  const normalized = status === "violation" ? "blocked" : status;
  return `<span class="status-chip ${normalized}" title="${escapeAttribute(statusLabels[normalized] || status)}">${escapeHtml(chipLabels[normalized] || status)}</span>`;
}

function tierChip(tier) {
  const label = { violation: "Violation", caution: "Caution", informational: "Info" }[tier] || tier;
  return `<span class="tier-chip ${tier}">${escapeHtml(label)}</span>`;
}

function option(value, label, selected = "") {
  return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getProperty(id) {
  return state.properties.find((property) => property.id === id);
}

function propertyOptionLabel(property) {
  const tags = [property.state, property.hopa_qualified ? "HOPA" : ""].filter(Boolean).join(" / ");
  return tags ? `${property.name} (${tags})` : property.name;
}

function groupBy(rows, key) {
  return rows.reduce((accumulator, row) => {
    const value = row[key] || "unknown";
    accumulator[value] ||= [];
    accumulator[value].push(row);
    return accumulator;
  }, {});
}

function sortNewest(rows) {
  return [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function platformLabel(platform) {
  return { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" }[platform] || platform;
}

function interactionLabel(type) {
  return { dm: "DM", comment: "Comment", click: "Click", form_fill: "Form fill" }[type] || type;
}

function stageLabel(stage) {
  return { new: "New", contacted: "Contacted", toured: "Toured", leased: "Leased", lost: "Lost" }[stage] || stage;
}

function scopeLabel(scope) {
  return scope === "state-dependent"
    ? "State-dependent"
    : scope === "safe-harbor"
      ? "Safe harbor"
      : scope === "hopa-exemption"
        ? "HOPA exemption"
        : scope === "property-feature"
          ? "Property feature"
          : "Federal";
}

function complianceDisclaimer() {
  return `
    <p class="compliance-disclaimer">
      Automated compliance support, not legal advice. Findings should be confirmed with licensed counsel before publishing, especially for jurisdiction-specific rules.
    </p>
  `;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
