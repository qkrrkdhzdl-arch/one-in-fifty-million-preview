/* SVG charts for the record screen */
(function () {
  const U = window.U;
  let uid = 0;

  function axes(w, h, pad, yMax, yLabel) {
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (h - pad.t - pad.b) * i / 4;
      g += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#e2d9c6" stroke-width="1"/>`;
    }
    return g;
  }

  function survival(life) {
    const w = 560, h = 210, pad = { l: 34, r: 10, t: 12, b: 26 };
    const pts = window.ENGINE.survivalCurve(life);
    const x = a => pad.l + (w - pad.l - pad.r) * a / 100;
    const y = v => pad.t + (h - pad.t - pad.b) * (1 - v / 100);
    let path = "";
    pts.forEach((p, i) => { path += (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); });
    let ticks = "";
    [0, 25, 50, 75, 100].forEach(a => {
      ticks += `<text x="${x(a)}" y="${h - 8}" font-size="9" fill="#857e70" text-anchor="middle" font-family="ui-monospace">${a}</text>`;
    });
    [0, 50, 100].forEach(v => {
      ticks += `<text x="${pad.l - 5}" y="${y(v) + 3}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">${v}</text>`;
    });
    const da = life.death.age;
    const dy = window.ENGINE.survivalCurve(life).find(p => p[0] >= da) || [da, 0];
    const marker = `<line x1="${x(da)}" y1="${pad.t}" x2="${x(da)}" y2="${h - pad.b}" stroke="#b23a2b" stroke-width="1" stroke-dasharray="3 3"/>
      <circle cx="${x(da)}" cy="${y(dy[1])}" r="3.4" fill="#b23a2b"/>
      <text x="${x(da) + 6}" y="${y(dy[1]) - 6}" font-size="9.5" fill="#b23a2b" font-family="ui-monospace">${da}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" role="img">${axes(w, h, pad)}
      <path d="${path}" fill="none" stroke="#2b5d7d" stroke-width="1.8" stroke-linejoin="round"/>
      ${marker}${ticks}
      <text x="${w - pad.r}" y="${pad.t + 9}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">%</text>
    </svg>`;
  }

  function income(life) {
    const w = 560, h = 170, pad = { l: 34, r: 10, t: 14, b: 30 };
    // income percentile by decade
    const buckets = {};
    life.history.forEach(hh => { const d = Math.floor(hh.age / 10) * 10; (buckets[d] = buckets[d] || []).push(hh.income || 0); });
    const keys = Object.keys(buckets).map(Number).sort((a, b) => a - b).filter(k => k >= 20 && k <= 70);
    const vals = keys.map(k => window.ENGINE.incomePercentile(buckets[k].reduce((a, b) => a + b, 0) / buckets[k].length));
    const bw = (w - pad.l - pad.r) / Math.max(1, keys.length);
    let bars = "", labels = "";
    keys.forEach((k, i) => {
      const v = vals[i];
      const bh = (h - pad.t - pad.b) * v / 100;
      const x = pad.l + i * bw + bw * 0.18, y = h - pad.b - bh;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${v > 70 ? "#1e6a4a" : v > 40 ? "#b5832c" : "#b23a2b"}" opacity=".85"/>`;
      bars += `<text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="8.5" text-anchor="middle" fill="#4e4a41" font-family="ui-monospace">${v}</text>`;
      labels += `<text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${h - 10}" font-size="9" text-anchor="middle" fill="#857e70" font-family="ui-monospace">${k}s</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" role="img">${axes(w, h, pad)}${bars}${labels}
      <text x="${pad.l - 5}" y="${pad.t + 4}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">100</text>
      <text x="${w - pad.r}" y="${pad.t + 4}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">상위 %</text>
    </svg>`;
  }

  function wealth(life) {
    const w = 560, h = 190, pad = { l: 42, r: 12, t: 12, b: 24 };
    const hs = life.history;
    if (!hs.length) return "";
    const maxW = Math.max(1000, ...hs.map(h => h.wealth));
    const minW = Math.min(0, ...hs.map(h => h.wealth));
    const x = i => pad.l + (w - pad.l - pad.r) * i / Math.max(1, hs.length - 1);
    const y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - minW) / (maxW - minW || 1));
    let d = "", dArea = "";
    hs.forEach((hh, i) => { d += (i ? "L" : "M") + x(i).toFixed(1) + "," + y(hh.wealth).toFixed(1); });
    dArea = d + `L${x(hs.length - 1).toFixed(1)},${h - pad.b}L${pad.l},${h - pad.b}Z`;
    const zero = minW < 0 ? `<line x1="${pad.l}" y1="${y(0)}" x2="${w - pad.r}" y2="${y(0)}" stroke="#c9bea5" stroke-width="1" stroke-dasharray="2 3"/>` : "";
    const ticks = [20, 40, 60, 80].map(a => {
      const i = hs.findIndex(h2 => h2.age >= a);
      return i >= 0 ? `<text x="${x(i)}" y="${h - 8}" font-size="9" fill="#857e70" text-anchor="middle" font-family="ui-monospace">${a}</text>` : "";
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img">${axes(w, h, pad)}
      <path d="${dArea}" fill="rgba(30,106,74,.08)" stroke="none"/>
      <path d="${d}" fill="none" stroke="#1e6a4a" stroke-width="1.8"/>
      ${zero}${ticks}
      <text x="${pad.l - 5}" y="${y(maxW) + 9}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">${U.money(maxW)}</text>
      <text x="${pad.l - 5}" y="${y(minW) + 2}" font-size="9" fill="#857e70" text-anchor="end" font-family="ui-monospace">${U.money(minW)}</text>
    </svg>`;
  }

  window.CHARTS = { survival, income, wealth };
})();
