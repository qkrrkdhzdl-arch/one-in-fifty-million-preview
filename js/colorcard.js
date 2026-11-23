/* 5천만 분의 1 — '이 삶의 색' 카드
   원작 「80억 분의 1」의 결 색 카드를 한국 삶에 맞춰 옮겼다.
   픽셀 꽃 한 송이와 둘레 여덟 낱말, 색 이름과 16진수. */
(function () {
  'use strict';
  const PALETTE = ['#C284F6', '#8FC7A6', '#E8B96A', '#7FA8D9', '#D98FA0', '#A79BE0', '#8FD3C7', '#E09A6B'];
  const NAMES = ['라벤더색', '연두색', '살구색', '하늘색', '분홍색', '보라색', '청록색', '주황색'];

  function hash(str) {
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
    return h;
  }
  function hexToRgba(hex, a) {
    const v = hex.replace('#', '');
    const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function lighten(hex, amt) {
    const v = hex.replace('#', '');
    const c = [0, 2, 4].map(i => Math.min(255, parseInt(v.slice(i, i + 2), 16) + amt));
    return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function derive(stats) {
    const words = [
      stats.relation >= 55 ? '곁' : '바람',
      stats.knowledge >= 50 ? '뿌리' : '물결',
      stats.happiness >= 55 ? '오늘' : '내일',
      stats.health >= 55 ? '고요' : '일'
    ];
    // 여덟 자리: 네 낱말과 그 반대 낱말을 번갈아 둔다
    const opposite = { 곁: '바람', 바람: '곁', 뿌리: '물결', 물결: '뿌리', 오늘: '내일', 내일: '오늘', 고요: '일', 일: '고요' };
    const ring = [];
    words.forEach(w => { ring.push(w); ring.push(opposite[w]); });
    const i = hash(words.join('')) % PALETTE.length;
    return { name: NAMES[i], hex: PALETTE[i], words: ring };
  }

  function desc(stats, words) {
    const a = words[0], b = words[1];
    const lead = `이 삶은 ${a} 쪽으로 조금 더 기울었습니다.`;
    if (stats.happiness >= 65) return `${lead} 웃음이 남는 해가 많았고, ${b}의 자리도 비어 있지 않았습니다.`;
    if (stats.health >= 65) return `${lead} 몸을 오래 지켰고, 그 덕에 ${b}을(를) 끝까지 볼 수 있었습니다.`;
    return `${lead} 아쉬운 해도 있었지만 ${b}은(는) 이 삶의 바탕이었습니다.`;
  }

  function html(life) {
    const lc = life.lifeColor || derive(life.stats);
    const soft = hexToRgba(lc.hex, .12);
    const words = lc.words || derive(life.stats).words;
    return `<section class="rec-sec colorcard" style="--cc:${lc.hex};--cc-soft:${soft}">
      <h3>이 삶의 색 <span class="lbl">결 하나, 색 하나</span></h3>
      <div class="cc-stage">
        <canvas class="cc-flower" width="240" height="240"></canvas>
        ${words.slice(0, 8).map((w, i) => `<span class="cc-w cc-w${i + 1}">${w}</span>`).join('')}
      </div>
      <p class="cc-name"><b style="background:${lc.hex}"></b>${lc.name} 결 <span class="mono">${lc.hex}</span></p>
      <p class="cc-desc">${desc(life.stats, words)}</p>
    </section>`;
  }

  function mount(el, life) {
    const cv = el.querySelector('canvas.cc-flower');
    if (!cv) return;
    const lc = life.lifeColor || derive(life.stats);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 240, 240);
    const cell = 10, cx = 12, cy = 12;
    const seed = life.seed || 7;
    const petal = 8, rIn = 2.2, rOut = 9.4;
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x * cell), Math.round(y * cell), cell, cell); };
    for (let p = 0; p < petal; p++) {
      const ang = (Math.PI * 2 / petal) * p - Math.PI / 2;
      const len = rOut - ((seed >> p) & 1) * 0.9;
      for (let r = rIn; r <= len; r += 0.45) {
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        const t = (r - rIn) / (rOut - rIn);
        const col = t > 0.82 ? lighten(lc.hex, 26) : t > 0.35 ? lc.hex : hexToRgba(lc.hex, .82);
        px(Math.floor(x), Math.floor(y), col);
        if (t > 0.3 && t < 0.75) px(Math.floor(x) + 1, Math.floor(y), hexToRgba(lc.hex, .55));
      }
    }
    // 꽃 중심
    for (let y = -1.6; y <= 1.6; y += 0.8) for (let x = -1.6; x <= 1.6; x += 0.8) {
      px(Math.floor(cx + x), Math.floor(cy + y), '#EBF0ED');
    }
    for (let i = 0; i < 3; i++) px(cx - 1 + i, cy, lighten(lc.hex, 40));
  }

  window.COLORCARD = { html, mount, derive };
})();
