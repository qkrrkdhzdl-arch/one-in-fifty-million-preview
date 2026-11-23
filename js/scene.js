/* 5천만 분의 1 — 인게임 픽셀 장면
   원작 「80억 분의 1」의 32:10 픽셀 장면을 한국 삶에 맞춰 그린다.
   share.js의 픽셀 페인터(SHARE.scene)를 재사용하고, 삶의 상태에 따라 장면을 고른다. */
(function () {
  'use strict';
  const U = window.U;

  // 17개 시·도별 기본 지형
  const SEA = ['busan', 'jeju', 'ulsan', 'incheon', 'gyeongnam', 'jeonnam', 'gangwon'];
  const FARM = ['jeonnam', 'jeonbuk', 'chungnam', 'gyeongbuk', 'gangwon', 'jeju'];

  function mode(life) {
    if (life.zone === 'rural') return FARM.includes(life.region.id) && life.seed % 3 === 0 ? 'field' : 'field';
    if (life.zone === 'metro') return 'city';
    return SEA.includes(life.region.id) ? 'town' : 'town';
  }

  // 나이·형편·계절로 장면 하나를 고른다(해마다 조금씩 달라진다)
  function specFor(life) {
    const age = life.age;
    const seed = (life.seed || 1) + age * 37;
    const m = mode(life);
    const people = [];
    const home = life.home;

    if (age < 6) {
      people.push({ type: 'baby', x: 15.5 });
      people.push({ x: 13.2, y: 16.9, opt: { cloth: '#7a6a52' } });
      people.push({ x: 18.4, y: 16.9, opt: { cloth: '#5c6f74' } });
    } else if (age < 19) {
      people.push({ x: 15.6, y: 16.9, opt: { cloth: '#3f5d63' } });
      if (life.siblings > 0) people.push({ x: 17.6, y: 17.0, opt: { cloth: '#8a5b45' } });
      if (age >= 8) people.push({ x: 12.4, y: 17.0, opt: { cloth: '#6b6f78' } });
    } else if (age < 65) {
      people.push({ x: 15.4, y: 16.9, opt: { cloth: '#3f5d63' } });
      if (life.married) people.push({ x: 17.8, y: 16.9, opt: { cloth: '#8a5b45' } });
      const kids = Math.min(2, life.kids || 0);
      for (let i = 0; i < kids; i++) people.push({ x: 20.4 + i * 1.5, y: 17.4, opt: { small: true, cloth: '#7d6a58' } });
    } else {
      people.push({ x: 15.8, y: 16.9, opt: { cloth: '#6b6f78' } });
      if (life.married) people.push({ x: 18.0, y: 16.9, opt: { cloth: '#7a6a52' } });
    }

    // 시간대: 아침 → 낮 → 저녁 → 밤 (해마다 순환)
    const times = ['dawn', 'day', 'dusk', 'night'];
    const time = times[(age + (life.seed % 4)) % 4];
    const season = (life.year + age) % 4;

    return {
      time, mode: m, seed, people,
      house: home === 'own' || home === 'jeonse' || home === 'wolse' || age < 19,
      bus: m === 'city' && age >= 20 && age < 65,
      boat: SEA.includes(life.region.id) && m !== 'city' && (life.seed + age) % 5 === 0,
      season
    };
  }

  function caption(life) {
    const U = window.U;
    const en = U && U.lang() === 'en';
    const L = (ko, e) => (en ? e : ko);
    const m = mode(life);
    const place = en
      ? ((life.district.en || '').toLowerCase().startsWith((life.region.en || '').toLowerCase()) ? life.district.en : `${life.district.en || life.district.ko}, ${life.region.en || life.region.ko}`)
      : `${life.region.ko} ${life.district.ko}`;
    const where = m === 'city' ? L('아파트 골목', 'a street of flats') : m === 'field' ? L('논밭 사이 집', 'a house among the fields') : L('동네 골목', 'a neighbourhood lane');
    let home = life.home === 'own' ? L('내 집', 'your own home') : life.home === 'jeonse' ? L('전세 살이', 'a jeonse lease') : life.home === 'wolse' ? L('월세 살이', 'a rented room') : (life.age < 19 ? L('부모님 집', "your parents' home") : L('얹혀 사는 집', 'a room in someone else\'s house'));
    // tago난 집: 태어난 집의 이름을 그대로 쓴다(반지하 셋방, 옥탑방, 사택 …)
    if (life.age < 19 && life.homeKind) {
      const hs = (window.CONTENT && window.CONTENT.homes) || [];
      const h = hs.find(x => x.id === life.homeKind);
      if (h && h.cap) home = L(h.cap.ko, h.cap.en);
    }
    if (life.age >= 65) home = life.home === 'own' ? L('내 집, 은퇴', 'your own home, retired') : home;
    const who = life.age < 19 ? (life.family === 'single' ? L('한부모와 함께', 'with one parent') : L('가족과 함께', 'with family'))
      : life.married ? (life.kids ? L('식구들과 함께', 'with the household') : L('배우자와 함께', 'with a spouse'))
      : (life.family && life.family.partner && life.family.partner.alive) ? L('연인과 함께', 'with a partner') : L('혼자', 'alone');
    return `${place} · ${where} · ${home} · ${who}`;
  }

  function draw(canvas, life) {
    if (!canvas || !life) return;
    const spec = specFor(life);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 578;
    const h = Math.round(w * 10 / 32);            // 원작과 같은 32:10 창
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    strip(g, w, h, spec);
  }

  // 36×11.25 격자(32:10)에 하늘 → 지평선 → 땅 → 사람 순으로 한 장면을 그린다.
  // 공유 카드(36×24)와 달리 32:10 높이에 맞춰 인물과 집을 땅 위에 앉힌다.
  function strip(g, w, h, spec) {
    const S = window.SHARE;
    if (!S || !S.px || !S.person) return;
    const pal = S.PALETTES[spec.time] || S.PALETTES.day;
    const cell = w / 36;
    const px = (x, y, ww, hh, c) => S.px(g, x, y, ww, hh, c, cell);
    const R = rng(spec.seed || 7);
    const GROUND = 8.2;
    // 하늘 네 단
    const bands = [[0, 2.2], [2.2, 4.4], [4.4, 6.4], [6.4, GROUND]];
    bands.forEach((b, i) => px(0, b[0], 36, b[1] - b[0], pal.sky[i]));
    // 해 · 달
    const sunX = spec.sunX != null ? spec.sunX : 28, sunY = spec.time === 'night' ? 2.2 : 2.6;
    const sr = spec.time === 'night' ? 1.1 : 1.5;
    for (let yy = -Math.ceil(sr); yy <= sr; yy++) {
      const half = Math.round(Math.sqrt(Math.max(0, sr * sr - yy * yy)) * 10) / 10;
      if (half > 0) px(sunX - half, sunY + yy, half * 2, 0.8, pal.sun);
    }
    // 먼 산
    for (let i = 0; i < 36; i++) {
      const top = Math.max(4.6, Math.min(6.6, 6.6 - 1.6 * Math.abs(Math.sin(i * 0.22 + R() * 0.4)) - R() * 0.3));
      px(i, top, 1, 6.6 - top, pal.far);
    }
    if (spec.mode === 'city') {
      let x = 1;
      while (x < 34) {
        const bw = 2 + Math.floor(R() * 3), bh = 1.8 + Math.floor(R() * 2.4);
        const top = 6.6 - bh;
        px(x, top, bw, bh, pal.near);
        for (let yy = top + 0.8; yy < 6.2; yy += 1.2) {
          for (let xx = x + 0.5; xx < x + bw - 0.4; xx += 1.2) {
            if (R() > 0.45) px(xx, yy, 0.5, 0.6, spec.time === 'night' || spec.time === 'dusk' ? '#e8c98a' : pal.far);
          }
        }
        x += bw + 0.8;
      }
    } else if (spec.mode === 'sea') {
      px(0, 6.6, 36, 1.6, '#4f7f96');
      for (let i = 0; i < 14; i++) px(Math.floor(R() * 34), 6.7 + R() * 1.3, 2, 0.25, '#9fc2cd');
      if (spec.boat) { px(25, 6.0, 3.6, 0.8, '#6b4c38'); px(26.6, 4.6, 0.3, 1.4, '#5a4634'); px(26.9, 4.6, 1.6, 1.2, '#efe6d0'); }
    } else if (spec.mode === 'field') {
      for (let i = 0; i < 7; i++) {
        const tx = 1.5 + i * 4.4 + Math.floor(R() * 1.4);
        px(tx + 1, 4.6, 0.8, 2, '#4a3826');
        px(tx + 0.2, 3.4, 2.4, 1.6, pal.grass);
        px(tx + 0.8, 2.8, 1.2, 1, pal.grass);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const bx = 1.5 + i * 9;
        px(bx, 4.8, 6, 1.8, i % 2 ? '#8a7f6d' : '#7b7263');
        px(bx + 1, 5.2, 1, 0.9, '#d9c9a3');
        px(bx + 3.2, 5.2, 1, 0.9, '#d9c9a3');
      }
    }
    // 땅
    px(0, GROUND, 36, 11.25 - GROUND, pal.ground);
    px(0, GROUND, 36, 0.5, pal.grass);
    if (spec.bus) {
      px(4, 6.7, 7, 1.4, '#5b6b76');
      for (let i = 0; i < 3; i++) px(4.6 + i * 2, 7.0, 1.2, 0.6, '#cfd8d2');
    }
    // 집
    if (spec.house) {
      const hx = 24, hy = 4.9, hw = 6.4, hh = 3.3;
      px(hx, hy, hw, hh, '#d8cdb6');
      for (let i = 0; i < 5; i++) px(hx - 0.7 + i * 0.7, hy - 0.9 + i * 0.3, hw + 1.4 - i * 1.6, 0.55, '#7d4a3a');
      px(hx + 1, hy + 1.1, 1.3, 1.1, spec.time === 'night' ? '#e8c98a' : '#9fb6bd');
      px(hx + 4, hy + 1.4, 1.4, 2.4, '#7a5638');
    }
    // 사람
    const standing = 10.2;
    (spec.people || []).forEach(p => {
      if (p.type === 'baby') {
        px(p.x, standing - 1.4, 3, 1.4, '#f0dcc0');
        px(p.x + 0.3, standing - 1.1, 2.4, 0.8, '#fdf7ea');
        return;
      }
      const small = p.opt && p.opt.small;
      const scale = (p.opt && p.opt.scale) || (small ? 0.7 : 0.88);
      S.person(g, p.x, standing - 6.2 * scale, cell, pal, Object.assign({}, p.opt, { scale }));
    });
    if (spec.time === 'night') {
      for (let i = 0; i < 22; i++) px(R() * 36, R() * 3.6, 0.3, 0.3, '#efe9dc');
    }
    g.strokeStyle = 'rgba(29,28,25,.18)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  }

  function rng(seed) { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function avatar(canvas, life) {
    if (!canvas || !life) return;
    const n = 12, s = canvas.width / n;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const skin = '#e8c8a8', hair = life.sex === 'f' ? '#3a2b26' : '#2b2622';
    const cloth = life.cls === 'high' ? '#3f5d63' : life.cls === 'low' ? '#8a7a62' : '#5c6f74';
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * s, y * s, w * s, h * s); };
    g.clearRect(0, 0, canvas.width, canvas.height);
    r(0, 0, 12, 12, life.age > 60 ? '#DDE5E1' : '#D3DEDA');
    r(3, 2, 6, 2, hair); r(2, 4, 1, 4, hair); r(9, 4, 1, 4, hair);
    r(3, 4, 6, 5, skin);
    r(4, 5, 1, 1, '#2b2622'); r(7, 5, 1, 1, '#2b2622');
    r(5, 7.5, 2, 0.6, '#b07a6a');
    if (life.age > 55) { r(3, 4, 6, 0.6, '#cfd8d2'); }
    r(2, 9, 8, 3, cloth); r(5, 9, 2, 3, '#F2F5F3');
  }

  window.SCENE = { draw, caption, avatar, specFor, mode };
})();
