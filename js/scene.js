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
    const m = mode(life);
    const place = `${life.region.ko} ${life.district.ko}`;
    const where = m === 'city' ? '아파트 골목' : m === 'field' ? '논밭 사이 집' : '동네 골목';
    let home = life.home === 'own' ? '내 집' : life.home === 'jeonse' ? '전세 살이' : life.home === 'wolse' ? '월세 살이' : (life.age < 19 ? '부모님 집' : '얹혀 사는 집');
    if (life.age >= 65) home = life.home === 'own' ? '내 집, 은퇴' : home;
    const who = life.age < 19 ? (life.family === 'single' ? '한부모와 함께' : '가족과 함께')
      : life.married ? (life.kids ? '식구들과 함께' : '배우자와 함께') : '혼자';
    return `${place} · ${where} · ${home} · ${who}`;
  }

  function draw(canvas, life) {
    if (!canvas || !life) return;
    const spec = specFor(life);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 578;
    const h = Math.round(w * 9 / 16);             // 16:9 (36×24 원화의 3/4 비율)
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;

    // share.js의 장면은 36×24 격자(한 칸 10px)로 그린다. 그 원본에서 32:10 창(11.25행)을
    // 지평선·인물·건물이 모두 남는 구간(8행~19.25행)에 맞춰 잘라 낸다.
    const off = document.createElement('canvas');
    off.width = 360; off.height = 240;
    const og = off.getContext('2d');
    og.imageSmoothingEnabled = false;
    try { window.SHARE.scene(og, 0, 0, 360, 240, spec); } catch (e) { /* 장면을 못 그려도 화면은 계속 */ }
    // 하늘·스카이라인·골목·사람이 한 장면으로 읽히는 구간(3.7~24행)
    g.drawImage(off, 0, 37, 360, 203, 0, 0, canvas.width, canvas.height);
  }

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
