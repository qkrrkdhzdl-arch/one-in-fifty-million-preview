// 「5천만 분의 1」 공유 카드용 브라우저 캔버스 렌더러.
(function () {
  'use strict';
  const W = 1080, H = 1350, M = 72;
  const KINDS = ['record', 'birth', 'color', 'map', 'curve', 'death'];
  const C = { bg: '#EBF0ED', ink: '#13212A', sub: '#4A5A61', muted: '#7A898D',
    rule: '#C7D2CE', card: '#F7FAF8', red: '#8C1D3C', teal: '#0F6E68',
    gold: '#9C7020', green: '#2B7A4E' };
  const serif = 'Hahmlet, "Noto Serif KR", serif';
  const mono = '"IBM Plex Mono", monospace';
  const sans = '"IBM Plex Sans KR", sans-serif';
  const F = { title: '700 84px ' + serif, name: '700 64px ' + serif,
    label: '600 24px ' + mono, body: '400 30px ' + sans, big: '700 128px ' + serif };
  const EMPTY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, num(v)));
  const str = v => v == null ? '' : String(v);
  const comma = n => Math.round(num(n)).toLocaleString('ko-KR');
  function eok(man) {
    const n = Math.round(Math.abs(num(man))), a = Math.floor(n / 10000), b = n % 10000;
    return (num(man) < 0 ? '−' : '') + (a ? comma(a) + '억 ' : '') + comma(b) + '만원';
  }
  function roundRect(g, x, y, w, h, r, fill, stroke, width = 1) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
  }
  function text(g, s, x, y, font = F.body, color = C.ink, align = 'left') {
    g.save(); g.font = font; g.fillStyle = color; g.textAlign = align;
    g.textBaseline = 'alphabetic';
    const room = align === 'center' ? 2 * Math.min(x - M, W - M - x)
      : align === 'right' ? x - M : W - M - x;
    g.fillText(str(s), x, y, Math.max(1, room)); g.restore();
  }
  function wrap(g, value, x, y, maxW, lineHeight, maxLines = 4) {
    const lines = []; let line = '';
    const push = () => { lines.push(line); line = ''; };
    for (const paragraph of str(value).split('\n')) {
      if (line) push();
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? line + ' ' + word : word;
        if (g.measureText(candidate).width <= maxW) { line = candidate; continue; }
        if (line) push();
        for (const ch of Array.from(word)) {
          if (line && g.measureText(line + ch).width > maxW) push();
          line += ch;
        }
      }
      push();
    }
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
      let last = visible[visible.length - 1];
      while (last && g.measureText(last + '…').width > maxW) last = Array.from(last).slice(0, -1).join('');
      visible[visible.length - 1] = last + '…';
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    visible.forEach((s, i) => g.fillText(s, x, y + i * lineHeight, maxW));
    return y + visible.length * lineHeight;
  }
  function paragraph(g, s, x, y, width, size, height, count, color = C.ink) {
    g.save(); g.font = '400 ' + size + 'px ' + sans; g.fillStyle = color;
    const end = wrap(g, s, x, y, width, height, count); g.restore(); return end;
  }
  function line(g, x1, y1, x2, y2, color = C.rule, width = 1) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }
  function dot(g, x, y, r, color) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  }
  function base(g) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(19,33,42,.012)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  }
  function chrome(g) {
    g.save(); g.font = '600 22px ' + mono; g.fillStyle = C.teal;
    let x = M;
    for (const ch of Array.from('5천만 분의 1')) {
      g.fillText(ch, x, 91); x += g.measureText(ch).width + 2;
    }
    g.restore();
    text(g, '1in50m', W - M, 91, '400 22px ' + mono, C.muted, 'right');
    text(g, '#5천만분의1', M, 1230, '400 20px ' + mono, C.muted);
    text(g, '1in50m.kr', W - M, 1230, '400 20px ' + mono, C.muted, 'right');
    line(g, M, 1254, W - M, 1254);
  }
  function normalize(input, extra) {
    const l = Object.assign({}, input || {});
    l.name = Object.assign({ ko: '이름 없는 사람', en: '' }, l.name);
    l.region = Object.assign({ id: '', ko: '대한민국' }, l.region);
    l.district = Object.assign({ ko: '' }, l.district);
    l.stats = Object.assign({ health: 50, happiness: 50, knowledge: 50, relation: 50 }, l.stats);
    l.history = Array.isArray(l.history) ? l.history.filter(Boolean) : [];
    l.feed = Array.isArray(l.feed) ? l.feed.filter(Boolean) : [];
    l.peers = Array.isArray(l.peers) ? l.peers.filter(Boolean) : [];
    l.birthYear = num(l.birthYear, 2026); l.age = Math.max(0, num(l.age));
    l._extra = extra && typeof extra === 'object' ? extra : {};
    if (!l.typeName) {
      try { l.typeName = window.ENGINE.lifeType(l).name.ko; } catch (_) {}
    }
    l.typeName = l.typeName || '삶의 결'; return l;
  }
  const lastAge = l => Math.max(0, Math.floor(num(l.death && l.death.age, l.age)));
  const lastYear = l => num(l.death && l.death.year, num(l.year, l.birthYear + lastAge(l)));
  const wealth = l => num(l.cash) + num(l.assets) + num(l.homeValue) + num(l.deposit) - num(l.debt);
  const JOB = { none: '', office: '사무직', trade: '기술·생산직', public: '공공기관', self: '자영업', free: '프리랜서', farm: '농림어업' };
  const EDU = { none: '', high: '고등학교', college: '전문대', university: '대학교', grad: '대학원' };
  const labelOf = v => typeof v === 'string'
    ? (JOB[v] != null ? JOB[v] : EDU[v] != null ? EDU[v] : v)
    : v && (v.ko || (v.name && (v.name.ko || v.name))) || '';
  function survival(l) {
    try {
      const points = window.ENGINE.survivalCurve(l);
      if (Array.isArray(points)) {
        const valid = points.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
          .map(p => [Math.max(0, p[0]), clamp(p[1], 0, 100)]).sort((a, b) => a[0] - b[0]);
        if (valid.length > 1 && valid[valid.length - 1][0] > valid[0][0]) return valid;
      }
    } catch (_) {}
    const scale = l.sex === 'f' ? 90 : 84;
    return Array.from({ length: 131 }, (_, age) => [age, 100 * Math.exp(-Math.pow(age / scale, 7))]);
  }
  function interpolate(points, age) {
    if (age <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (age <= b[0]) return a[1] + (b[1] - a[1]) * (age - a[0]) / (b[0] - a[0] || 1);
    }
    return points[points.length - 1][1];
  }
  function provinceCount(l) {
    const groups = ['서울|서울특별시', '부산|부산광역시', '대구|대구광역시', '인천|인천광역시',
      '광주|광주광역시', '대전|대전광역시', '울산|울산광역시', '세종|세종특별자치시',
      '경기|경기도', '강원|강원도|강원특별자치도', '충북|충청북도', '충남|충청남도',
      '전북|전라북도|전북특별자치도', '전남|전라남도', '경북|경상북도', '경남|경상남도', '제주|제주도|제주특별자치도'];
    const seen = new Set();
    const scan = s => groups.forEach((p, i) => {
      if (new RegExp('(?:^|\\s)(?:' + p + ')(?=\\s|[에으로로에서의,·.]|$)').test(str(s))) seen.add(i);
    });
    scan(l.region.ko);
    l.feed.filter(f => /이사|이주|전입|정착|거주/.test(str(f.text))).forEach(f => scan(f.text));
    return Math.max(1, seen.size);
  }

  function typeOf(l) {
    try { return window.ENGINE.lifeType(l); } catch (_) { return { name: { ko: '삶의 결' }, line: { ko: '' }, desc: { ko: '' }, axis: '' }; }
  }
  function summary(l) {
    const t = typeOf(l);
    const born = (l.feed.find(f => num(f.age, -1) === 0) || {}).text || '';
    const school = (l.feed.find(f => /졸업|진학|입학/.test(str(f.text))) || {}).text || '';
    const job = labelOf(l.job);
    const end = l.death ? `${lastAge(l)}세에 ${labelOf(l.death.cause)}으로 세상을 떠났다.` : '지금도 살아간다.';
    return [born, school, job ? `${job}으로 일했다.` : '', end].filter(Boolean).join(' ');
  }
  function lastTxt(l) {
    try {
      const d = l.death || {};
      return labelOf(d.line) || '';
    } catch (_) { return ''; }
  }
  function peersAges(l) {
    return l.peers.map(p => {
      const ms = (p.milestones || []).filter(m => m && m.death);
      return ms.length ? ms[ms.length - 1].age + '세' : '—';
    }).join(' · ');
  }

  function record(g, l) {
    text(g, l.name.ko, M, 210, F.name);
    text(g, `${l.region.ko} · ${l.birthYear}–${lastYear(l)} · 향년 ${lastAge(l)}세`, M, 258, F.label, C.sub);
    text(g, l.typeName, M, 318, '600 30px ' + sans, C.red);
    g.save(); g.font = '400 35px ' + sans; g.fillStyle = C.ink;
    wrap(g, summary(l), M, 386, W - M * 2, 54, 4); g.restore();
    const nw = wealth(l);
    const happy = l.history.reduce((b, h) => (num(h.happiness, 0) > num(b.happiness, 0) ? h : b), l.history[0] || { age: 0, happiness: 0 });
    const cells = [
      ['남긴 재산', eok(nw)],
      ['가장 행복했던 해', num(happy.age) + '세'],
      ['자녀', l.kids ? l.kids + '명' : '없음'],
      ['살아 본 시·도', provinceCount(l) + '곳']
    ];
    cells.forEach(([k, v], i) => {
      const x = M + (i % 2) * 468, y = 660 + Math.floor(i / 2) * 128;
      text(g, k, x, y, F.label, C.muted);
      text(g, v, x, y + 44, '700 34px ' + serif, C.ink);
    });
    line(g, M, 940, W - M, 940);
    text(g, '같은 1초에 태어난 네 사람', M, 990, F.label, C.teal);
    text(g, peersAges(l), M, 1040, '400 30px ' + sans, C.sub);
    text(g, '누구도 어디서 태어날지 고르지 않았다.', M, 1120, '400 28px ' + sans, C.muted);
  }

  function birth(g, l) {
    g.save(); g.globalAlpha = .06; g.fillStyle = C.red;
    g.beginPath(); g.arc(W - 120, 300, 260, 0, Math.PI * 2); g.fill(); g.restore();
    text(g, '출생', M, 200, F.label, C.teal);
    text(g, l.name.ko, M, 300, F.name);
    g.save(); g.font = '400 40px ' + sans; g.fillStyle = C.ink;
    wrap(g, `${l.birthYear}년 ${l.region.ko} ${l.district.ko}에서 ${l.sex === 'f' ? '여자아이' : '남자아이'}로 태어났다.`, M, 380, W - M * 2, 62, 3);
    g.restore();
    text(g, `${l.birthYear}년 이 나라에서 태어난 254,341명 중 한 명`, M, 620, '400 32px ' + sans, C.sub);
    line(g, M, 690, W - M, 690);
    const rows = [['출생지', `${l.region.ko} ${l.district.ko}`], ['가정 형편', { high: '넉넉한 편', mid: '보통', low: '어려운 편' }[l.cls] || '보통'], ['기대수명', '83세 안팎']];
    rows.forEach(([k, v], i) => {
      text(g, k, M, 760 + i * 92, F.label, C.muted);
      text(g, v, M, 800 + i * 92, '600 32px ' + sans, C.ink);
    });
  }

  function color(g, l) {
    const t = typeOf(l);
    const st = l.stats;
    const hue = ['곁', '일', '뿌리', '바람', '고요', '물결', '오늘', '내일'];
    const pairs = [
      [st.relation >= 55 ? hue[0] : hue[1], st.relation >= 55 ? hue[1] : hue[0], st.relation],
      [st.knowledge >= 50 ? hue[2] : hue[3], st.knowledge >= 50 ? hue[3] : hue[2], st.knowledge],
      [st.health >= 55 ? hue[4] : hue[5], st.health >= 55 ? hue[5] : hue[4], st.health],
      [st.happiness >= 55 ? hue[6] : hue[7], st.happiness >= 55 ? hue[7] : hue[6], st.happiness]
    ];
    text(g, '이 삶의 결', M, 200, F.label, C.teal);
    text(g, l.typeName, M, 290, '700 56px ' + serif, C.ink);
    g.save(); g.font = '400 32px ' + sans; g.fillStyle = C.sub;
    wrap(g, labelOf(t.line), M, 356, W - M * 2, 48, 2); g.restore();
    roundRect(g, M, 470, 220, 220, 8, C.red, null);
    text(g, '#8C1D3C', M + 250, 570, F.label, C.muted);
    text(g, '이 삶이 기운 쪽', M + 250, 610, '400 30px ' + sans, C.sub);
    const left = M + 250, track = 300;
    pairs.forEach(([a, b, v], i) => {
      const y = 730 + i * 96;
      text(g, a, left, y, '600 30px ' + sans, C.ink);
      text(g, b, W - M, y, '600 30px ' + sans, C.ink, 'right');
      g.fillStyle = C.rule; g.fillRect(left, y + 18, W - M - left, 3);
      const p = clamp(v, 0, 100) / 100;
      dot(g, left + (W - M - left) * (0.12 + p * 0.76), y + 19, 8, C.red);
    });
    text(g, '네 쌍의 낱말로 보면 이 이름에 가장 가까웠어요.', M, 1160, '400 26px ' + sans, C.muted);
  }

  function map(g, l) {
    const n = lastAge(l) + 1;
    const cols = 10, gap = 8, size = Math.floor((W - M * 2 - gap * (cols - 1)) / cols);
    text(g, '인생 지도', M, 200, F.label, C.teal);
    text(g, `${n}칸 · 한 칸이 1년`, M, 250, '400 28px ' + sans, C.sub);
    for (let a = 0; a < n; a++) {
      const h = l.history.find(x => num(x.age) === a);
      const hp = num(h && h.happiness, 50);
      const col = hp >= 75 ? '#0B5C63' : hp >= 58 ? '#7FBF86' : hp >= 42 ? '#B9CFA8' : '#F3E2B3';
      const cx = M + (a % cols) * (size + gap), cy = 320 + Math.floor(a / cols) * (size + gap);
      roundRect(g, cx, cy, size, size, 4, col, null);
      if (a === n - 1) { g.strokeStyle = C.red; g.lineWidth = 4; g.strokeRect(cx + 2, cy + 2, size - 4, size - 4); }
    }
    const ly = 1030;
    [['#F3E2B3', '덜 행복'], ['#B9CFA8', ''], ['#7FBF86', ''], ['#0B5C63', '더 행복']].forEach(([c, t], i) => {
      roundRect(g, M + i * 84, ly, 60, 16, 2, c, null);
      if (t) text(g, t, M + i * 84 + (i === 0 ? 70 : -70), ly + 46, '400 24px ' + sans, C.muted);
    });
    text(g, '테두리 칸 = 마지막 해', M, 1140, '400 26px ' + sans, C.muted);
  }

  function curve(g, l) {
    const pts = survival(l);
    text(g, '생존 곡선', M, 200, F.label, C.teal);
    text(g, '같은 해, 같은 곳에서 태어난 사람들', M, 250, '400 28px ' + sans, C.sub);
    const x0 = M + 40, y0 = 330, w = W - M * 2 - 60, h = 520;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + h * i / 4;
      line(g, x0, y, x0 + w, y, C.rule);
      text(g, (100 - i * 25) + '%', x0 - 12, y + 8, '400 22px ' + mono, C.muted, 'right');
    }
    g.beginPath();
    pts.forEach((p, i) => {
      const x = x0 + w * clamp(p[0], 0, 110) / 110, y = y0 + h * (1 - clamp(p[1], 0, 100) / 100);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.strokeStyle = C.teal; g.lineWidth = 4; g.stroke();
    const age = lastAge(l);
    const yv = interpolate(pts, age);
    const mx = x0 + w * clamp(age, 0, 110) / 110, my = y0 + h * (1 - yv / 100);
    line(g, mx, y0, mx, y0 + h, C.red, 2);
    dot(g, mx, my, 10, C.red);
    text(g, `${age}세 · ${Math.round(yv)}% 생존`, mx + 16, my - 12, '600 26px ' + sans, C.red);
    for (let a = 0; a <= 100; a += 20) text(g, a, x0 + w * a / 110, y0 + h + 40, '400 22px ' + mono, C.muted, 'center');
  }

  function death(g, l) {
    const d = l.death || {};
    text(g, '마지막 순간', M, 200, F.label, C.teal);
    text(g, '향년', M, 380, '600 40px ' + sans, C.muted);
    text(g, String(lastAge(l)), M - 8, 560, F.big, C.ink);
    text(g, '세', M + 300, 560, '600 44px ' + sans, C.sub);
    line(g, M, 640, W - M, 640);
    text(g, `사인 · ${labelOf(d.cause) || '노환'}`, M, 710, '600 34px ' + sans, C.ink);
    g.save(); g.font = '400 34px ' + sans; g.fillStyle = C.sub;
    wrap(g, lastTxt(l) || '잠든 채로 아침이 오지 않았다.', M, 790, W - M * 2, 52, 4); g.restore();
    text(g, `${l.name.ko} · ${l.birthYear}–${lastYear(l)} · ${l.region.ko}`, M, 1060, F.label, C.muted);
  }

  const DRAW = { record, birth, color, map, curve, death };

  function make(kind, life, extra) {
    try {
      const l = normalize(life, extra);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      if (!g) return EMPTY;
      base(g);
      (DRAW[kind] || record)(g, l);
      chrome(g);
      return cv.toDataURL('image/png');
    } catch (e) {
      return EMPTY;
    }
  }

  window.CARD = { make, KINDS };
})();
