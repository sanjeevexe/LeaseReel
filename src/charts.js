// Lightweight inline-SVG chart helpers. No dependencies — vanilla strings that
// inherit the institutional palette via CSS custom properties. Kept deliberately
// small and legible so the data reads like a monitoring terminal, not a toy.

const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sparkline for compliance-rate / volume trends.
export function sparkline(values, opts = {}) {
  const w = opts.width || 260;
  const h = opts.height || 56;
  const pad = 4;
  const nums = values.map(Number);
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const step = nums.length > 1 ? (w - pad * 2) / (nums.length - 1) : 0;
  const points = nums.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${h - pad} L${points[0][0].toFixed(1)} ${h - pad} Z`;
  const stroke = opts.stroke || "var(--navy)";
  const [lx, ly] = points[points.length - 1];
  return `
    <svg class="chart-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(opts.label || "trend")}">
      <path d="${area}" fill="${stroke}" opacity="0.10" />
      <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="${stroke}" />
    </svg>`;
}

// Stacked weekly bars (cleared / review / blocked).
export function stackedBars(series, opts = {}) {
  const h = opts.height || 120;
  const barGap = 6;
  const n = series.length;
  const barW = 100 / n - barGap / 10;
  const max = Math.max(...series.map((s) => s.screened), 1);
  const seg = [
    { key: "cleared", color: "var(--cleared)" },
    { key: "needs_review", color: "var(--review)" },
    { key: "blocked", color: "var(--blocked)" }
  ];
  const bars = series
    .map((s, i) => {
      const x = (i * 100) / n + barGap / 4;
      let yTop = 0;
      const rects = seg
        .map(({ key, color }) => {
          const val = s[key] || 0;
          const barH = (val / max) * (h - 18);
          const y = h - 18 - yTop - barH;
          yTop += barH;
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(0, barH).toFixed(2)}" fill="${color}" rx="0.6" />`;
        })
        .join("");
      const label = `<text x="${(x + barW / 2).toFixed(2)}" y="${h - 4}" text-anchor="middle" class="chart-axis">${esc(s.week.split(" ")[1] || s.week)}</text>`;
      return rects + label;
    })
    .join("");
  return `<svg class="chart-stacked" viewBox="0 0 100 ${h}" preserveAspectRatio="none" role="img" aria-label="Weekly screening volume">${bars}</svg>`;
}

// Donut for status mix.
export function donut(segments, opts = {}) {
  const size = opts.size || 132;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -Math.PI / 2;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const end = angle + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      angle = end;
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="14" />`;
    })
    .join("");
  const center = opts.centerLabel
    ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="chart-donut-value">${esc(opts.centerValue || "")}</text>
       <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="chart-donut-label">${esc(opts.centerLabel)}</text>`
    : "";
  return `<svg class="chart-donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(opts.label || "distribution")}">${arcs}${center}</svg>`;
}

// Horizontal bars — used for channel cost-per-lease and property breakdowns.
// items: [{ label, value, display, color, caption }]
export function horizontalBars(items, opts = {}) {
  const max = opts.max || Math.max(...items.map((i) => i.value), 1);
  return `
    <div class="hbars">
      ${items
        .map((i) => {
          const pct = Math.max(2, Math.round((i.value / max) * 100));
          return `
            <div class="hbar-row">
              <span class="hbar-label">${esc(i.label)}</span>
              <div class="hbar-track">
                <span class="hbar-fill" style="width:${pct}%; background:${i.color || "var(--navy)"}"></span>
              </div>
              <span class="hbar-value">${esc(i.display != null ? i.display : i.value)}</span>
            </div>`;
        })
        .join("")}
    </div>`;
}

// Funnel — lead capture -> contacted -> toured -> leased.
export function funnel(steps, opts = {}) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return `
    <div class="funnel">
      ${steps
        .map((s, i) => {
          const pct = Math.max(6, Math.round((s.value / max) * 100));
          const conv =
            i > 0 && steps[i - 1].value
              ? `${Math.round((s.value / steps[i - 1].value) * 100)}%`
              : "";
          return `
            <div class="funnel-step">
              <div class="funnel-meta"><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong></div>
              <div class="funnel-bar-track"><span class="funnel-bar" style="width:${pct}%; background:${s.color || "var(--navy)"}"></span></div>
              ${conv ? `<span class="funnel-conv">${conv} of prior</span>` : ""}
            </div>`;
        })
        .join("")}
    </div>`;
}

// Compare bar (baseline vs current vs control) for a single metric.
// series: [{ label, value, display, color }]
export function compareBars(series, opts = {}) {
  const max = opts.max || Math.max(...series.map((s) => s.value), 1);
  const lowerBetter = opts.lowerBetter;
  return `
    <div class="compare">
      ${series
        .map((s) => {
          const pct = Math.max(4, Math.round((s.value / max) * 100));
          return `
            <div class="compare-row">
              <span class="compare-label">${esc(s.label)}</span>
              <div class="compare-track"><span class="compare-fill" style="width:${pct}%; background:${s.color || "var(--navy)"}"></span></div>
              <span class="compare-value">${esc(s.display != null ? s.display : s.value)}</span>
            </div>`;
        })
        .join("")}
      ${opts.note ? `<p class="compare-note">${esc(opts.note)}${lowerBetter ? " · lower is better" : ""}</p>` : ""}
    </div>`;
}
