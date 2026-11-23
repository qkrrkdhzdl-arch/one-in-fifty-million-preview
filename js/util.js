/* small helpers shared by ui / charts / share */
(function () {
  const U = {};
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  U.lang = () => window.APP ? window.APP.lang : "ko";
  U.T = (k, vars) => {
    const d = window.I18N[U.lang()] || window.I18N.ko;
    let s = d[k] != null ? d[k] : (window.I18N.ko[k] != null ? window.I18N.ko[k] : k);
    if (vars) for (const key in vars) s = s.replace(new RegExp("\\{" + key + "\\}", "g"), vars[key]);
    return s;
  };
  U.L = (obj) => obj ? (obj[U.lang()] != null ? obj[U.lang()] : obj.ko) : "";

  U.money = (man) => {
    const neg = man < 0; let v = Math.abs(Math.round(man || 0));
    if (U.lang() === "en") {
      if (v >= 10000) { const eok = v / 10000; return (neg ? "-" : "") + "₩" + (eok >= 10 ? Math.round(eok) : eok.toFixed(1).replace(/\.0$/, "")) + "M"; }
      return (neg ? "-" : "") + "₩" + Math.round(v / 10) + "k";
    }
    let s;
    if (v >= 10000) {
      const e = Math.floor(v / 10000), m = v % 10000;
      s = e + "억" + (m ? " " + m.toLocaleString() : "");
    } else s = v.toLocaleString() + "만";
    return (neg ? "-" : "") + s + (U.lang() === "ko" ? "" : "");
  };
  U.moneyUnit = (man) => U.lang() === "ko" ? U.money(man) : U.money(man);

  U.pct = (v) => Math.round(v) + "%";
  U.stage = (age) => age < 13 ? "stageChild" : age < 20 ? "stageTeen" : age < 35 ? "stageYouth" : age < 50 ? "stageAdult" : age < 65 ? "stageMid" : "stageElder";
  U.dateLabel = (life) => U.lang() === "ko" ? `${life.year}년` : `${life.year}`;

  U.toast = (msg) => {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove("on"), 2200);
  };

  U.happinessColor = (h) => {
    // 0 red-brown → 50 sand → 100 jade
    const stops = [[0, [150, 46, 33]], [35, [178, 106, 63]], [55, [200, 176, 124]], [75, [110, 155, 122]], [100, [30, 106, 74]]];
    for (let i = 1; i < stops.length; i++) {
      if (h <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i];
        const t = (h - a) / (b - a);
        return `rgb(${ca.map((x, j) => Math.round(x + (cb[j] - x) * t)).join(",")})`;
      }
    }
    return "rgb(30,106,74)";
  };

  window.U = U;
})();
