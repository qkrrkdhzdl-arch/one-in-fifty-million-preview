/* 5천만 분의 1 — 화면·피드·결정·기록·공유
   원작 「80억 분의 1」의 화면 흐름(표지 → 출생 신고서 → 본 게임 → 사망 → 사망 기록 → 공유 카드)을
   한국 콘텐츠(17개 시·도 / 62개 시군구 / 사건 248종 / 결정 24장 / 출처 16종 / 문화주석 30 / 삶의 결 16 / 동기 4명)로 구현한다. */
(function () {
  'use strict';
  const U = window.U, C = window.CONTENT, E = window.ENGINE, $ = U.$;

  /* 한 해의 길이(1× 기준). 사용자 지시: 1×는 약 10초, 빠르게 6~7초, 깊게 14~15초. */
  const YEAR_MS = { fast: 6500, normal: 10000, deep: 14500 };
  const SPEEDS = [1, 2, 4, 8, 12, 16];
  const en = () => U.lang() === 'en';
  const L = (ko, e) => (U.lang() === 'en' ? e : ko);
  // 숫자 뒤에 붙는 단위(세·명·년)는 언어마다 다르다
  const AGE = (n) => en() ? `${n}` : `${n}세`;
  // 영어에서는 지역명과 구 이름이 겹치면 한 번만 쓴다(Jeju Jeju City → Jeju City)
  const place = (r, d) => {
    if (!en()) return `${r.ko} ${d.ko}`;
    const rn = r.en || r.ko, dn = d.en || d.ko;
    return dn.toLowerCase().startsWith(rn.toLowerCase()) ? dn : `${dn}, ${rn}`;
  };
  const YEARN = (n) => en() ? `${n}` : `${n}년`;
  const CLASS_KO = { high: '넉넉한 편', mid: '보통', low: '어려운 편' };
  const CLASS_EN = { high: 'comfortable', mid: 'middle', low: 'tight' };
  const clsName = (c) => en() ? (CLASS_EN[c] || c) : (CLASS_KO[c] || '보통');
  const CLASS_DOT = { high: '●●●●○', mid: '●●●○○', low: '●●○○○' };
  const HOME_KO = { none: '얹혀 삶', wolse: '월세', jeonse: '전세', own: '내 집' };
  const HOME_EN = { none: 'Living with family', wolse: 'Monthly rent', jeonse: 'Jeonse', own: 'Owned home' };
  const homeName = (h) => en() ? (HOME_EN[h] || h) : (HOME_KO[h] || '—');
  const JOB_KO = { none: '—', office: '사무직', trade: '기술·생산직', public: '공공기관', self: '자영업', free: '프리랜서', farm: '농림어업' };
  const JOB_EN = { none: '—', office: 'Office work', trade: 'Skilled trades', public: 'Public service', self: 'Small business', free: 'Freelance', farm: 'Farming and fishing' };
  const jobName = (j) => en() ? (JOB_EN[j] || '—') : (JOB_KO[j] || '—');
  const EDU_KO = { none: '—', high: '고등학교', college: '전문대', university: '대학교', grad: '대학원' };
  const EDU_EN = { none: '—', high: 'High school', college: 'Two-year college', university: 'University', grad: 'Graduate school' };
  const eduName = (e) => en() ? (EDU_EN[e] || '—') : (EDU_KO[e] || '—');
  const MAJOR_KO = { none: '—', eng: '공학·컴퓨터', biz: '경영·경제', hum: '인문·사회', med: '의약·보건', art: '예체능', edu: '사범·교육', sci: '자연과학' };
  const MAJOR_EN = { none: '—', eng: 'Engineering and computing', biz: 'Business and economics', hum: 'Humanities and social sciences', med: 'Medicine and health', art: 'Arts and physical education', edu: 'Education', sci: 'Natural sciences' };
  const majorName = (m) => en() ? (MAJOR_EN[m] || m) : (MAJOR_KO[m] || m);
  const ROLE_KO = { none: '—', dev: '개발·데이터', mkt: '마케팅·기획', sales: '영업', finance: '재무·회계', research: '연구·전문직', public: '공무원·공공', edu: '교사·교육', med: '의료·돌봄', self: '자영업·창업', trade: '기술·생산', free: '프리랜서', farm: '농림어업', senior: '노후 일자리' };
  const ROLE_EN = { none: '—', dev: 'Development and data', mkt: 'Marketing and planning', sales: 'Sales', finance: 'Finance and accounting', research: 'Research and the professions', public: 'Civil service', edu: 'Teaching', med: 'Health care', self: 'Small business', trade: 'Skilled trades', free: 'Freelance and arts', farm: 'Farming and fishing', senior: 'Late-life work' };
  const roleName = (r) => en() ? (ROLE_EN[r] || r) : (ROLE_KO[r] || r);
  const FOCUS = [
    ['work', '일·배움', 'work and learning', '역량↑ 소득↑ 스트레스↑', 'skill up, income up, stress up'],
    ['love', '관계·사랑', 'people you love', '관계↑ 행복↑', 'bonds and happiness up'],
    ['health', '건강·쉼', 'health and rest', '건강↑ 스트레스↓', 'health up, stress down'],
    ['study', '학습·공부', 'study', '역량↑ 성적↑ 스트레스↑', 'skill and marks up, stress up'],
    ['money', '돈·투자', 'money', '소득·재산↑ 역량↑', 'income and wealth up'],
    ['balance', '균형', 'balance', '모두 조금씩', 'a little of everything']
  ];
  const focusName = (f) => en() ? f[2] : f[1];
  const focusEff = (f) => en() ? f[4] : f[3];
  // 어릴 때는 '돈·투자' 대신 '학습·공부'로 시간을 쓰고, 자라면 둘 다 고를 수 있다
  const focusList = (age) => age < 19 ? FOCUS.filter(f => f[0] !== 'money') : FOCUS.filter(f => f[0] !== 'study');
  const ALLOC = [['safe', '예금', 'Savings'], ['stock', '주식', 'Stocks'], ['coin', '코인', 'High risk']];
  const allocName = (a) => en() ? a[2] : a[1];

  const APP = window.APP = {
    lang: (function () {
      try {
        const q = new URLSearchParams(location.search).get('lang');
        if (q === 'en' || q === 'ko') { localStorage.setItem('oifm2_lang', q); return q; }
        const s = localStorage.getItem('oifm2_lang');
        if (s === 'en' || s === 'ko') return s;
      } catch (e) {}
      return 'ko';
    })(),
    pace: localStorage.getItem('oifm2_pace') || 'normal',
    speed: 1, playing: false, auto: false, ff: false,
    autoHide: localStorage.getItem('oifm2_autohide') === '1',
    screen: 'cover', life: null, modal: null, peek: false,
    yearT: 0, hold: 0, queue: [], qi: 0, lastTs: 0, raf: null, pendingDeath: null,
    deathStep: 0, recDecade: null, shareKind: 'record'
  };
  const now = () => performance.now();
  const yearMs = () => YEAR_MS[APP.pace] / APP.speed;

  /* ---------- 화면 전환 ---------- */
  function go(id) {
    APP.screen = id;
    ['cover', 'birth', 'life', 'death', 'record'].forEach(s => {
      const el = $('#screen-' + s);
      if (el) { el.hidden = s !== id; try { el.inert = s !== id; } catch (e) {} }
    });
    window.scrollTo(0, 0);
  }

  /* ---------- 저장/복원 ---------- */
  function save() {
    try {
      if (!APP.life) return;   // 화면을 닫을 때 지난 삶을 지우지 않는다(새로 시작할 때만 비운다)
      const l = APP.life;
      const slim = Object.assign({}, l, { yearLog: (l.yearLog || []).slice(-6), feed: (l.feed || []).slice(-400) });
      localStorage.setItem('oifm2_life', JSON.stringify({ life: slim, screen: APP.screen, pace: APP.pace }));
    } catch (e) { /* 저장 실패는 게임을 막지 않는다 */ }
  }
  function loadSave() {
    try { const raw = localStorage.getItem('oifm2_life'); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  /* ---------- 표지 ---------- */
  function regionShare() {
    const total = C.regions.reduce((s, r) => s + r.w, 0);
    return C.regions.slice().sort((a, b) => b.w - a.w).map(r => ({ r, pct: r.w / total * 100 }));
  }

  const MAP_POS = {
    seoul: [.40, .175], incheon: [.335, .20], gyeonggi: [.43, .245], gangwon: [.60, .175],
    chungbuk: [.50, .335], chungnam: [.37, .355], daejeon: [.44, .375], sejong: [.435, .345],
    gyeongbuk: [.60, .44], daegu: [.575, .515], jeonbuk: [.37, .49], gwangju: [.305, .60],
    jeonnam: [.285, .70], gyeongnam: [.48, .655], busan: [.545, .615], ulsan: [.595, .57], jeju: [.20, .86]
  };

  function drawHeroMap(canvas) {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 560, h = Math.round(w * 9 / 16);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // 대한민국 실루엣(거친 다각형) 안쪽에만 점을 찍는다
    const poly = [[.30,.09],[.44,.05],[.53,.10],[.58,.17],[.54,.23],[.62,.27],[.66,.36],[.64,.46],
      [.61,.55],[.58,.63],[.55,.72],[.50,.80],[.44,.86],[.38,.80],[.33,.72],[.29,.63],[.26,.52],
      [.28,.42],[.24,.34],[.26,.24],[.27,.16]];
    const jeju = [[.17,.86],[.23,.87],[.24,.91],[.18,.92]];
    const inside = (x, y) => {
      const test = (pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
      return test(poly) || test(jeju);
    };
    const grid = 12;
    for (let y = 4; y < h; y += grid) {
      for (let x = 4; x < w; x += grid) {
        const ins = inside(x / w, y / h);
        g.beginPath();
        g.arc(x, y, ins ? 1.6 : 1, 0, Math.PI * 2);
        g.fillStyle = ins ? 'rgba(94,110,114,.34)' : 'rgba(94,110,114,.10)';
        g.fill();
      }
    }
    // 시·도 점
    const mx = regionShare();
    const maxW = Math.max(...mx.map(m => m.r.w));
    mx.forEach(m => {
      const p = MAP_POS[m.r.id] || [.45, .5];
      const r = 4 + Math.sqrt(m.r.w / maxW) * 20;
      g.beginPath();
      g.arc(w * p[0], h * p[1], r, 0, Math.PI * 2);
      g.fillStyle = m.r.type === 'metro' ? 'rgba(140,29,60,.72)' : 'rgba(140,29,60,.42)';
      g.fill();
    });
    // 이름표(좁은 화면에서는 겹치므로 생략)
    if (w > 420) {
      g.font = '600 10px "IBM Plex Mono", monospace';
      g.lineWidth = 3; g.strokeStyle = 'rgba(235,240,237,.85)'; g.textAlign = 'left';
      g.fillStyle = 'rgba(19,33,42,.55)';
      ['seoul', 'gyeonggi', 'busan', 'gyeongnam', 'jeju'].forEach(id => {
        const m = mx.find(x => x.r.id === id); if (!m) return;
        const p = MAP_POS[m.r.id];
        const lb = en() ? m.r.en : m.r.ko;
        g.strokeText(lb, w * p[0] + 13, h * p[1] - 12);
        g.fillText(lb, w * p[0] + 13, h * p[1] - 12);
      });
    }
  }

  function drawCertMap(canvas, life) {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 420, h = Math.round(w * 0.52);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const poly = [[.30,.09],[.44,.05],[.53,.10],[.58,.17],[.54,.23],[.62,.27],[.66,.36],[.64,.46],
      [.61,.55],[.58,.63],[.55,.72],[.50,.80],[.44,.86],[.38,.80],[.33,.72],[.29,.63],[.26,.52],
      [.28,.42],[.24,.34],[.26,.24],[.27,.16]];
    const jeju = [[.17,.86],[.23,.87],[.24,.91],[.18,.92]];
    const inside = (x, y) => {
      const test = (pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
      return test(poly) || test(jeju);
    };
    for (let y = 2; y < h; y += 7) for (let x = 2; x < w; x += 7) {
      const ins = inside(x / w, y / h);
      g.beginPath(); g.arc(x, y, ins ? 1.2 : 0.8, 0, Math.PI * 2);
      g.fillStyle = ins ? 'rgba(94,110,114,.38)' : 'rgba(94,110,114,.10)'; g.fill();
    }
    const p = MAP_POS[life.region.id] || [.45, .5];
    g.beginPath(); g.arc(w * p[0], h * p[1], 7, 0, Math.PI * 2);
    g.fillStyle = 'rgba(15,110,104,.16)'; g.fill();
    g.beginPath(); g.arc(w * p[0], h * p[1], 3.4, 0, Math.PI * 2);
    g.fillStyle = '#0F6E68'; g.fill();
  }

  function renderCover() {
    const saved = loadSave();
    const share = regionShare();
    const top = share.slice(0, 9);
    const restPct = share.slice(9).reduce((s, x) => s + x.pct, 0);
    const maxPct = top[0].pct;
    const el = $('#screen-cover');
    el.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <div class="herotext">
          <div class="kicker">${L('v2.2 · 무료 인생 시뮬레이션 · 17개 시·도 62개 시군구 · 사건 769종 · 결정 44장 · 일상 결정 28장',
                            'v2.2 · a free life simulation · 17 provinces, 62 districts · 769 events · 44 decisions · 28 everyday choices')}</div>
          <h1>${en() ? 'One in<br>Fifty <em>Million</em>' : '5천만<br>분의 <em>1</em>'}</h1>
          ${ en() ? '<p lang="ko" style="font-family:var(--f-mono);font-size:12px;letter-spacing:.06em;color:var(--ink3);margin:10px 0 0">5천만 분의 1 · the Korean title</p>' : ''}
          <p class="lede">${L('2025년, 이 나라에서 254,341명이 태어났습니다. 그중 한 명이 되어 한 번뿐인 삶을 끝까지 살아봅니다. 어느 동네, 누구의 아이로 태어날지는 고를 수 없습니다. 당신이 그랬던 것처럼.',
                            'In 2025, 254,341 people were born in this country. You are one of them, and you live that one life to the end. The neighbourhood and whose child you are, you do not choose. Neither did they.')}</p>
          <div class="counter">
            <div><strong>254,341</strong><span>${L('2025년 출생아', 'births in 2025')}</span></div>
            <div><strong>0.80</strong><span>${L('합계출산율(명)', 'children per woman')}</span></div>
            <div><strong>17</strong><span>${L('시·도 · 62개 시군구', 'provinces · 62 districts')}</span></div>
          </div>
          <div class="heroopts">
            <div class="optgroup wide"><span class="lbl">${L('태어날 때', 'Born in')}</span>
              <div class="seg" data-seg="cohort">
                ${[['now', '지금', 'Today'], ['w2000', '2000년대', 'the 2000s'], ['w1990', '1990년대', 'the 1990s'], ['any', '아무 때나', 'Any era']].map(([k, ko, e]) =>
                  `<button data-v="${k}" aria-pressed="${(localStorage.getItem('oifm2_cohort') || 'now') === k}">${L(ko, e)}</button>`).join('')}
              </div>
              <span class="hint">${L('지난 세대는 그 시절 통계와 사건으로 살아갑니다.', 'Earlier generations live by the statistics and the scenes of their own time.')}</span>
            </div>
            <div class="optgroup wide"><span class="lbl">${L('한 번의 인생 길이', 'Length of one life')}</span>
              <div class="seg" data-seg="pace">
                ${[['fast', '빠르게 · 6.5초/년', 'Fast · 6.5s a year'], ['normal', '보통 · 10초/년', 'Normal · 10s a year'], ['deep', '깊게 · 14.5초/년', 'Deep · 14.5s a year']].map(([k, ko, e]) =>
                  `<button data-v="${k}" aria-pressed="${APP.pace === k}">${L(ko, e)}</button>`).join('')}
              </div>
              <span class="hint">${L('1× 기준 한 해가 10초입니다. 사는 동안 16×까지 배속되고, 결정이 뜨면 그 자리에 멈춥니다.',
                                  'At 1× a year takes ten seconds. You can run up to 16× while living; the clock stops where a decision arrives.')}</span>
            </div>
            <div class="optgroup wide"><span class="lbl">${L('태어날 곳 (선택)', 'Where you are born (optional)')}</span>
              <select class="sel" id="homeSel">
                <option value="">${L('고르지 않을래요 — 출생 비중대로 뽑습니다', 'Let it be drawn — weighted by real births')}</option>
                ${C.regions.map(r => `<option value="${r.id}">${U.L(r)} · ${L('출생 비중', 'birth share')} ${(r.w / 100 * 100).toFixed(1)}%</option>`).join('')}
              </select>
            </div>
            <div class="optgroup wide"><span class="lbl">${L('언어', 'Language')}</span>
              <div class="seg" data-seg="lang">
                <button data-v="ko" aria-pressed="${APP.lang === 'ko'}">한국어</button>
                <button data-v="en" aria-pressed="${APP.lang === 'en'}">English</button>
              </div>
              <span class="hint">${L('영어로 보면 외국인에게도 같은 장면이 읽힙니다.', 'In English the same scenes read for anyone outside Korea.')}</span>
            </div>
          </div>
          <div class="ctarow" style="margin-top:24px">
            <button class="cta" id="startBtn">${L('태어나기', 'Be born')}</button>
            ${saved && saved.life && !saved.life.death ? `<button class="ghost" id="resumeBtn">${L('이어하기', 'Continue')} · ${L(saved.life.age + '세', 'age ' + saved.life.age)} ${en() ? saved.life.name.en : saved.life.name.ko}</button>` : ''}
            ${saved && saved.life && saved.life.death ? `<button class="ghost" id="lastRecBtn">${L('지난 삶 기록 보기', "Last life's record")} · ${L(saved.life.death.age + '세', 'age ' + saved.life.death.age)} ${en() ? saved.life.name.en : saved.life.name.ko}</button>` : ''}
            <span class="ctahint">${L('설정은 그대로 두고 바로 태어나도 괜찮아요.', 'You can leave all of this as it is and simply be born.')}</span>
          </div>
          <p class="warnline">${L('죽음과 질병, 사고도 실제 통계대로 일어납니다. 장면은 그리지 않고, 도움받을 곳을 함께 알려 드립니다. 15세 이상에게 맞춘 시뮬레이션이에요.',
                                'Death, illness and accidents happen at their real rates. None of it is drawn out; instead the game shows where help can be found. Written for players aged 15 and over.')}
            <button class="lnk" id="themeBtn">${L('화면 밝기 바꾸기', 'Light or dark')}</button></p>
        </div>
        <div class="heroside">
          <div class="tg-bg"><canvas id="mapCanvas"></canvas></div>
          <div class="odds">
            <h2>${L('지금 태어나는 아기라면', 'If a baby were born today')}</h2>
            <p class="sub">${L('국가데이터처 「2025년 출생통계」 · 시·도별 출생아 수 비중', 'Statistics Korea, Birth Statistics 2025 · share of births by province')}</p>
            <div class="oddslist">
              ${top.map(({ r, pct }) => `
                <div class="orow"><span class="on">${U.L(r)}</span>
                  <span class="ot"><i style="width:${Math.max(3, pct / top[0].pct * 100)}%"></i></span>
                  <span class="ov">${pct.toFixed(1)}%</span></div>`).join('')}
              <div class="orow"><span class="on">${L('나머지 8개 시·도', 'the other 8')}</span>
                <span class="ot"><i style="width:${Math.max(3, restPct / maxPct * 100)}%;background:var(--rule)"></i></span>
                <span class="ov">${restPct.toFixed(1)}%</span></div>
            </div>
            <p class="hint" style="margin-top:12px">${L('서울·경기에서만 두 명 중 한 명 가까이(44.5%)가 태어납니다. 이 비중대로 뽑히고, 원하면 직접 고를 수도 있어요.',
                                                                 'Almost one in two (44.5%) is born in Seoul or Gyeonggi alone. The draw follows those shares, and you may also choose.')}</p>
          </div>
        </div>
      </div>
    </div>`;
    drawHeroMap($('#mapCanvas'));

    el.querySelectorAll('[data-seg="pace"] button').forEach(b => b.onclick = () => {
      APP.pace = b.dataset.v; localStorage.setItem('oifm2_pace', APP.pace);
      el.querySelectorAll('[data-seg="pace"] button').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    el.querySelectorAll('[data-seg="cohort"] button').forEach(b => b.onclick = () => {
      localStorage.setItem('oifm2_cohort', b.dataset.v);
      el.querySelectorAll('[data-seg="cohort"] button').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    el.querySelectorAll('[data-seg="lang"] button').forEach(b => b.onclick = () => switchLang(b.dataset.v));
    $('#themeBtn').onclick = toggleTheme;
    $('#startBtn').onclick = () => startBirth($('#homeSel').value);
    const lr = $('#lastRecBtn');
    if (lr) lr.onclick = () => { APP.life = saved.life; go('record'); renderRecord(); };
    const rb = $('#resumeBtn');
    if (rb) rb.onclick = () => { APP.life = saved.life; APP.pace = saved.pace || APP.pace; beginLife(true); };
  }

  function switchLang(v) {
    if (v === APP.lang) return;
    APP.lang = v;
    try { localStorage.setItem('oifm2_lang', v); } catch (e) { /* 저장이 막혀도 화면은 바뀐다 */ }
    document.documentElement.lang = v;
    save();
    try {
      // 주소에 붙은 ?lang=이 저장값을 덮어쓰지 않게 지운다
      const u = new URL(location.href);
      u.searchParams.delete('lang');
      history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
    } catch (e) {}
    location.reload();   // 저장된 삶은 그대로 두고 화면 언어만 새로 그린다
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('oifm2_theme', next);
  }

  /* ---------- 출생 뽑기 ---------- */
  function cohortFromPref() {
    const p = localStorage.getItem('oifm2_cohort') || 'now';
    if (p === 'w2000') return [1998, 2005];
    if (p === 'w1990') return [1990, 1996];
    if (p === 'any') return null;
    return [2020, 2026];
  }

  function startBirth(regionId) {
    closeModal();
    const life = E.createLife({ region: regionId || undefined, cohortSpan: cohortFromPref() });
    if (cohortFromPref() === null) { /* 엔진 기본 코호트 분포 사용 */ }
    APP.life = life;
    go('birth');
    const share = regionShare();
    const pct = share.find(x => x.r.id === life.region.id);
    const el = $('#screen-birth');
    el.innerHTML = `<div class="wrap"><div class="rollbox">
      <div class="roller"><div class="lbl">${L('출생지를 정하는 중', 'Drawing your birthplace')}</div>
        <div class="country" id="rollName">${U.L(C.regions[Math.floor(Math.random() * C.regions.length)])}</div>
        <div class="meta" id="rollMeta">${L('확률', 'odds')} —</div></div>
    </div></div>`;
    const names = C.regions.map(r => U.L(r));
    let i = 0;
    const spin = setInterval(() => {
      const nm = $('#rollName'); if (!nm) return clearInterval(spin);
      nm.textContent = names[Math.floor(Math.random() * names.length)];
      const mm = $('#rollMeta'); if (mm) mm.textContent = L('확률', 'odds') + ' —';
    }, 90);
    setTimeout(() => {
      clearInterval(spin);
      const nm = $('#rollName'); if (nm) nm.textContent = U.L(life.region);
      const mm = $('#rollMeta'); if (mm) mm.textContent = `${U.L(life.district)} · ${L('확률', 'odds')} ${(pct ? pct.pct : 0).toFixed(1)}%`;
      setTimeout(() => renderCert(), 520);
    }, 1750);
  }

  function lifeExpectancy(life) {
    // 통계청 생명표(2024) 기준값에 지역 유형·형편·출생 세대 차이를 더해 근사한다
    let e0 = life.sex === 'f' ? 86.4 : 80.6;                 // 전국 기대수명
    if (life.zone === 'metro') e0 += 0.4; else if (life.zone === 'rural') e0 -= 0.6;
    if (life.cls === 'high') e0 += 1.8; else if (life.cls === 'low') e0 -= 2.2;
    if (life.birthYear < 1990) e0 -= 5.5; else if (life.birthYear < 2005) e0 -= 3.0; else if (life.birthYear < 2020) e0 -= 1.2;
    return Math.round(e0 * 10) / 10;
  }
  function eraStats(birthYear) {
    if (birthYear < 1990) return { u5: '1.4%', gdp: '$7,900', label: '1990년' };
    if (birthYear < 2005) return { u5: '0.7%', gdp: '$16,300', label: '2000년대' };
    if (birthYear < 2020) return { u5: '0.4%', gdp: '$28,600', label: '2010년대' };
    return { u5: '0.3%', gdp: '$36,200', label: '2025년' };
  }

  function certNo(life) {
    const h = Math.abs(Math.sin(life.seed) * 1e7) | 0;
    return `No. KOR-${life.birthYear}-${String(h).slice(0, 7)}`;
  }

  function guillocheSVG() {
    let p = '';
    for (let k = 0; k < 14; k++) {
      let d = '';
      for (let x = 0; x <= 720; x += 12) {
        const y = 60 + k * 26 + Math.sin((x / 720) * Math.PI * 2 * (2 + (k % 3)) + k) * (14 + k % 4 * 3);
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
      }
      p += `<path d="${d}" fill="none" stroke="currentColor" stroke-width=".6"/>`;
    }
    return `<svg class="guilloche" viewBox="0 0 720 420" preserveAspectRatio="none" aria-hidden="true">${p}</svg>`;
  }

  function renderCert() {
    const life = APP.life;
    const e0 = lifeExpectancy(life);
    const share = regionShare().find(x => x.r.id === life.region.id);
    const el = $('#screen-birth');
    const parentAge = `${life.familyAges.mother != null ? L('어머니 ', 'Mother ') + life.familyAges.mother + L('세', '') : ''}${life.familyAges.mother != null && life.familyAges.father != null ? ' · ' : ''}${life.familyAges.father != null ? L('아버지 ', 'Father ') + life.familyAges.father + L('세', '') : ''}`;
    // 집안의 배경: 이 아이가 어디서, 누구와 자라는가
    const g = life.bg || {};
    const side = g.gpSide === 'maternal' ? '외가' : '친가';
    const gma = life.family.gma, gpa = life.family.gpa;
    const sideLabel = en() ? (g.gpSide === 'maternal' ? 'Maternal' : 'Paternal') : side;
    const gpLabel = !gma && !gpa
      ? L('안 계심', 'none living')
      : sideLabel + ' · ' + [gma ? L('할머니 ', 'Grandmother ') + gma.age + L('세', '') : '', gpa ? L('할아버지 ', 'Grandfather ') + gpa.age + L('세', '') : ''].filter(Boolean).join(' · ');
    const gpStory = (en() ? {
      cohabit: `Your ${g.gpSide === 'maternal' ? 'maternal' : 'paternal'} grandmother lives in the same house.`,
      near: `Your grandmother lives two stops away.`,
      holiday: `Your grandmother lives in the countryside you visit for the holidays.`,
      far: `Your grandparents live far off; news of them arrives only by phone.`,
      one: `Only one grandparent is still living.`,
      gone: `Both of your grandparents were gone before you were born.`,
      raised: `You are being raised by your grandmother, without your parents.`
    } : {
      cohabit: `${side} 할머니가 같은 집에서 함께 삽니다.`,
      near: `${side} 할머니가 두 정거장 거리에 삽니다.`,
      holiday: `${side} 할머니는 명절에 내려가는 시골에 삽니다.`,
      far: `조부모는 멀리 살고, 안부는 전화로만 오갑니다.`,
      one: `조부모 중 한 분만 계십니다.`,
      gone: `태어날 때 조부모는 이미 계시지 않았습니다.`,
      raised: `부모 없이 할머니 손에서 자랍니다.`
    })[g.gpSetup] || '';
    el.innerHTML = `<div class="wrap"><div class="rollbox">
      <div class="roller" style="min-height:0;padding:18px 0 6px"><div class="lbl">${L('출생 신고', 'Certificate of Birth')}</div>
        <div class="meta">${U.L(life.region)} · ${U.L(life.district)} · ${L('확률', 'odds')} ${(share ? share.pct : 0).toFixed(1)}%</div></div>
      <div class="cert">
        <div class="band"><b>${L('출생 신고', 'Certificate of Birth')}</b><span>${certNo(life)}</span></div>
        <div class="body">
          ${guillocheSVG()}
          <div class="lbl">${L('이름', 'Name')}</div>
          <h2>${en() ? life.name.en : life.name.ko}</h2>
          <p class="story">${en()
              ? `You were born in ${life.district.en}, ${life.region.en}, in ${life.birthYear}, a ${life.sex === 'f' ? 'girl' : 'boy'} in a ${clsName(life.cls)} household. ${life.family === 'single' ? 'One parent is raising you.' : life.siblings ? (life.siblings === 1 ? 'You have an older sibling.' : `You have ${life.siblings} older siblings.`) : 'You are the first child.'} The family lives in ${life.region.en}. ${gpStory}`
              : `${life.birthYear}년 ${life.region.ko} ${life.district.ko}의 ${CLASS_KO[life.cls]} 가정에서 ${life.sex === 'f' ? '여자아이' : '남자아이'}로 태어났습니다. ${life.family === 'single' ? '한부모 가정입니다.' : life.siblings ? `위로 형제자매 ${life.siblings}명이 있습니다.` : '첫아이입니다.'} 가족은 ${life.region.ko}에서 살아갑니다. ${gpStory}`}</p>
          <p class="certpace">${L(
              `기대수명까지 살면 약 ${Math.round(e0 * YEAR_MS[APP.pace] / 60000)}분이 걸려요 (1년 ≈ ${Math.round(YEAR_MS[APP.pace] / 1000)}초). 사는 동안 일시정지와 배속이 되고, 중간에 닫아도 이 브라우저에 저장됩니다.`,
              `Living to life expectancy takes about ${Math.round(e0 * YEAR_MS[APP.pace] / 60000)} minutes (one year is about ${Math.round(YEAR_MS[APP.pace] / 1000)} seconds). You can pause and speed it up, and closing the tab keeps the life saved in this browser.`)}</p>
          <div class="fields">
            <div><span>${L('성별', 'Sex')}</span><b>${life.sex === 'f' ? L('여성', 'Female') : L('남성', 'Male')}</b></div>
            <div><span>${L('출생 지역', 'Province')}</span><b>${U.L(life.region)}</b></div>
            <div><span>${L('출생지', 'Born in')}</span><b>${U.L(life.district)} (${life.district.char === 'rural' ? L('농촌', 'rural') : L('도시', 'urban')})</b></div>
            <div><span>${L('가정 형편', 'Household')}</span><b>${clsName(life.cls)} ${CLASS_DOT[life.cls]}</b></div>
            <div><span>${L('부모 나이', 'Parents')}</span><b>${parentAge || '—'}</b></div>
            <div><span>${L('형제자매', 'Siblings')}</span><b>${life.siblings ? L(life.siblings + '명', String(life.siblings)) : L('없음', 'None')}</b></div>
            <div><span>${L('조부모', 'Grandparents')}</span><b>${gpLabel}</b></div>
            <div><span>${L('기대수명', 'Life expectancy')}</span><b>${L(e0 + '세', e0 + ' years')}</b></div>
            <div><span>${L('5세 전 사망 확률', 'Death before 5')}</span><b>${eraStats(life.birthYear).u5}</b></div>
            <div><span>${L('1인당 GDP(PPP)', 'GDP per person (PPP)')}</span><b>${eraStats(life.birthYear).gdp}</b></div>
          </div>
                    <figure class="certmap"><canvas id="certMap"></canvas>
            <figcaption>${L(`${life.region.ko} ${life.district.ko}는 여기에 있어요.`, `Here is ${life.district.en}, ${life.region.en}.`)}</figcaption></figure>
          <div class="odds-line">${en()
              ? `Among children born in ${life.district.en}, ${life.region.en} in ${life.birthYear}, about ${life.cls === 'high' ? 20 : life.cls === 'low' ? 30 : 40}% come from a ${life.cls === 'high' ? 'top-20%' : life.cls === 'low' ? 'bottom-30%' : 'middle'} household. You are one of the 254,341 children born in this country that year.`
              : `${life.birthYear}년 ${life.region.ko} ${life.district.ko}에서 태어난 아이 가운데 ${life.cls === 'high' ? '상위 20%' : life.cls === 'low' ? '하위 30%' : '중간 40%'} 가정 출신은 ${life.cls === 'high' ? '다섯 중 하나꼴' : life.cls === 'low' ? '셋 중 하나꼴' : '열에 넷꼴'}입니다. 같은 해 이 나라에서 태어난 아이 254,341명 중 한 명입니다.`}</div>
          <div class="certcomps"><span class="lbl">${L('같은 1초에 태어난 네 사람', 'Four people born the same second')}</span>
            <ul>${life.peers.map(p => `<li><b>${en() && p.nameEn ? p.nameEn : p.name}</b><span>${en() && p.regEn ? p.regEn : p.reg} · ${p.sex === 'f' ? L('여', 'F') : L('남', 'M')}</span></li>`).join('')}</ul>
          </div>
        </div>
        <div class="foot">
          <button class="ghost" id="shareBirthBtn">${L('출생 카드 공유', 'Share the birth card')}</button>
          <button class="cta" id="beginBtn">${L('삶을 시작하기', 'Begin this life')}</button>
        </div>
      </div>
    </div></div>`;
    drawCertMap($('#certMap'), life);
    $('#beginBtn').onclick = () => beginLife(false);
    $('#shareBirthBtn').onclick = () => openShare('birth', true);
  }

  /* ---------- 본 게임 ---------- */
  function beginLife(fromSave) {
    const life = APP.life;
    if (!fromSave) {
      life.feed = [];
      life.yearLog = [];
      life.history = life.history || [];
      life.ageFocusLog = life.ageFocusLog || [];
    }
    life.feed = life.feed || [];
    life.yearLog = life.yearLog || [];
    APP.playing = true; APP.speed = 1; APP.ff = false; APP.modal = null; APP.peek = false;
    APP.yearT = 0; APP.hold = 600; APP.queue = []; APP.qi = 0; APP.pendingDeath = null;
    go('life');
    renderLifeShell();
    if (fromSave && life.feed.length) renderFeedAll();
    if (!fromSave && !life.feed.length) {
      pushFeed(0, { ko: L(`${life.birthYear}년 ${life.region.ko} ${life.district.ko}의 ${CLASS_KO[life.cls]} 가정에서 태어났습니다.`,
                          `Born in ${U.L(life.district)}, ${U.L(life.region)} in ${life.birthYear}, into a ${clsName(life.cls)} household.`) }, 'note');
      pushFeed(0, { ko: L('같은 1초에 태어난 네 사람과 함께 이 세상에 나왔습니다.', 'You came into the world with four people born the same second.') });
    }
    APP.lastTs = 0;
    if (!APP.raf) APP.raf = requestAnimationFrame(loop);
    // 저장된 삶에 아직 답하지 않은 결정·회고가 있으면 그것부터 다시 띄운다
    if (fromSave && life.pendingDecision) {
      APP.playing = false; refreshControls(); showDecision(life.pendingDecision);
    } else if (fromSave && life.pendingReflection) {
      APP.playing = false; refreshControls(); showReflection(life.age);
    }
    save();
  }

  function renderLifeShell() {
    const el = $('#screen-life');
    el.innerHTML = `
    <header class="topbar"><div class="wrap">
      <div class="brand">${en() ? 'One in Fifty <em>Million</em>' : '5천만 분의 <em>1</em>'}</div>
      <div class="agebox">
        <div class="age" id="ageNum">0<small>${L('세', 'yrs')}</small></div>
        <div class="yr">
          <span class="t" id="ageYear">—</span>
          <div class="prog"><i id="prog"></i></div>
        </div>
      </div>
      <div class="speed">
        <button id="pauseBtn" aria-pressed="false">${L('❚❚ 멈춤', '❚❚ Pause')}</button>
        <span class="sps">${SPEEDS.map(s => `<button data-s="${s}" aria-pressed="${s === 1}">${s}×</button>`).join('')}</span>
        <button id="ffBtn" class="ff"><span class="fftx">${L('다음 결정까지', 'To the next decision')}</span><span class="ffsh">»</span></button>
        <button id="autoBtn" class="ff" aria-pressed="false"><span class="fftx">${L('자동 결정', 'Auto-decide')}</span><span class="ffsh">${L('자동', 'auto')}</span></button>
        <button id="moreBtn" class="ff morebtn" aria-label="${L('더 보기', 'More')}">⋯</button>
        <div id="moreMenu" class="more">
          <div class="mg"><button id="goFamily">${L('가족과 삶 보기', 'Family')}</button><button id="goStats">${L('상태 살펴보기', 'Your state')}</button></div>
          <div class="mg"><button id="autoHideBtn">${L('결정 창 숨기기', 'Hide decision cards')}</button></div>
          <div class="mg"><button id="quitBtn">${L('나가기 (저장)', 'Leave (saved)')}</button><button id="themeBtn2">${L('화면 밝기', 'Light or dark')}</button></div>
        </div>
      </div>
    </div></header>
    <div class="wrap life">
      <div class="col">
        <div class="panel idcard p-id" id="p-id">
          <div class="top"><span>${L('신원 기록 · KOR', 'IDENTITY · KOR')}</span><span id="idYear">—</span></div>
          <div class="in">
            <div class="portrait"><canvas id="avatar"></canvas></div>
            <div>
              <div class="nm" id="idName">—</div>
              <dl id="idDl"></dl>
            </div>
          </div>
          <div class="mrz" id="mrz">—</div>
        </div>
        <div class="panel p-stats" id="p-stats">
          <h3><span class="ttl">${L('상태', 'State')}</span><span class="lbl">0–100</span></h3>
          <div id="statRows"></div>
          <div class="statmini" id="statMini"></div>
          <div class="money" id="moneyBox"></div>
          <div class="spend" id="spendBox"></div>
          <button type="button" class="ghost wide expbtn" id="expToggle" aria-expanded="false">${L('연소득·연지출 내역', 'Income and spending')}</button>
          <div class="expdetail" id="expDetail" hidden></div>
          <button type="button" class="ghost wide" id="selfCareBtn">${L('내 건강 관리', 'Look after my health')}</button>
        </div>
        <div class="panel p-fam" id="p-fam">
          <h3><span class="ttl">${L('가족과 삶', 'Family and life')}</span><span class="lbl" id="famLbl"></span></h3>
          <div class="famlist" id="famList"></div>
          <button type="button" class="ghost wide" id="famMore">${L('가족 자세히 보기', 'The family, in detail')}</button>
        </div>
      </div>
      <div class="col">
        <div class="panel p-scene">
          <div class="scene"><canvas id="scene"></canvas></div>
          <p class="scenecap" id="sceneCap">—</p>
        </div>
        <div class="panel p-focus">
          <h3><span class="ttl">${L('올해의 초점', "This year's focus")}</span><span class="lbl" id="focusYear">—</span></h3>
          <p class="status" id="focusStatus">—</p>
          <div class="chips" id="focusChips"></div>
          <p class="fohint" id="focusHint">${L('결정을 맡긴 동안에는 한 해의 초점도 알아서 골라요. 칩을 누르면 그때부터는 직접 정해요.',
                                                'While decisions are automatic, the focus is picked for you too. Tap a chip and you are choosing again.')}</p>
          <div class="moneyrow" id="moneyRow"></div>
        </div>
        <div class="panel p-feed">
          <h3><span class="ttl">${L('인생 기록', 'Life record')}</span><span class="lbl">${L('최근 순', 'Newest first')}</span></h3>
          <ul class="feed" id="feed"></ul>
          <button type="button" class="ghost feedmore" id="feedMore">${L('이전 기록 더 보기', 'Earlier years')}</button>
        </div>
      </div>
      <div class="col col3">
        <div class="panel p-peers">
          <h3><span class="ttl">${L('같은 1초에 태어난 사람들', 'Born the same second')}</span><span class="lbl">${L('지금 나이', 'age now')}</span></h3>
          <ul class="peerlist" id="peerList"></ul>
        </div>
        <div class="panel p-grid">
          <h3><span class="ttl">${L('인생 지도', 'Life map')}</span><span class="lbl">${L('한 칸 = 1년', 'one cell, one year')}</span></h3>
          <div class="grid10" id="grid"></div>
          <div class="gridkey"><span><i style="background:var(--grid-lo)"></i>${L('덜 행복', 'less happy')}</span><span><i style="background:var(--grid-hi)"></i>${L('더 행복', 'happier')}</span><span><i style="background:var(--rule2);box-shadow:inset 0 0 0 1px var(--ink3)"></i>${L('기대수명', 'life expectancy')}</span></div>
        </div>
        <div class="panel stats p-chart">
          <h3><span class="ttl">${L('돈의 흐름', 'Money over a life')}</span><span class="lbl">${L('순자산(만 원)', 'net worth')}</span></h3>
          <div class="chartbox" id="chartBox"></div>
        </div>
      </div>
    </div>`;

    // 이벤트
    $('#pauseBtn').onclick = () => {
      // 결정을 내려 두고 화면만 보는 중이라면, 살기를 누를 때 결정 창을 다시 띄운다
      if (!APP.playing && APP.peekDec) { const d = APP.peekDec; APP.peekDec = null; const pk = $('#decpeek'); if (pk) pk.remove(); showDecision(d); return; }
      APP.playing = !APP.playing; paint(); refreshControls(); save();
    };
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const prev = yearMs();
      const p = Math.min(1, APP.yearT / (prev / 1000));
      APP.speed = +b.dataset.s;
      APP.yearT = p * (yearMs() / 1000);
      refreshControls(); paintTop(); paint();
    });
    $('#ffBtn').onclick = () => { APP.ff = !APP.ff; APP.playing = true; refreshControls(); paint(); if (APP.ff) U.toast(L('다음 결정까지 빠르게 넘깁니다', 'Skipping ahead to the next decision')); };
    $('#autoBtn').onclick = () => { APP.auto = !APP.auto; refreshControls(); U.toast(APP.auto ? L('결정을 맡깁니다 (6초 뒤 알아서 골라요)', 'Decisions are automatic from here (six seconds each)') : L('결정을 직접 고릅니다', 'You choose each decision yourself')); };
    $('#moreBtn').onclick = (e) => { e.stopPropagation(); $('#moreMenu').classList.toggle('open'); };
    document.addEventListener('click', (ev) => { const m = $('#moreMenu'); if (m && !ev.target.closest('#moreBtn')) m.classList.remove('open'); });
    $('#quitBtn').onclick = () => { save(); APP.playing = false; renderCover(); go('cover'); };
    $('#themeBtn2').onclick = toggleTheme;
    $('#autoHideBtn').onclick = () => setAutoHide(!APP.autoHide);
    paintAutoHide();
    $('#goFamily').onclick = () => { const p = $('#p-fam'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    $('#goStats').onclick = () => { const p = $('#p-stats'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const fm2 = $('#famMore'); if (fm2) fm2.onclick = openFamilySheet;
    const scb = $('#selfCareBtn'); if (scb) scb.onclick = openSelfCare;
    const et = $('#expToggle');
    if (et) et.onclick = () => {
      const box = $('#expDetail'); if (!box) return;
      box.hidden = !box.hidden;
      et.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
      renderExpenseDetail();
    };
    const fm = $('#feedMore');
    if (fm) fm.onclick = () => { const ul = $('#feed'); if (!ul) return; ul.classList.toggle('all'); updateFeedMore(); if (!ul.classList.contains('all')) ul.scrollTop = 0; };

    renderFocus(); renderPanels(); paintTop(); paint();
  }

  function refreshControls() {
    const p = $('#pauseBtn'); if (p) p.setAttribute('aria-pressed', !APP.playing);
    document.querySelectorAll('[data-s]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.s === APP.speed));
    const a = $('#autoBtn'); if (a) a.setAttribute('aria-pressed', APP.auto);
    const f = $('#ffBtn'); if (f) f.setAttribute('aria-pressed', APP.ff);
    const pz = $('#pauseBtn'); if (pz) pz.textContent = APP.playing ? L('❚❚ 멈춤', '❚❚ Pause') : L('▶ 살기', '▶ Live');
  }

  /* ---------- 상단·패널 ---------- */
  function paintTop() {
    const life = APP.life; if (!life) return;
    const an = $('#ageNum'); if (an) an.innerHTML = `${life.age}<small>${L('세', 'yrs')}</small>`;
    const ay = $('#ageYear');
    if (ay) ay.textContent = en()
      ? `${life.year} · ${life.name.en} · a year ≈ ${Math.round(yearMs() / 1000)}s`
      : `${life.year}년 · ${life.name.ko} · 1년 ≈ ${Math.round(yearMs() / 1000)}초`;
    const iy = $('#idYear'); if (iy) iy.textContent = String(life.year);
    const idn = $('#idName'); if (idn) idn.textContent = en() ? life.name.en : life.name.ko;
    const dl = $('#idDl');
    if (dl) dl.innerHTML = `
      <dt>${L('성별', 'Sex')}</dt><dd>${life.sex === 'f' ? L('여성', 'Female') : L('남성', 'Male')}</dd>
      <dt>${L('출생', 'Born')}</dt><dd>${U.L(life.region)} · ${L(life.birthYear + '년', String(life.birthYear))}</dd>
      <dt>${L('거주', 'Lives')}</dt><dd>${place(life.region, life.district)}</dd>
      <dt>${L('가정 형편', 'Household')}</dt><dd>${clsName(life.cls)}</dd>
      <dt>${L('학력', 'Education')}</dt><dd>${(life.major && life.major !== 'none') ? `${majorName(life.major)} · ${eduName(life.edu)}` : eduName(life.edu)}</dd>
      <dt>${L('일', 'Work')}</dt><dd>${life.flags.retired ? L('은퇴', 'Retired') : (life.role && life.role !== 'none' ? roleName(life.role) : jobName(life.job))}</dd>
      <dt>${L('집', 'Home')}</dt><dd>${homeName(life.home)}${life.flags.wagePeak && !life.flags.retired ? L(' · 임금피크', ' · wage peak') : ''}${life.flags.retired ? L(' · 은퇴', ' · retired') : ''}</dd>`;
    const mrz = $('#mrz');
    if (mrz) mrz.textContent = `I<KOR${life.name.en.replace(/ /g, '').toUpperCase()}<<${(en() ? life.region.en.replace(/\s+/g, '') : life.region.ko).toUpperCase()}<<<<<<<<<<<<<<<<<<<<<`;
    const cv = $('#avatar');
    if (cv && !cv._drawn) { window.SCENE.avatar(cv, life); cv._drawn = life.age; }
    else if (cv && cv._drawn !== life.age + life.cls) { window.SCENE.avatar(cv, life); cv._drawn = life.age + life.cls; }
  }

  function renderPanels() {
    const life = APP.life; if (!life) return;
    // 상태
    const rows = $('#statRows');
    if (rows) {
      const rowsL = [['health', '건강', 'Health'], ['happiness', '행복', 'Happiness'], ['spec', '역량', 'Skill'], ['relation', '관계', 'Bonds']];
      rows.innerHTML = rowsL.map(([k, ko, e]) => `
        <div class="statrow" data-k="${k}"><span class="sn">${L(ko, e)}</span>
          <span class="sb"><i style="width:${Math.round(life.stats[k])}%"></i></span>
          <span class="sv">${Math.round(life.stats[k])}</span></div>`).join('');
    }
    const mini = $('#statMini');
    if (mini) {
      const M = [['reputation', '평판', 'Reputation', '사회적 신뢰', 'how much others trust you'], ['stress', '스트레스', 'Stress', '낮을수록 좋아요', 'lower is better']];
      mini.innerHTML = M.map(([k, ko, e, koTip, enTip]) => `
        <div class="statrow mini" data-k="${k}" title="${L(koTip, enTip)}">
          <span class="sn">${L(ko, e)}</span>
          <span class="sb"><i style="width:${Math.round(life.stats[k] || 0)}%"></i></span>
          <span class="sv">${Math.round(life.stats[k] || 0)}</span></div>`).join('');
    }
    const money = $('#moneyBox');
    if (money) {
      const nw = E.netWorth(life);
      const inc = life.income || 0, exp = life.expenses || 0;
      money.innerHTML = `
        <div><small>${life.age < 19 ? L('가정 형편', 'Household') : L('순자산', 'Net worth')}</small><b>${life.age < 19 ? clsName(life.cls) : U.money(nw)}</b></div>
        <div><small>${L('올해 연소득', 'Income this year')}</small><b>${life.age < 19 ? '—' : (inc ? U.money(inc) : U.money(0))}</b></div>
        <div class="wide3"><small>${L('올해 연지출', 'Spending this year')}</small><b class="${exp > inc && inc > 0 ? 'over' : ''}">${life.age < 19 ? '—' : (exp ? U.money(exp) : U.money(0))}</b></div>`;
    }
    const spend = $('#spendBox');
    if (spend) {
      const inc = Math.max(1, life.income || 0), ex = Math.max(0, life.expenses || 0);
      if (life.age < 19 || !life.income) { spend.innerHTML = ''; }
      else {
        const use = Math.min(1, ex / Math.max(inc, ex, 1)), save = 1 - use;
        spend.innerHTML = `
        <div class="sbar"><i style="width:${(use * 100).toFixed(1)}%;background:var(--accent)"></i><i style="width:${(save * 100).toFixed(1)}%;background:var(--stamp)"></i></div>
        <div class="keys"><span style="--c:var(--accent)">${L('지출', 'spent')} ${Math.round(use * 100)}%</span><span style="--c:var(--stamp)">${L('남김', 'kept')} ${Math.round(save * 100)}%</span></div>`;
      }
    }
    renderExpenseDetail();
    // 가족
    const fam = $('#famList');
    if (fam) {
      const view = E.familyView(life);
      fam.innerHTML = view.length ? view.map(p => {
        const state = p.alive ? AGE(p.age) : L('고인', 'Died');
        return `<div class="famrow${p.alive ? '' : ' dead'}">
          <span class="fn">${U.esc(U.tr(p.role))}</span>
          <span class="fst">${state}</span>
          <span class="fbar" title="${L('나와의 관계', 'closeness to you')} ${p.relation}"><i style="width:${p.relation}%"></i></span>
          <span class="fmeta">${p.alive ? `${L('건강', 'health')} ${p.health} · ${U.esc(U.tr(p.job))}` : `${p.health < 100 ? L('생전 건강 ', 'health at the end ') + p.health : ''}`}</span>
        </div>`;
      }).join('') : `<p class="hint">${L('기록 없음', 'No record')}</p>`;
      const fl = $('#famLbl'); if (fl) fl.textContent = L(`${view.filter(p => p.alive).length}명`, `${view.filter(p => p.alive).length}`);
    }
    // 씬
    const sc = $('#scene');
    if (sc) { window.SCENE.draw(sc, life); }
    const cap = $('#sceneCap');
    if (cap) cap.textContent = window.SCENE.caption(life);
    // 피어
    const pl = $('#peerList');
    if (pl) {
      pl.innerHTML = life.peers.map(p => {
        const ms = p.milestones.filter(m => m.age <= life.age);
        const last = ms[ms.length - 1];
        const one = last ? String(U.L(last)).split('. ')[0] : '';
        return `<li title="${U.esc(one)}"><b>${en() && p.nameEn ? p.nameEn : p.name}</b><span class="pa">${p.alive === false ? '†' : AGE(life.age)}</span>
          <span class="pd">${en() && p.regEn ? p.regEn : p.reg} · ${p.sex === 'f' ? L('여', 'F') : L('남', 'M')}</span></li>`;
      }).join('');
    }
    // 지도
    const grid = $('#grid');
    if (grid) {
      // 100칸을 한 번만 만들고, 해마다 바뀐 칸만 갱신한다(스냅샷·리페인트 부담 줄임)
      if (grid.children.length !== 100) {
        grid.innerHTML = Array.from({ length: 100 }, () => '<div class="c"></div>').join('');
      }
      const hist = life.history || [];
      const e0 = lifeExpectancy(life);
      for (let a = 0; a < 100; a++) {
        const cell = grid.children[a]; if (!cell) continue;
        const h = hist.find(x => x.age === a);
        const hp = h ? h.happiness : null;
        cell.style.background = hp == null ? 'var(--rule2)'
          : hp >= 75 ? 'var(--grid-hi)' : hp >= 58 ? 'var(--grid-mid)' : hp >= 42 ? '#B9CFA8' : 'var(--grid-lo)';
        cell.className = 'c' + (a === life.age ? ' cur' : '') + (Math.abs(a - e0) < 1 ? ' le' : '');
        cell.title = AGE(a) + (h ? L(' · 행복 ', ' · happiness ') + h.happiness : '');
      }
    }
    // 그래프
    const cb = $('#chartBox');
    if (cb && window.CHARTS && window.CHARTS.wealth) cb.innerHTML = window.CHARTS.wealth(life);
  }

  const EXP_KO = { housing: '주거비', food: '식비', living: '생활·공과금', education: '교육·육아', care: '부양·간병', taxInterest: '세금·이자', leisure: '여가·문화', health: '의료·건강' };
  const EXP_EN = { housing: 'Housing', food: 'Food', living: 'Bills and daily costs', education: 'School and children', care: 'Dependants and nursing', taxInterest: 'Tax and interest', leisure: 'Leisure', health: 'Health care' };
  const expName = (k) => en() ? (EXP_EN[k] || k) : EXP_KO[k];
  function renderExpenseDetail() {
    const life = APP.life; if (!life) return;
    const box = $('#expDetail'); if (!box || box.hidden) return;
    const it = life.expenseItems || {};
    const inc = life.incomeItems || {};
    const totalE = Object.keys(EXP_KO).reduce((s, k) => s + (it[k] || 0), 0) || 1;
    const rows = Object.keys(EXP_KO).map(k => {
      const v = it[k] || 0; if (!v) return '';
      return `<li><span class="el">${expName(k)}</span><span class="eb"><i style="width:${Math.round(v / totalE * 100)}%"></i></span><span class="ev">${U.money(v)}</span></li>`;
    }).join('');
    const incRows = [[L('근로소득', 'Earned income'), inc.labor], [L('연금', 'Pension'), inc.pension], [L('이자·배당', 'Interest and dividends'), inc.asset], [L('기타', 'Other'), inc.other]]
      .filter(x => x[1]).map(([n, v]) => `<li><span class="el">${n}</span><span class="eb"></span><span class="ev">${U.money(v)}</span></li>`).join('');
    const sm = life.spendMode || {};
    const SM_LABEL = { food: '식비', living: '생활·공과금', leisure: '여가·문화', health: '의료·건강' };
    const SM_EN = { food: 'Food', living: 'Bills', leisure: 'Leisure', health: 'Health care' };
    const SM_VAL = { save: '절약', normal: '균형', generous: '여유' };
    const SM_VAL_EN = { save: 'Frugal', normal: 'Balanced', generous: 'Generous' };
    const smName = (k) => en() ? (SM_EN[k] || k) : SM_LABEL[k];
    const smVal = (v) => en() ? (SM_VAL_EN[v] || v) : SM_VAL[v];
    const smRows = Object.keys(SM_LABEL).map(k => `
      <div class="smrow"><span class="sml">${smName(k)}</span>
        <span class="smseg">${['save', 'normal', 'generous'].map(v =>
          `<button type="button" data-sm="${k}" data-sv="${v}" aria-pressed="${(sm[k] || 'normal') === v}">${smVal(v)}</button>`).join('')}</span>
      </div>`).join('');
    box.innerHTML = `<div class="exh">${L('올해 연소득', 'Income this year')} <b>${U.money(life.income || 0)}</b></div>
      <ul class="exl">${incRows || `<li><span class="el">${L('소득 없음', 'No income')}</span><span class="eb"></span><span class="ev">—</span></li>`}</ul>
      <div class="exh">${L('올해 연지출', 'Spending this year')} <b>${U.money(life.expenses || 0)}</b></div>
      <ul class="exl">${rows || `<li><span class="el">${L('지출 없음', 'No spending')}</span><span class="eb"></span><span class="ev">—</span></li>`}</ul>
      <div class="exh">${L('생활비 모드', 'Spending style')} <b>${L(U.money((life.income || 0) - (life.expenses || 0)) + ' 남김', U.money((life.income || 0) - (life.expenses || 0)) + ' kept')}</b></div>
      <div class="spendmode">${smRows}</div>
      <p class="exn">${L('절약하면 지출이 줄고 남는 돈이 늘지만 식사·여가의 질이 떨어집니다. 여유를 고르면 몸과 마음이 편해지는 대신 저축이 줄어듭니다.',
                            'Frugal trims the bills and leaves more behind, at the cost of plainer meals and fewer evenings out. Generous is easier on the body and mind and harder on savings.')}
      ${life.flags.retired ? L(' 은퇴 뒤에는 근로소득이 0원이고 연금·이자만 남습니다.', ' After retirement there is no earned income, only pension and interest.') : life.flags.wagePeak ? L(' 임금피크제 기간에는 급여가 해마다 줄어듭니다.', ' On a wage-peak contract the salary falls every year.') : ''} ${L('모든 금액은 그해 기준 명목값입니다.', 'All amounts are nominal, as they stood that year.')}</p>`;
    box.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => {
      E.setSpend(life, b.dataset.sm, b.dataset.sv);
      U.toast(`${smName(b.dataset.sm)} ${smVal(b.dataset.sv)} · ${L('연지출', 'spending')} ${U.money(life.expenses)}`);
      renderPanels(); renderFocus(); save();
    });
  }

  function openFamilySheet() {
    const life = APP.life; if (!life) return;
    const view = E.familyView(life);
    APP.playing = false; refreshControls();
    const bar = (v, cls) => `<span class="fsbar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>`;
    const cards = view.map(p => `
      <div class="fcard${p.alive ? '' : ' dead'}">
        <div class="fch"><span class="fr">${U.esc(U.tr(p.role))}</span><b>${U.esc(p.nameEn && en() ? p.nameEn : U.tr(p.name))}</b>
          <span class="fstate">${p.alive ? L('생존', 'Alive') : L('고인', 'Deceased')}</span></div>
        <dl>
          <dt>${L('나이', 'Age')}</dt><dd>${p.alive ? AGE(p.age) : '—'}</dd>
          <dt>${L('직업', 'Work')}</dt><dd>${p.alive ? U.esc(U.tr(p.job)) : '—'}</dd>
          <dt>${L('건강', 'Health')}</dt><dd>${bar(p.health)}<span class="fv">${p.alive ? p.health : '—'}</span></dd>
          <dt>${L('나와의 관계', 'Closeness to you')}</dt><dd>${bar(p.relation, 'rel')}<span class="fv">${p.relation}</span></dd>
        </dl>
      </div>`).join('');
    openModal(`
      <div class="dec-top"><span class="lbl">${L('가족과 삶', 'Family and life')}</span><span class="dec-meta">${L(life.age + '세', 'age ' + life.age)} · ${L(life.year + '년', life.year)}</span></div>
      <h2>${L('가족의 지금', 'The family now')}</h2>
      <p class="dec-b">${L('부모·배우자·자녀의 생사와 건강, 나와의 관계를 한자리에 모았습니다. 사람이 떠나면 그 자리는 바로 비워집니다.',
                            'Your parents, your spouse and your children, their health and how close they are to you, all in one place. When someone goes, the place they held empties at once.')}</p>
      <div class="fgrid">${cards || `<p class="hint">${L('기록된 가족이 없습니다.', 'No family on record.')}</p>`}</div>
      <p class="hint">${L('관계 막대는 0–100입니다. 건강이 낮아지면 간병비가 늘고, 관계가 낮으면 정서 지표가 떨어집니다.',
                            'The closeness bar runs from 0 to 100. Poor health brings nursing costs; a distant relationship pulls your own mood down.')}</p>
      ${careBlock(life)}
      <div class="dec-foot"><button class="cta sm" id="famClose">${L('닫고 이어 살기', 'Close and live on')}</button></div>`, { kind: 'family' });
    $('#famClose').onclick = () => { closeModal(); APP.playing = true; refreshControls(); };
    bindCare(life, () => { openFamilySheet(); });
  }

  /* ---------- 직접 관리 ---------- */
  const CARE_HINT = {
    checkup: '부모님 두 분의 건강을 크게 올립니다(70만).', tonic: '부모님 건강을 조금 올리고 관계도 좋아집니다(35만).',
    meal: '가족과 한 끼. 관계와 기분이 오릅니다(30만).', trip: '가족 여행. 관계가 크게 오르고 스트레스가 풀립니다(220만).',
    spouse: '배우자와 시간을 냅니다. 관계와 기분이 오릅니다(25만).', child: '자녀와 시간을 냅니다. 관계와 기분이 오릅니다(40만).',
    grand: '조부모를 찾아뵙고 안부를 묻습니다(25만).'
  };
  const CARE_EN = {
    checkup: 'A full check-up lifts both your parents’ health (₩700k).', tonic: 'Tonics for your parents: some health, and a warmer relationship (₩350k).',
    meal: 'One meal together. Closeness and mood rise (₩300k).', trip: 'A family trip. Closeness rises sharply and stress drains away (₩2.2M).',
    spouse: 'An evening set aside for your spouse. Closeness and mood rise (₩250k).', child: 'Time set aside for your child. Closeness and mood rise (₩400k).',
    grand: 'You visit your grandparents and ask how they are (₩250k).'
  };
  const careHint = (k) => en() ? (CARE_EN[k] || '') : (CARE_HINT[k] || '');
  const SELF_HINT = { exercise: '몸을 만들고 스트레스를 풉니다', checkup: '이상 신호를 미리 잡습니다', rest: '잠과 쉼으로 회복합니다', supplement: '꾸준한 보충', dental: '치아와 잇몸' };
  const SELF_EN = { exercise: 'You build the body and burn off stress', checkup: 'Catches the warning signs early', rest: 'Recovery through sleep and rest', supplement: 'Something taken steadily', dental: 'Teeth and gums' };
  const selfHint = (k) => en() ? (SELF_EN[k] || '') : (SELF_HINT[k] || '');

  function careBlock(life) {
    const used = life.careUsed || {};
    const av = (k) => used[k] === life.age;
    const row = (k) => {
      const d = E.FAMILY_CARE[k];
      if (!d) return '';
      if (k === 'spouse' && !(life.family.spouse && life.family.spouse.alive)) return '';
      if (k === 'child' && !(life.flags.childrenCount > 0)) return '';
      if ((k === 'checkup' || k === 'tonic') && !(life.flags.fatherAlive || life.flags.motherAlive)) return '';
      if (k === 'grand' && !(life.flags.gmaAlive || life.flags.gpaAlive)) return '';
      return `<button type="button" class="careb" data-care="${k}" ${av(k) ? 'disabled' : ''}>
        <span class="cb-t">${U.tr(d.label)}</span>
        <span class="cb-c">${av(k) ? L('올해 완료', 'Done this year') : U.money(d.cost)}</span>
        <span class="cb-n">${careHint(k)}</span></button>`;
    };
    const html = ['checkup', 'tonic', 'meal', 'trip', 'spouse', 'child', 'grand'].map(row).join('');
    return `<div class="carebox"><h3 class="careh">${L('가족 돌보기', 'Looking after family')} <span class="lbl">${L('돈을 써서 지금 올립니다', 'money spent now, to lift things now')}</span></h3>
      <div class="caregrid">${html || `<p class="hint">${L('지금 돌볼 가족이 없습니다.', 'There is no one to look after right now.')}</p>`}</div></div>`;
  }

  function bindCare(life, after) {
    document.querySelectorAll('[data-care]').forEach(b => b.onclick = () => {
      const r = E.careAction(life, b.dataset.care);
      U.toast(r.ok ? `${U.tr(r.label)} · ${U.money(r.cost)}` : U.tr(r.why || '지금은 할 수 없습니다'));
      if (r.ok) { renderPanels(); save(); }
      if (after) after();
    });
  }

  function openSelfCare() {
    const life = APP.life; if (!life) return;
    APP.playing = false; refreshControls();
    const used = life.careUsed || {};
    const rows = Object.keys(E.SELF_CARE).map(k => {
      const d = E.SELF_CARE[k];
      const done = used[k] === life.age;
      const eff = Object.entries(d.st).map(([s, v]) => `${({ health: '건강', happiness: '행복', stress: '스트레스' })[s] || s} ${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`).join(' · ');
      const effEn = Object.entries(d.st).map(([s, v]) => `${({ health: 'health', happiness: 'happiness', stress: 'stress' })[s] || s} ${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`).join(' · ');
      return `<button type="button" class="careb" data-self="${k}" ${done ? 'disabled' : ''}>
        <span class="cb-t">${U.tr(d.label)}</span><span class="cb-c">${done ? L('올해 완료', 'Done this year') : U.money(d.cost)}</span>
        <span class="cb-n">${selfHint(k)} · ${en() ? effEn : eff}</span></button>`;
    }).join('');
    openModal(`
      <div class="dec-top"><span class="lbl">${L('내 건강 관리', 'My health')}</span><span class="dec-meta">${L(life.age + '세', 'age ' + life.age)} · ${L(life.year + '년', life.year)}</span></div>
      <h2>${L('돈을 써서 몸을 돌본다', 'Spending money on the body')}</h2>
      <p class="dec-b">${L('건강은 세월이 지나며 조금씩 줄어듭니다. 지금 돈과 시간을 들이면 그 속도를 늦출 수 있습니다. 한 해에 같은 항목은 한 번씩만 할 수 있습니다.',
                            'Health thins out with the years. Money and time spent now can slow that. Each item can be bought once a year.')}</p>
      <div class="caregrid">${rows}</div>
      <p class="hint">${L(`현재 건강 ${Math.round(life.stats.health)} · 스트레스 ${Math.round(life.stats.stress)} · 쓸 수 있는 돈 ${U.money((life.cash || 0) + (life.assets || 0))}`,
                            `Health ${Math.round(life.stats.health)} · stress ${Math.round(life.stats.stress)} · money available ${U.money((life.cash || 0) + (life.assets || 0))}`)}</p>
      <div class="dec-foot"><button class="cta sm" id="selfClose">${L('닫고 이어 살기', 'Close and live on')}</button></div>`, { kind: 'selfcare' });
    document.querySelectorAll('[data-self]').forEach(b => b.onclick = () => {
      const r = E.careAction(life, b.dataset.self);
      U.toast(r.ok ? `${U.tr(r.label)} · ${U.money(r.cost)}` : U.tr(r.why || '지금은 할 수 없습니다'));
      if (r.ok) { renderPanels(); save(); }
      openSelfCare();
    });
    $('#selfClose').onclick = () => { closeModal(); APP.playing = true; refreshControls(); };
  }

  function renderFocus() {
    const life = APP.life; if (!life) return;
    const fy = $('#focusYear'); if (fy) fy.textContent = YEARN(life.year);
    const st = $('#focusStatus');
    const eff = (k) => focusName(FOCUS.find(f => f[0] === k) || FOCUS[0]);
    if (st) st.innerHTML = life.age < 6
      ? L('이 나이에는 부모의 선택으로 살아갑니다. 한 해 한 해가 몸과 마음의 바탕이 됩니다.',
          'At this age you live by your parents’ choices. Year by year, the body and the mind are being laid down.')
      : L(`지금은 <b>${eff(life.focus)}</b> 쪽으로 시간을 씁니다. 올해 무엇에 마음을 둘까요?`,
          `Your time is going to <b>${eff(life.focus)}</b> at the moment. What will you put your mind to this year?`);
    const chips = $('#focusChips');
    if (chips) {
      chips.innerHTML = focusList(life.age).map((f) =>
        `<button class="chip" data-f="${f[0]}" aria-pressed="${life.focus === f[0]}">${focusName(f)}<small>${focusEff(f)}</small></button>`).join('');
      chips.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        life.focus = b.dataset.f; renderFocus(); U.toast(L('올해의 초점: ', 'This year: ') + eff(life.focus));
      });
    }
    const mr = $('#moneyRow');
    if (mr) {
      const price = E.homePrice(life);
      const has = life.home === 'own';
      mr.innerHTML = ALLOC.map((a) => `<button class="chip" data-a="${a[0]}" aria-pressed="${life.alloc === a[0]}">${allocName(a)}</button>`).join('')
        + `<button class="chip" data-home="${has ? 'sell' : 'buy'}">${has ? L('집 팔기', 'Sell the home') : L(`집 사기 · ${U.money(price)}`, `Buy a home · ${U.money(price)}`)}</button>`;
      mr.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { life.alloc = b.dataset.a; renderFocus(); U.toast(L(`돈을 ${b.textContent}에 둡니다`, `Money goes into ${b.textContent.toLowerCase()}`)); });
      mr.querySelectorAll('[data-home]').forEach(b => b.onclick = () => {
        if (b.dataset.home === 'buy') {
          const r = E.buyHome(life);
          U.toast(r.ok ? L(`집을 샀습니다 · ${U.money(r.price)}`, `You bought a home · ${U.money(r.price)}`) : L(`아직 ${U.money(r.need)}이 모자랍니다`, `You are ${U.money(r.need)} short`));
        } else { const r = E.sellHome(life); if (r.ok) U.toast(L(`집을 팔았습니다 · ${U.money(r.price)}`, `You sold the home · ${U.money(r.price)}`)); }
        renderPanels(); renderFocus();
      });
    }
  }

  /* ---------- 피드 ---------- */
  // 원작은 피드를 최근 것이 위로 오게 쌓고, 사건 본문 서사를 그대로 보여준다.
  // 자료 줄은 바로 앞 줄과 같은 출처일 때는 되풀이하지 않는다.
  const GLOSS = (C.glossary || []).filter(g => g.ko && g.ko.length >= 2).slice().sort((a, b) => b.ko.length - a.ko.length);
  const GL_MAP = {};
  GLOSS.forEach(g => { GL_MAP[g.ko] = g; });

  function glossify(text) {
    const s = String(text == null ? '' : text);
    const used = {};
    let out = '';
    for (let i = 0; i < s.length;) {
      let hit = null;
      const prevCh = i > 0 ? s[i - 1] : '';
      const hangul = (ch) => ch && /[\uac00-\ud7a3]/.test(ch);
      for (const g of GLOSS) {
        if (used[g.ko]) continue;
        if (!s.startsWith(g.ko, i)) continue;
        // 낱말 경계를 지킨다('여수시' 안의 '수시'를 주석으로 만들지 않는다)
        if (hangul(prevCh) && hangul(g.ko[0])) continue;
        const after = s[i + g.ko.length] || '';
        if (hangul(g.ko[g.ko.length - 1]) && hangul(after)) continue;
        hit = g; break;
      }
      if (hit) {
        used[hit.ko] = 1;
        out += `<button type="button" class="gl" data-gl="${U.esc(hit.ko)}">${U.esc(hit.ko)}</button>`;
        i += hit.ko.length;
      } else { out += U.esc(s[i]); i++; }
    }
    return out;
  }

  function closeGloss() {
    const p = $('#glpop'); if (p) p.remove();
  }
  function showGloss(btn) {
    const g = GL_MAP[btn.dataset.gl]; if (!g) return;
    closeGloss();
    const pop = document.createElement('div');
    pop.id = 'glpop';
    pop.innerHTML = en()
      ? `<b>${U.esc(g.en || g.ko)} · Korean culture note</b>${U.esc(g.defEn || '')}`
      : `<b>${U.esc(g.ko)} 한국 문화 노트</b>${U.esc(g.defKo || '')}`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(Math.max(10, r.left), window.innerWidth - w - 10);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.gl');
    if (b) { e.preventDefault(); e.stopPropagation(); showGloss(b); return; }
    if (!e.target.closest || !e.target.closest('#glpop')) closeGloss();
  });

  function feedItemInner(f) {
    if (f.title && f.body) return `<span class="tt">${U.esc(f.title)}</span><span class="bd">${glossify(f.body)}</span>`;
    return glossify(f.body || f.text || '');
  }
  function feedRows(list) {
    let prevSrc = null;
    return (list || []).map(f => {
      const showSrc = f.src && f.src !== prevSrc;
      prevSrc = f.src || null;
      return `<li class="${f.kind || ''} ev" data-src="${U.esc(f.src || '')}"><span class="a">${AGE(f.age)}</span><span class="x">${feedItemInner(f)}${showSrc ? `<span class="f">${U.esc(f.src)}</span>` : ''}</span></li>`;
    }).join('');
  }
  // 예전 저장본(제목만 있던 피드)을 본문 서사까지 채워 되살린다
  function migrateFeed(list) {
    (list || []).forEach(f => {
      if (f.title != null) return;
      const t = f.text || '';
      f.title = f.kind ? '' : t;
      f.body = f.kind ? t : '';
      if (!f.kind) {
        const ev = C.events.find(e => U.L(e.t) === t);
        if (ev) f.body = U.L(ev.b);
      }
    });
  }

  function updateFeedMore() {
    const ul = $('#feed'), btn = $('#feedMore');
    if (!ul || !btn) return;
    const n = ul.children.length;
    btn.hidden = n < 7;
    btn.textContent = ul.classList.contains('all') ? L('최근 것만 보기', 'Newest only') : L(`이전 기록 더 보기 (${n}건)`, `Earlier years (${n})`);
  }

  function pushFeed(age, ev, kind) {
    const life = APP.life; if (!life) return;
    const src = ev && ev.src && C.sources[ev.src] ? C.sources[ev.src] : null;
    const title = ev && ev.t ? U.L(ev.t) : '';
    const body = ev && ev.b ? U.L(ev.b) : '';
    const item = {
      age, kind: kind || '',
      title, body,
      text: title || (ev && ev.ko) || '',
      src: src ? (en() ? `${src.en || src.ko} · ${U.L(src.fig)}` : `${src.ko} · ${U.L(src.fig)}`) : null
    };
    if (!title && !body && ev && ev.ko) item.body = ev.ko;
    const prevItem = life.feed[life.feed.length - 1];
    life.feed.push(item);
    if (life.feed.length > 400) life.feed.shift();
    const ul = $('#feed'); if (!ul) return;
    const li = document.createElement('li');
    li.className = (item.kind ? item.kind + ' ' : '') + 'ev enter';
    // 바로 위(더 최근) 줄과 같은 출처면 자료 줄을 되풀이하지 않는다
    const topSrc = (ul.firstElementChild && ul.firstElementChild.getAttribute('data-src')) || (prevItem && prevItem.src) || '';
    const showSrc = item.src && item.src !== topSrc;
    li.setAttribute('data-src', item.src || '');
    li.innerHTML = `<span class="a">${AGE(item.age)}</span><span class="x">${feedItemInner(item)}${showSrc ? `<span class="f">${U.esc(item.src)}</span>` : ''}</span>`;
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 240) ul.removeChild(ul.lastElementChild);
    updateFeedMore();
  }

  function renderFeedAll() {
    const ul = $('#feed'); if (!ul) return;
    migrateFeed(APP.life.feed);
    const list = (APP.life.feed || []).slice(-240).reverse();
    ul.innerHTML = feedRows(list);
    ul.scrollTop = 0;
    updateFeedMore();
  }

  /* ---------- 시계 ---------- */
  function loop(ts) {
    APP.raf = requestAnimationFrame(loop);
    if (APP.screen !== 'life' || !APP.life) { APP.lastTs = ts; return; }
    const dt = APP.lastTs ? Math.min(ts - APP.lastTs, 300) : 0;
    APP.lastTs = ts;
    if (!APP.playing || APP.modal) { paint(); return; }
    if (APP.hold > 0) { APP.hold = Math.max(0, APP.hold - dt); paint(); return; }
    const dur = yearMs();
    APP.yearT += APP.ff ? Math.max(dt, dur / 24) : dt;
    const p = Math.min(1, APP.yearT / dur);
    // 그 해의 사건을 시각에 맞춰 하나씩 드러낸다
    if (APP.queue.length && APP.qi < APP.queue.length) {
      const q = APP.queue[APP.qi];
      if (p >= q.at) { pushFeed(APP.life.age, q.ev, q.kind); APP.qi++; }
    }
    if (p >= 1) { endYear(); return; }
    paint();
  }

  function endYear() {
    const life = APP.life;
    APP.yearT = 0;
    const res = E.tick(life);
    APP.queue = []; APP.qi = 0;
    const evs = (res.events || []).slice();
    evs.forEach((ev, i) => {
      APP.queue.push({ at: 0.12 + i * 0.3, ev, kind: (ev.st && (ev.st.happiness || 0) < 0) ? 'bad' : '' });
    });
    life.yearLog.push({ age: life.age, year: life.year, events: evs });
    // 아무 사건도 없는 해는 조용한 문장 하나로 남긴다(원작의 조용한 해)
    if (!evs.length && C.quiet && C.quiet.length) {
      APP.queue.push({ at: 0.35, ev: { ko: U.L(C.quiet[(life.seed + life.age * 7) % C.quiet.length]) }, kind: 'note' });
    }
    paintTop(); renderPanels(); renderFocus();
    if (res.death) { APP.pendingDeath = res.death; die(); return; }
    if (res.decision) {
      // 결정 창 숨기기를 켜 두면 창 없이 알아서 고르고, 고른 일은 인생 기록에 남긴다
      if (APP.autoHide) { commitChoice(res.decision, autoPick(res.decision)); paint(); return; }
      APP.playing = false; refreshControls(); showDecision(res.decision); return;
    }
    if (res.reflection) { APP.playing = false; refreshControls(); showReflection(res.reflection); return; }
    if (life.history.length % 5 === 0) save();
    paint();
  }

  function paint() {
    const life = APP.life; if (!life) return;
    const bar = $('#prog');
    if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, APP.yearT / yearMs())).toFixed(4)})`;
  }

  /* ---------- 모달 ---------- */
  function openModal(html, opts) {
    closeModal();
    APP.modal = opts || {}; APP.modal.kind = (opts && opts.kind) || 'modal';
    const root = $('#modalroot');
    root.innerHTML = `<div class="scrim" id="modal"><div class="dec" id="decCard">${html}</div></div>`;
    APP.modalOpen = true;
    return $('#decCard');
  }
  function closeModal() {
    const root = $('#modalroot');
    if (root) root.innerHTML = '';
    APP.modal = null; APP.modalOpen = false;
    const peek = $('#decpeek'); if (peek) peek.remove();
  }

  function deltaText(ch, age) {
    const out = [];
    [['health', '건강', 'Health'], ['happiness', '행복', 'Happiness'], ['relation', '관계', 'Bonds'], ['reputation', '평판', 'Reputation'], ['stress', '스트레스', 'Stress']].forEach(([k, ko, e]) => {
      const v = ch.st && ch.st[k]; if (!v) return;
      out.push(`${L(ko, e)} ${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`);
    });
    const ab = ((ch.st && ch.st.spec) || 0) + ((ch.st && ch.st.knowledge) || 0);
    if (ab) out.push(`${L('역량', 'Skill')} ${ab > 0 ? '+' : ''}${Math.round(ab * 10) / 10}`);
    if (ch.money && age >= 19) out.push(U.money(ch.money));
    if (ch.inc) out.push(`${L('소득', 'Income')} ${ch.inc > 0 ? '+' : ''}${Math.round(ch.inc * 100)}%`);
    if (ch.set && ch.set.job && ch.set.job !== 'none') out.push(jobName(ch.set.job));
    if (ch.set && ch.set.home) out.push(homeName(ch.set.home));
    return out.filter(Boolean).join(' · ');
  }

  const TAG_FOCUS = { work: 'career', love: 'family', health: 'health', study: 'edu', money: 'money', balance: '' };
  function autoPick(dec) {
    const want = TAG_FOCUS[APP.life.focus] || '';
    let best = 0, bestScore = -1e9;
    dec.ch.forEach((c, i) => {
      if (!E.choiceAvailable(APP.life, c).ok) return;
      const st = c.st || {};
      let sc = (st.health || 0) * 0.25 + (st.happiness || 0) * 0.45 + (st.knowledge || 0) * 0.15 + (st.relation || 0) * 0.15
             + (st.spec || 0) * 0.2 - (st.stress || 0) * 0.15;
      if (want && c.tag === want) sc += 2.5;
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    return best;
  }

  function commitChoice(dec, i) {
    const life = APP.life, ch = dec.ch[i];
    if (!ch) return;
    E.applyChoice(life, dec, ch);
    pushFeed(dec.age, { ko: L(`${U.L(dec.t)} · 결정: ${U.L(ch.t)}`, `${dec.t.en || dec.t.ko} · decision: ${ch.t.en || ch.t.ko}`) }, 'dec');
    if (APP.decTimer) { clearInterval(APP.decTimer); APP.decTimer = null; }
    APP.peekDec = null;
    life.pendingDecision = null;
    APP.playing = true; APP.hold = 620; refreshControls();
    renderPanels(); renderFocus(); paintTop(); save();
  }

  function paintAutoHide() {
    const b = $('#autoHideBtn');
    if (b) b.textContent = APP.autoHide ? L('결정 창 다시 보기', 'Show decision cards again') : L('결정 창 숨기기', 'Hide decision cards');
  }
  function setAutoHide(on) {
    APP.autoHide = !!on;
    try { localStorage.setItem('oifm2_autohide', APP.autoHide ? '1' : '0'); } catch (e) {}
    paintAutoHide();
    U.toast(APP.autoHide ? L('이제 결정 창 없이 알아서 고르고, 고른 일은 기록에 남겨요', 'From now on decisions are made without a card, and each one still goes into the record') : L('결정이 오면 창을 띄웁니다', 'A card will appear whenever a decision comes'));
  }

  function showDecision(dec) {
    const life = APP.life;
    const src = dec.src && C.sources[dec.src] ? C.sources[dec.src] : null;
    const card = openModal(`
      <div class="decbar" id="decbar"></div>
      <div class="dec-top"><span class="lbl">${U.L(dec.badge)}</span>
        <span class="dec-meta">${L(dec.age + '세', 'age ' + dec.age)} · ${L(life.year + '년', life.year)}</span>
        <button class="dec-min" id="decMin">${L('잠깐 내려 두기 ▾', 'Set it aside ▾')}</button></div>
      <h2>${U.L(dec.t)}</h2>
      <p class="dec-b">${U.L(dec.b)}</p>
      ${src ? `<p class="dec-note"><b>${L('자료', 'Source')}</b> ${en() && src.en ? src.en : src.ko} · ${U.L(src.fig)}</p>` : ''}
      <div class="opts">${dec.ch.map((c, i) => {
        const av = E.choiceAvailable(life, c);
        return `
        <button class="opt${av.ok ? '' : ' locked'}" data-ch="${i}" aria-pressed="${APP.auto && i === 0}" ${av.ok ? '' : 'disabled'}>
          <i>${i + 1}</i><span class="ot">${U.L(c.t)}</span>
          <span class="oe">${deltaText(c, dec.age)}</span>
          ${av.ok ? (c.n && U.L(c.n) ? `<span class="on">${U.L(c.n)}</span>` : '') : `<span class="on lockednote">${U.tr(av.why || '지금은 고를 수 없습니다')}</span>`}
        </button>`; }).join('')}</div>
      <p class="dec-count" id="decCount">${APP.auto ? L('잠시 후 알아서 고릅니다 · 카드를 누르면 멈춰요', 'It will choose in a moment · tap a card to stop it') : L('고르면 이 해가 이어집니다', 'Choose, and the year goes on')}</p>
      <div class="dec-foot">
        <button class="ghost" id="autoOff">${APP.auto ? L('자동 결정 끄기', 'Turn auto-decide off') : L('자동 결정 켜기', 'Turn auto-decide on')}</button>
        <button class="ghost" id="decSkip">${L('결정 창 숨기기', 'Hide decision cards')}</button>
      </div>`);

    const choose = (i) => {
      closeModal();
      commitChoice(dec, i);
    };
    card.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { if (b.disabled) return; choose(+b.dataset.ch); });
    $('#decMin').onclick = () => {
      const t = U.L(dec.t);
      closeModal();
      // 결정을 내릴 때까지 해는 거기서 멈춰 둔다(뒤 화면만 잠깐 볼 수 있게)
      APP.playing = false; APP.hold = 0; refreshControls();
      const peek = document.createElement('div');
      peek.className = 'decpeek'; peek.id = 'decpeek';
      peek.innerHTML = `<span class="dp-t"><b>${t}</b><small>${L(`${dec.age}세 · ${life.year}년 · 결정을 기다립니다`, `age ${dec.age} · ${life.year} · waiting on a decision`)}</small></span>
        <button class="cta" id="decOpen">${L('결정하기', 'Decide')}</button>`;
      document.body.appendChild(peek);
      APP.peekDec = dec;
      $('#decOpen').onclick = () => { APP.peekDec = null; peek.remove(); APP.playing = false; showDecision(dec); };
      life.__dec = dec;
    };
    $('#autoOff').onclick = () => { APP.auto = !APP.auto; refreshControls(); closeModal(); APP.playing = false; showDecision(dec); };
    $('#decSkip').onclick = () => {
      setAutoHide(true);
      choose(autoPick(dec));
    };
    // 자동 결정 카운트다운: 보통 6초, 8× 이상 배속에서는 2.2초(빨리 넘길 때 기다리지 않게)
    const waitMs = APP.speed >= 8 ? 2200 : 6000;
    let left = waitMs;
    const bar = $('#decbar'), cnt = $('#decCount');
    if (APP.auto) {
      APP.decTimer = setInterval(() => {
        left -= 100;
        if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - left / waitMs).toFixed(3)})`;
        if (cnt) cnt.innerHTML = L(`${Math.ceil(left / 1000)}초 뒤 알아서 고릅니다 · <b>카드를 누르면 멈춰요</b>`, `It will choose in ${Math.ceil(left / 1000)}s · <b>tap a card to stop it</b>`);
        if (left <= 0) {
          clearInterval(APP.decTimer); APP.decTimer = null;
          choose(autoPick(dec));
        }
      }, 100);
    }
  }

  function showReflection(age) {
    const life = APP.life;
    openModal(`
      <div class="dec-top"><span class="lbl">${L('돌아보기', 'A pause')}</span><span class="dec-meta">${L(age + '세', 'age ' + age)} · ${L(life.year + '년', life.year)}</span></div>
      <h2>${L(`${age}살, 잠깐 멈춰 앉아`, `At ${age} a chair is pulled out`) }</h2>
      <p class="dec-b">${L(
          age === 5 ? '다섯 살. 놀이와 식탁과 잠자리가 이 사람의 바탕을 만듭니다. 지금 무엇이 가장 기억에 남나요?' : age === 30 ? '서른. 일과 사랑과 돈이 서로 자리를 다투는 때입니다. 무엇을 남기고 무엇을 접었나요?' : age === 50 ? '쉰. 몸이 먼저 다른 이야기를 시작합니다. 지금 곁에 무엇이 있나요?' : '일흔. 남은 시간의 무게가 달라집니다. 무엇을 붙잡고 있나요?',
          age === 5 ? 'Five. Play, the table, the bed you sleep in: this is what a person is built from. What do you remember most?' : age === 30 ? 'Thirty. Work, love and money are all fighting for the same room. What did you keep, and what did you put down?' : age === 50 ? 'Fifty. The body starts a different conversation first. What is beside you now?' : 'Seventy. The time that is left weighs differently. What are you still holding on to?')}</p>
      <div class="reflect">
        <textarea id="reflText" placeholder="${L('한 줄이면 충분해요.', 'One line is enough.')}"></textarea>
        <div class="qs"><button data-q="${L('지금 가장 고마운 사람은?', 'Who are you most grateful to right now?')}">${L('지금 가장 고마운 사람은?', 'Who are you most grateful to?')}</button>
          <button data-q="${L('이 나이에 가장 잘한 선택은?', 'What is the best choice you made at this age?')}">${L('가장 잘한 선택은?', 'The best choice you made?')}</button>
          <button data-q="${L('지키고 싶은 것은?', 'What do you want to keep?')}">${L('지키고 싶은 것은?', 'What do you want to keep?')}</button></div>
      </div>
      <div class="dec-foot"><button class="ghost" id="reflSkip">${L('그냥 지나가기', 'Let it pass')}</button><button class="cta sm" id="reflSave">${L('남기고 계속 살기', 'Leave it and live on')}</button></div>`, { kind: 'reflect' });
    $('#reflText').focus();
    document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { $('#reflText').value = b.dataset.q; $('#reflText').focus(); });
    const done = (txt) => {
      if (txt) { life.reflections.push({ age, text: txt }); pushFeed(age, { ko: L(`남긴 말: “${txt}”`, `You wrote: “${txt}”`) }, 'note'); }
      closeModal(); life.pendingReflection = false; APP.playing = true; APP.hold = 600; refreshControls(); save();
    };
    $('#reflSkip').onclick = () => done(null);
    $('#reflSave').onclick = () => done($('#reflText').value.trim());
    // 자동 결정 중에는 회고 창도 알아서 닫는다(멈춰 선 채로 남지 않게)
    if (APP.auto) setTimeout(() => { if (APP.modal && APP.modal.kind === 'reflect') done(null); }, APP.speed >= 8 ? 1600 : 5000);
  }

  /* ---------- 사망 ---------- */
  function die() {
    const life = APP.life, d = APP.pendingDeath || life.death;
    APP.playing = false;
    APP.deathStep = 0;
    go('death');
    const el = $('#screen-death');
    el.innerHTML = `
      <button class="dc-skip" id="dcSkip">${L('건너뛰기', 'Skip')}</button>
      <div class="deathcut" id="deathcut">
        <div class="dc-lab" id="dcLab">${L('마지막 해', 'The last year')}</div>
        <div class="dc-age" id="dcAge">${AGE(d.age)}</div>
        <div class="dc-line" id="dcLine">${L(`${life.region.ko}에서 숨을 거두었습니다.`, `You died in ${U.L(life.region)}.`)}</div>
        <div class="dc-cause" id="dcCause">${L('사인', 'Cause')} · ${causeName(d.cause)}</div>
      </div>
      <div class="dc-next">${L('화면을 누르면 다음으로 넘어가요', 'Tap the screen to go on')}</div>`;
    const steps = [
      { lab: L('마지막 해', 'The last year'), age: AGE(d.age), line: L(`${life.region.ko}에서 숨을 거두었습니다.`, `You died in ${U.L(life.region)}.`), cause: `${L('사인', 'Cause')} · ${causeName(d.cause)}` },
      { lab: L('마지막 순간', 'The last moment'), age: AGE(d.age), line: U.L(d.line) || '', cause: L(`${life.year}년 · 향년 ${d.age}세`, `${life.year} · aged ${d.age}`) + (helpLine(d.cause) ? ' · ' + helpLine(d.cause) : '') }
    ];
    let s = 0;
    const show = () => {
      const st = steps[s];
      $('#dcLab').textContent = st.lab; $('#dcAge').textContent = st.age;
      $('#dcLine').textContent = st.line; $('#dcCause').textContent = st.cause;
      const c = $('#deathcut'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = 'fadein .7s ease';
    };
    el.onclick = (ev) => {
      if (ev.target.id === 'dcSkip') return;
      s++;
      if (s < steps.length) show(); else renderRecord();
    };
    $('#dcSkip').onclick = () => renderRecord();
    save();
  }

  /* ---------- 사망 기록 ---------- */
  function decadeLabel(a) { return a < 10 ? L('어린 시절', 'The early years') : L(`${a}대`, `${a}s`); }

  function renderRecord() {
    const life = APP.life, d = life.death || APP.pendingDeath;
    migrateFeed(life.feed);
    go('record');
    const type = E.lifeType(life);
    const nw = E.netWorth(life);
    const happy = life.history.reduce((best, h) => (h.happiness > best.happiness ? h : best), life.history[0] || { happiness: 50, age: 0 });
    const places = new Set([en() ? (life.region.en || life.region.ko) : life.region.ko]);
    const cause = d ? d.cause : '노환';
    const el = $('#screen-record');
    const color = type.color || null;
    const lastJob = life.lastJob && life.lastJob !== 'none' ? jobName(life.lastJob)
      : (life.job !== 'none' ? jobName(life.job) : (life.retired ? L('은퇴', 'Retired') : '—'));
    el.innerHTML = `<div class="wrap"><div class="rec">
      <div class="rec-band"><span>${L('사망 기록 · RECORD OF DEATH', 'RECORD OF DEATH')}</span><span>${certNo(life)}</span></div>
      <div class="rec-body">
        <div class="rec-head">
          <div>
            <span class="lbl">${U.L(life.region)} · ${life.sex === 'f' ? L('여성', 'Female') : L('남성', 'Male')}</span>
            <h1>${en() ? life.name.en : life.name.ko}</h1>
            <p class="rec-life">${life.birthYear} – ${life.year} · ${L('향년 ', 'aged ')}${AGE(d.age)} · ${place(life.region, life.district)}</p>
            <p class="rec-color"><b style="background:${colorHex(type)}"></b>${U.L(type.name)}</p>
            <p class="rec-story">${en()
              ? `Born in ${U.L(life.district)}, ${U.L(life.region)} in ${life.birthYear}, in a ${clsName(life.cls)} household. ${life.edu !== 'none' ? ({ high: 'Finished high school. ', college: 'Finished a two-year college. ', university: 'Graduated from university. ', grad: 'Finished graduate school. ' }[life.edu] || '') : ''}${(life.role && life.role !== 'none') ? 'Worked in ' + roleName(life.role).toLowerCase().replace(/^late-life work$/, 'late-life jobs') + '. ' : ((life.lastJob || life.job) !== 'none' ? 'Worked as ' + jobName(life.lastJob || life.job).toLowerCase() + '. ' : '')}${life.married ? 'Lived with a spouse. ' : (life.flags.widowed ? 'Outlived a spouse. ' : (life.flags.divorced ? 'Lived alone after a divorce. ' : 'Lived without a spouse. '))}${life.kids ? `Raised ${life.kids} ${life.kids > 1 ? 'children' : 'child'}. ` : ''}Died at ${d.age} of ${String(causeName(cause)).toLowerCase()}.`
              : `${life.birthYear}년 ${life.region.ko} ${life.district.ko}의 ${CLASS_KO[life.cls]} 가정에서 태어났습니다. ${life.edu && life.edu !== 'none' ? EDU_KO[life.edu] + josa(EDU_KO[life.edu], '을', '를') + ' 마쳤습니다. ' : ''}${(life.role && life.role !== 'none') ? (ROLE_KO[life.role] || '') + ' 일을 했습니다. ' : ((life.lastJob || life.job) !== 'none' ? JOB_KO[life.lastJob || life.job] + '으로 일했습니다. ' : '')}${life.married ? '배우자와 함께 살았습니다. ' : (life.flags.widowed ? '배우자와 사별했습니다. ' : (life.flags.divorced ? '이혼 뒤 혼자 살았습니다. ' : '배우자 없이 살았습니다. '))}${life.kids ? `아이 ${life.kids}명을 키웠습니다. ` : ''}${d.age}세에 ${cause}${josa(cause, '으로', '로')} 세상을 떠났습니다.`}</p>
            <p class="rec-cause">${L('사인', 'Cause')} · ${causeName(cause)}</p>
            <p class="rec-cause-note">${causeNote(cause)}</p>
            ${helpLine(cause) ? `<p class="rec-note" style="margin-top:4px">${helpLine(cause)}</p>` : ''}
          </div>
          <div>
            <div class="rec-fields" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0;border-top:0">
              <div><span>${L('최종 학력', 'Schooling')}</span><b>${eduName(life.edu)}</b></div>
              <div><span>${L('전공', 'Field')}</span><b>${(life.major && life.major !== 'none') ? majorName(life.major) : '—'}</b></div>
              <div><span>${L('마지막 일', 'Last work')}</span><b>${life.role && life.role !== 'none' ? roleName(life.role) : lastJob}${life.retired && lastJob !== L('은퇴', 'Retired') ? L(' · 은퇴', ' · retired') : ''}</b></div>
              <div><span>${L('함께한 사람', 'Shared it with')}</span><b>${life.married ? L('배우자', 'A spouse') : (life.flags.widowed ? L('배우자(먼저 떠남)', 'A spouse, who went first') : L('없음', 'No one'))}</b></div>
              <div><span>${L('자녀', 'Children')}</span><b>${life.kids ? L(life.kids + '명', String(life.kids)) : L('없음', 'None')}</b></div>
              <div><span>${L('가장 행복했던 해', 'Happiest year')}</span><b>${L(`${happy.age}세 (${life.birthYear + happy.age}년)`, `${life.birthYear + happy.age}, aged ${happy.age}`)}</b></div>
              <div><span>${L('살았던 곳', 'Places lived')}</span><b>${[...places].join(', ')}</b></div>
              <div><span>${L('남긴 재산(한국 체감)', 'Left behind')}</span><b>${U.money(nw)}</b></div>
              <div><span>${L('재산 상위', 'Wealth standing')}</span><b>${nw > 0 ? (100 - E.wealthPercentile(nw)).toFixed(1) + '%' : '—'}</b></div>
            </div>
          </div>
        </div>

        ${window.COLORCARD ? window.COLORCARD.html(life) : ''}
        <section class="rec-sec">
          <h3>${L('이 삶의 결', 'The shape of this life')} <span class="lbl">${L('16가지 결 중 하나', 'one of sixteen')}</span></h3>
          <p class="lead">${U.L(type.line)}</p>
          <p class="rec-axis"><span class="lbl">${L('이 삶이 기운 쪽', 'Where it leaned')}</span> ${axisName(type.axis)} · ${U.L(type.kw)}</p>
          <p class="rec-story" style="margin-top:8px;font-size:15px">${U.L(type.desc)}</p>
          <p class="hint" style="margin-top:8px">${L('결은 한 삶이 어느 쪽으로 기울어 흘러가는지를 네 쌍의 낱말로 나타낸 것입니다. 어느 쪽도 더 나은 삶은 아닙니다.',
                                                          'A shape is a life told as four pairs of words: which way it leaned as it went. Neither side is the better life.')}</p>
        </section>

        <section class="rec-sec">
          <h3>${L('인생 지도', 'Life map')} <span class="lbl">${L(`한 칸 = 1년 · ${d.age + 1}칸`, `one cell, one year · ${d.age + 1} cells`)}</span></h3>
          <div class="grid10" id="recGrid"></div>
          <div class="gridkey"><span><i style="background:var(--grid-lo)"></i>${L('덜 행복', 'less happy')}</span><span><i style="background:var(--grid-hi)"></i>${L('더 행복', 'happier')}</span><span><i style="background:var(--rule2);box-shadow:inset 0 0 0 1px var(--ink3)"></i>${L('기대수명', 'life expectancy')}</span></div>
        </section>

        <section class="rec-sec">
          <h3>${L('생존 곡선', 'Survival curve')} <span class="lbl">${L('같은 해 태어난 사람들', 'everyone born that year')}</span></h3>
          <div class="chartbox">${window.CHARTS ? window.CHARTS.survival(life) : ''}</div>
          <p class="lead">${L(`${life.birthYear}년 ${life.region.ko}에서 태어난 사람 가운데 ${d.age}세까지 살아 있는 비율만큼 이 삶도 이어졌습니다.`,
                               `Of the people born in ${U.L(life.region)} in ${life.birthYear}, the share still alive at ${d.age} is the share this life reached.`)}</p>
        </section>

        <section class="rec-sec">
          <h3>${L('기억에 남는 순간', 'Moments kept')} <span class="lbl">${L(`${(life.history || []).length}해 중에서`, `from ${(life.history || []).length} years`)}</span></h3>
          <ul class="moments">${moments(life).map(m => `<li><span class="a">${AGE(m.age)}</span><span>${m.text}</span></li>`).join('')}</ul>
        </section>

        <section class="rec-sec">
          <h3>${L('인생 기록 전체', 'The whole record')} <span class="lbl">${L('태어난 날부터 순서대로', 'from the day you were born')}</span></h3>
          <div class="decades" id="decades"></div>
          <ul class="feed" id="recFeed"></ul>
        </section>

        <section class="rec-sec">
          <h3>${L('소득과 재산의 흐름', 'Income and wealth')} <span class="lbl">${L('만 원', 'KRW')}</span></h3>
          <div class="chartbox">${window.CHARTS && window.CHARTS.wealth ? window.CHARTS.wealth(life) : ''}</div>
          <div class="chartbox" style="margin-top:10px">${window.CHARTS && window.CHARTS.income ? window.CHARTS.income(life) : ''}</div>
          <p class="lead">${L('위는 순자산, 아래는 그해 연 소득이 같은 해 태어난 사람들 사이에서 놓인 백분위(높을수록 많음)입니다.',
                               'Above: net worth. Below: where that year’s income stood among everyone born the same year, as a percentile.')}</p>
        </section>

        <div class="rec-foot">
          <button class="cta" id="againBtn">${L('다시 태어나기', 'Be born again')}</button>
          <button class="ghost" id="shareBtn">${L('이번 생 공유하기', 'Share this life')}</button>
          <button class="ghost" id="coverBtn">${L('처음 화면으로', 'Back to the cover')}</button>
        </div>
        <p class="rec-note">${L('전생 기록은 이 브라우저에만 남습니다. 같은 브라우저로 다시 오면 지난 삶을 다시 볼 수 있어요.',
                               'The record stays in this browser only. Come back on the same browser and the last life is still here.')}</p>
      </div>
    </div></div>`;

    if (window.COLORCARD) window.COLORCARD.mount(el, life);
    // 지도
    const g = $('#recGrid');
    if (g) {
      const cells = [];
      for (let a = 0; a <= d.age; a++) {
        const h = (life.history || []).find(x => x.age === a);
        const hp = h ? h.happiness : 50;
        const bg = hp >= 75 ? 'var(--grid-hi)' : hp >= 58 ? 'var(--grid-mid)' : hp >= 42 ? '#B9CFA8' : 'var(--grid-lo)';
        const ev = (life.feed || []).find(f => f.age === a);
        cells.push(`<div class="c${a === d.age ? ' cur' : ''}" style="background:${bg}" title="${AGE(a)}"><span class="m">${a % 10 === 0 ? a : ''}</span></div>`);
      }
      g.innerHTML = cells.join('');
    }
    // 10년 단위
    const dec = $('#decades');
    const ages = [...new Set((life.feed || []).map(f => Math.floor(f.age / 10) * 10))].sort((a, b) => a - b);
    const drawFeed = (from) => {
      const ul = $('#recFeed'); if (!ul) return;
      ul.innerHTML = feedRows((life.feed || []).filter(f => f.age >= from && f.age < from + 10));
      dec.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.from === from));
    };
    dec.innerHTML = ages.map(a => `<button data-from="${a}" aria-pressed="${a === ages[0]}">${decadeLabel(a)}</button>`).join('');
    dec.querySelectorAll('button').forEach(b => b.onclick = () => drawFeed(+b.dataset.from));
    if (ages.length) drawFeed(ages[0]);

    $('#againBtn').onclick = () => { APP.life = null; localStorage.removeItem('oifm2_life'); renderCover(); go('cover'); $('#startBtn').click(); };
    $('#coverBtn').onclick = () => { APP.life = null; localStorage.removeItem('oifm2_life'); renderCover(); go('cover'); };
    $('#shareBtn').onclick = () => openShare('record');
  }

  const CAUSE_EN = {};
  (C.deaths || []).forEach(d => { if (d.cause && d.causeEn) CAUSE_EN[d.cause] = d.causeEn; });
  window.CAUSE_EN = CAUSE_EN;
  const causeName = (c) => {
    if (!en()) return c;
    return CAUSE_EN[c] || U.tr(c);
  };
  const AXIS_EN = { '곁': 'nearness', '바람': 'wandering', '뿌리': 'roots', '물결': 'drifting', '고요': 'stillness', '일': 'work', '오늘': 'today', '내일': 'tomorrow' };
  const axisName = (a) => en() ? String(a || '').split('·').map(w => AXIS_EN[w.trim()] || w.trim()).join(' · ') : a;
  const HEAVY = /자살|사고|폭력|중독|학대|전쟁/;
  function causeNote(cause) {
    if (cause === '자살') return L('2025년 자살률은 10만 명당 27.8명이었습니다. 이 삶은 그 가운데 하나로 기록됩니다.',
                                   'In 2025 the suicide rate was 27.8 people per 100,000. This life is recorded as one of them.');
    if (cause === '암') return L('2025년 사망자의 24.9%가 암으로 숨졌습니다. 이 삶도 그 네 명 중 한 명에 들었습니다.',
                                 'Cancer took 24.9% of everyone who died in 2025. This life was one of those four in a hundred.');
    if (cause === '노환') return L('2025년 사망자는 362,968명이었습니다. 나이를 다 채우고 숨을 거두는 일은 그중 일부입니다.',
                                   'In 2025, 362,968 people died in this country. Dying at the end of a full measure of years is only some of them.');
    return L('2025년 이 나라에서 362,968명이 숨졌고, 사인은 저마다 달랐습니다.',
             'In 2025, 362,968 people died in this country, and no two causes were quite the same.');
  }
  function helpLine(cause) {
    if (!HEAVY.test(String(cause || ''))) return '';
    return L('힘든 마음이 오래 머문다면 자살예방상담 109, 정신건강상담 1577-0199로 연락해도 좋습니다.',
             'If a hard feeling stays for a long time, the suicide prevention line (109) and the mental health line (1577-0199) are there to call.');
  }

  function josa(word, withJong, withoutJong) {
    const last = String(word || '').slice(-1);
    const code = last.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return withoutJong;
    const hasJong = (code - 0xac00) % 28 !== 0;
    return hasJong ? withJong : withoutJong;
  }

  function colorHex(type) {
    const pal = ['#8C1D3C', '#0F6E68', '#9C7020', '#2B5A7A', '#6B4A7A', '#2B7A4E', '#A8730F', '#4A5A61'];
    let h = 0; const nm = U.L(type.name) || '';
    for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 997;
    return pal[h % pal.length];
  }

  function moments(life) {
    const out = [];
    const feed = life.feed || [];
    const pick = (ko, e) => { const re = en() ? e : ko; return feed.find(f => re.test(f.text)); };
    const b = feed.find(f => f.age === 0);
    if (b) out.push({ age: 0, text: b.text });
    const school = pick(/입학|졸업|대학/, /graduat|enrolled|admission|accepted at|university entrance/i); if (school && school.age >= 6 && school.age <= 26) out.push({ age: school.age, text: school.text });
    const job = pick(/취업|일하기 시작|첫 직장|자영업/, /job|first work|hired|business|firm/i); if (job) out.push({ age: job.age, text: job.text });
    const love = pick(/결혼|연애|배우자/, /marri|dating|spouse|partner/i); if (love) out.push({ age: love.age, text: love.text });
    const kid = pick(/태어났습니다|아이가/, /was born|a child/i); if (kid && kid.age > 18) out.push({ age: kid.age, text: kid.text });
    const money = feed.filter(f => (en() ? /saved|set aside/i : /모아 둔 돈/).test(f.text)).pop(); if (money) out.push({ age: money.age, text: money.text });
    const last = feed[feed.length - 1]; if (last) out.push({ age: last.age, text: last.text });
    const seen = new Set();
    return out.filter(m => (seen.has(m.text) ? false : seen.add(m.text)))
      .sort((a, b) => a.age - b.age).slice(0, 8);
  }

  /* ---------- 공유 ---------- */
  function openShare(kind, fromCert) {
    const life = APP.life;
    const kinds = [['record', '인생 기록', 'Life record'], ['birth', '출생', 'Birth'], ['color', '이 삶의 결', 'Shape'], ['map', '인생 지도', 'Life map'], ['curve', '생존 곡선', 'Survival'], ['death', '마지막 순간', 'The end']];
    APP.shareKind = kind || 'record';
    const root = $('#sheetroot');
    root.innerHTML = `<div class="scrim" id="shareScrim"><div class="sharebox">
      <div class="share-tabs">${kinds.map(([k, ko, e]) => `<button data-k="${k}" aria-pressed="${k === APP.shareKind}">${L(ko, e)}</button>`).join('')}</div>
      <img class="share-img" id="shareImg" alt="${L('삶의 공유 카드', 'A card of this life')}"/>
      <p class="share-cap" id="shareCap"></p>
      <div class="share-act">
        <button class="cta sm" id="saveCard">${L('이미지 저장', 'Save the image')}</button>
        <button class="ghost" id="copyText">${L('글·링크 복사', 'Copy the text')}</button>
        <button class="ghost" id="closeShare">${L('닫기', 'Close')}</button>
      </div>
    </div></div>`;
    const draw = () => {
      const img = $('#shareImg');
      let url = '';
      try {
        if (window.CARD && window.CARD.make) url = window.CARD.make(APP.shareKind, life, { fromCert: !!fromCert });
      } catch (e) { url = ''; }
      if (!url && window.SHARE) {
        const cv = document.createElement('canvas');
        window.SHARE.drawCard(life, '45', cv);
        url = cv.toDataURL('image/png');
      }
      img.src = url;
      const cap = $('#shareCap');
      if (cap) cap.textContent = shareText(life, APP.shareKind);
    };
    root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      APP.shareKind = b.dataset.k;
      root.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', x === b));
      draw();
    });
    $('#closeShare').onclick = () => { root.innerHTML = ''; };
    $('#saveCard').onclick = () => {
      const a = document.createElement('a');
      a.href = $('#shareImg').src; a.download = en() ? `one-in-fifty-million_${life.name.en.replace(/\s+/g, '-')}_${APP.shareKind}.png` : `5천만분의1_${life.name.ko}_${APP.shareKind}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      U.toast(L('카드를 저장했습니다', 'Card saved'));
    };
    $('#copyText').onclick = async () => {
      const txt = shareText(life, APP.shareKind);
      try { await navigator.clipboard.writeText(txt); U.toast(L('글을 복사했습니다', 'Text copied')); } catch (e) { U.toast(L('복사가 막혀 있어요', 'Copying is blocked here')); }
    };
    draw();
  }

  function shareText(life, kind) {
    const type = E.lifeType(life);
    const d = life.death;
    if (en()) {
      const head = `${life.name.en} · ${U.L(life.region)} · ${life.birthYear}–${life.year}`;
      if (kind === 'birth') return `Born in ${U.L(life.district)}, ${U.L(life.region)}, ${life.birthYear}. One of the 254,341 children born in Korea that year. One in Fifty Million.`;
      if (kind === 'death') return `${life.name.en} died in ${life.year} at ${d ? d.age : life.age}, of ${String(causeName(d ? d.cause : '')).toLowerCase()}. One in Fifty Million.`;
      return `${head}. The shape of this life: ${type.name.en}. ${type.line.en} One in Fifty Million.`;
    }
    const head = `${life.name.ko} · ${life.region.ko} · ${life.birthYear}–${life.year}`;
    if (kind === 'birth') return `${life.birthYear}년 ${life.region.ko} ${life.district.ko}에서 태어났다. 대한민국에서 그해 태어난 254,341명 중 한 명. #5천만분의1`;
    if (kind === 'death') return `${life.name.ko}, ${d ? d.age : life.age}세에 ${d ? d.cause : ''}${josa(d ? d.cause : '', '으로', '로')} 세상을 떠났다. #5천만분의1`;
    return `${head}. 이 삶의 결은 '${U.L(type.name)}'. ${U.L(type.line)} #5천만분의1`;
  }

  /* ---------- 시작 ---------- */
  function boot() {
    const th = localStorage.getItem('oifm2_theme');
    if (th) document.documentElement.setAttribute('data-theme', th);
    document.documentElement.lang = APP.lang;
    renderCover();
    go('cover');
    window.addEventListener('beforeunload', save);
    document.addEventListener('keydown', (e) => {
      if (APP.screen !== 'life') return;
      // 입력칸에 글을 쓰는 중에는 단축키를 쓰지 않는다(띄어쓰기가 먹히지 않던 문제)
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.closest && t.closest('input,textarea,select,[contenteditable="true"]')));
      if (typing) return;
      if (e.key === ' ') { e.preventDefault(); APP.playing = !APP.playing; refreshControls(); }
      if (['1', '2', '3', '4', '5'].includes(e.key)) { APP.speed = SPEEDS[+e.key - 1]; refreshControls(); }
      if (e.key === 'Escape' && APP.modal) { closeModal(); APP.playing = true; }
    });
  }
  boot();
})();
