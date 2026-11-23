/* 4-cut pixel-art share card (canvas) */
(function () {
  const U = window.U;
  const KFONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
  const MONO = 'ui-monospace,"SF Mono",Menlo,monospace';

  function rng(seed) { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const PALETTES = {
    dawn:  { sky: ["#2b3550", "#4c5a7a", "#8c8f9e", "#d9b98f"], sun: "#f3d9a4", far: "#3a4257", near: "#2a3040", ground: "#4a4438", grass: "#5d6a4c" },
    day:   { sky: ["#8fb6cc", "#a9c7d6", "#c6d8dd", "#e6e3d2"], sun: "#f2e3b6", far: "#7d8f86", near: "#5d6f62", ground: "#8a7a58", grass: "#6f8558" },
    dusk:  { sky: ["#3b3a55", "#6c4f63", "#b5726a", "#e2a878"], sun: "#f0c58a", far: "#4a3d4c", near: "#332c38", ground: "#4d4136", grass: "#5c5941" },
    night: { sky: ["#151a2b", "#1f2740", "#2b3550", "#3a4560"], sun: "#e8e3cc", far: "#1a2032", near: "#12161f", ground: "#232420", grass: "#2b3327" }
  };

  function px(g, x, y, w, h, color, cell) { g.fillStyle = color; g.fillRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(w * cell), Math.ceil(h * cell)); }

  function person(g, x, y, cell, pal, opt = {}) {
    const skin = opt.skin || "#e8c39a", hair = opt.hair || "#2b231d", cloth = opt.cloth || "#7a4b3a", pants = opt.pants || "#3a3f4a";
    const s = opt.scale || 1;
    const cx = x, cy = y;
    // head
    px(g, cx + 1 * s, cy, 2 * s, 2 * s, skin, cell);
    px(g, cx + 1 * s, cy, 2 * s, 0.8 * s, hair, cell);
    // body
    px(g, cx + 0.7 * s, cy + 2 * s, 2.6 * s, 2.4 * s, cloth, cell);
    // legs
    px(g, cx + 0.9 * s, cy + 4.4 * s, 0.9 * s, 1.8 * s, pants, cell);
    px(g, cx + 2.2 * s, cy + 4.4 * s, 0.9 * s, 1.8 * s, pants, cell);
  }

  function baby(g, x, y, cell) {
    px(g, x, y, 3, 1.4, "#f0dcc0", cell);
    px(g, x + 0.3, y + 0.3, 2.4, 0.8, "#fdf7ea", cell);
    px(g, x + 0.6, y + 0.5, 0.5, 0.4, "#3a2f28", cell);
    px(g, x + 1.8, y + 0.5, 0.5, 0.4, "#3a2f28", cell);
  }

  function tree(g, x, y, cell, pal, h = 6) {
    px(g, x + 1, y + h - 2, 1, 2, "#4a3826", cell);
    px(g, x + 0.2, y + h - 4.6, 2.6, 2.8, pal.grass, cell);
    px(g, x + 0.7, y + h - 5.6, 1.6, 1.4, pal.grass, cell);
  }

  function building(g, x, y, w, h, cell, pal, lit) {
    px(g, x, y, w, h, pal.near, cell);
    const r = rng(Math.round(x * 31 + y * 17 + w * 7 + h * 3));
    for (let yy = y + 1; yy < y + h - 1; yy += 2) {
      for (let xx = x + 0.6; xx < x + w - 0.6; xx += 1.4) {
        if (r() > 0.45) px(g, xx, yy, 0.7, 0.9, lit ? "#e8c98a" : pal.far, cell);
      }
    }
  }

  function scene(g, ox, oy, w, h, spec) {
    const cell = Math.min(w / 36, h / 24);
    const pal = PALETTES[spec.time] || PALETTES.day;
    g.save();
    g.beginPath(); g.rect(ox, oy, cell * 36, cell * 24); g.clip();
    g.translate(ox, oy);
    // sky bands
    const bands = [0, 6, 11, 15, 24];
    for (let i = 0; i < 4; i++) px(g, 0, bands[i], 36, bands[i + 1] - bands[i], pal.sky[i], cell);
    // sun / moon
    const sunX = spec.sunX != null ? spec.sunX : 27, sunY = spec.time === "night" ? 4 : 5;
    const sr = spec.time === "night" ? 1.6 : 2.2;
    for (let yy = -Math.ceil(sr); yy <= sr; yy++) {
      const half = Math.round(Math.sqrt(Math.max(0, sr * sr - yy * yy)) * 10) / 10;
      if (half > 0) px(g, sunX - half, sunY + yy, half * 2, 1, pal.sun, cell);
    }
    // far hills
    const rr = rng(spec.seed || 7);
    let hillH = [];
    for (let i = 0; i <= 36; i++) hillH.push(15 - 3.2 * Math.abs(Math.sin(i * 0.22 + rr() * 0.3)) - rr() * 0.6);
    for (let i = 0; i < 36; i++) {
      const top = Math.max(10, Math.min(15, hillH[i]));
      px(g, i, top, 1, 15 - top, pal.far, cell);
    }
    // city or nature
    if (spec.mode === "city") {
      let x = 1;
      while (x < 34) {
        const bw = 2 + Math.floor(rr() * 3), bh = 4 + Math.floor(rr() * 7);
        building(g, x, 15 - bh, bw, bh, cell, pal, spec.time === "night" || spec.time === "dusk");
        x += bw + 0.8;
      }
      if (spec.bus) {
        px(g, 6, 13.6, 8, 1.8, "#5b6b76", cell);
        for (let i = 0; i < 4; i++) px(g, 6.8 + i * 1.9, 14.1, 1.2, 0.8, "#cfd8d2", cell);
        px(g, 6.8, 15.2, 1, 0.7, "#2a2a2a", cell); px(g, 12.2, 15.2, 1, 0.7, "#2a2a2a", cell);
      }
    } else if (spec.mode === "sea") {
      for (let y = 15; y < 19; y++) px(g, 0, y, 36, 1, y < 17 ? "#4f7f96" : "#3d6a80", cell);
      for (let i = 0; i < 20; i++) {
        const wx = Math.floor(rr() * 34), wy = 15 + Math.floor(rr() * 4);
        px(g, wx, wy, 2, 0.3, "#9fc2cd", cell);
      }
      if (spec.boat) { px(g, 25, 14.4, 4, 1, "#6b4c38", cell); px(g, 26.5, 12.6, 0.3, 1.8, "#5a4634", cell); px(g, 26.8, 12.6, 2, 1.6, "#efe6d0", cell); }
    } else if (spec.mode === "field") {
      for (let i = 0; i < 8; i++) {
        const tx = 2 + i * 4 + Math.floor(rr() * 2);
        tree(g, tx, 9, cell, pal, 6);
      }
      for (let i = 0; i < 30; i++) px(g, rr() * 36, 16 + rr() * 3, 0.5, 0.6, "#c9b06a", cell);
    } else if (spec.mode === "town") {
      for (let i = 0; i < 4; i++) {
        const bx = 2 + i * 9;
        px(g, bx, 12.4, 6, 2.6, i % 2 ? "#8a7f6d" : "#7b7263", cell);
        px(g, bx + 1, 12.9, 1.2, 1.2, "#d9c9a3", cell);
        px(g, bx + 3.4, 12.9, 1.2, 1.2, "#d9c9a3", cell);
      }
    }
    // ground
    px(g, 0, 19, 36, 5, pal.ground, cell);
    px(g, 0, 19, 36, 0.8, pal.grass, cell);
    // house for later panels
    if (spec.house) {
      const hx = 22, hy = 13.6;
      px(g, hx, hy, 9, 5.4, "#d8cdb6", cell);
      // roof
      for (let i = 0; i < 5; i++) px(g, hx - 0.8 + i * 0.9, hy - 1 + i * 0.35, 10.6 - i * 1.8, 0.6, "#7d4a3a", cell);
      px(g, hx + 1.4, hy + 1.6, 1.8, 1.6, "#9fb6bd", cell);
      px(g, hx + 5.6, hy + 2.0, 1.9, 3.4, "#7a5638", cell);
      if (spec.time === "night") px(g, hx + 1.4, hy + 1.6, 1.8, 1.6, "#e8c98a", cell);
    }
    // figures
    (spec.people || []).forEach(p => {
      if (p.type === "baby") baby(g, p.x, 17.2, cell);
      else if (p.type === "wheel") {
        px(g, p.x, p.y + 1, 2.6, 2, "#5d6b76", cell);
        px(g, p.x - 1, p.y + 2.6, 4.6, 0.5, "#3a3f4a", cell);
        px(g, p.x + 0.6, p.y + 1.4, 1.4, 1.2, "#5d6b76", cell);
        person(g, p.x + 0.6, p.y - 1.6, cell, pal, { cloth: "#6b6f78" });
      } else {
        person(g, p.x, p.y, cell, pal, p.opt || {});
      }
    });
    // stars
    if (spec.time === "night") {
      for (let i = 0; i < 26; i++) px(g, rr() * 36, rr() * 8, 0.3, 0.3, "#efe9dc", cell);
    }
    g.restore();
    // frame
    g.strokeStyle = "rgba(29,28,25,.18)"; g.lineWidth = 2;
    g.strokeRect(ox + 1, oy + 1, cell * 36 - 2, cell * 24 - 2);
  }

  function scenesFor(life) {
    const seed = life.seed;
    const sea = ["busan", "jeju", "ulsan", "incheon", "gyeongnam", "jeonnam"].includes(life.region.id);
    const metro = life.zone === "metro";
    const mode1 = sea ? "sea" : metro ? "city" : life.zone === "rural" ? "field" : "town";
    return [
      { time: "dawn", mode: mode1, seed: seed + 1, people: [{ type: "baby", x: 15 }], sunX: 27 },
      { time: "day", mode: "city", seed: seed + 2, people: [{ x: 17, y: 16.4, opt: { cloth: "#3f5d63", pants: "#2f333c" } }], bus: true },
      { time: "dusk", mode: life.zone === "rural" ? "field" : "town", seed: seed + 3, house: true, people: [{ x: 16, y: 17, opt: { cloth: "#8a5b45" } }, { x: 19.2, y: 17.1, opt: { cloth: "#7a6a52" } }] },
      { time: "night", mode: sea ? "sea" : "field", seed: seed + 4, people: [{ x: 15.6, y: 17.2, opt: { cloth: "#6b6f78" } }] }
    ];
  }

  function captions(life) {
    const pickEvent = (a, b) => {
      const list = (life.yearLog || []).map(y => ({ age: y.age, ev: y.events && y.events[0] }))
        .filter(x => x.ev && x.age >= a && x.age <= b);
      return list.length ? list[Math.floor(list.length / 2)].ev : null;
    };
    const t1 = pickEvent(18, 34), t2 = pickEvent(42, 62), t3 = pickEvent(63, 120);
    const L = U.lang();
    const never = { ko: "닿지 못한 시간", en: "years never reached" };
    const cap1 = life.death.age >= 18 ? (t1 ? (L === "ko" ? t1.t.ko : t1.t.en) : (L === "ko" ? "스물과 서른 사이" : "twenties and thirties")) : never[L];
    const cap2 = life.death.age >= 42 ? (t2 ? (L === "ko" ? t2.t.ko : t2.t.en) : (L === "ko" ? "쉰과 예순 사이" : "fifties and sixties")) : never[L];
    const cap3 = life.death.age >= 63 ? (t3 ? (L === "ko" ? t3.t.ko : t3.t.en) : (L === "ko" ? "마지막 몇 해" : "the last years")) : never[L];
    return [
      { ko: `${life.birthYear}년 · ${life.region.ko} ${life.district.ko}`, en: `${life.birthYear} · ${life.district.en}, ${life.region.en}`,
        koT: "태어난 날", enT: "The day you were born" },
      { ko: cap1, en: cap1, koT: "전환점", enT: "The turning point" },
      { ko: cap2, en: cap2, koT: "집과 사람", enT: "House and people" },
      { ko: cap3, en: cap3, koT: "노년", enT: "Old age" }
    ];
  }

  function drawCard(life, format, canvas) {
    const L = U.lang();
    const W = 1080, H = format === "916" ? 1920 : 1350;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d");
    const type = window.ENGINE.lifeType(life);
    g.fillStyle = "#f4efe3"; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,.016)";
    for (let i = 0; i < H; i += 3) g.fillRect(0, i, W, 1);

    const pad = 64;
    const gap = 16;
    const panelW = (W - pad * 2 - gap) / 2;
    const panelH = Math.round(panelW * 2 / 3);
    const capH = 58;
    const rowStep = panelH + capH + gap;
    const gridTop = format === "916" ? 214 : 190;
    const gridBottom = gridTop + rowStep + panelH + capH;

    // header
    g.fillStyle = "#b23a2b"; g.fillRect(pad, pad - 8, 56, 56);
    g.fillStyle = "#fff"; g.font = `700 14px ${MONO}`; g.textAlign = "center";
    g.fillText("1/50M", pad + 28, pad + 24);
    g.fillText("분의 1", pad + 28, pad + 40);
    g.textAlign = "left";
    g.fillStyle = "#857e70"; g.font = `600 14px ${MONO}`;
    g.fillText(L === "ko" ? "5천만 분의 1 · 인생 기록" : "ONE IN FIFTY MILLION · A LIFE RECORD", pad + 72, pad + 12);
    g.fillStyle = "#1d1c19";
    let nf = 44;
    do { g.font = `800 ${nf}px ${KFONT}`; nf -= 2; }
    while (g.measureText(L === "ko" ? life.name.ko : life.name.en).width > (W - pad * 2 - 300) && nf > 22);
    g.fillText(L === "ko" ? life.name.ko : life.name.en, pad + 72, pad + 54);

    g.textAlign = "right";
    g.fillStyle = "#4e4a41"; g.font = `600 20px ${MONO}`;
    g.fillText(`${life.birthYear} — ${life.year}`, W - pad, pad + 16);
    g.fillStyle = "#857e70"; g.font = `500 17px ${KFONT}`;
    g.fillText(L === "ko" ? `향년 ${life.death.age}세 · ${life.death.cause}` : `aged ${life.death.age} · ${life.death.causeEn}`, W - pad, pad + 44);
    g.textAlign = "left";
    g.strokeStyle = "#c9bea5"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(pad, pad + 78); g.lineTo(W - pad, pad + 78); g.stroke();

    const cap = captions(life);
    const sc = scenesFor(life);
    let i = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const x = pad + c * (panelW + gap);
      const y = gridTop + r * rowStep;
      scene(g, x, y, panelW, panelH, sc[i]);
      g.fillStyle = "#857e70"; g.font = `700 12px ${MONO}`;
      g.fillText((L === "ko" ? cap[i].koT : cap[i].enT).toUpperCase(), x + 2, y + panelH + 20);
      g.fillStyle = "#1d1c19"; g.font = `600 17px ${KFONT}`;
      g.fillText(trim(g, L === "ko" ? cap[i].ko : cap[i].en, panelW - 4), x + 2, y + panelH + 42);
      i++;
    }

    // life type block
    const y0 = gridBottom + (format === "916" ? 78 : 52);
    g.fillStyle = "#857e70"; g.font = `700 12px ${MONO}`;
    g.fillText(L === "ko" ? "삶의 결 / SHAPE OF A LIFE" : "SHAPE OF A LIFE / 삶의 결", pad, y0);
    g.fillStyle = "#1d1c19"; g.font = `800 40px ${KFONT}`;
    g.fillText(U.L(type.name), pad, y0 + 48);
    g.fillStyle = "#b23a2b"; g.font = `600 21px ${KFONT}`;
    g.fillText(trim(g, U.L(type.line), W - pad * 2 - 110), pad, y0 + 82);
    drawFlower(g, W - pad - 46, y0 + 34, 38, type);

    // stats
    const avgH = Math.round(life.history.reduce((a, b) => a + b.happiness, 0) / Math.max(1, life.history.length));
    const nw = window.ENGINE.netWorth(life);
    const stats = [
      [L === "ko" ? "평균 행복" : "Happiness", String(avgH)],
      [L === "ko" ? "남긴 재산" : "Left behind", U.money(nw)],
      [L === "ko" ? "순자산 상위" : "Wealth", (100 - window.ENGINE.wealthPercentile(nw)) + "%"],
      [L === "ko" ? "향년" : "Age", life.death.age + ""]
    ];
    const sy = y0 + 140 + (format === "916" ? 40 : 0);
    g.strokeStyle = "#ddd4c0"; g.beginPath(); g.moveTo(pad, sy - 26); g.lineTo(W - pad, sy - 26); g.stroke();
    stats.forEach((s, k) => {
      const x = pad + k * ((W - pad * 2) / 4);
      g.fillStyle = "#857e70"; g.font = `600 12px ${MONO}`;
      g.fillText(s[0], x, sy);
      g.fillStyle = "#1d1c19"; g.font = `700 26px ${MONO}`;
      g.fillText(s[1], x, sy + 30);
    });

    // footer
    g.fillStyle = "#857e70"; g.font = `500 14px ${KFONT}`;
    g.fillText(L === "ko" ? "태어난 곳은 고를 수 없다. 서명은 고를 수 있다." : "You cannot choose where you are born. You can choose what you sign.", pad, H - 38);
    g.textAlign = "right"; g.font = `600 13px ${MONO}`;
    g.fillText("1in50m", W - pad, H - 38);
    g.textAlign = "left";
    return canvas;
  }

  function trim(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 2 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  function drawFlower(g, cx, cy, r, type) {
    const c = type.colors || ["#e8d5c4", "#c98c7d", "#8a3f34", "#2b2a28"];
    g.save(); g.translate(cx, cy);
    const n = type.flower.shape === "star" ? 8 : type.flower.shape === "bell" ? 5 : type.flower.shape === "cluster" ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.save(); g.rotate(a);
      g.fillStyle = i % 2 ? c[1] : c[0];
      g.beginPath(); g.ellipse(0, -r * 0.55, r * 0.26, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = c[2]; g.beginPath(); g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  window.SHARE = { drawCard, drawFlower };
})();
