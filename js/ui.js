/* UI controller: screens, feed, modals, record, sharing */
(function () {
  const U = window.U, C = window.CONTENT, E = window.ENGINE;
  const $ = U.$;

  const APP = window.APP = {
    lang: localStorage.getItem("oifm_lang") || "ko",
    pace: localStorage.getItem("oifm_pace") || "normal",
    speed: 1, playing: false, auto: false, ff: false,
    life: null, timer: null, screen: "cover", modalOpen: false
  };
  const PACE = { fast: 620, normal: 1250, deep: 2150 };

  // ---------------- helpers ----------------
  const t = U.T;
  const stName = { health: "statHealth", happiness: "statHappiness", knowledge: "statKnowledge", relation: "statRelation" };

  function glossify(html, lang) {
    if (!C.glossary) return html;
    const safe = C.glossary.filter(g => g.ko.length >= 2);
    let used = 0;
    for (const g of safe) {
      if (used > 2) break;
      const term = lang === "ko" ? g.ko : g.ko;
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (re.test(html)) {
        html = html.replace(re, `<span class="gloss" data-g="${g.ko}">${term}</span>`);
        used++;
      }
    }
    return html;
  }

  function screen(id) {
    U.$$(".screen").forEach(s => s.classList.toggle("on", s.id === "screen-" + id));
    APP.screen = id;
    window.scrollTo(0, 0);
  }

  // ---------------- cover ----------------
  function renderCover() {
    const el = $("#screen-cover");
    el.innerHTML = `
      <div class="cover">
        <div class="cover-seal">1/50M<br>대한민국</div>
        <h1>${t("title")}<br><span style="font-size:20px;color:var(--ink-3);font-weight:600;letter-spacing:-.3px">${t("titleSub")}</span></h1>
        <div class="en">1 IN 50,000,000 · KOREA</div>
        <p class="tag">${t("tagline")}</p>
        <p class="note">${t("coverNote")}</p>
        <div class="dice"><b>2025</b><span>${U.lang() === "ko" ? "출생아 254,341명 · 합계출산율 0.80명" : "254,341 births · fertility rate 0.80"}</span></div>
        <div class="settings-row" style="margin-top:22px">
          <span class="lab">${t("pace")}</span>
          <div class="seg" data-seg="pace">
            <button data-v="fast" class="${APP.pace === "fast" ? "on" : ""}">${t("paceFast")}</button>
            <button data-v="normal" class="${APP.pace === "normal" ? "on" : ""}">${t("paceNormal")}</button>
            <button data-v="deep" class="${APP.pace === "deep" ? "on" : ""}">${t("paceDeep")}</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="lab">${t("lang")}</span>
          <div class="seg" data-seg="lang">
            <button data-v="ko" class="${APP.lang === "ko" ? "on" : ""}">한국어</button>
            <button data-v="en" class="${APP.lang === "en" ? "on" : ""}">EN</button>
          </div>
        </div>
        <div class="cover-actions">
          <button class="primary" id="btn-born">${t("start")}</button>
        </div>
        <div class="cover-foot">${t("coverFoot")}<br>${t("footerNote")}</div>
      </div>`;
    el.querySelectorAll('[data-seg="pace"] button').forEach(b => b.onclick = () => {
      APP.pace = b.dataset.v; localStorage.setItem("oifm_pace", APP.pace); renderCover();
    });
    el.querySelectorAll('[data-seg="lang"] button').forEach(b => b.onclick = () => setLang(b.dataset.v));
    $("#btn-born").onclick = () => { APP.life = E.createLife(); renderBirth(); screen("birth"); };
  }

  function setLang(l) {
    APP.lang = l; localStorage.setItem("oifm_lang", l);
    document.documentElement.lang = l;
    if (APP.screen === "cover") renderCover();
    else if (APP.screen === "birth") renderBirth();
    else if (APP.screen === "life") { renderLifeShell(); renderFeedAll(); updateHud(); }
    else if (APP.screen === "record") renderRecord();
    else if (APP.screen === "death") renderDeath();
  }

  // ---------------- birth ----------------
  function renderBirth() {
    const life = APP.life, el = $("#screen-birth");
    const clsKey = { high: "birthClassHigh", mid: "birthClassMid", low: "birthClassLow" }[life.cls];
    const famKey = { both: "birthFamilyBoth", single: "birthFamilySingle", grand: "birthFamilyGrand", care: "birthFamilyCare" }[life.family];
    el.innerHTML = `
      <div class="birth">
        <div class="birth-head"><h2>${t("birthTitle")}</h2><span>${life.birthYear} · ${U.lang() === "ko" ? "대한민국" : "REPUBLIC OF KOREA"}</span></div>
        <p class="birth-sub">${t("birthSub")}</p>
        <div class="sheet">
          <div class="sheet-main">
            <div class="sheet-name">${U.L(life.name)}<small>${U.lang() === "ko" ? life.name.en : life.name.ko}</small></div>
            <p class="sheet-sentence">${t("born", { y: life.birthYear, r: U.L(life.region), d: U.L(life.district) })}</p>
          </div>
          <div class="kv">
            <div>${t("birthRegion")}</div><div><b>${U.L(life.region)} ${U.L(life.district)}</b></div>
            <div>${t("birthSex")}</div><div><b>${life.sex === "f" ? t("birthSexF") : t("birthSexM")}</b></div>
            <div>${t("birthClass")}</div><div><b>${t(clsKey)}</b></div>
            <div>${t("birthFamily")}</div><div><b>${t(famKey)}</b></div>
            <div>${t("birthSiblings")}</div><div><b>${t("birthSiblingsN", { n: life.siblings })}</b></div>
          </div>
        </div>
        <div class="peers-preview">
          <div class="mini-title">${t("peerBirth")}</div>
          <ul>${life.peers.map(p => `<li><span class="dot"></span><span><span class="who">${p.name}</span> · ${p.reg} · ${p.cls === "high" ? (U.lang() === "ko" ? "형편 나은 집" : "better-off home") : p.cls === "low" ? (U.lang() === "ko" ? "어려운 집" : "struggling home") : (U.lang() === "ko" ? "평범한 집" : "ordinary home")}</span></li>`).join("")}</ul>
          <p style="font-size:11.5px;color:var(--ink-3);margin-top:8px">${t("peerBirthNote")}</p>
        </div>
        <div class="birth-actions">
          <button class="ghost" id="birth-reroll">${t("reroll")}</button>
          <button class="primary" id="birth-start">${t("begin")}</button>
        </div>
      </div>`;
    $("#birth-reroll").onclick = () => { APP.life = E.createLife(); renderBirth(); };
    $("#birth-start").onclick = () => startLife();
  }

  // ---------------- life shell ----------------
  function renderLifeShell() {
    const el = $("#screen-life");
    el.innerHTML = `
      <div class="life">
        <div class="hud" id="hud"></div>
        <div class="peer-strip hide-desktop" id="peerstrip"></div>
        <div class="life-grid">
          <div class="main-col">
            <div class="feed" id="feed"></div>
            <div class="focus-wrap" id="focuswrap"></div>
            <div class="controls" id="controls"></div>
          </div>
          <aside class="side" id="side"></aside>
        </div>
      </div>`;
    updateHud(); renderFocus(); renderControls(); renderSide(); renderPeerStrip();
  }

  function stageTag() {
    const age = APP.life.age;
    if (APP.life.pendingDecision) return t("pausedAtDecision");
    if (APP.ff) return t("fastForwarding");
    return t(U.stage(age));
  }

  function updateHud() {
    const life = APP.life; if (!life) return;
    const hud = $("#hud"); if (!hud) return;
    const nw = E.netWorth(life);
    hud.innerHTML = `
      <div class="hud-top">
        <span class="hud-age">${life.age}<span style="font-size:12px;font-weight:600">${t("ageUnit")}</span></span>
        <span class="hud-year">${life.year}</span>
        <span class="hud-stage">${stageTag()}</span>
      </div>
      <div class="meters">
        ${["health", "happiness", "knowledge", "relation"].map(k => `
          <div class="meter" data-k="${k}">
            <div class="lab"><span>${t(stName[k])}</span><b>${Math.round(life.stats[k])}</b></div>
            <div class="bar"><i style="width:${Math.round(life.stats[k])}%"></i></div>
          </div>`).join("")}
      </div>
      <div class="money-line">
        <span>${t("income")} <b>${life.income ? U.money(life.income) : "—"}</b></span>
        <span>${t("wealth")} <b>${U.money(nw)}</b></span>
        <span>${t("home")} <b>${t("home" + { none: "None", wolse: "Wolse", jeonse: "Jeonse", own: "Own" }[life.home])}</b></span>
        ${life.job !== "none" ? `<span>${t("job")} <b>${U.lang() === "ko" ? E.JOB_KO[life.job] : E.JOB_EN[life.job]}</b></span>` : ""}
      </div>`;
  }

  function renderPeerStrip() {
    const el = $("#peerstrip"); if (!el) return;
    el.innerHTML = APP.life.peers.map(p => {
      const ms = p.milestones.filter(m => m.age <= APP.life.age);
      const m = ms[ms.length - 1];
      const dead = !p.alive;
      return `<button class="peer-chip ${dead ? "dead" : ""}" data-peer="${p.id}">
        <span class="av">${p.name.slice(0, 1)}</span><b>${p.name}</b> ${dead ? "†" : APP.life.age + (U.lang() === "ko" ? "세" : "")}
      </button>`;
    }).join("");
    el.querySelectorAll("[data-peer]").forEach(b => b.onclick = () => showPeer(b.dataset.peer));
  }

  function renderFocus() {
    const el = $("#focuswrap"); if (!el) return;
    const life = APP.life;
    if (life.age < 6) { el.style.display = "none"; return; }
    el.style.display = "block";
    const items = [["health", "focusHealth"], ["family", "focusFamily"], ["career", "focusCareer"], ["study", "focusStudy"], ["balance", "focusBalance"]];
    const price = E.homePrice(life);
    const down = Math.round(price * 0.3);
    const have = life.cash + life.assets;
    el.innerHTML = `
      <div class="focus-title"><span>${t("focusTitle")}</span><button id="money-toggle">${t("moneyTitle")} · ${t("more")}</button></div>
      <div class="row">${items.map(([k, lab]) => `<button class="chip ${life.focus === k ? "on" : ""}" data-focus="${k}">${t(lab)}</button>`).join("")}</div>
      <div class="row" id="moneyrow" style="display:none;margin-top:8px">
        ${[["safe", "allocSafe"], ["stock", "allocStock"], ["coin", "allocCoin"]].map(([k, lab]) => `<button class="chip ${life.alloc === k ? "on" : ""}" data-alloc="${k}">${t(lab)}</button>`).join("")}
        ${life.home === "own"
          ? `<button class="chip" data-home="sell">${t("sellHome")}</button>`
          : `<button class="chip ${have >= down ? "" : ""}" data-home="buy" title="${U.money(price)}">${t("buyHome")} · ${U.money(price)}</button>`}
      </div>`;
    el.querySelectorAll("[data-focus]").forEach(b => b.onclick = () => {
      life.focus = b.dataset.focus; renderFocus();
    });
    el.querySelectorAll("[data-alloc]").forEach(b => b.onclick = () => {
      life.alloc = b.dataset.alloc; renderFocus();
    });
    const mt = $("#money-toggle");
    if (mt) mt.onclick = () => {
      const row = $("#moneyrow");
      row.style.display = row.style.display === "none" ? "flex" : "none";
    };
    el.querySelectorAll("[data-home]").forEach(b => b.onclick = () => {
      if (b.dataset.home === "buy") {
        const r = E.buyHome(life);
        U.toast(r.ok ? `${t("buyHomeDone")} · ${U.money(r.price)}` : `${t("buyHomeFail")} (${U.money(r.need)})`);
      } else {
        const r = E.sellHome(life);
        if (r.ok) U.toast(`${t("soldHome")} · ${U.money(r.price)}`);
      }
      updateHud(); renderFocus(); renderSide();
    });
  }

  function renderControls() {
    const el = $("#controls"); if (!el) return;
    el.innerHTML = `
      <div class="ctl">
        <button class="btn-round" id="btn-play">${APP.playing ? "❚❚" : "▶"}</button>
        <div class="speed-group">${[1, 2, 4, 8, 16].map(s => `<button data-s="${s}" class="${APP.speed === s ? "on" : ""}">${s}×</button>`).join("")}</div>
      </div>
      <div class="ctl">
        <button class="btn-pill" id="btn-ff">${t("toNext")}</button>
        <button class="btn-pill ${APP.auto ? "on" : ""}" id="btn-auto">${t("auto")}</button>
      </div>`;
    $("#btn-play").onclick = () => { APP.playing = !APP.playing; if (APP.playing) { APP.ff = false; schedule(0); } renderControls(); };
    el.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { APP.speed = +b.dataset.s; renderControls(); });
    $("#btn-ff").onclick = () => { APP.ff = true; APP.playing = true; schedule(0); renderControls(); U.toast(t("fastForwarding")); };
    $("#btn-auto").onclick = () => { APP.auto = !APP.auto; renderControls(); if (APP.auto) U.toast(t("autoOn")); };
  }

  function renderSide() {
    const el = $("#side"); if (!el) return;
    const life = APP.life;
    const nw = E.netWorth(life);
    el.innerHTML = `
      <div class="side-card">
        <h4>${t("yourLife")}</h4>
        <div class="side-row"><span>${t("birthRegion")}</span><b>${U.L(life.region)} ${U.L(life.district)}</b></div>
        <div class="side-row"><span>${t("income")}</span><b>${life.income ? U.money(life.income) : "—"}</b></div>
        <div class="side-row"><span>${t("wealth")}</span><b>${U.money(nw)}</b></div>
        <div class="side-row"><span>${t("assets")}</span><b>${U.money(life.assets + life.cash)}</b></div>
        <div class="side-row"><span>${t("debt")}</span><b>${U.money(life.debt)}</b></div>
        <div class="side-row"><span>${t("job")}</span><b>${life.job === "none" ? "—" : (U.lang() === "ko" ? E.JOB_KO[life.job] : E.JOB_EN[life.job])}</b></div>
        <div class="side-row"><span>${t("home")}</span><b>${t("home" + { none: "None", wolse: "Wolse", jeonse: "Jeonse", own: "Own" }[life.home])}</b></div>
        <div class="side-row"><span>${U.lang() === "ko" ? "어머니" : "Mother"}</span><b>${life.familyAges.mother != null ? life.familyAges.mother + (U.lang() === "ko" ? "세" : "") : "—"}</b></div>
        <div class="side-row"><span>${U.lang() === "ko" ? "아버지" : "Father"}</span><b>${life.familyAges.father != null ? life.familyAges.father + (U.lang() === "ko" ? "세" : "") : "—"}</b></div>
      </div>
      <div class="side-card">
        <h4>${t("currentPeers")}</h4>
        <div class="side-peers">${life.peers.map(p => {
          const ms = p.milestones.filter(m => m.age <= life.age);
          const m = ms[ms.length - 1] || p.milestones[0];
          return `<div class="side-peer"><b>${p.name}</b><span class="age">${p.reg}</span><br>${U.L(m)}</div>`;
        }).join("")}</div>
      </div>`;
  }

  // ---------------- feed ----------------
  function yearBlockHTML(entry) {
    const life = APP.life;
    const items = entry.events || [];
    let out = `<div class="yearblock ${entry.isNew ? "new" : ""}">
      <div class="year-head"><span class="y">${entry.year}</span><span class="a">${entry.age}${t("ageUnit")}</span></div>`;
    if (!items.length) out += `<div style="font-size:12.5px;color:var(--ink-3)">${t("eventNone")}</div>`;
    items.forEach(e => {
      const d = [];
      ["health", "happiness", "knowledge", "relation"].forEach(k => {
        const v = e.st[k]; if (!v) return;
        d.push(`<span class="${v > 0 ? "up" : "down"}">${t(stName[k]).slice(0, 2)} ${v > 0 ? "+" : ""}${v}</span>`);
      });
      if (e.money) d.push(`<span class="${e.money > 0 ? "up" : "down"}">${U.money(e.money)}</span>`);
      const src = C.sources[e.src];
      out += `<article class="ev">
        <div class="ev-top">
          <div class="ev-ic">${e.ic || "•"}</div>
          <div style="flex:1;min-width:0">
            <h4>${U.L(e.t)}</h4>
            <p>${glossify(U.L(e.b), APP.lang)}</p>
            <div class="ev-meta">
              <div class="delta">${d.join("")}</div>
              ${src ? `<button class="src-btn" data-src>${t("source")} · ${U.lang() === "ko" ? src.ko.split(" ")[0] : src.en.split(",")[0]}</button>` : ""}
            </div>
            ${src ? `<div class="src-box"><div class="name">${U.L(src)} <span style="color:var(--ink-3);font-weight:400">${src.date}</span></div>
              <div class="fig">${U.L(src.fig)}</div><a href="${src.url}" target="_blank" rel="noopener">${src.url}</a></div>` : ""}
          </div>
        </div>
      </article>`;
    });
    out += `</div>`;
    return out;
  }

  function renderFeedAll() {
    const feed = $("#feed"); if (!feed) return;
    feed.innerHTML = (APP.life.yearLog || []).map(yearBlockHTML).join("");
    bindFeed();
    scrollFeed();
  }

  function appendYear(entry) {
    const feed = $("#feed"); if (!feed) return;
    feed.insertAdjacentHTML("beforeend", yearBlockHTML(entry));
    bindFeed();
    if (!APP.ff) scrollFeed();
  }

  function scrollFeed() {
    const feed = $("#feed");
    if (!feed) return;
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function bindFeed() {
    U.$$("[data-src]").forEach(b => {
      if (b._b) return; b._b = 1;
      b.onclick = () => { const box = b.closest(".ev").querySelector(".src-box"); box.classList.toggle("on"); };
    });
    U.$$(".gloss").forEach(b => {
      if (b._b) return; b._b = 1;
      b.onclick = () => showGlossary(b.dataset.g);
    });
  }

  // ---------------- simulation loop ----------------
  function startLife() {
    const life = APP.life;
    life.yearLog = [];
    APP.playing = true; APP.ff = false; APP.speed = 1;
    renderLifeShell();
    screen("life");
    // year 0 opening
    const open = { age: 0, year: life.birthYear, events: [], isNew: true };
    const e = C.events.filter(x => x.age[0] === 0 && x.age[1] === 0);
    open.events = e.slice(0, 1);
    open.events.forEach(ev => {
      ["health", "happiness", "knowledge", "relation"].forEach(k => life.stats[k] = Math.max(0, Math.min(100, life.stats[k] + (ev.st[k] || 0))));
    });
    life.yearLog.push(open);
    life.history.push({ age: 0, year: life.birthYear, happiness: Math.round(life.stats.happiness), health: Math.round(life.stats.health), wealth: life.cash, income: 0, event: open.events[0] ? open.events[0].t : null });
    renderFeedAll();
    if (life.peers[0]) life.peers[0].age = 0;
    schedule(900);
  }

  function schedule(delay) {
    clearTimeout(APP.timer);
    if (!APP.playing) return;
    APP.timer = setTimeout(step, delay != null ? delay : (APP.ff ? 42 : PACE[APP.pace] / APP.speed));
  }

  function step() {
    if (!APP.playing || APP.modalOpen || APP.screen !== "life") return;
    const life = APP.life;
    const res = E.tick(life);
    const entry = { age: life.age, year: life.year, events: res.events || [], isNew: true };
    life.yearLog.push(entry);
    appendYear(entry);
    updateHud(); renderSide(); renderPeerStrip(); renderFocus();

    if (res.death) { endLife(); return; }
    if (res.decision) {
      APP.playing = false; APP.ff = false; renderControls();
      showDecision(res.decision);
      return;
    }
    if (res.reflection) {
      APP.playing = false; renderControls();
      showReflection(res.reflection);
      return;
    }
    schedule(APP.ff ? 42 : PACE[APP.pace] / APP.speed);
  }

  // ---------------- modals ----------------
  function openModal(html, opts = {}) {
    closeModal();
    APP.modalOpen = true;
    const bg = U.el("div", "modal-bg");
    bg.innerHTML = `<div class="modal">${html}</div>`;
    if (opts.dismissable !== false) bg.onclick = e => { if (e.target === bg) closeModal(); };
    document.body.appendChild(bg);
    return bg;
  }
  function closeModal() {
    const m = $(".modal-bg"); if (m) m.remove();
    APP.modalOpen = false;
  }

  function showDecision(dec) {
    const bg = openModal(`
      <div class="modal-badge">${U.L(dec.badge)}</div>
      <h3>${dec.age}${t("ageUnit")} · ${U.L(dec.t)}</h3>
      <p class="body">${glossify(U.L(dec.b), APP.lang)}</p>
      <div class="choices">${dec.ch.map((c, i) => `
        <button class="choice" data-ch="${i}">
          <div class="ct"><i>${String.fromCharCode(65 + i)}</i>${U.L(c.t)}</div>
          ${c.n && U.L(c.n) ? `<div class="cn">${glossify(U.L(c.n), APP.lang)}</div>` : ""}
          <div class="cd">${deltaText(c)}</div>
        </button>`).join("")}</div>
      ${C.sources[dec.src] ? `<div class="src-box on" style="margin-top:12px"><div class="name">${U.L(C.sources[dec.src])} <span style="color:var(--ink-3);font-weight:400">${C.sources[dec.src].date}</span></div><div class="fig">${U.L(C.sources[dec.src].fig)}</div></div>` : ""}
    `, { dismissable: false });
    bg.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => {
      const ch = dec.ch[+b.dataset.ch];
      E.applyChoice(APP.life, dec, ch);
      APP.life.yearLog[APP.life.yearLog.length - 1].decision = { t: dec.t, choice: ch.t };
      closeModal();
      APP.life.pendingDecision = null;
      updateHud(); renderSide(); renderFocus();
      U.toast(`${t("decide")}: ${U.L(ch.t)}`);
      APP.playing = true; schedule(650); renderControls();
    });
    if (APP.auto) {
      setTimeout(() => {
        if (!APP.modalOpen) return;
        const idx = Math.floor(Math.random() * dec.ch.length);
        const btn = bg.querySelector(`[data-ch="${idx}"]`);
        if (btn) btn.click();
      }, 520);
    }
  }

  function deltaText(ch) {
    const out = [];
    ["health", "happiness", "knowledge", "relation"].forEach(k => {
      const v = ch.st[k]; if (!v) return;
      out.push(`${t(stName[k])} ${v > 0 ? "+" : ""}${v}`);
    });
    if (ch.money) out.push(U.money(ch.money));
    if (ch.inc) out.push(`${t("income")} ${ch.inc > 0 ? "+" : ""}${Math.round(ch.inc * 100)}%`);
    if (ch.set && ch.set.job) out.push(U.lang() === "ko" ? E.JOB_KO[ch.set.job] : E.JOB_EN[ch.set.job]);
    return out.join(" · ");
  }

  function showReflection(age) {
    const bg = openModal(`
      <div class="modal-badge">${age}${t("ageUnit")} · ${U.lang() === "ko" ? "회고" : "REFLECTION"}</div>
      <h3>${t("reflectionTitle")}</h3>
      <p class="body">${t("reflectionBody")}</p>
      <textarea class="refl" id="refl-text" placeholder="${t("reflectionPlaceholder")}"></textarea>
      <div class="modal-foot">
        <button class="ghost" id="refl-skip">${t("reflectionSkip")}</button>
        <button class="primary" id="refl-save">${t("reflectionSave")}</button>
      </div>`);
    $("#refl-save").onclick = () => {
      const v = $("#refl-text").value.trim();
      if (v) APP.life.reflections.push({ age, text: v });
      closeModal(); APP.playing = true; schedule(400); renderControls();
    };
    $("#refl-skip").onclick = () => { closeModal(); APP.playing = true; schedule(300); renderControls(); };
  }

  function showGlossary(ko) {
    const g = C.glossary.find(x => x.ko === ko); if (!g) return;
    const bg = openModal(`
      <div class="modal-badge">${t("glossaryTitle")}</div>
      <h3>${U.lang() === "ko" ? g.ko : g.en}</h3>
      <p class="body">${U.lang() === "ko" ? g.defKo : g.defEn}</p>
      <div class="modal-foot"><button class="primary" id="g-close">${t("close")}</button></div>`);
    $("#g-close").onclick = closeModal;
  }

  function showPeer(id) {
    const p = APP.life.peers.find(x => x.id === id); if (!p) return;
    const ms = p.milestones.filter(m => m.age <= APP.life.age);
    const bg = openModal(`
      <div class="modal-badge">${U.lang() === "ko" ? "같은 날 태어남" : "BORN THE SAME DAY"}</div>
      <h3>${p.name}</h3>
      <p class="body" style="color:var(--ink-3)">${p.reg} · ${p.cls === "high" ? (U.lang() === "ko" ? "형편 나은 집" : "better-off") : p.cls === "low" ? (U.lang() === "ko" ? "어려운 집" : "struggling") : (U.lang() === "ko" ? "평범한 집" : "ordinary")}</p>
      <div class="peer-card" style="border:0;padding:8px 0">
        <div class="arc">${ms.map(m => `<div><b>${m.age}${t("ageUnit")}</b><span>${U.L(m)}</span></div>`).join("")}</div>
      </div>
      <div class="modal-foot"><button class="primary" id="p-close">${t("close")}</button></div>`);
    $("#p-close").onclick = closeModal;
  }

  // ---------------- death & record ----------------
  function endLife() {
    APP.playing = false; APP.ff = false; clearTimeout(APP.timer);
    const life = APP.life;
    if (!life.death) { const d = { age: life.age, year: life.year, cause: "노환", causeEn: "Old age", line: { ko: "잠든 채로 아침이 오지 않았다.", en: "The morning did not come." } }; life.death = d; }
    renderControls();
    renderDeath();
    screen("death");
  }

  function renderDeath() {
    const life = APP.life, el = $("#screen-death");
    el.innerHTML = `
      <div class="death-screen">
        <div class="death-kicker">${t("deathTitle")} · ${life.death.year}</div>
        <div class="death-line">${U.L(life.death.line)}<small>${life.death.age}${t("ageUnit")} · ${U.lang() === "ko" ? life.death.cause : life.death.causeEn}</small></div>
        <div class="death-actions"><button class="primary" id="to-record">${t("deathContinue")}</button></div>
      </div>`;
    $("#to-record").onclick = () => { renderRecord(); screen("record"); };
  }

  function renderRecord() {
    const life = APP.life, el = $("#screen-record");
    const type = E.lifeType(life);
    const nw = E.netWorth(life), pct = E.wealthPercentile(nw);
    const diff = life.death.age - 83.7;
    const diffTxt = Math.abs(diff) < 0.8 ? t("survivedSame") : diff > 0 ? t("survived", { d: Math.round(diff) }) : t("survivedShort", { d: Math.round(-diff) });
    const dod = life.death.year;
    const haps = life.history.map(h => h.happiness);
    const avgH = Math.round(haps.reduce((a, b) => a + b, 0) / Math.max(1, haps.length));
    const peak = life.history.reduce((a, b) => b.happiness > a.happiness ? b : a, life.history[0]);
    const hard = life.history.reduce((a, b) => b.happiness < a.happiness ? b : a, life.history[0]);
    const lifespan = life.death.age;
    const cells = [];
    for (let a = 0; a <= 100; a++) {
      const h = life.history[a];
      if (!h || a > lifespan) { cells.push(`<div class="cell dead" title="${a}"></div>`); continue; }
      const mark = (life.yearLog || []).find(y => y.age === a && y.decision) ? "◆" : "";
      cells.push(`<div class="cell" style="background:${U.happinessColor(h.happiness)}" data-a="${a}" title="${t("mapTooltip", { a, y: h.year, h: h.happiness })}"><span class="mk">${mark}</span></div>`);
    }
    el.innerHTML = `
      <div class="record">
        <div class="rec-head">
          <div class="kicker">${t("recordEn")}</div>
          <h2>${t("record")}</h2>
          <div class="sub">${life.birthYear} — ${dod} · ${U.lang() === "ko" ? "대한민국" : "REPUBLIC OF KOREA"}</div>
        </div>
        <div class="rec-name">
          <div class="n">${U.L(life.name)}</div>
          <div class="y">${U.L(life.region)} ${U.L(life.district)} · ${life.sex === "f" ? t("birthSexF") : t("birthSexM")}</div>
        </div>
        <div class="rec-grid">
          <div class="rec-cell"><div class="k">${t("recBorn")}</div><div class="v">${life.birthYear}<small>${U.L(life.region)}</small></div></div>
          <div class="rec-cell"><div class="k">${t("recDied")}</div><div class="v">${dod}<small>${life.death.age}${t("ageUnit")}</small></div></div>
          <div class="rec-cell"><div class="k">${t("recCause")}</div><div class="v">${U.lang() === "ko" ? life.death.cause : life.death.causeEn}</div></div>
          <div class="rec-cell"><div class="k">${t("recLife")}</div><div class="v">${t("recLifeVal", { a: life.death.age })}</div></div>
          <div class="rec-cell"><div class="k">${t("recJob")}</div><div class="v" style="font-size:14px">${life.job === "none" ? (U.lang() === "ko" ? "무직" : "None") : (U.lang() === "ko" ? E.JOB_KO[life.job] : E.JOB_EN[life.job])}</div></div>
          <div class="rec-cell"><div class="k">${t("recWealth")}</div><div class="v">${U.money(nw)}<small>${t("recWealthPct", { p: 100 - pct })}</small></div></div>
        </div>
        <p style="font-size:12px;color:var(--ink-3);margin-top:8px">${diffTxt}</p>

        <div class="section">
          <div class="section-head"><h3>${t("recType")}</h3><span>${type.axis}</span></div>
          <div class="type-card">
            <div class="flower"><canvas width="192" height="192" id="flowerCanvas" style="width:96px;height:96px"></canvas></div>
            <div style="min-width:0">
              <div class="tn">${U.lang() === "ko" ? type.flower.ko : type.flower.en} · ${type.flower.latin}</div>
              <h3>${U.L(type.name)}</h3>
              <div class="line">${U.L(type.line)}</div>
              <p class="desc">${U.L(type.desc)}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h3>${t("lifeMap")}</h3><span>0 — ${lifespan}</span></div>
          <p style="font-size:11.5px;color:var(--ink-3);margin-top:6px">${t("lifeMapNote")}</p>
          <div class="lifemap">${cells.join("")}</div>
          <div class="legend"><span><i style="background:${U.happinessColor(15)}"></i>${U.lang() === "ko" ? "힘든 해" : "hard year"}</span><span><i style="background:${U.happinessColor(50)}"></i>50</span><span><i style="background:${U.happinessColor(85)}"></i>${U.lang() === "ko" ? "좋은 해" : "good year"}</span><span>◆ ${t("decide")}</span></div>
        </div>

        <div class="section">
          <div class="section-head"><h3>${t("chartWealth")}</h3><span>${U.money(nw)}</span></div>
          <div class="chart">${window.CHARTS.wealth(life)}</div>
        </div>
        <div class="section">
          <div class="section-head"><h3>${t("chartSurvival")}</h3><span>${life.death.age}${t("ageUnit")}</span></div>
          <div class="chart">${window.CHARTS.survival(life)}<div class="cap">${U.lang() === "ko" ? "국가데이터처 「2025 한국의 사회지표」 2024년 기대수명 83.7년" : "Life expectancy 83.7 years (2024), Statistics Korea"}</div></div>
        </div>
        <div class="section">
          <div class="section-head"><h3>${t("chartIncome")}</h3><span>${t("chartIncomeNote")}</span></div>
          <div class="chart">${window.CHARTS.income(life)}</div>
        </div>

        <div class="section">
          <div class="section-head"><h3>${t("endStats")}</h3><span></span></div>
          <div class="rec-grid">
            <div class="rec-cell"><div class="k">${t("avgHappiness")}</div><div class="v">${avgH}</div></div>
            <div class="rec-cell"><div class="k">${t("peak")}</div><div class="v" style="font-size:14px">${peak.age}${t("ageUnit")} · ${peak.year}</div></div>
            <div class="rec-cell"><div class="k">${t("hardest")}</div><div class="v" style="font-size:14px">${hard.age}${t("ageUnit")} · ${hard.year}</div></div>
            <div class="rec-cell"><div class="k">${t("totalEvents")}</div><div class="v">${life.history.filter(h => h.event).length}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h3>${t("reflectionKept")}</h3><span>${life.reflections.length}</span></div>
          ${life.reflections.length ? `<div class="refl-list">${life.reflections.map(r => `<div class="refl-item"><b>${r.age}${t("ageUnit")} · ${life.birthYear + r.age}</b>${U.esc(r.text)}</div>`).join("")}</div>` : `<p style="font-size:12.5px;color:var(--ink-3);margin-top:8px">${t("reflectionsEmpty")}</p>`}
        </div>

        <div class="section">
          <div class="section-head"><h3>${t("peersTitle")}</h3><span>${t("currentPeers")}</span></div>
          <p style="font-size:11.5px;color:var(--ink-3);margin-top:6px">${t("peersNote")}</p>
          <div class="peer-list">${life.peers.map(p => {
            const dm = p.milestones.find(m => m.death);
            return `<div class="peer-card">
              <div class="top"><span class="nm">${p.name}</span><span class="rg">${p.reg}</span></div>
              <div class="arc">${p.milestones.map(m => `<div><b>${m.age}${t("ageUnit")}</b><span>${U.L(m)}</span></div>`).join("")}</div>
            </div>`;
          }).join("")}</div>
        </div>

        <p class="foot-note">${t("recordFoot")}</p>
        <div style="height:56px"></div>
      </div>
      <div class="rec-actions">
        <button class="ghost" id="rec-again">${t("again")}</button>
        <button class="primary" id="rec-share">${t("share")}</button>
      </div>`;
    // flower
    const cv = $("#flowerCanvas");
    if (cv) window.SHARE.drawFlower(cv.getContext("2d"), 96, 96, 84, type);
    U.$$(".lifemap .cell").forEach(c => c.onclick = () => {
      const a = +c.dataset.a;
      const h = life.history[a];
      const y = (life.yearLog || []).find(x => x.age === a);
      if (!h) return;
      openModal(`<div class="modal-badge">${a}${t("ageUnit")} · ${h.year}</div>
        <h3>${U.lang() === "ko" ? `행복도 ${h.happiness}` : `Happiness ${h.happiness}`}</h3>
        <p class="body">${y && y.events.length ? y.events.map(e => U.L(e.t)).join(" · ") : t("eventNone")}</p>
        <div class="modal-foot"><button class="primary" id="m-close">${t("close")}</button></div>`);
      $("#m-close").onclick = closeModal;
    });
    $("#rec-again").onclick = () => { APP.life = E.createLife(); renderBirth(); screen("birth"); };
    $("#rec-share").onclick = showShare;
  }

  // ---------------- share ----------------
  function showShare() {
    const life = APP.life;
    let fmt = "45";
    const bg = openModal(`
      <div class="modal-badge">${t("shareTitle")}</div>
      <h3>${U.L(life.name)} · ${life.birthYear}—${life.death.year}</h3>
      <div class="share-tabs seg" style="margin-top:12px">
        <button data-f="45" class="on">${t("share45")}</button>
        <button data-f="916">${t("share916")}</button>
      </div>
      <div class="share-preview"><canvas id="shareCanvas" style="max-height:52dvh;width:auto;margin:0 auto;display:block"></canvas></div>
      <div class="modal-foot">
        <button class="ghost" id="sh-copy">${t("copy")}</button>
        <button class="primary" id="sh-dl">${t("download")}</button>
      </div>`, { dismissable: true });
    const cv = $("#shareCanvas");
    const draw = () => { window.SHARE.drawCard(life, fmt, cv); cv.style.aspectRatio = fmt === "45" ? "4/5" : "9/16"; };
    draw();
    bg.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
      fmt = b.dataset.f;
      bg.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === b));
      draw();
    });
    $("#sh-dl").onclick = () => {
      cv.toBlob(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `1in50m_${life.name.ko}_${life.birthYear}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, "image/png");
    };
    $("#sh-copy").onclick = async () => {
      try {
        const blob = await new Promise(r => cv.toBlob(r, "image/png"));
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        U.toast(t("copied"));
      } catch (e) { U.toast(t("copy") + " ✕"); }
    };
  }

  // ---------------- boot ----------------
  function boot() {
    document.documentElement.lang = APP.lang;
    // ensure screens exist
    ["cover", "birth", "life", "death", "record"].forEach(id => {
      if (!document.getElementById("screen-" + id)) {
        const s = document.createElement("section");
        s.id = "screen-" + id; s.className = "screen";
        document.getElementById("app").appendChild(s);
      }
    });
    renderCover();
    screen("cover");
  }
  window.UI = { boot, setLang, showShare, renderRecord, endLife, APP };
  document.addEventListener("DOMContentLoaded", boot);
})();
