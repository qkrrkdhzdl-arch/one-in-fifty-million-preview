/* 5천만 분의 1 — life engine v2 (2026-11-23)
   Deterministic per-seed simulation of one Korean life, one year at a time.
   v2: 성별·선후관계 플래그, 사건 1회성, 말년 다양화, 선택 후속, 초점 가중,
       지역·실제 연도 사건, 지표 확장(평판/역량/스트레스), 가족 상태,
       전공·직무 선택, 대학 스펙→취업 연동, 연소득/연지출 내역, 임금피크·은퇴 소득. */
(function () {
  const C = window.CONTENT;

  // ---------- random ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  const R = () => rnd();
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  function pick(arr) { return arr[Math.floor(R() * arr.length)]; }
  function wpick(arr, wf) {
    let s = 0; const ws = arr.map(x => { const w = Math.max(0, wf(x)); s += w; return w; });
    if (s <= 0) return arr[Math.floor(R() * arr.length)];
    let r = R() * s;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- 지난 삶의 기억 (v3.0) ----------
  // 같은 사건이 매 판 또 나오면 "이벤트가 늘 똑같다"로 읽힌다. 최근 삶들에서 나온 사건은
  // 이번 삶에서 무게를 크게 낮추고, 거의 매 판 나온 사건은 거의 지운다.
  const MEM_KEY = "oifm2_mem";
  function loadMem() {
    try {
      const m = JSON.parse(localStorage.getItem(MEM_KEY) || "null");
      if (!m || typeof m !== "object") return { lives: 0, events: {}, lovers: {}, tags: {} };
      m.events = m.events || {}; m.lovers = m.lovers || {}; m.tags = m.tags || {};
      return m;
    } catch (e) { return { lives: 0, events: {}, lovers: {}, tags: {} }; }
  }
  function saveMem(m) { try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch (e) { /* 저장이 막혀도 게임은 돈다 */ } }
  function memWindow(m) { return clamp(m.lives || 0, 1, 8); }
  function memWeight(life, id) {
    const m = life._mem;
    if (!m) return 1;
    const n = memWindow(m);
    const c = (m.events && m.events[id]) || 0;
    if (!c) return 1;
    const r = c / n;
    if (r >= 0.62) return 0.04;      // 거의 매 삶에 나온 사건
    if (r >= 0.42) return 0.14;
    if (r >= 0.25) return 0.38;
    return 0.75;
  }
  function recordLife(life) {
    const m = loadMem();
    const ids = Object.keys(life.usedIds || {});
    m.lives = (m.lives || 0) + 1;
    // 창을 넘어간 기억은 절반으로 잊는다(오래된 삶이 영원히 사건을 막지 않게)
    if (m.lives > 8) {
      for (const k in m.events) { m.events[k] = Math.round(m.events[k] * 0.6); if (!m.events[k]) delete m.events[k]; }
      m.lives = 8;
    }
    for (const id of ids) m.events[id] = (m.events[id] || 0) + 1;
    (life.loverSeen || []).forEach(id => { m.lovers[id] = (m.lovers[id] || 0) + 1; });
    for (const id in m.events) if (m.events[id] > 8) m.events[id] = 8;
    for (const id in m.lovers) if (m.lovers[id] > 8) m.lovers[id] = 8;
    saveMem(m);
  }

  // ---------- 지표 ----------
  // '지식'과 '역량'은 하나로 통합한다. 학습·공부로 쌓은 것도 역량으로 들어가고,
  // 조건 검사에 남아 있는 knowledge는 역량과 같은 값으로 유지한다.
  function bump(life, k, v) {
    if (!v) return;
    if (k === "knowledge") {
      // 학습으로 얻은 것은 역량의 일부로만 쌓인다(경험·직무 역량과 같은 눈금)
      life.stats.spec = clamp((life.stats.spec || 0) + v * 0.18, 0, 100);
      life.stats.knowledge = life.stats.spec;
      return;
    }
    const g = v > 0 ? v * (k === "spec" ? 0.32 : k === "happiness" ? 0.65 : k === "relation" ? 0.55 : 1) : v;
    life.stats[k] = clamp((life.stats[k] || 0) + g, 0, 100);
  }
  function syncStats(life) { life.stats.knowledge = life.stats.spec; }

  // 관계·행복이 오르면 스트레스가 내려가고, 떨어지면 올라간다
  function stressLink(life, dHap, dRel, dHea) {
    const up = Math.max(0, dHap) + Math.max(0, dRel) + Math.max(0, dHea) * 0.5;
    const down = Math.max(0, -dHap) + Math.max(0, -dRel) + Math.max(0, -dHea) * 0.5;
    if (up || down) bump(life, "stress", down * 0.30 - up * 0.22);
    if (life.stats.stress > 72) bump(life, "happiness", -0.3);
    else if (life.stats.stress < 24) bump(life, "happiness", 0.2);
  }

  // 고용 형태: 창업자·프리랜서에게 희망퇴직·임금피크·직장 상사가 나오지 않게 구분한다
  function empTypeOf(life) {
    const r = life.role || "none";
    // 일자리를 잃었거나 은퇴한 뒤에는 '회사원' 전제(상사·승진·명예퇴직)가 나오지 않는다.
    // (직무를 한 번 고른 사람은 role이 남아 있어, 고용 여부를 함께 보지 않으면 무직인데 회사 장면이 나온다)
    if (!life.flags.employed) return "none";
    if (r === "self") return "founder";
    if (r === "free") return "freelance";
    if (r === "public" || r === "edu") return "public";
    if (r === "trade" || r === "farm") return "sme";
    if (r === "med" || r === "research") return life.flags.entryGrade === "대기업·전문직" ? "corp" : "sme";
    if (r === "none") return life.flags.employed ? "sme" : "none";
    return (life.flags.entryGrade === "대기업·전문직" || (life.stats.reputation >= 62 && life.stats.spec >= 62)) ? "corp" : "sme";
  }

  // ---------- macro eras ----------
  const MACRO = [
    { from: 1997, to: 1998, id: "imf", job: 0.84, house: -0.09, mood: -7, infl: 0.045 },
    { from: 2003, to: 2003, id: "card", job: 0.97, house: 0.05, mood: -3, infl: 0.035 },
    { from: 2008, to: 2009, id: "gfc", job: 0.89, house: -0.05, mood: -5, infl: 0.041 },
    { from: 2015, to: 2021, id: "boom", job: 1.02, house: 0.085, mood: 2, infl: 0.012 },
    { from: 2020, to: 2021, id: "covid", job: 0.92, house: 0.07, mood: -5, infl: 0.006 },
    { from: 2022, to: 2023, id: "rate", job: 0.98, house: -0.035, mood: -3, infl: 0.052 },
    { from: 2024, to: 2026, id: "low", job: 0.99, house: -0.008, mood: -2, infl: 0.023 }
  ];
  function macroFor(year) {
    for (const m of MACRO) if (year >= m.from && year <= m.to) return m;
    return null;
  }
  const HOUSING_INDEX = (year) => {
    let v = 100;
    for (let y = 2000; y < year; y++) {
      const m = macroFor(y);
      let g = 0.035 + (y >= 2015 && y <= 2021 ? 0.06 : 0) + (y >= 2022 && y <= 2023 ? -0.05 : 0);
      if (m) g += m.house;
      v *= 1 + g;
    }
    return v;
  };

  // ---------- birth ----------
  const COHORTS = [[1981, 6], [1990, 12], [1998, 22], [2008, 20], [2013, 14], [2020, 12], [2026, 8]];
  const CLASS_FROM_CHAR = {
    rich: [["high", .45], ["mid", .40], ["low", .15]],
    mid: [["high", .15], ["mid", .60], ["low", .25]],
    low: [["high", .05], ["mid", .45], ["low", .50]],
    city: [["high", .08], ["mid", .62], ["low", .30]],
    rural: [["high", .07], ["mid", .50], ["low", .43]]
  };
  const FAMILY = [["both", 78], ["single", 15], ["grand", 4], ["care", 3]];

  function koreanName(sex) {
    const sur = wpick(C.surnames, x => x[2]);
    const given = sex === "f" ? pick(C.givenF) : pick(C.givenM);
    return { ko: sur[0] + given[0], en: given[1] + " " + sur[1] };
  }

  const MAJORS = {
    eng:  { ko: "공학·컴퓨터", en: "Engineering & Computing", spec: 16, bias: ["dev", "research", "trade"] },
    biz:  { ko: "경영·경제", en: "Business & Economics", spec: 13, bias: ["mkt", "finance", "sales"] },
    hum:  { ko: "인문·사회", en: "Humanities & Social Sciences", spec: 11, bias: ["mkt", "public", "edu"] },
    med:  { ko: "의약·보건", en: "Medicine & Health", spec: 20, bias: ["med", "research"] },
    art:  { ko: "예체능", en: "Arts & Physical Education", spec: 10, bias: ["free", "mkt"] },
    edu:  { ko: "사범·교육", en: "Education", spec: 12, bias: ["edu", "public"] },
    sci:  { ko: "자연과학", en: "Natural Sciences", spec: 15, bias: ["research", "dev"] },
    none: { ko: "—", en: "—", spec: 0, bias: [] }
  };
  const ROLES = {
    dev:     { ko: "개발·데이터", en: "Development & Data", job: "office", mul: 1.24 },
    mkt:     { ko: "마케팅·기획", en: "Marketing & Planning", job: "office", mul: 1.02 },
    sales:   { ko: "영업·영업관리", en: "Sales", job: "office", mul: 0.97 },
    finance: { ko: "재무·회계", en: "Finance & Accounting", job: "office", mul: 1.06 },
    research:{ ko: "연구·전문직", en: "Research & Professions", job: "office", mul: 1.14 },
    senior:  { ko: "노후 일자리", en: "Senior Job", job: "trade", mul: 0.34 },
    public:  { ko: "공무원·공공기관", en: "Public Service", job: "public", mul: 0.93 },
    edu:     { ko: "교사·교육", en: "Teaching", job: "public", mul: 0.95 },
    med:     { ko: "의료·돌봄", en: "Health Care", job: "office", mul: 1.46 },
    self:    { ko: "자영업·창업", en: "Small Business", job: "self", mul: 0.88 },
    trade:   { ko: "기술·생산", en: "Skilled Trades", job: "trade", mul: 0.9 },
    free:    { ko: "프리랜서·예술", en: "Freelance & Arts", job: "free", mul: 0.84 },
    farm:    { ko: "농림어업", en: "Farming & Fishing", job: "farm", mul: 0.8 },
    none:    { ko: "—", en: "—", job: "none", mul: 0 }
  };

  function createLife(opt = {}) {
    const seed = opt.seed != null ? opt.seed : (Math.random() * 1e9) | 0;
    rnd = mulberry32(seed);
    const sex = opt.sex || (R() < 0.5 ? "f" : "m");
    const region = opt.region && C.regions.find(r => r.id === opt.region) ? C.regions.find(r => r.id === opt.region) : wpick(C.regions, r => r.w);
    const district = pick(region.districts);
    const zone = district[2] === "rural" ? "rural" : region.type;
    const cls = opt.cls || wpick(CLASS_FROM_CHAR[district[2]] || CLASS_FROM_CHAR.mid, x => x[1])[0];
    let cohort;
    if (opt.cohort) cohort = opt.cohort;
    else if (opt.cohortSpan) {
      const [y0, y1] = opt.cohortSpan;
      const inside = COHORTS.filter(c => c[0] >= y0 && c[0] <= y1);
      cohort = inside.length ? wpick(inside, x => x[1])[0] : Math.round(y0 + R() * (y1 - y0));
    } else cohort = wpick(COHORTS, x => x[1])[0];
    const birthYear = cohort;
    const family = wpick(FAMILY, x => x[1])[0];
    const singleParent = family === "single" ? (R() < 0.75 ? "mother" : "father") : null;
    const parents = {
      mother: family === "both" || family === "single" && singleParent === "mother",
      father: family === "both" || family === "single" && singleParent === "father"
    };
    const siblings = family === "single" ? ri(0, 1) : family === "care" ? 0 : wpick([[0, 22], [1, 45], [2, 26], [3, 7]], x => x[1])[0];
    const name = opt.name || koreanName(sex);
    const era = birthYear <= 1985 ? "old" : birthYear <= 2005 ? "mid" : "new";

    const baseHealth = 58 + (cls === "high" ? 4 : cls === "low" ? -3 : 0) + ri(-5, 5);
    const motherAge = parents.mother ? 30 + ri(0, 7) : null;
    const fatherAge = parents.father ? 32 + ri(0, 8) : null;

    // ---------- 집안의 배경 (v2.2) ----------
    // 같은 해 같은 동네에 태어나도 아버지의 일, 어머니의 일, 조부모와의 거리는 집집마다 다르다.
    // 이 배경이 아동기의 장면을 정하고, 그 장면이 다시 청년·중년의 사정으로 이어진다.
    const pickW = (list) => {
      let s = 0; for (const x of list) s += x[1];
      let r = R() * s;
      for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; }
      return list[list.length - 1][0];
    };
    const FJOBS = zone === "rural"
      ? [["농사", 34], ["기술직", 16], ["운수·건설", 18], ["공무원", 8], ["가게", 16], ["회사원", 8]]
      : cls === "high"
      ? [["회사원", 36], ["전문직", 18], ["가게", 20], ["공무원", 12], ["기술직", 14]]
      : cls === "low"
      ? [["일용·건설", 20], ["기술직", 26], ["운수·건설", 18], ["가게", 16], ["회사원", 20]]
      : [["회사원", 34], ["기술직", 20], ["가게", 16], ["공무원", 10], ["운수·건설", 12], ["전문직", 8]];
    const M_OLD = [["전업주부", 56], ["가게", 12], ["교사", 9], ["농사", 12], ["간호사", 4], ["회사원", 7]];
    const M_NEW = [["전업주부", 30], ["회사원", 17], ["교사", 10], ["간호사", 8], ["가게", 15], ["공무원", 6],
                   ["농사", zone === "rural" ? 16 : 2], ["일용·서비스", 6]];
    const fJob = pickW(FJOBS);
    const mJob = pickW(era === "old" ? M_OLD : M_NEW);
    const fIncome = { "회사원": cls === "high" ? 540 : cls === "low" ? 235 : 330,
      "전문직": 660, "가게": 300 + ri(-80, 160), "공무원": 330, "기술직": 285,
      "운수·건설": 265, "일용·건설": 205, "농사": 185 }[fJob] || 300;
    const mIncome = mJob === "전업주부" ? 0 : Math.round(({ "교사": 360, "간호사": 330, "공무원": 315,
      "회사원": 300, "가게": 240, "농사": 150, "일용·서비스": 160 }[mJob] || 240) * (0.85 + R() * 0.3));

    // 조부모: 어느 쪽(친가·외가)과 얼마나 가까이 사는지
    const gpSide = R() < 0.62 ? "paternal" : "maternal";
    const gpRoll = R();
    let gpSetup;
    if (family === "grand") gpSetup = "raised";
    else if (family === "care") gpSetup = "gone";
    else if (gpRoll < 0.08) gpSetup = "cohabit";
    else if (gpRoll < 0.26) gpSetup = "near";
    else if (gpRoll < 0.60) gpSetup = "holiday";
    else if (gpRoll < 0.74) gpSetup = "far";
    else if (gpRoll < 0.88) gpSetup = "one";
    else gpSetup = "gone";
    const baseGma = (gpSide === "paternal" ? (fatherAge || 33) + 26 : (motherAge || 30) + 25) + ri(-3, 4);
    const baseGpa = baseGma + 2 + ri(0, 4);
    const gmaAlive = gpSetup !== "gone" && !(gpSetup === "one" && R() < 0.55);
    const gpaAlive = gpSetup !== "gone" && (gpSetup === "one" ? !gmaAlive : R() < 0.58);
    const gpHouse = koreanName("f");
    const gpSur = gpHouse.ko.slice(0, 1);
    const gpGmaName = gpHouse.ko;
    const gpGpaName = gpSur + pick(C.givenM)[0];

    // 아동기의 집안 풍경: 이 아이가 자란 집의 매일
    const COAST = ["busan", "ulsan", "incheon", "jeonnam", "gyeongnam", "jeju", "gangwon"];
    let childArc;
    if (family === "grand") childArc = "grand";
    else if (family === "single") childArc = "single";
    else if (fJob === "가게" || mJob === "가게") childArc = "shopkid";
    else if (fJob === "농사") childArc = "farmkid";
    else if (COAST.indexOf(region.id) >= 0 && R() < 0.22) childArc = "seatown";
    else if (zone === "rural") childArc = "citytown";
    else if (fJob === "운수·건설" && R() < 0.55) childArc = "movehouse";
    else if (mJob !== "전업주부" && R() < 0.34) childArc = "latchkey";
    else childArc = "city";

    // ---------- 태어난 집 (v3.0) ----------
    // 같은 동네, 같은 형편이라도 아이가 자라는 집은 집집마다 다르다. 집이 아동기의 장면을 정한다.
    const HOME_POOL = (C.homes || []).filter(h => {
      if (h.cls && h.cls.indexOf(cls) < 0) return false;
      if (h.zone && h.zone.indexOf(zone) < 0) return false;
      // 집과 집안 사정이 어긋나지 않게
      if (h.id === "grand_house" && !(family === "grand" || gpSetup === "cohabit" || gpSetup === "raised")) return false;
      if (h.id === "relatives" && !(family === "care" || singleParent)) return false;
      if (h.id === "dorm" && !["기술직", "운수·건설", "공무원", "회사원"].includes(fJob) && !["교사", "간호사", "공무원", "회사원"].includes(mJob)) return false;
      if (h.id === "gov_housing" && !["공무원", "군인", "경찰"].includes(fJob) && !["공무원", "교사", "군인"].includes(mJob)) return false;
      if (h.id === "sea_house" && COAST.indexOf(region.id) < 0) return false;
      if (h.id === "shop_above" && !(fJob === "가게" || mJob === "가게")) return false;
      if (h.id === "clan_house" && zone !== "rural") return false;
      return true;
    });
    const homeKind = opt.homeKind || (HOME_POOL.length ? wpick(HOME_POOL, h => h.w || 5).id : null);
    // 기질·소질·꿈: 같은 동네 같은 집에서 태어나도 아이는 다르다
    const IDT = (C.identity || {});
    const trait = pick(IDT.traits || [{ id: "warm", ko: "다정함", en: "warm-hearted", st: {} }]);
    const talent = pick(IDT.talents || [{ id: "hand", ko: "손재주", en: "hands", st: {} }]);
    const dream = pick(IDT.dreams || [{ id: "teacher", ko: "선생님", en: "a teacher" }]);

    const life = {
      seed, name: { ko: name.ko, en: name.en }, sex, region, district: { ko: district[0], en: district[1], char: district[2] },
      zone, cls, birthYear, cohort, era, family, siblings, singleParent, parents,
      age: 0, year: birthYear,
      homeKind: homeKind,
      trait, talent, dream,
      _mem: loadMem(),
      loverCands: [],
      loverSeen: [],
      loveRound: 0,
      loveAt: [ri(21, 24), ri(27, 31), ri(33, 35)],
      familyAges: { mother: motherAge, father: fatherAge, sibling: Array.from({ length: siblings }, (_, i) => ri(-3, 6)) },
      parentDeath: {
        mother: parents.mother ? 76 + ri(-8, 12) : null,
        father: parents.father ? 72 + ri(-9, 12) : null
      },
      gpDeath: {
        gma: gmaAlive ? 78 + ri(-9, 14) : null,
        gpa: gpaAlive ? 76 + ri(-11, 13) : null
      },
      bg: { gpSetup, gpSide, childArc, fJob, mJob },
      stats: (function () {
        const ability = clamp(Math.round((28 + ri(-6, 8)) * 0.35 + (8 + ri(0, 6)) * 0.65), 8, 40);
        return {
          health: clamp(baseHealth, 30, 80), happiness: 56 + ri(-6, 8),
          knowledge: ability, relation: 60 + ri(-8, 6),
          reputation: 30 + ri(-6, 8), spec: ability, stress: 20 + ri(-6, 8)
        };
      })(),
      cash: cls === "high" ? ri(200, 600) : cls === "low" ? ri(0, 40) : ri(40, 160),
      assets: 0, homeValue: 0, deposit: 0, debt: 0, home: "none",
      job: "none", role: "none", major: "none", lastJob: "", lastRole: "", edu: "none",
      married: 0, kids: 0, care: 0, retired: 0,
      income: 0, expenses: 0, alloc: "safe", focus: "balance",
      incomeItems: { labor: 0, pension: 0, asset: 0, other: 0 },
      expenseItems: { housing: 0, food: 0, living: 0, education: 0, care: 0, taxInterest: 0, leisure: 0, health: 0 },
      contribYears: 0, wagePeakAt: null, retireAge: null,
      events: [], seen: {}, usedIds: {}, lastSeen: {}, decisions: [], history: [], reflections: [],
      flags: {},
      death: null, ageFocusLog: [], moves: 0,
      peers: [], startedYear: birthYear,
      pendingDecision: null, pendingReflection: false,
      incomeLog: [], statLog: [], familyLog: []
    };
    life.flags = {
      fatherAlive: !!parents.father, motherAlive: !!parents.mother,
      married: false, spouseAlive: false, divorced: false, widowed: false,
      childrenCount: 0, retired: false, wagePeak: false, inCollege: false, graduated: false,
      employed: false, militaryDone: false, hasHome: false, caregivingParent: false,
      inherited: false, majorChosen: false, roleChosen: false, chronic: false,
      contestWin: false, albaExp: 0, spec: 0,
      dating: false, wantChild: false, hospitalized: false, recovering: false,
      empType: "none", investStyle: "safe",
      gpSetup, gpSide, childArc, gmaAlive, gpaAlive,
      homeKind,
      traitId: trait.id, talentId: talent.id, dreamId: dream.id,
      gpNone: gpSetup === "gone", gpNear: gpSetup === "cohabit" || gpSetup === "near" || gpSetup === "raised",
      gpFar: gpSetup === "holiday" || gpSetup === "far",
      fJob, mJob, famShop: fJob === "가게" || mJob === "가게", famFarm: fJob === "농사",
      momWorks: mJob !== "전업주부",
      hasMother: !!parents.mother, hasFather: !!parents.father,   // 조부모 손에 자란 사람은 부모 개체가 없다
      hasSibling: siblings > 0   // 외동이면 형제·동생이 등장하는 장면을 막는다
    };
    life.spendMode = { food: "normal", leisure: "normal", living: "normal", health: "normal" };
    life.family = {
      mother: parents.mother ? { name: "어머니", alive: true, age: motherAge, health: 66 + ri(-8, 10), relation: 68 + ri(-8, 8), job: mJob, income: mIncome } : null,
      father: parents.father ? { name: "아버지", alive: true, age: fatherAge, health: 64 + ri(-8, 10), relation: 62 + ri(-10, 8), job: fJob, income: fIncome } : null,
      gma: gmaAlive ? { name: gpGmaName, side: gpSide, alive: true, age: baseGma, health: 52 + ri(-8, 14), relation: (gpSetup === "cohabit" || gpSetup === "raised" ? 76 : gpSetup === "near" ? 68 : gpSetup === "holiday" ? 62 : 56) + ri(-6, 8), job: gpSetup === "raised" ? "양육" : "—", income: 0 } : null,
      gpa: gpaAlive ? { name: gpGpaName, side: gpSide, alive: true, age: baseGpa, health: 50 + ri(-8, 14), relation: (gpSetup === "cohabit" || gpSetup === "raised" ? 70 : gpSetup === "near" ? 62 : gpSetup === "holiday" ? 56 : 50) + ri(-6, 8), job: "—", income: 0 } : null,
      spouse: null,
      partner: null,
      children: []
    };
    // four peers born the same day
    const pool = C.peers.slice().sort(() => R() - 0.5).slice(0, 4);
    life.peers = pool.map(p => ({ ...p, name: p.name, age: 0, alive: true, milestoneAge: 0 }));
    life.stats.health = clamp(life.stats.health, 30, 82);
    for (const src2 of [trait.st, talent.st]) {
      if (!src2) continue;
      for (const k in src2) life.stats[k] = clamp((life.stats[k] || 0) + src2[k], 0, 100);
    }
    return life;
  }

  // ---------- content normalisation (legacy fields → cond) ----------
  const PREPPED = new WeakSet();
  // ---------- 태어난 집·연인 (v3.0) ----------
  function homeRef(life) {
    if (!life || !life.homeKind) return null;
    return (C.homes || []).find(h => h.id === life.homeKind) || null;
  }

  // 문장 안의 자리표시자를 그 삶의 상태로 바꿔 끼운다. 사건 본문은 언어별로 따로 채운다.
  function tplFill(text, life, en) {
    if (!text || text.indexOf("{") < 0) return text;
    const sp = (life.family && (life.family.spouse || life.family.partner)) || null;
    const married = !!life.flags.married;
    const spKo = married ? (life.sex === "m" ? "아내" : "남편") : "연인";
    const spEn = married ? (life.sex === "m" ? "your wife" : "your husband") : "your partner";
    const inlawKo = married ? (life.sex === "m" ? "처가" : "시댁") : "상대의 집";
    const inlawEn = "your in-laws";
    const job = sp && sp.job ? (en ? (sp.jobEn || sp.job) : sp.job) : (en ? "their work" : "그 사람의 일");
    const fam = sp && sp.fam ? (en ? (sp.famEn || sp.fam) : sp.fam) : (en ? "their family" : "그 집안");
    const h = homeRef(life);
    const homeName = h ? (en ? h.en : h.ko) : (en ? "home" : "집");
    const dreamName = life.dream ? (en ? (life.dream.en || life.dream.ko) : life.dream.ko) : (en ? "that dream" : "그 꿈");
    return text
      .split("{spouse}").join(en ? spEn : spKo)
      .split("{inlaw}").join(en ? inlawEn : inlawKo)
      .split("{spjob}").join(job)
      .split("{spfam}").join(fam)
      .split("{home}").join(homeName)
      .split("{dream}").join(dreamName);
  }
  function filledEvent(e, life) {
    const hasTpl = e.tpl || (e.b && (String(e.b.ko || "").indexOf("{") >= 0 || String(e.b.en || "").indexOf("{") >= 0));
    if (!hasTpl) return e;
    const out = Object.assign({}, e);
    out.t = { ko: tplFill(e.t && e.t.ko, life, false), en: tplFill(e.t && e.t.en, life, true) };
    out.b = { ko: tplFill(e.b && e.b.ko, life, false), en: tplFill(e.b && e.b.en, life, true) };
    return out;
  }
  const DREAM_ROLES = {
    teacher: ["edu"], doctor: ["med"], nurse: ["med"], scientist: ["research", "dev"],
    boss: ["self"], writer: ["free", "mkt"], judge: ["public"], soldier: ["public"],
    cook: ["self"], singer: ["free"], athlete: ["free", "edu"], pilot: ["trade", "dev"]
  };
  const TALENT_MAJORS = {
    number: ["eng", "biz", "sci"], word: ["hum", "edu"], hand: ["eng", "art", "med"],
    talk: ["biz", "hum", "edu"], draw: ["art"], song: ["art"], body: ["art", "edu"], memory: ["med", "sci", "edu"]
  };
  const TALENT_ROLES = {
    number: ["dev", "finance", "research"], word: ["mkt", "edu", "free"], hand: ["trade", "med", "free"],
    talk: ["sales", "mkt", "public"], draw: ["free", "mkt"], song: ["free"], body: ["trade", "edu"], memory: ["med", "research", "public"]
  };
  const MAJOR_EXTRA_ROLE = {
    med: { id: "med", tag: "career", t: { ko: "의료·돌봄", en: "Health Care" }, n: { ko: "의약·보건 전공을 살려 병원·약국·보건 현장에 들어갑니다.", en: "You enter hospitals, clinics, or health care matching your medical studies." }, st: { health: -1, happiness: 1, reputation: 4, spec: 6, stress: 5 }, money: 0, inc: 0, set: { role: "med", employed: true } },
    edu: { id: "edu", tag: "career", t: { ko: "교사·교육", en: "Teaching & Education" }, n: { ko: "사범·교육 전공을 살려 학교와 교육 현장을 택합니다.", en: "You step into schools and teaching matching your education degree." }, st: { health: 0, happiness: 2, relation: 2, reputation: 3, spec: 4, stress: 2 }, money: 0, inc: 0, set: { role: "edu", employed: true } },
    art: { id: "free", tag: "career", t: { ko: "프리랜서·예술", en: "Freelance & Arts" }, n: { ko: "예체능 전공을 살려 작업실·디자인·공연 일을 시작합니다.", en: "You start studio, design, or creative work matching your arts background." }, st: { health: 0, happiness: 3, spec: 4, stress: 3 }, money: 0, inc: 0, set: { role: "free", employed: true } }
  };

  function filledDecision(d, life) {
    if (!d) return d;
    const out = Object.assign({}, d);
    if (d.t) out.t = { ko: tplFill(d.t.ko, life, false), en: tplFill(d.t.en, life, true) };
    if (d.b) out.b = { ko: tplFill(d.b.ko, life, false), en: tplFill(d.b.en, life, true) };
    let baseCh = Array.isArray(d.ch) ? d.ch.slice() : [];
    if (d.id === "d_24_role" && MAJOR_EXTRA_ROLE[life.major]) {
      const extra = MAJOR_EXTRA_ROLE[life.major];
      if (!baseCh.some(c => c.set && c.set.role === extra.set.role)) {
        baseCh.unshift(extra);
      }
    }
    const talId = life.talent && life.talent.id;
    const drmId = life.dream && life.dream.id;
    out.ch = baseCh.map(c => {
      const nc = Object.assign({}, c);
      if (c.t) nc.t = { ko: tplFill(c.t.ko, life, false), en: tplFill(c.t.en, life, true) };
      if (c.n) nc.n = { ko: tplFill(c.n.ko, life, false), en: tplFill(c.n.en, life, true) };
      if (d.id === "d_19_major" && c.set && c.set.major) {
        const fitTal = (TALENT_MAJORS[talId] || []).includes(c.set.major);
        if (fitTal) {
          const tName = life.talent ? life.talent.ko : "";
          const tNameEn = life.talent ? life.talent.en : "";
          nc.n = {
            ko: (nc.n && nc.n.ko ? nc.n.ko + " " : "") + `(타고난 소질 ‘${tName}’과 잘 맞습니다)`,
            en: (nc.n && nc.n.en ? nc.n.en + " " : "") + `(Fits your knack for ${tNameEn})`
          };
        }
      }
      if (d.id === "d_24_role" && c.set && c.set.role) {
        const r = c.set.role;
        const fitMaj = life.major && (MAJORS[life.major] && (MAJORS[life.major].bias || []).includes(r));
        const fitDrm = (DREAM_ROLES[drmId] || []).includes(r);
        const notesKo = [], notesEn = [];
        if (fitMaj) { notesKo.push("전공과 연결됨"); notesEn.push("matches your major"); }
        if (fitDrm) { notesKo.push(`어릴 적 꿈 ‘${life.dream.ko}’과 맞닿음`); notesEn.push(`aligns with childhood dream (${life.dream.en})`); }
        if (notesKo.length) {
          nc.n = {
            ko: (nc.n && nc.n.ko ? nc.n.ko + " " : "") + `(${notesKo.join(" · ")})`,
            en: (nc.n && nc.n.en ? nc.n.en + " " : "") + `(${notesEn.join(" · ")})`
          };
        }
      }
      return nc;
    });
    return out;
  }

  // 연인 후보: 매 삶에 다른 사람이 온다. 직업·집안·성격·나이·만남 계기가 조합된다.
  const LOVER_TAGS_OK = ["corp", "public", "teacher", "nurse", "startup", "free", "self", "research",
    "arts", "medical", "military", "rich", "poor", "dual", "singleparent", "rural", "bigfam", "immig",
    "ambitious", "calm", "warm", "prickly", "planner", "impulsive", "older", "younger"];
  function rollLovers(life, count) {
    const pool = C.lovers || [];
    if (!pool.length) return [];
    const m = life._mem || loadMem();
    const n = memWindow(m);
    const seen = life.loverSeen || [];
    const wf = x => {
      let w = 1;
      const c = (m.lovers && m.lovers[x.id]) || 0;
      w *= c / n >= 0.5 ? 0.08 : c / n >= 0.25 ? 0.3 : 1;
      if (seen.indexOf(x.id) >= 0) w *= 0.05;
      return w;
    };
    const out = [];
    let cands = pool.slice();
    while (out.length < count && cands.length) {
      const pickd = wpick(cands, wf);
      cands = cands.filter(x => x !== pickd);
      if (out.some(x => x.id === pickd.id)) continue;
      out.push(pickd);
    }
    const opp = life.sex === "f" ? "m" : "f";
    return out.map(a => {
      const nm = koreanName(opp);
      const gr = a.gapRange || (a.gap === "older" ? [3, 9] : a.gap === "younger" ? [-6, -3] : [-1, 1]);
      const age = Math.max(18, life.age + ri(gr[0], gr[1]) + (R() < 0.35 ? 1 : 0));
      return {
        id: a.id, name: nm.ko, nameEn: nm.en, sex: opp, age,
        job: a.job.ko, jobEn: a.job.en, fam: a.fam.ko, famEn: a.fam.en,
        trait: a.trait.ko, traitEn: a.trait.en, route: a.route.ko, routeEn: a.route.en,
        intro: a.intro, first: a.first, fit: a.fit, tags: a.tags || [],
        gap: a.gap, met: life.age
      };
    });
  }
  function partnerJobEn(c) { return c.jobEn || c.job; }
  function setPartner(life, c) {
    if (!c) return;
    life.family.partner = {
      name: c.name, nameEn: c.nameEn, sex: c.sex, age: c.age, alive: true,
      health: 70 + ri(-6, 10), relation: 66 + ri(-4, 10),
      job: c.job, jobEn: c.jobEn, fam: c.fam, famEn: c.famEn,
      trait: c.trait, traitEn: c.traitEn, route: c.route, routeEn: c.routeEn,
      tags: c.tags, intro: c.intro, first: c.first, fit: c.fit, met: c.met,
      income: (function () {
        const tg = c.tags || [];
        const mult = tg.includes("medical") ? 2.05 : tg.includes("rich") ? 1.55 : (tg.includes("corp") || tg.includes("research")) ? 1.2 : (tg.includes("public") || tg.includes("teacher") || tg.includes("nurse")) ? 1.05 : (tg.includes("free") || tg.includes("arts") || tg.includes("poor")) ? 0.68 : 0.95;
        return Math.round(Math.max(2400, life.income || 3000) * mult * (0.85 + R() * 0.3));
      })()
    };
    life.flags.dating = true;
    life.flags.partnerTags = (c.tags || []).slice();
    life.flags.partnerId = c.id;
    life.flags.partnerFam = c.fam;
    life.flags.partnerJob = c.job;
    life.flags.partnerGap = c.gap;
    (life.loverSeen = life.loverSeen || []).push(c.id);
    life.flags.justMet = 1;
  }
  function loverDecision(life) {
    const round = life.loveRound || 0;
    const cands = life.loverCands && life.loverCands.length ? life.loverCands : (life.loverCands = rollLovers(life, 3));
    const en = false;
    const ch = cands.map((c, i) => ({
      id: "c" + i, lover: i, tag: "love",
      t: { ko: c.name + " · " + c.age + "세 · " + c.job, en: c.nameEn + " · " + c.age + " · " + partnerJobEn(c) },
      n: { ko: c.fam + " · " + c.trait + " · " + c.route + ". " + c.intro.ko, en: c.famEn + ", " + c.traitEn + ", " + c.routeEn + ". " + c.intro.en },
      st: { happiness: 3, relation: 3, stress: 1 }, money: -8, inc: 0, set: {}, flags: {},
      meta: { fam: c.fam, famEn: c.famEn, trait: c.trait, traitEn: c.traitEn, tags: c.tags, gap: c.gap }
    }));
    ch.push({
      id: "skip", tag: "culture",
      t: { ko: "이번에는 넘긴다", en: "Not this time" },
      n: { ko: "만남을 미루면 그 사람과의 다음 기회가 없을 수 있습니다.", en: "If you pass, there may be no next chance with them." },
      st: { happiness: -2, relation: -1, stress: 0 }, money: 0, inc: 0, set: {}, flags: {}
    });
    return {
      id: "d_love_" + round, age: life.age, dyn: "love",
      badge: { ko: "결정 · 연인", en: "Decision · A Partner" },
      t: { ko: "누구와 만날까", en: "Who Will You Meet" },
      b: {
        ko: "요즘 들어 자리를 권하는 연락이 잇따릅니다. 세 사람을 만나 보게 되었고, 각자 다른 직업과 집안, 다른 말투로 저녁을 보냈습니다. 이번 생의 몇 년을 누구와 겪을지 정해야 합니다.",
        en: "Lately the invitations keep coming. You have now spent an evening with three different people, each with their own work, family, and way of talking. The next few years will be shared with one of them, or with none."
      },
      ch
    };
  }

  function prepEvent(e) {
    if (!e || PREPPED.has(e)) return e;
    // 같은 사건이 매 삶 같은 나이에만 나오지 않도록, 한 해짜리 사건은 두어 해 늦게도 허용한다
    if (e.age && e.age[0] === e.age[1] && e.age[0] >= 6 && !e.fixedAge) {
      e.age = [e.age[0], Math.min(e.age[0] + (e.age[0] < 19 ? 2 : 3), 104)];
    }
    if (!e.cond) {
      const c = {};
      if (e.sex && e.sex !== "any" && e.sex !== "all") c.sex = String(e.sex).toUpperCase();
      if (e.reg && e.reg !== "any") c.zone = [e.reg];
      if (e.cls && e.cls !== "any") c.cls = [e.cls];
      if (e.era && e.era !== "any") c.era = [e.era];
      if (e.yr) c.year = e.yr;
      if (e.path) c.path = e.path;
      if (e.fam) {
        const pa = [];
        if (e.fam.m) pa.push("mother");
        if (e.fam.f) pa.push("father");
        if (pa.length) c.parentsAlive = pa;
        if (e.fam.k) c.kids = [1, 9];
      }
      e.cond = c;
    }
    if (e.sex === "any") e.sex = "all";
    PREPPED.add(e);
    return e;
  }
  function prepAll() { (C.events || []).forEach(prepEvent); }

  // ---------- condition DSL ----------
  function condOK(life, c) {
    if (!c) return true;
    if (c.any) { if (!c.any.some(x => condOK(life, x))) return false; }
    if (c.not && condOK(life, c.not)) return false;
    if (c.sex) {
      // "ALL"/"ANY"는 성별 제한 없음. (v2.2 콘텐츠에는 "ALL"이 문자열로 남아 있어 그대로 비교하면 그 사건이 영영 나오지 않는다)
      const want = String(c.sex).toUpperCase();
      if (want !== "ALL" && want !== "ANY" && want !== String(life.sex).toUpperCase()) return false;
    }
    if (c.age) { if (life.age < c.age[0] || life.age > c.age[1]) return false; }
    if (c.year) { if (life.year < c.year[0] || life.year > c.year[1]) return false; }
    if (c.loc && c.loc.indexOf(life.region.id) < 0) return false;
    if (c.zone && c.zone.indexOf(life.zone) < 0) return false;
    if (c.cls && c.cls.indexOf(life.cls) < 0) return false;
    if (c.era && c.era.indexOf(life.era) < 0) return false;
    if (c.path && c.path.indexOf(life.flags.path || "academic") < 0) return false;
    if (c.job && c.job.indexOf(life.job) < 0) return false;
    if (c.emp) {
      const et = life.flags.empType || empTypeOf(life);
      const want = Array.isArray(c.emp) ? c.emp : [c.emp];
      if (want.indexOf(et) < 0) return false;
    }
    if (c.invest) {
      const want = Array.isArray(c.invest) ? c.invest : [c.invest];
      const style = life.flags.investStyle || life.alloc || "safe";
      if (want.indexOf(style) < 0) return false;
    }
    if (c.edu && c.edu.indexOf(life.edu) < 0) return false;
    if (c.major && c.major.indexOf(life.major) < 0) return false;
    if (c.role && c.role.indexOf(life.role) < 0) return false;
    if (c.marital) {
      const m = life.flags.widowed ? "widowed" : life.flags.divorced ? "divorced" : life.flags.married ? "married" : "single";
      const want = Array.isArray(c.marital) ? c.marital : [c.marital];
      if (want.indexOf(m) < 0) return false;
    }
    if (c.kids) { const k = life.flags.childrenCount || 0; if (k < c.kids[0] || k > c.kids[1]) return false; }
    if (c.ageKids) {   // 자녀 나이 조건: [최소,최대]
      const ks = (life.family.children || []).filter(k => k.alive !== false).map(k => k.age);
      if (!ks.some(a => a >= c.ageKids[0] && a <= c.ageKids[1])) return false;
    }
    if (c.parentsAlive) {
      const want = c.parentsAlive;   // 배열: mother/father/both/none/any
      if (want === "none") { if (life.flags.fatherAlive || life.flags.motherAlive) return false; }
      else if (want === "both") { if (!(life.flags.fatherAlive && life.flags.motherAlive)) return false; }
      else if (want === "any") { if (!(life.flags.fatherAlive || life.flags.motherAlive)) return false; }
      else {
        for (const p of want) {
          if (p === "mother" && !life.flags.motherAlive) return false;
          if (p === "father" && !life.flags.fatherAlive) return false;
        }
      }
    }
    if (c.flags) for (const k in c.flags) {
      const v = !!life.flags[k], want = !!c.flags[k];
      if (v !== want) return false;
    }
    if (c.flagIs) for (const k in c.flagIs) {
      const want = Array.isArray(c.flagIs[k]) ? c.flagIs[k] : [c.flagIs[k]];
      if (want.indexOf(life.flags[k]) < 0) return false;
    }
    if (c.spouseAlive != null) {
      const alive = !!(life.family && life.family.spouse && life.family.spouse.alive);
      if (alive !== !!c.spouseAlive) return false;
    }
    if (c.hasPartner != null) {
      const has = !!(life.flags.dating || life.family.partner || (life.flags.married && life.family.spouse));
      if (has !== !!c.hasPartner) return false;
    }
    if (c.partnerTags) {
      const mine = life.flags.partnerTags || null;
      if (!mine) return false;
      const want = Array.isArray(c.partnerTags) ? c.partnerTags : [c.partnerTags];
      if (!want.some(t => mine.indexOf(t) >= 0)) return false;
    }
    if (c.gte) for (const k in c.gte) { if ((+life.flags[k] || 0) < c.gte[k]) return false; }
    if (c.lte) for (const k in c.lte) { if ((+life.flags[k] || 0) > c.lte[k]) return false; }
    if (c.stat) for (const k in c.stat) {
      const v = life.stats[k] || 0;
      if (v < c.stat[k][0] || v > c.stat[k][1]) return false;
    }
    if (c.income) { const v = life.income || 0; if (v < c.income[0] || v > c.income[1]) return false; }
    if (c.netWorth) { const v = netWorth(life); if (v < c.netWorth[0] || v > c.netWorth[1]) return false; }
    return true;
  }

  // ---------- economy ----------
  const JOB_BASE = { none: 0, office: 3400, trade: 2900, public: 3150, self: 2500, free: 2280, farm: 2100 };
  const JOB_KO = { none: "무직", office: "사무·관리직", trade: "기술·생산직", public: "공무원·공공기관", self: "자영업", free: "프리랜서", farm: "농림어업" };
  const JOB_EN = { none: "No paid work", office: "Office and management", trade: "Skilled trades and production", public: "Public service", self: "Self-employed", free: "Freelance", farm: "Farming and fishing" };

  const NOMINAL = (year) => Math.pow(1.024, year - 2026);
  const eduMul = (e) => ({ none: 0.82, high: 0.86, college: 0.94, university: 1.0, grad: 1.14 }[e] || 0.9);
  const zoneMul = (z) => ({ metro: 1.07, city: 0.96, rural: 0.85 }[z] || 1);
  function ageCurve(a) {
    if (a < 22) return 0.3;
    if (a < 30) return 0.72 + (a - 22) * 0.035;
    if (a < 45) return 1.0 + (a - 30) * 0.012;
    if (a < 52) return 1.18;
    if (a < 58) return 1.18 - (a - 52) * 0.02;
    if (a < 65) return 1.06 - (a - 58) * 0.03;
    return 0.4;
  }
  function wagePeakFactor(life) {
    // 임금피크제: 52세를 기준으로 매년 4%씩 줄어 65세에 0.5
    if (!life.flags.wagePeak) return 1;
    const start = life.wagePeakAt || 52;
    return clamp(1 - 0.04 * (life.age - start), 0.5, 1);
  }
  const PENSION_MIN_AGE = 63;

  function computeIncome(life) {
    const nom = NOMINAL(life.year);
    const items = { labor: 0, pension: 0, asset: 0, other: 0 };
    const m = macroFor(life.year);
    const working = life.flags.employed && !life.flags.retired && life.age >= 19 && life.age < 70;
    if (working) {
      const role = (life.role && life.role !== "none") ? ROLES[life.role] : null;
      const baseJob = role ? (JOB_BASE[role.job] || 0) : (JOB_BASE[life.job] || 0);
      const rmul = role ? role.mul : 1;
      let labor = baseJob * rmul * eduMul(life.edu) * zoneMul(life.zone) * ageCurve(life.age);
      labor *= 1 + clamp(life.stats.spec, 0, 100) * 0.005;         // 역량·스펙
      labor *= 1 + clamp(life.stats.reputation - 40, -40, 60) * 0.0010;  // 평판
      labor *= 1 + (life.wageBonus || 0);
      if (life.sex === "f") labor *= 0.93;                          // 측정된 성별 임금격차
      labor *= wagePeakFactor(life);
      if (m) labor *= m.job;
      items.labor = Math.max(0, Math.round(labor * nom));
      // 임금피크제 이후 근로소득은 다시 늘지 않는다(보너스·호봉 변동 포함)
      if (life.flags.wagePeak) {
        if (life.peakLabor == null) life.peakLabor = items.labor;
        else { items.labor = Math.min(items.labor, life.peakLabor); life.peakLabor = items.labor; }
      } else {
        life.peakLabor = items.labor;
      }
    }
    if (life.age >= PENSION_MIN_AGE) {
      const yrs = Math.min(40, life.contribYears || 0);
      items.pension = Math.round(660 * (0.35 + yrs / 40 * 0.65) * nom);
    }
    const rate = { safe: 0.021, stock: 0.045, coin: 0.02, none: 0.015 }[life.alloc] || 0.02;
    items.asset = Math.round((life.cash * 0.016 + life.assets * rate) * 1);
    if (life.married && life.family && life.family.spouse && life.family.spouse.alive && life.family.spouse.age < 65) {
      const spBase = life.family.spouse.income || 2400;
      items.other = Math.round(spBase * 0.45 * nom);
    }
    items.total = items.labor + items.pension + items.asset + items.other;
    return items;
  }

  function updateIncome(life) {
    const it = computeIncome(life);
    life.incomeItems = it;
    life.income = it.total;
    return it;
  }

  function homePrice(life) {
    return Math.round(26000 * zoneMul(life.zone) * HOUSING_INDEX(life.year) / HOUSING_INDEX(2026));
  }
  function housingCost(life) {
    const price = homePrice(life);
    if (life.home === "own") return { upkeep: Math.round(price * 0.009), rent: 0 };
    if (life.home === "wolse") return { upkeep: 0, rent: Math.round(price * 0.032) };
    if (life.home === "jeonse") return { upkeep: 0, rent: Math.round((life.deposit || 0) * 0.012) };
    return { upkeep: 0, rent: 0 };
  }

  const BIG_COSTS = [
    { at: 45, key: "edu", need: l => l.flags.childrenCount > 0, amt: 2200 },
    { at: 52, key: "uni", need: l => l.flags.childrenCount > 0, amt: 3000 },
    { at: 62, key: "wed", need: l => l.flags.childrenCount > 0, amt: 3200 },
    { at: 70, key: "med", need: () => true, amt: 1200 },
    { at: 79, key: "med2", need: () => true, amt: 1600 }
  ];
  function lifeCycleCost(life) {
    life.paid = life.paid || {};
    const nom = NOMINAL(life.year);
    for (const c of BIG_COSTS) {
      if (life.age === c.at && !life.paid[c.key] && c.need(life)) {
        life.paid[c.key] = 1;
        let need = Math.round(c.amt * nom);
        life.lastBigCost = need;
        const fromCash = Math.min(life.cash, need); life.cash -= fromCash; need -= fromCash;
        const fromAssets = Math.min(life.assets, need); life.assets -= fromAssets; need -= fromAssets;
        if (need > 0) life.debt += need;
      }
    }
  }

  // 연지출 내역: 항목별로 계산해 합계와 함께 남긴다 (UI 내역 공개용)
  function expenseBreakdown(life) {
    const nom = NOMINAL(life.year);
    const it = { housing: 0, food: 0, living: 0, education: 0, care: 0, taxInterest: 0, leisure: 0, health: 0 };
    if (life.age < 19) { it.total = 0; return it; }
    const h = housingCost(life);
    it.housing = Math.round(h.rent + h.upkeep);
    const kids = (life.family.children || []).filter(k => k.alive !== false);
    // 소득이 늘면 식비·생활비·여가도 함께 는다(저축률이 비현실적으로 커지지 않게)
    const inc = life.income || 0;
    it.food = Math.round(Math.max((215 + 32 * kids.length) * nom * (life.married ? 1.25 : 1), inc * 0.105));
    it.living = Math.round(Math.max((168 + 26 * kids.length) * nom * (life.home === "own" ? 1.15 : 1), inc * 0.115));
    let edu = 0;
    if (life.flags.inCollege) edu += 760;
    for (const k of kids) {
      if (k.age < 6) edu += 430;
      else if (k.age < 13) edu += 390;
      else if (k.age < 19) edu += 520;
      else if (k.age < 25) edu += 880;
    }
    for (const k of (life.family.children || []).filter(k => k.age >= 19 && k.age < 25)) edu += 160;
    it.education = Math.round(edu * nom);
    let care = 0;
    if (life.flags.caregivingParent) care += 340;
    if (life.family.spouse && life.family.spouse.alive && life.family.spouse.health < 50) care += 260;
    if (life.care) care += 300 * life.care;
    it.care = Math.round(care * nom);
    it.taxInterest = Math.round((life.income || 0) * 0.078 + (life.debt || 0) * 0.042);
    const leisureBase = life.stats.stress > 65 ? 70 : 128;
    it.leisure = Math.round(Math.max(leisureBase * nom * (life.flags.retired ? 0.85 : 1), inc * 0.07));
    it.health = Math.round((38 + Math.max(0, 55 - life.stats.health) * 2.2 + (life.age > 60 ? 55 : 0)) * nom);
    // 생활비 모드: 사용자가 고른 식비·여가·생활·건강 지출 수준을 반영한다
    const sm = life.spendMode || {};
    const mul = { food: { save: 0.8, normal: 1, generous: 1.24 }, leisure: { save: 0.55, normal: 1, generous: 1.5 },
                  living: { save: 0.88, normal: 1, generous: 1.12 }, health: { save: 0.75, normal: 1, generous: 1.4 } };
    for (const k of ["food", "living", "leisure", "health"]) {
      const m = (mul[k] || {})[sm[k]] || 1;
      if (m !== 1) it[k] = Math.round((it[k] || 0) * m);
    }
    let total = Object.values(it).reduce((a, b) => a + b, 0);
    // 소득이 있는데 지출이 소득을 넘으면 항목 비율을 유지한 채 소득의 97%로 줄인다
    const cap = (life.income || 0) * 0.97;
    if (life.income > 0 && total > cap && total > 0) {
      const k = cap / total;
      for (const key of Object.keys(it)) it[key] = Math.round(it[key] * k);
      total = Math.round(cap);
    }
    it.total = total;
    return it;
  }

  // 지출을 어디에 쓸지는 몸과 마음에도 남는다
  function spendModeEffect(life) {
    const sm = life.spendMode || {};
    const pick = (k) => sm[k] || "normal";
    if (pick("food") === "save") { bump(life, "health", -0.4); bump(life, "happiness", -0.5); bump(life, "stress", 0.3); }
    if (pick("food") === "generous") { bump(life, "health", 0.6); bump(life, "happiness", 0.8); bump(life, "stress", -0.4); }
    if (pick("leisure") === "save") { bump(life, "happiness", -1.0); bump(life, "stress", 0.9); }
    if (pick("leisure") === "generous") { bump(life, "happiness", 1.4); bump(life, "stress", -1.6); }
    if (pick("health") === "save") { bump(life, "health", -0.8); }
    if (pick("health") === "generous") { bump(life, "health", 1.1); bump(life, "stress", -0.3); }
    if (pick("living") === "generous") { bump(life, "happiness", 0.3); }
    if (pick("living") === "save") { bump(life, "happiness", -0.3); }
  }

  function yearEconomics(life) {
    updateIncome(life);
    lifeCycleCost(life);
    if (life.flags.employed && !life.flags.retired) life.contribYears = Math.min(40, (life.contribYears || 0) + 1);
    const ex = expenseBreakdown(life);
    life.expenseItems = ex;
    life.expenses = ex.total;
    if (life.age < 19) { life.expenses = 0; return; }
    spendModeEffect(life);

    const net = life.income - life.expenses;
    if (net > 0) {
      const repay = Math.min(life.debt, Math.round(net * 0.55));
      life.debt -= repay;
      const left = net - repay;
      const saveRate = { safe: 0.15, stock: 0.13, coin: 0.10, none: 0.17 }[life.alloc] || 0.14;
      const save = left * saveRate;
      life.cash += Math.round(save * (life.alloc === "safe" ? 0.75 : 0.25));
      life.assets += Math.round(save * (life.alloc === "safe" ? 0.25 : 0.75));
      life.cash += Math.round(left * (1 - saveRate));
    } else {
      let need = -net;
      const fromCash = Math.min(life.cash, need);
      life.cash -= fromCash; need -= fromCash;
      if (need > 0) life.debt += Math.round(need);
      if (life.cash <= 0 && need > 0) life.stats.happiness -= 1;
    }
    const m = macroFor(life.year);
    const stockR = { safe: 0.026, stock: R() < 0.2 ? -0.1 : 0.05, coin: R() < 0.5 ? -0.28 : 0.26, none: 0.02 }[life.alloc] || 0.03;
    if (life.assets > 0) life.assets = Math.round(life.assets * (1 + stockR));
    if (life.assets < 0) life.assets = 0;
    if (life.home === "own") {
      const g = 0.028 + (m ? m.house : 0);
      life.homeValue = Math.round(life.homeValue * (1 + g));
    }
    life.cash = Math.max(0, Math.round(life.cash));
  }

  // ---------- family ----------
  function addChild(life) {
    const sex = R() < 0.5 ? "f" : "m";
    const nm = koreanName(sex);
    const k = { name: nm.ko, nameEn: nm.en, sex, age: 0, alive: true, health: 74 + ri(-8, 12), relation: 78 + ri(-6, 8), job: "—", edu: "none" };
    life.family.children.push(k);
    life.flags.childrenCount = life.family.children.filter(x => x.alive !== false).length;
    life.kids = life.flags.childrenCount;
    return k;
  }
  function syncChildren(life) {
    while ((life.family.children || []).length < (life.kids || 0)) addChild(life);
    if (life.family.children.length > (life.kids || 0)) {
      // 자녀 수가 줄어드는 선택은 없다. 수를 맞추지 않고 그대로 둔다.
    }
    life.flags.childrenCount = life.family.children.filter(x => x.alive !== false).length;
  }
  function familyTick(life) {
    const out = [];
    const fa = life.familyAges || {};
    const fam = life.family;
    // 연애 중인 사람도 해마다 한 살씩 든다. 오래 만나고 헤어지기도 한다.
    if (fam.partner && fam.partner.alive) {
      fam.partner.age = (fam.partner.age || life.age) + 1;
      fam.partner.health = clamp(fam.partner.health - (fam.partner.age > 70 ? 1.4 : 0.35), 0, 100);
      const years = life.age - (fam.partner.met || life.age);
      if (years >= 3 && R() < 0.06 + (life.flags.partnerGap === "younger" ? 0.02 : 0)) {
        const p = fam.partner;
        life.flags.dating = false; life.flags.exPartner = p.name; life.flags.partnerTags = null;
        fam.partner = null;
        const splitNo = life.flags.splitCount || 0;
        life.flags.splitCount = splitNo + 1;
        const splitVars = [
          { t: { ko: "마지막 통화", en: "The Last Call" }, b: { ko: "몇 해를 만난 사람과 헤어졌습니다. 돌려받은 우산과 충전기를 상자에 넣고, 문 앞에 놓인 택배를 대신 받아 주던 이웃에게 인사를 했습니다.", en: "After several years, the two of you end it. You put the returned umbrella and charger in a box, and greet the neighbour who used to take in your deliveries." } },
          { t: { ko: "돌려받은 열쇠", en: "Returned Keys" }, b: { ko: "서로의 일정이 어긋난 끝에 각자의 자리로 돌아가기로 합니다. 공유하던 달력 앱을 지우고, 현관 선반에 놓여 있던 여분의 열쇠를 정리합니다.", en: "After schedules drift too far apart, you agree to part ways, clearing shared calendars and spare keys from the shelf." } },
          { t: { ko: "각자의 계절", en: "Separate Seasons" }, b: { ko: "오래 붙잡고 있던 인연을 조용히 내려놓습니다. 함께 찍은 사진을 폴더 하나에 모아 둔 뒤, 다시 혼자만의 주말을 맞습니다.", en: "You quietly let go of a relationship you held onto for years, archiving old photos into one folder." } }
        ];
        const sv = splitVars[splitNo % splitVars.length];
        out.push({
          id: "love_split_" + splitNo, ic: "💔", src: "src_marriage", cat: "love",
          t: sv.t, b: sv.b,
          st: { health: 0, happiness: -9, knowledge: 0, relation: -4, reputation: 0, spec: 0, stress: 8 }, money: 0, inc: 0
        });
      }
    }
    // 조부모: 해마다 한 살씩, 아프고, 떠난다
    for (const w of ["gma", "gpa"]) {
      const gp = fam[w];
      if (!gp || !gp.alive) continue;
      gp.age = (gp.age || 0) + 1;
      gp.health = clamp(gp.health - (gp.age > 78 ? 2.3 : gp.age > 68 ? 1.0 : 0.45), 0, 100);
      const limit = (life.gpDeath && life.gpDeath[w]) || 250;
      const risk = gp.age >= limit ? 1 : clamp(Math.pow(Math.max(0, gp.age - 68) / 42, 4) * 0.6 + (gp.health < 22 ? 0.34 : gp.health < 38 ? 0.12 : 0.002), 0, 1);
      if (R() < risk) {
        gp.alive = false;
        life.flags[w + "Alive"] = false;
        const other = w === "gma" ? fam.gpa : fam.gma;
        if (!(other && other.alive)) life.flags.gpNone = true;
        out.push(w === "gma" ? {
          id: "fam_gma", ic: "🕯", src: "src_death", cat: "family",
          t: { ko: "할머니의 장례", en: "Your Grandmother's Funeral" },
          b: { ko: "할머니가 새벽에 돌아가셨다. 상주가 아닌데도 마당에서 국을 끓이고 손님을 맞았다. 상을 치르고 나니 그 집의 부엌이 가장 넓게 느껴졌다.", en: "Your grandmother died before dawn. Though not the chief mourner, you cooked in the yard and greeted visitors. After the funeral, the kitchen in that house seemed the largest room of all." },
          st: { health: -2, happiness: -8, knowledge: 0, relation: 4, reputation: 0, spec: 0, stress: 7 }, money: -320, inc: 0,
          set: { flags: { gmaAlive: false } }
        } : {
          id: "fam_gpa", ic: "🕯", src: "src_death", cat: "family",
          t: { ko: "할아버지의 빈의자", en: "Your Grandfather's Empty Chair" },
          b: { ko: "할아버지가 병원에서 돌아오지 못했다. 라디오와 안경, 담배 냄새가 남은 방을 정리하며 서랍에서 동전 봉지를 찾았다.", en: "Your grandfather did not come back from the hospital. Clearing the room that still smelled of radio and tobacco, you found a pouch of coins in a drawer." },
          st: { health: -2, happiness: -7, knowledge: 0, relation: 3, reputation: 0, spec: 0, stress: 6 }, money: -280, inc: 0,
          set: { flags: { gpaAlive: false } }
        });
      }
    }
    if (fam.mother && fam.mother.alive) {
      fam.mother.age = (fam.mother.age || 0) + 1;
      fam.mother.health = clamp(fam.mother.health - (fam.mother.age > 70 ? 1.9 : 0.55), 0, 100);
    }
    if (fam.father && fam.father.alive) {
      fam.father.age = (fam.father.age || 0) + 1;
      fam.father.health = clamp(fam.father.health - (fam.father.age > 70 ? 2.0 : 0.6), 0, 100);
    }
    if (fam.spouse && fam.spouse.alive) {
      fam.spouse.age = (fam.spouse.age || 0) + 1;
      fam.spouse.health = clamp(fam.spouse.health - (fam.spouse.age > 65 ? 1.7 : 0.45) - (life.married ? 0 : 0), 0, 100);
    }
    for (const k of fam.children || []) {
      if (!k.alive) continue;
      k.age += 1;
      if (k.age === 19) k.edu = "high";
      if (k.age === 22 && life.edu === "university") k.edu = "university";
      if (k.age === 25 && k.job === "—") k.job = pick(["회사원", "공무원", "기술직", "프리랜서", "대학원생", "자영업"]);
      if (k.age >= 30 && k.job === "—") k.job = "회사원";
    }
    // 부모 사망: 나이·건강 기반. 이미 돌아가신 뒤에는 다시 일어나지 않는다.
    const maybeDie = (who, label) => {
      const p = fam[who]; if (!p || !p.alive) return;
      const limit = life.parentDeath[who];
      const ageRisk = p.age >= (limit || 200) ? 1 : (p.age > 65 ? Math.pow((p.age - 65) / 40, 4) * 0.5 : 0.002);
      const healthRisk = p.health < 25 ? 0.35 : p.health < 40 ? 0.12 : 0;
      if (R() < clamp(ageRisk + healthRisk, 0, 1)) {
        p.alive = false;
        life.flags[who + "Alive"] = false;
        if (who === "father") life.parents.father = false;
        if (who === "mother") life.parents.mother = false;
        out.push(who === "father" ? {
          id: "fam_father", ic: "🕯", src: "src_death", cat: "family",
          t: { ko: "아버지의 장례", en: "Your Father's Funeral" },
          b: { ko: "아버지가 새벽에 숨을 거두었다. 사흘 동안 빈소를 지키며 조문객의 이름을 적었고, 마지막 날에는 당신이 상주로 서 있었다.", en: "Your father died before dawn. You kept the wake for three days, writing down the names of visitors, and stood as chief mourner on the last day." },
          st: { health: -2, happiness: -9, knowledge: 0, relation: 3, reputation: 0, spec: 0, stress: 8 }, money: -450, inc: 0
        } : {
          id: "fam_mother", ic: "🕯", src: "src_death", cat: "family",
          t: { ko: "어머니의 빈방", en: "Your Mother's Empty Room" },
          b: { ko: "어머니가 병원에서 돌아오지 못했다. 집을 정리하다 냉장고에 남은 반찬과 달력에 적힌 약 복용 시간을 발견했다.", en: "Your mother did not come home from the hospital. Clearing the house, you found side dishes left in the fridge and medicine times pencilled on the calendar." },
          st: { health: -2, happiness: -10, knowledge: 0, relation: 2, reputation: 0, spec: 0, stress: 8 }, money: -380, inc: 0
        });
      }
    };
    maybeDie("father"); maybeDie("mother");
    // 배우자 사망
    const sp = fam.spouse;
    if (sp && sp.alive && sp.age > 62 && R() < clamp(Math.pow((sp.age - 62) / 45, 3) * 0.5 + (sp.health < 30 ? 0.2 : 0), 0, 0.5)) {
      sp.alive = false; life.flags.spouseAlive = false; life.flags.widowed = true;
      // 사별한 뒤에도 married가 1로 남아 기록 화면이 '배우자와 함께 살았습니다'로 끝나던 문제
      life.flags.married = false; life.married = 0;
      out.push({
        id: "fam_spouse", ic: "🕯", src: "src_death", cat: "family",
        t: { ko: "배우자의 빈자리", en: "The Empty Chair" },
        b: { ko: "배우자가 먼저 떠났다. 장례를 마치고 돌아온 집에서 이불을 두 개에서 하나로 줄이고, 아침에 누구에게 말을 거는 습관을 고치지 못해 혼잣말을 한다.", en: "Your spouse went first. Back home after the funeral you fold two duvets into one, and still speak out loud to someone at breakfast." },
        st: { health: -3, happiness: -12, relation: -6, reputation: 0, spec: 0, stress: 12 }, money: -520, inc: 0
      });
    }
    return out;
  }

  // ---------- events ----------
  function matchEvent(e, life, extraYears) {
    if (life.age < e.age[0]) return false;
    // 한 사건은 원래 나이대에서만: 최대 +2년까지만 늦게 허용
    if (life.age > e.age[1] + (extraYears || 0)) return false;
    if (!condOK(life, e.cond)) return false;
    return true;
  }

  const FOCUS_CAT = {
    work:   { work: 3.4, study: 2.0, money: 1.12, health: 0.55, family: 0.6, culture: 0.6, civic: 1.1, love: 0.5 },
    love:   { love: 3.3, family: 2.6, health: 0.8, work: 0.7, study: 0.6, money: 0.8, culture: 1.25, civic: 1.0 },
    health: { health: 3.3, culture: 1.2, family: 0.9, work: 0.6, money: 0.7, love: 0.7, study: 0.6, civic: 0.7 },
    money:  { money: 3.2, work: 1.7, study: 1.1, health: 0.8, family: 0.7, love: 0.6, culture: 0.8, civic: 0.9 },
    balance:{ work: 1.05, study: 1.05, money: 1.05, health: 1.15, family: 1.1, love: 1.05, culture: 1.15, civic: 1.0 }
  };

  function focusWeight(life, e) {
    const f = FOCUS_CAT[life.focus] || FOCUS_CAT.balance;
    const k = e.cat || "culture";
    return f[k] != null ? f[k] : 1;
  }

  function hid(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  // 이 삶에서 잠든 사건: 두 삶이 같은 사건 목록을 갖지 않게 하는 장치.
  // 씨앗마다 22%의 사건이 이번 생에는 일어나지 않는다.
  function hasSpecificCond(c) {
    if (!c) return false;
    return !!(c.partnerTags || c.role || c.major || c.flagIs || c.loc || c.stat || c.emp || c.ageKids || c.zone);
  }
  function dormant(life, id, spec) {
    if (!life._skip) life._skip = {};
    if (life._skip[id] == null) life._skip[id] = hid(id + ":" + life.seed) < (spec ? 0.14 : 0.42);
    return life._skip[id];
  }
  function eligiblePool(life, extra) {
    return C.events.filter(e => {
      if (dormant(life, e.id, hasSpecificCond(e.cond))) return false;
      if (e.age[0] > life.age) return false;
      if (life.age > e.age[1] + (extra || 0)) return false;
      if (!condOK(life, e.cond)) return false;
      if (life.usedIds[e.id] && !(e.repeat && life.age - ((life.lastSeen && life.lastSeen[e.id]) || 0) >= e.repeat)) return false;
      // 되풀이되는 사건도 한 삶에 두 번까지만(같은 문장이 세 번 나오면 반복으로 읽힌다)
      if (life.usedIds[e.id] >= 2) return false;
      // 다른 id라도 제목이 같은 장면은 한 인생에 한 번만 보여 준다(같은 사건이 두 번 나오는 것처럼 읽히지 않게)
      if (life.seenTitles && e.t && e.t.ko && life.seenTitles[e.t.ko]) return false;
      return true;
    });
  }

  function pickEvents(life, count) {
    const out = [];
    // 초점 카테고리에서 최소 한 건을 보장한다 (초점 선택이 체감되도록)
    const focusCat = life.focus === "work" ? ["work", "study"] : life.focus === "love" ? ["love", "family"] : life.focus === "health" ? ["health"] : life.focus === "money" ? ["money"] : [];
    let pool = eligiblePool(life, 0);
    if (!pool.length) pool = eligiblePool(life, 2);
    if (life._gentle) {
      const HEAVY_EV = /자살|학대|폭력|구타|중독|성폭|살해|유산|치매/;
      const safe = pool.filter(e => !HEAVY_EV.test((e.t && e.t.ko || "") + " " + (e.b && e.b.ko || "")));
      if (safe.length) pool = safe;
    }
    if (!pool.length) return out;
    let forced = null;
    if (life.age >= 6 && focusCat.length && R() < 0.72) {
      const fp = pool.filter(e => focusCat.indexOf(e.cat) >= 0);
      if (fp.length) forced = wpick(fp, x => x.w * memWeight(life, x.id));
    }
    for (let i = 0; i < count; i++) {
      if (!pool.length) break;
      let cands = pool.filter(e => e !== forced && out.indexOf(e) < 0);
      if (!cands.length) break;
      const ctxW = (x) => {
        const c = x.cond;
        if (!c) return 1;
        let m = 1;
        if (c.partnerTags) m *= 2.8;
        if (c.role || c.major || c.flagIs || c.loc || c.ageKids) m *= 2.1;
        if (c.emp || c.marital || c.kids) m *= 1.3;
        return m;
      };
      const e = forced && out.indexOf(forced) < 0 && i === 0 ? forced
        : wpick(cands, x => x.w * memWeight(life, x.id) * focusWeight(life, x) * ctxW(x) * (x.age[1] === x.age[0] ? 1.2 : 1));
      out.push(e);
      life.usedIds[e.id] = (life.usedIds[e.id] || 0) + 1;
      life.lastSeen[e.id] = life.age;
      if (e.t && e.t.ko) { life.seenTitles = life.seenTitles || {}; life.seenTitles[e.t.ko] = 1; }
      pool = pool.filter(x => x !== e && !(e.t && e.t.ko && x.t && x.t.ko === e.t.ko));
    }
    return out;
  }

  function applyEvent(life, e) {
    let dHap = 0, dRel = 0, dHea = 0;
    for (const k of ["health", "happiness", "knowledge", "relation", "reputation", "spec", "stress"]) {
      const v = (e.st && e.st[k]) || 0;
      if (!v) continue;
      bump(life, k, v);
      if (k === "happiness") dHap += v; else if (k === "relation") dRel += v; else if (k === "health") dHea += v;
    }
    stressLink(life, dHap, dRel, dHea);
    if (e.money) {
      if (life.age < 19) { if (e.money > 0) life.cash += Math.round(e.money * 0.05); }
      else if (e.money > 0) life.cash += e.money;
      else {
        let need = -e.money;
        const fromCash = Math.min(life.cash, need);
        life.cash -= fromCash;
        if (need - fromCash > 0) life.debt += Math.round((need - fromCash) * 1.02);
      }
    }
    if (e.inc) life.wageBonus = clamp((life.wageBonus || 0) + e.inc, -0.15, 0.2);
    if (e.set) applySet(life, e.set);
    if (e.fam) {
      // 가족 상태 변화(관계·건강)
      if (e.fam.rel) for (const who of ["mother", "father"]) if (life.family[who] && life.family[who].alive) life.family[who].relation = clamp(life.family[who].relation + e.fam.rel, 0, 100);
      if (life.family.spouse && life.family.spouse.alive && e.fam.relSpouse) life.family.spouse.relation = clamp(life.family.spouse.relation + e.fam.relSpouse, 0, 100);
    }
  }

  function applySet(life, s) {
    if (!s) return;
    if (s.edu) {
      life.edu = s.edu;
      if (s.edu === "university" && life.age >= 18 && life.age <= 25) life.flags.inCollege = true;
      if (s.edu === "grad") life.flags.inCollege = false;
    }
    if (s.path) life.flags.path = s.path;
    if (s.major) {
      life.major = s.major; life.flags.majorChosen = true; life.flags.inCollege = true; life.history && (life.majorYear = life.year);
      const talId = life.talent && life.talent.id;
      if (talId && (TALENT_MAJORS[talId] || []).includes(s.major)) bump(life, "spec", 4);
    }
    if (s.role) {
      life.role = s.role; life.lastRole = s.role;
      life.flags.roleChosen = true;
      const r = ROLES[s.role];
      if (r && r.job) life.job = r.job;
      life.flags.empType = empTypeOf(life);
      const drmId = life.dream && life.dream.id;
      if (drmId) life.flags.dreamMatched = (DREAM_ROLES[drmId] || []).includes(s.role);
      const talId = life.talent && life.talent.id;
      if (talId && (TALENT_ROLES[talId] || []).includes(s.role)) {
        bump(life, "spec", 4);
        life.wageBonus = clamp((life.wageBonus || 0) + 0.04, -0.15, 0.25);
      }
    }
    if ((s.role || s.job) && s.job !== "none" && s.employed !== false && !life.flags.entryGrade) {
      const g = gradeFor(life);
      life.flags.entryScore = g.score; life.flags.entryGrade = g.grade;
    }
    if (s.job) {
      if (s.job === "none" && life.job !== "none") { life.lastJob = life.job; }
      life.job = s.job;
      life.flags.employed = s.job !== "none";
      if (s.job !== "none") life.flags.retired = false;
    }
    if (s.employed != null) { life.flags.employed = !!s.employed; if (!s.employed) life.job = "none"; }
    if (s.home) setHome(life, s.home);
    if (s.married != null) {
      if (s.married) marry(life);
      else { life.married = 0; life.flags.married = false; }
    }
    if (s.divorce) { life.married = 0; life.flags.married = false; life.flags.divorced = true; if (life.family.spouse) life.family.spouse.alive = false; if (life.family.spouse) life.family.spouse = null; }
    if (s.widow) { life.married = 0; life.flags.married = false; life.flags.widowed = true; }
    if (s.kids != null) { life.kids = s.kids; syncChildren(life); }
    if (s.addKid) { addChild(life); life.kids = life.flags.childrenCount; }
    if (s.care != null) life.care = s.care;
    if (s.retired != null) {
      life.retired = s.retired;
      life.flags.retired = !!s.retired;
      if (s.retired) { life.retireAge = life.age; life.flags.employed = false; if (life.job !== "none") life.lastJob = life.job; life.job = "none"; }
    }
    if (s.wagePeak != null) {
      life.flags.wagePeak = !!s.wagePeak;
      if (s.wagePeak && life.wagePeakAt == null) life.wagePeakAt = life.age;
    }
    if (s.inCollege != null) life.flags.inCollege = !!s.inCollege;
    if (s.militaryDone != null) life.flags.militaryDone = !!s.militaryDone;
    if (s.caregiving != null) life.flags.caregivingParent = !!s.caregiving;
    if (s.inherited != null) life.flags.inherited = !!s.inherited;
    if (s.chronic != null) life.flags.chronic = !!s.chronic;
    if (s.contestWin) { life.flags.contestWin = true; }
    if (s.alba) life.flags.albaExp = (life.flags.albaExp || 0) + s.alba;
    if (s.invest) life.alloc = s.invest === "safe" ? "safe" : s.invest === "stock" ? "stock" : s.invest === "coin" ? "coin" : life.alloc;
    if (s.stat) for (const k in s.stat) life.stats[k] = clamp(s.stat[k], 0, 100);
    if (s.flags) for (const k in s.flags) {
      life.flags[k] = s.flags[k];
      // 수술·입원은 몇 해 동안 다른 사건을 막는 상태로 남는다
      if (k === "recovering" && s.flags[k]) life.flags.recoveringUntil = life.age + 2;
      if (k === "hospitalized" && s.flags[k]) life.flags.hospitalizedUntil = life.age + 1;
    }
    syncStats(life);
  }

  function marry(life) {
    if (life.flags.widowed) life.flags.widowed = false;
    life.flags.married = true; life.married = 1;
    life.flags.dating = false;
    const pt = life.family.partner;
    if (!life.family.spouse || !life.family.spouse.alive) {
      if (pt && pt.alive !== false) {
        // 연인으로 만난 사람과 혼인한다: 이름·나이·직업·집안이 그대로 이어진다
        life.family.spouse = {
          name: pt.name, nameEn: pt.nameEn, sex: pt.sex, alive: true, age: pt.age,
          health: pt.health, relation: pt.relation, job: pt.job, jobEn: pt.jobEn,
          fam: pt.fam, famEn: pt.famEn, trait: pt.trait, traitEn: pt.traitEn,
          tags: pt.tags, gap: pt.gap, met: pt.met, income: pt.income || 0
        };
        life.family.partner = null;
        life.flags.partnerTags = (pt.tags || []).slice();
      } else {
        const sex = life.sex === "f" ? "m" : "f";
        const nm = koreanName(sex);
        const spPool = [
          { ko: "회사원", en: "Office worker", tags: ["corp"] },
          { ko: "교사", en: "Teacher", tags: ["teacher"] },
          { ko: "간호사", en: "Nurse", tags: ["nurse"] },
          { ko: "자영업", en: "Small business owner", tags: ["self"] },
          { ko: "공무원", en: "Civil servant", tags: ["public"] },
          { ko: "프리랜서", en: "Freelancer", tags: ["free"] },
          { ko: "의사", en: "Doctor", tags: ["medical"] }
        ];
        const spDef = pick(spPool);
        const mult = spDef.tags[0] === "medical" ? 2.0 : spDef.tags[0] === "corp" ? 1.15 : spDef.tags[0] === "free" ? 0.72 : 1.0;
        life.family.spouse = {
          name: nm.ko, nameEn: nm.en, sex, alive: true, age: life.age + ri(-2, 3),
          health: 72 + ri(-8, 10), relation: 74 + ri(-6, 8),
          job: spDef.ko, jobEn: spDef.en, tags: spDef.tags.slice(),
          income: Math.round(Math.max(2400, life.income || 2800) * mult * (0.8 + R() * 0.35))
        };
        life.flags.partnerTags = spDef.tags.slice();
        life.flags.partnerJob = spDef.ko;
      }
    }
  }

  function setHome(life, h) {
    if (h !== life.home) life.moves++;
    life.home = h;
    life.flags.hasHome = h === "own";
    if (h === "own" && !life.homeValue) {
      const price = homePrice(life);
      const down = Math.round(price * 0.3);
      let rest = down;
      const useCash = Math.min(life.cash, rest); life.cash -= useCash; rest -= useCash;
      life.assets = Math.max(0, life.assets - rest);
      life.homeValue = price;
      life.debt += price - down;
      life.deposit = 0;
    }
    if (h === "jeonse") {
      life.deposit = Math.round(homePrice(life) * 0.68);
      life.debt += Math.round(life.deposit * 0.35);
      life.homeValue = 0;
    }
    if (h === "wolse" || h === "none") { life.deposit = 0; life.homeValue = h === "none" ? 0 : life.homeValue; }
  }

  // ---------- yearly focus ----------
  const FOCUS_EFFECT = {
    study:   { health: -0.3, happiness: -0.1, knowledge: 1.4, relation: -0.7, reputation: 0.3, spec: 1.6, stress: 1.1, income: 0 },
    health:  { health: 2.6, happiness: 0.5, knowledge: 0, relation: -0.3, reputation: 0, spec: 0, stress: -3.2, income: 0 },
    work:    { health: -1.0, happiness: -0.2, knowledge: 0.5, relation: -0.9, reputation: 0.7, spec: 1.5, stress: 2.0, income: 0.045 },
    love:    { health: 0.3, happiness: 1.3, knowledge: 0, relation: 2.8, reputation: 0.2, spec: 0, stress: -1.4, income: -0.02 },
    money:   { health: -0.4, happiness: 0.2, knowledge: 0.9, relation: -0.5, reputation: 0.3, spec: 0.6, stress: 0.6, income: 0.028 },
    balance: { health: 0.9, happiness: 0.9, knowledge: 0.4, relation: 0.5, reputation: 0.2, spec: 0.4, stress: -1.0, income: 0 }
  };

  function applyFocus(life) {
    if (life.age < 6) return;
    const f = FOCUS_EFFECT[life.focus] || FOCUS_EFFECT.balance;
    life.stats.health = clamp(life.stats.health + f.health, 0, 100);
    life.stats.happiness = clamp(life.stats.happiness + f.happiness, 0, 100);
    bump(life, "knowledge", f.knowledge * (life.age > 60 ? 0.3 : 1));
    life.stats.relation = clamp(life.stats.relation + f.relation, 0, 100);
    life.stats.reputation = clamp(life.stats.reputation + f.reputation, 0, 100);
    life.stats.spec = clamp(life.stats.spec + f.spec * (life.age > 65 ? 0.1 : life.age > 55 ? 0.5 : 1), 0, 100);
    life.stats.stress = clamp(life.stats.stress + f.stress, 0, 100);
    life.wageBonus = clamp((life.wageBonus || 0) + f.income, -0.15, 0.2);
    life.ageFocusLog.push(life.focus);
  }

  function drift(life) {
    const a = life.age;
    let dh = -0.25;
    if (a >= 40) dh -= 0.35;
    if (a >= 60) dh -= 0.55;
    if (a >= 75) dh -= 0.7;
    if (life.cls === "low") dh -= 0.15;
    if (life.flags.chronic) dh -= 0.5;
    if (life.stats.stress > 65) dh -= 0.45;
    life.stats.health = clamp(life.stats.health + dh, 0, 100);
    const target = 38 + life.stats.health * 0.19 + life.stats.relation * 0.17 - Math.max(0, life.stats.stress - 55) * 0.3;
    life.stats.happiness = clamp(life.stats.happiness + (target - life.stats.happiness) * 0.1, 0, 100);
    if (a > 22) life.stats.relation = clamp(life.stats.relation - 0.45, 0, 100);
    if (a < 22) bump(life, "knowledge", 0.18);
    if (a > 55) bump(life, "knowledge", -0.35);
    // 스트레스는 저절로 조금씩 풀리고, 관계가 좋을수록 더 빨리 풀린다
    const relEase = life.stats.relation > 60 ? (life.stats.relation - 60) * 0.02 : 0;
    const happyEase = life.stats.happiness > 65 ? (life.stats.happiness - 65) * 0.015 : 0;
    const dailyLoad = (a >= 19 && a < 70 && life.flags.employed) ? 0.9 : 0;
    life.stats.stress = clamp(life.stats.stress - (a > 60 ? 1.2 : 0.55) - relEase - happyEase + dailyLoad, 0, 100);
    // 일하는 동안은 스트레스가 완전히 사라지지 않는다
    if (life.flags.employed && a >= 19 && a < 68 && life.stats.stress < 22) life.stats.stress += (22 - life.stats.stress) * 0.2;
    if (life.stats.stress > 70) life.stats.happiness = clamp(life.stats.happiness - 0.4, 0, 100);
    // 임금 보정은 해마다 조금씩 원래 자리로 돌아간다(한 해의 성과가 영구 배수가 되지 않게)
    life.wageBonus = clamp((life.wageBonus || 0) * 0.9, -0.15, 0.2);
    // 역량은 40대까지 조금씩 늘고, 60 이후에는 천천히 줄어든다
    if (a >= 22 && a < 45) life.stats.spec = clamp(life.stats.spec + 0.15, 0, 100);
    if (a >= 60) life.stats.spec = clamp(life.stats.spec - 0.25, 0, 100);
  }

  // ---------- decisions ----------
  // 한 해에 한 장만 띄운다. 같은 나이에 두 장이 겹치면 다음 해로 넘긴다.
  function decisionFor(life) {
    if (!life.decQueue) life.decQueue = [];
    const queued = d => life.decQueue.indexOf(d.id) >= 0;
    // 연애: 정해진 나이가 아니라 이 삶이 뽑은 두어 해에 온다(매 삶 다른 시점).
    if (!life.flags.married && !(life.family && life.family.partner)) {
      const round = life.loveRound || 0;
      const at = (life.loveAt || [])[round];
      if (at != null && life.age >= at && life.age <= 46 && !life.flags["d_love_" + round]) {
        return loverDecision(life);
      }
    }
    for (const d of C.decisions) {
      if (life.decisions.indexOf(d.id) >= 0 || queued(d)) continue;
      if (d.age != null) {
        const a0 = Array.isArray(d.age) ? d.age[0] : d.age;
        const a1 = Array.isArray(d.age) ? d.age[1] : d.age + 1;
        if (life.age < a0 || life.age > a1) continue;
      }
      const c = d.cond;
      if (c) {
        // 결정 카드의 cond도 같은 규칙으로 검사한다(성별·부모 생존 등)
        if (!condOK(life, c)) continue;
      } else {
        const path = (life.flags && life.flags.path) || "academic";
        if (d.only && d.only.indexOf(path) < 0) continue;
        if (d.sex && d.sex !== "any" && d.sex !== "all" && String(d.sex).toUpperCase() !== String(life.sex).toUpperCase()) continue;
      }
      // 이번 삶에서 이 카드를 건너뛸 확률(opt): 해마다 같은 카드가 같은 나이에 나오지 않게
      if (d.opt && life.age === d.age) {
        if (R() < d.opt) { life.decisions.push(d.id); continue; }
      }
      if (!queued(d)) life.decQueue.push(d.id);
    }
    // 예정된 결정이 없는 해에는 상황별 일상 결정이 자주 온다 (맞춤 조건 가중치로 매 판 다른 선택지)
    if (!life.decQueue.length && life.age >= 8) {
      const p = life.age < 19 ? 0.28 : 0.42;
      if (R() < p) {
        const pool = (C.daily || []).filter(d => {
          const spec = hasSpecificCond(d.cond);
          if (hid("dly:" + d.id + ":" + life.seed) < (spec ? 0.12 : 0.24)) return false;
          if (life.decisions.indexOf(d.id) >= 0 || queued(d)) return false;
          if (life.age < d.age[0] || life.age > d.age[1]) return false;
          if (d.usedIn && life.usedIds["dly_" + d.id]) return false;
          return condOK(life, d.cond);
        });
        if (pool.length) life.decQueue.push(wpick(pool, x => (x.w || 1) * (hasSpecificCond(x.cond) ? 2.2 : 1) * memWeight(life, x.id)).id);
      }
    }
    while (life.decQueue.length) {
      const id = life.decQueue[0];
      const d = (C.decisions || []).find(x => x.id === id) || (C.daily || []).find(x => x.id === id);
      if (!d || !condOK(life, d.cond)) { life.decQueue.shift(); continue; }
      if (d.age != null && life.age > (Array.isArray(d.age) ? d.age[1] : d.age + 1)) { life.decQueue.shift(); continue; }
      if (life.decisions.indexOf(d.id) >= 0) { life.decQueue.shift(); continue; }
      // 일상 결정은 나이 범위를 가지므로, 화면에 띄울 때는 지금 나이를 붙인다
      if (Array.isArray(d.age)) return filledDecision(Object.assign({}, d, { ageRange: d.age, age: life.age }), life);
      return filledDecision(d, life);
    }
    return null;
  }

  function choiceAvailable(life, ch) {
    const nd = ch.need;
    if (!nd) return { ok: true };
    if (nd.stat) for (const k in nd.stat) if ((life.stats[k] || 0) < nd.stat[k]) return { ok: false, why: nd.why };
    if (nd.money != null && life.cash + life.assets < nd.money) return { ok: false, why: nd.why };
    if (nd.edu && nd.edu.indexOf(life.edu) < 0) return { ok: false, why: nd.why };
    return { ok: true };
  }

  function applyChoice(life, dec, ch) {
    // 연인 카드: 고른 사람이 이 삶의 연인이 된다
    if (dec && dec.dyn === "love") {
      if (ch && ch.lover != null) setPartner(life, life.loverCands[ch.lover]);
      if (ch && ch.st) for (const k in ch.st) if (ch.st[k]) bump(life, k, ch.st[k]);
      life.loveRound = (life.loveRound || 0) + 1;
      life.loverCands = [];
      if (life.decQueue) life.decQueue = life.decQueue.filter(x => x !== dec.id);
      if (life.decisions.indexOf(dec.id) < 0) life.decisions.push(dec.id);
      life.flags[dec.id] = ch ? ch.id : "skip";
      life.flags.empType = empTypeOf(life);
      return;
    }
    let dHap = 0, dRel = 0, dHea = 0;
    for (const k of ["health", "happiness", "knowledge", "relation", "reputation", "spec", "stress"]) {
      const v = (ch.st && ch.st[k]) || 0;
      if (!v) continue;
      bump(life, k, v);
      if (k === "happiness") dHap += v; else if (k === "relation") dRel += v; else if (k === "health") dHea += v;
    }
    stressLink(life, dHap, dRel, dHea);
    if (ch.money && life.age < 19) {
      if (ch.money > 0) life.cash += Math.round(ch.money * 0.03);
    } else if (ch.money) {
      if (ch.money > 0) life.cash += ch.money;
      else {
        let need = -ch.money;
        const use = Math.min(life.cash, need);
        life.cash -= use; need -= use;
        if (need > 0) life.debt += Math.round(need * 1.02);
      }
    }
    if (ch.inc) life.wageBonus = clamp((life.wageBonus || 0) + ch.inc, -0.15, 0.2);
    applySet(life, ch.set || {});
    if (ch.flags) for (const k in ch.flags) life.flags[k] = ch.flags[k];
    if (life.decQueue) life.decQueue = life.decQueue.filter(x => x !== dec.id);
    if (life.decisions.indexOf(dec.id) < 0) life.decisions.push(dec.id);
    life.flags[dec.id] = ch.id;
    life.flags.empType = empTypeOf(life);
  }

  // ---------- death ----------
  function hazard(life) {
    const a = life.age;
    if (a < 30) return 0.00025;
    if (a < 45) return 0.0018 + (a - 30) * 0.0003;
    const g = 0.0009 * Math.exp(0.083 * (a - 45));
    const hm = clamp(1 + (55 - life.stats.health) / 30, 0.45, 3.4);
    return clamp(g * hm, 0, 0.5);
  }
  function pickDeathCause(life) {
    const pool = life._gentle ? C.deaths.filter(d => !/자살/.test(d.cause)) : C.deaths;
    if (life.age < 40) {
      const young = pool.filter(d => /사고|자살|암/.test(d.cause));
      return wpick(young, d => d.cause === "사고" ? 5 : d.cause === "암" ? 3 : 2);
    }
    const bucket = life.age >= 90 ? "90" : life.age >= 75 ? "75" : "60";
    return wpick(pool, d => (d.weight[bucket] || 1) * (life.stats.health < 40 && /암|심장|뇌혈관|폐렴|패혈/.test(d.cause) ? 1.4 : 1));
  }
  function makeDeath(life, cause) {
    life.death = {
      age: life.age, year: life.year,
      cause: cause ? cause.cause : "노환",
      causeEn: cause ? cause.causeEn : "Old age",
      line: cause ? cause.line : { ko: "잠든 채로 아침이 오지 않았다.", en: "The morning did not come." }
    };
    // 이 삶에서 나온 사건을 기억에 남긴다: 다음 삶은 다른 사건들로 채워진다
    try { recordLife(life); } catch (e) { /* 기억 저장 실패는 삶을 막지 않는다 */ }
    return life.death;
  }

  // ---------- livelihood (일자리·은퇴) ----------
  function ensureLivelihood(life) {
    const out = [];
    // 대학은 24세에 졸업한다(학사 기준). 진학한 사람이 학위 없이 남아 있지 않게 한다.
    if (life.flags.inCollege && life.age >= 24) {
      life.flags.inCollege = false; life.flags.graduated = true;
      if (life.edu === "none" || life.edu === "high") life.edu = "university";
      out.push({
        id: "liv_graduate", ic: "🎓", src: "src_edu", cat: "study",
        t: { ko: "학위복을 입는 날", en: "The Day in the Gown" },
        b: { ko: "졸업식에서 학위복을 입고 사진을 찍습니다. 가족이 꽃다발을 들고 왔고, 식이 끝난 뒤에는 아버지가 조용히 어깨를 두드립니다.", en: "You wear the gown at graduation and have your photo taken. Your family brings flowers, and afterwards your father quietly pats your shoulder." },
        st: { health: 0, happiness: 5, knowledge: 2, relation: 3, reputation: 2, spec: 2, stress: 2 }, money: -40, inc: 0
      });
    }
    // 27세까지 일자리가 없으면 첫 직장을 구한다.
    if (!life.flags.employed && !life.flags.retired && life.job === "none" && life.role === "none" && life.age >= 27 && life.age <= 29) {
      const grade = entryGrade(life);
      life.role = grade.role;
      life.job = ROLES[grade.role].job;
      life.flags.employed = true;
      life.flags.roleChosen = true;
      life.lastRole = grade.role;
      out.push({
        id: "liv_first_job", ic: "💼", src: "src_job", cat: "work",
        t: { ko: "첫 정규직", en: "The First Steady Job" },
        b: { ko: "오래 미뤄 두었던 취업을 마무리하고 첫 정규직 계약서에 서명합니다. 출근 첫날 사원증 사진을 찍고, 점심시간에는 같은 팀 사람들의 이름을 공책에 적습니다.", en: "You finally sign a first full-time contract. On your first morning you have your ID photo taken and, at lunch, write the names of your new team in a notebook." },
        st: { health: -1, happiness: 2, knowledge: 1, relation: 1, reputation: 1, spec: 2, stress: 6 }, money: 0, inc: 0
      });
    }
    if (!life.flags.retired && !life.flags.retireEventShown && life.age >= 65) {
      const wasEmployed = !!life.flags.employed && life.job !== "none";
      const prevJob = life.job;
      const prevRole = life.role;
      life.flags.retired = true; life.retired = 1; life.retireAge = life.age;
      if (life.job !== "none") life.lastJob = life.job;
      life.lastRole = life.role;
      life.job = "none"; life.flags.employed = false;
      if (wasEmployed && !life.flags.retireEventShown) {
        life.flags.retireEventShown = true;
        const isSelf = prevJob === "self" || prevRole === "self";
        const isFree = prevJob === "free" || prevRole === "free";
        const isFarm = prevJob === "farm" || prevRole === "farm";
        const rText = isSelf
          ? { t: { ko: "가게 불을 끄는 저녁", en: "Closing the Shop for Good" }, b: { ko: "오래 지켜 온 가게의 간판 불을 마지막으로 내립니다. 단골손님에게 남은 재고를 챙겨 주고 열쇠 꾸러미를 서랍에 넣습니다.", en: "You switch off the shop sign for the last time, hand leftover stock to a regular, and leave the keys in the drawer." } }
          : isFree
          ? { t: { ko: "마지막 마감", en: "The Final Deadline" }, b: { ko: "마지막 의뢰 작업을 마치고 계약 폴더를 닫습니다. 수십 년 동안 닳은 작업 노트와 명함을 정리하며 일에서 한 걸음 물러납니다.", en: "You deliver your last commission and close the project folder, stepping back from decades of freelance deadlines." } }
          : isFarm
          ? { t: { ko: "밭을 내어주는 계절", en: "Handing Over the Fields" }, b: { ko: "예전 같지 않은 무릎과 허리를 느끼며 올해 농사를 끝으로 일손을 내려놓습니다. 창고의 농기계를 닦아 두고 마루에 앉습니다.", en: "Feeling the years in your knees and back, you finish one last harvest, clean the tools in the shed, and sit on the porch." } }
          : { t: { ko: "마지막 출근", en: "The Last Commute" }, b: { ko: "정년이 되어 사무실 책상을 비웁니다. 서랍에서 오래된 명함과 회사 로고가 찍힌 머그잔을 꺼내 종이상자에 담고, 엘리베이터에서 동료들과 마지막으로 인사를 나눕니다.", en: "You clear your desk at retirement. Old business cards and a company mug go into a cardboard box, and you say a last goodbye in the elevator." } };
        out.push({
          id: "liv_retire", ic: "🕰", src: "src_income", cat: "work",
          t: rText.t, b: rText.b,
          st: { health: 1, happiness: -2, knowledge: 0, relation: 1, reputation: 0, spec: 0, stress: -8 }, money: 0, inc: 0
        });
      }
    }
    return out;
  }

  // 대학 스펙/알바/공모전이 첫 직장 등급과 초봉으로 이어진다
  function gradeFor(life) {
    const spec = life.stats.spec || 0;
    const rep = life.stats.reputation || 0;
    const major = MAJORS[life.major] || MAJORS.none;
    let score = spec * 0.7 + rep * 0.3 + (major.spec || 0);
    if (life.edu === "grad") score += 14;
    else if (life.edu === "college") score -= 6;
    else if (life.edu === "high") score -= 12;
    if (life.flags.albaExp) score += Math.min(8, life.flags.albaExp * 0.7);
    if (life.flags.contestWin) score += 7;
    return { score: Math.round(score), grade: score >= 62 ? "대기업·전문직" : score >= 42 ? "중견·정규직" : "중소·계약직" };
  }

  function entryGrade(life) {
    const spec = life.stats.spec || 0;
    const rep = life.stats.reputation || 0;
    const major = MAJORS[life.major] || MAJORS.none;
    let score = spec * 0.7 + rep * 0.3 + (major.spec || 0);
    if (life.edu === "grad") score += 14;
    else if (life.edu === "college") score -= 6;
    else if (life.edu === "high") score -= 12;
    if (life.flags.albaExp) score += Math.min(8, life.flags.albaExp * 0.7);
    if (life.flags.contestWin) score += 7;
    // 점수대에 따라 직무 후보를 좁힌다
    const bias = major.bias.length ? major.bias : ["trade", "sales", "self"];
    const highPaying = ["dev", "research", "finance", "med", "mkt"];
    let role;
    if (score >= 62 && bias.some(b => highPaying.indexOf(b) >= 0)) role = pick(bias.filter(b => highPaying.indexOf(b) >= 0));
    else if (score >= 45) role = pick(bias);
    else role = pick(bias.filter(b => highPaying.indexOf(b) < 0).concat(["trade", "sales"]).filter(Boolean));
    if (!role) role = "trade";
    const grade = score >= 62 ? "대기업·전문직" : score >= 42 ? "중견·정규직" : "중소·계약직";
    life.flags.entryScore = Math.round(score);
    life.flags.entryGrade = grade;
    return { role, score, grade };
  }

  // ---------- main tick ----------
  function tick(life, opt) {
    life._gentle = !!(opt && opt.gentle);
    if (life.death) return { death: life.death };
    life.age += 1;
    life.year += 1;
    // 지난해의 수술·입원 상태는 정해진 해가 지나면 풀린다
    if (life.flags.recovering && life.age > (life.flags.recoveringUntil || 0)) { life.flags.recovering = false; delete life.flags.recoveringUntil; }
    if (life.flags.hospitalized && life.age > (life.flags.hospitalizedUntil || 0)) { life.flags.hospitalized = false; delete life.flags.hospitalizedUntil; }
    if (life.spendMode == null) life.spendMode = { food: "normal", leisure: "normal", living: "normal", health: "normal" };
    applyFocus(life);
    life.flags.empType = empTypeOf(life);
    drift(life);
    const liveEvs = ensureLivelihood(life);
    const famEvs = familyTick(life);
    yearEconomics(life);

    let evs = liveEvs.concat(famEvs).concat(pickEvents(life, life.age < 6 ? 1 : (R() < 0.55 ? 2 : 1)));
    // 태어난 집: 첫해 기록 맨 앞에 그 집의 냄새·소리를 한 장면 남긴다
    if (life.age === 1 && !life.flags.homeShown) {
      const h = homeRef(life);
      if (h) {
        evs.unshift({
          id: "home_open_" + (life.homeKind || "x"), ic: "🏠", src: "src_census", cat: "family",
          t: { ko: "태어난 집", en: "The House You Were Born Into" }, b: h.open
        });
      }
      life.flags.homeShown = true;
    }
    // 연인을 고른 직후: 그 사람과의 첫 주를 한 장면으로
    if (life.flags.justMet) {
      const p = life.family && life.family.partner;
      if (p) {
        const meetRound = Math.max(0, (life.loveRound || 1) - 1);
        const meetTitles = [
          { ko: "사귀기로 한 첫 주", en: "The First Week Together" },
          { ko: "새로 맞춘 저녁 약속", en: "A New Evening Together" },
          { ko: "다시 열어 둔 자리", en: "Making Room Again" }
        ];
        evs.unshift({
          id: "meet_first_" + (life.flags.partnerId || "x") + "_" + meetRound, ic: "💌", src: "src_marriage", cat: "love",
          t: meetTitles[meetRound % meetTitles.length], b: p.first
        });
      }
      life.flags.justMet = 0;
    }
    // 가족의 마지막 장면도 매번 같은 문장이 되지 않게 여러 결로 쓴다
    const FAM_VAR = {
      fam_mother: [
        { ko: "어머니가 돌아오지 못한 뒤 병실에서 가져온 겉옷을 세탁소에 맡깁니다. 옷깃에 밴 소독약 냄새가 덜 빠지지 않아 며칠을 창가에 걸어 두고, 냉장고 문에는 누가 마지막으로 적어 둔 장보기 메모가 아직 남아 있습니다.", en: "The coat brought back from the hospital goes to the cleaners. The smell of disinfectant lingers, so it hangs by the window for days, while a shopping list in someone else's handwriting stays on the fridge door." },
        { ko: "어머니의 병원비 영수증이 봉투째 쌓입니다. 그것을 상자에 넣어 다락에 올리고, 대신 냉장고의 반찬통을 하나씩 비우고 씻습니다. 마지막 통을 씻을 때 흐르는 물소리가 부엌 전체를 채웁니다.", en: "Receipts for your mother's hospital bills pile up in an envelope. You put them in a box, carry it to the loft, and empty the side-dish containers one by one. The water runs loud in the empty kitchen as you wash the last one." }
      ],
      fam_father: [
        { ko: "아버지가 떠난 뒤에도 새벽에 현관 등이 켜져 있던 습관을 고치지 못합니다. 사흘 빈소를 지키고 돌아온 날, 구두 한 켤레에 신문지를 접어 넣고 전화를 받지 않습니다. 다음 날 아침 그 신문지의 날짜가 장례 첫날이라는 것을 알아차립니다.", en: "Your father's habit of leaving the porch light on at dawn outlasts him. The evening you come home from three days at the funeral hall, you stuff newspaper into a pair of his shoes and let the phone ring. In the morning you notice the date on the paper is the first day of the funeral." },
        { ko: "아버지의 서랍에서 영수증과 함께 저축통장이 나옵니다. 잔액보다 먼저 눈에 들어온 것은 마지막 거래일이고, 당신은 그 통장을 덮은 뒤 현관의 구두를 정리합니다. 장례 뒤 사흘째, 신발장 아래 휴지통이 서류로 가득 차 있습니다.", en: "In your father's drawer, a savings passbook turns up with the receipts. You notice the date of the last transaction before the balance, close it, and go sort the shoes at the door. Three days after the funeral, the bin below the shoe cabinet is full of paper." }
      ],
      fam_spouse: [
        { ko: "배우자가 먼저 떠난 뒤 이불장의 두꺼운 이불을 하나만 남기고 나머지를 포장합니다. 저녁상에 그릇을 두 개 올렸다가 하나를 내려놓고, 사흘째 되는 날에야 욕실의 칫솔 하나를 버립니다.", en: "After your spouse goes first, all but one of the heavy duvets are wrapped and stored. You set two bowls for dinner, then take one away, and only on the third day throw out the second toothbrush." },
        { ko: "장례 뒤 집으로 돌아오는 길에 배우자의 운전면허증 사진이 생각납니다. 현관을 열고 신발 한 켤레를 아래칸으로 옮기고, 냉장고 문을 열었다 그대로 닫습니다. 다음 주에야 반찬을 절반으로 줄여 담습니다.", en: "On the walk home from the funeral you think of the photo on your spouse's driving licence. At the door you move one pair of shoes to the lower shelf, open the fridge, and close it again. Only the next week do you cook half the side dishes." }
      ],
      fam_gma: [
        { ko: "할머니가 떠난 뒤 마당의 장독 뚜껑을 처음으로 직접 엽니다. 상을 치르는 동안 이웃이 가져온 국그릇을 씻어 돌려주고, 부엌 문턱에 놓인 고무신 한 켤레는 그대로 뒀습니다. 그 집 부엌의 시계는 아직 할머니가 맞춰 둔 시간에 서 있습니다.", en: "For the first time you lift the lids of the soy jars in the yard yourself. During the funeral you wash and return the soup bowls neighbours brought, and leave a pair of rubber shoes on the kitchen step. The clock in her kitchen still shows the time she set." }
      ],
      fam_gpa: [
        { ko: "할아버지의 방에서 라디오를 켜 봅니다. 안경집과 손때 묻은 성냥갑, 서랍의 동전 봉지를 한 곳에 모으고, 장례 뒤에 그 방문을 닫아 뒀습니다. 복도 끝에서 아직 담배 냄새가 납니다.", en: "You switch on the radio in your grandfather's room. The glasses case, a matchbox worn smooth, and the pouch of coins from the drawer go into one place; after the funeral you close the door. Tobacco still hangs at the end of the corridor." }
      ]
    };
    evs = evs.map(e => {
      const v = FAM_VAR[e.id];
      if (!v || !v.length || R() > 0.7) return e;
      return Object.assign({}, e, { b: v[Math.floor(R() * v.length)] });
    });
    // 같은 사건이라도 매번 같은 문장이 되지 않게, alt(다른 결말)를 절반좀 쓴다
    evs = evs.map(e => (e.alt && R() < 0.45 ? { id: e.id, ic: e.ic, src: e.src, cat: e.cat, t: e.t, b: e.alt, alt: e.b, st: e.st, money: e.money, inc: e.inc, set: e.set, fam: e.fam, cond: e.cond } : e));
    evs = evs.map(e => filledEvent(e, life));
    // 사건이 일어나기 직전의 상태(선후관계 검증의 기준)
    const pre = {
      age: life.age, year: life.year, role: life.role,
      empType: life.flags.empType || empTypeOf(life),
      married: !!life.flags.married, dating: !!life.flags.dating, widowed: !!life.flags.widowed,
      fatherAlive: !!life.flags.fatherAlive, motherAlive: !!life.flags.motherAlive,
      gmaAlive: !!life.flags.gmaAlive, gpaAlive: !!life.flags.gpaAlive, gpNone: !!life.flags.gpNone,
      gpSetup: life.flags.gpSetup, childArc: life.flags.childArc,
      spouseAlive: !!(life.family.spouse && life.family.spouse.alive),
      kids: life.flags.childrenCount || 0,
      recovering: !!life.flags.recovering, hospitalized: !!life.flags.hospitalized
    };
    // 같은 해에 뽑힌 사건들이 서로를 무효화할 수 있다(배우자 사망 뒤 부부 여행, 퇴사 뒤 회사 장면).
    // 적용 직전에 조건을 다시 확인해, 앞선 사건이 뒤집은 상황을 그대로 이어받지 않게 한다.
    evs.forEach(e => {
      if (e.cond && !condOK(life, e.cond)) return;
      applyEvent(life, e);
      if (!e.repeat && e.t && e.t.ko) { life.seenTitles = life.seenTitles || {}; life.seenTitles[e.t.ko] = 1; }
    });

    // 동기
    life.peers.forEach(p => {
      p.age = life.age;
      const ms = p.milestones.filter(m => m.age <= life.age);
      p.milestoneAge = ms.length ? ms[ms.length - 1].age : 0;
      const deathM = p.milestones.find(m => m.death && m.age <= life.age);
      p.alive = !deathM;
    });

    const rec = {
      age: life.age, year: life.year,
      happiness: Math.round(life.stats.happiness), health: Math.round(life.stats.health),
      reputation: Math.round(life.stats.reputation), spec: Math.round(life.stats.spec), stress: Math.round(life.stats.stress),
      wealth: netWorth(life), income: life.income,
      labor: life.incomeItems.labor, pension: life.incomeItems.pension,
      expenses: life.expenses,
      event: evs.length ? evs[0].t : null
    };
    life.history.push(rec);
    life.incomeLog.push({
      age: life.age, year: life.year,
      labor: life.incomeItems.labor, pension: life.incomeItems.pension, asset: life.incomeItems.asset,
      total: life.income, expenses: life.expenses, items: Object.assign({}, life.expenseItems),
      retired: !!life.flags.retired, wagePeak: !!life.flags.wagePeak, employed: !!life.flags.employed
    });
    life.statLog.push({ age: life.age, health: rec.health, happiness: rec.happiness, relation: Math.round(life.stats.relation), knowledge: Math.round(life.stats.knowledge), reputation: rec.reputation, spec: rec.spec, stress: rec.stress });

    const dec = decisionFor(life);
    if (dec) { life.pendingDecision = dec; return { events: evs, pre, decision: dec }; }

    const refl = [5, 15, 30, 50, 70].includes(life.age);
    if (refl) { life.pendingReflection = true; return { events: evs, pre, reflection: life.age }; }

    const dead = life.age >= 105 ? true : R() < hazard(life);
    if (dead) {
      const c = pickDeathCause(life);
      const d = makeDeath(life, life.age >= 100 && life.stats.health > 55 ? C.deaths.find(x => x.cause === "노환") : c);
      return { events: evs, pre, death: d };
    }
    return { events: evs, pre };
  }

  // ---------- record ----------
  function netWorth(life) { return Math.round(life.cash + life.assets + life.homeValue + (life.deposit || 0) - life.debt); }

  function wealthPercentile(w) {
    const pts = [[-5000, 3], [0, 10], [3000, 22], [8000, 34], [15000, 45], [25000, 56], [40000, 67],
                 [60000, 76], [90000, 85], [140000, 91], [220000, 96], [400000, 99], [700000, 99.7]];
    if (w <= pts[0][0]) return 1;
    for (let i = 1; i < pts.length; i++) {
      if (w <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return Math.round(y0 + (y1 - y0) * (w - x0) / (x1 - x0));
      }
    }
    return 99.9;
  }
  function incomePercentile(inc) {
    if (!inc) return 0;
    const pts = [[1200, 12], [2000, 28], [3000, 47], [4000, 63], [5000, 74], [7000, 87], [10000, 95], [16000, 99]];
    if (inc <= pts[0][0]) return 5;
    for (let i = 1; i < pts.length; i++) {
      if (inc <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return Math.round(y0 + (y1 - y0) * (inc - x0) / (x1 - x0));
      }
    }
    return 99;
  }

  function lifeType(life) {
    const careerYears = life.ageFocusLog.filter(f => f === "work").length;
    const togetherYears = life.ageFocusLog.filter(f => f === "love").length + (life.married ? 8 : 0) + life.kids * 4;
    const bits = [];
    bits.push(careerYears > togetherYears ? 1 : 0);
    const wander = life.moves + (life.home === "wolse" ? 2 : 0);
    bits.push(wander >= 5 ? 1 : 0);
    const haps = life.history.map(h => h.happiness);
    const mean = haps.reduce((a, b) => a + b, 0) / Math.max(1, haps.length);
    const sd = Math.sqrt(haps.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, haps.length));
    bits.push(sd > 13 ? 1 : 0);
    const saved = Math.max(0, netWorth(life));
    bits.push(saved > 30000 && life.stats.happiness < 62 ? 1 : (saved > 60000 ? 1 : 0));
    const idx = bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3];
    return C.lifeTypes.find(t => t.id === "g_" + bits.join("")) || C.lifeTypes[idx % 16];
  }

  const SURVIVAL = [[0, 100], [5, 100], [10, 99.9], [15, 99.8], [20, 99.8], [25, 99.8], [30, 99.7], [35, 99.5],
    [40, 98.5], [45, 96.6], [50, 96.4], [55, 95.3], [60, 93.9], [65, 91.9], [70, 86.5], [75, 79.7],
    [80, 70.2], [85, 54.7], [90, 36.1], [95, 18.4], [100, 6.7]];
  function survivalCurve(life) {
    const out = [];
    for (let a = 0; a <= 100; a++) {
      const i = Math.min(SURVIVAL.length - 1, Math.ceil(a / 5));
      const [a0, v0] = SURVIVAL[Math.max(0, i - 1)], [a1, v1] = SURVIVAL[i];
      const t = a1 === a0 ? 0 : (a - a0) / (a1 - a0);
      out.push([a, Math.round((v0 + (v1 - v0) * t) * 10) / 10]);
    }
    return out;
  }

  // ---------- family view ----------
  function familyView(life) {
    const out = [];
    const f = life.family || {};
    for (const who of ["father", "mother"]) {
      const p = f[who];
      if (!p) continue;
      out.push({ who, role: who === "father" ? "아버지" : "어머니", name: p.name, nameEn: p.nameEn || "", alive: p.alive, age: p.age,
        health: Math.round(p.health), relation: Math.round(p.relation), job: p.alive ? p.job : "—", income: p.income || 0 });
    }
    for (const who of ["gpa", "gma"]) {
      const p = f[who];
      if (!p) continue;
      const base = who === "gma" ? "할머니" : "할아버지";
      const side = p.side === "maternal" ? "외가" : "친가";
      out.push({ who, role: base + " · " + side, name: p.name, nameEn: p.nameEn || "", alive: p.alive, age: p.age,
        health: Math.round(p.health), relation: Math.round(p.relation), job: p.alive ? (p.job || "—") : "—", income: 0 });
    }
    if (f.spouse) {
      out.push({ who: "spouse", role: "배우자", name: f.spouse.name, nameEn: f.spouse.nameEn || "", alive: f.spouse.alive, age: f.spouse.age,
        health: Math.round(f.spouse.health), relation: Math.round(f.spouse.relation), job: f.spouse.alive ? f.spouse.job : "—", jobEn: f.spouse.alive ? (f.spouse.jobEn || "") : "—", income: f.spouse.income || 0,
        fam: f.spouse.fam || "", famEn: f.spouse.famEn || "", trait: f.spouse.trait || "", traitEn: f.spouse.traitEn || "" });
    } else if (f.partner && f.partner.alive) {
      out.push({ who: "partner", role: "연인", name: f.partner.name, nameEn: f.partner.nameEn || "", alive: true, age: f.partner.age,
        health: Math.round(f.partner.health), relation: Math.round(f.partner.relation),
        job: f.partner.job || "—", jobEn: f.partner.jobEn || "", income: f.partner.income || 0,
        fam: f.partner.fam || "", famEn: f.partner.famEn || "", trait: f.partner.trait || "", traitEn: f.partner.traitEn || "" });
    }
    (f.children || []).forEach((k, i) => {
      out.push({ who: "child" + i, role: "자녀", name: k.name, nameEn: k.nameEn || "", alive: k.alive, age: k.age,
        health: Math.round(k.health), relation: Math.round(k.relation), job: k.job, income: 0 });
    });
    return out;
  }

  // 예전 저장본을 v2 모델로 옮긴다
  function migrate(life) {
    if (!life.stats.reputation || life.stats.reputation === 0) life.stats.reputation = 35;
    if (life.stats.spec == null) life.stats.spec = 12;
    if (life.stats.stress == null) life.stats.stress = 25;
    life.flags = life.flags || {};
    // v3.0: 예전 저장본에도 집·연인 자리를 만든다
    if (life.homeKind == null && life.flags.homeKind) life.homeKind = life.flags.homeKind;
    life.loverCands = life.loverCands || [];
    life.loverSeen = life.loverSeen || [];
    life.loveRound = life.loveRound || 0;
    if (!life.loveAt) life.loveAt = [ri(21, 24), ri(27, 31), ri(33, 35)];
    life._mem = loadMem();
    const d = {
      fatherAlive: !!life.parents.father, motherAlive: !!life.parents.mother,
      married: !!life.married, childrenCount: life.kids || 0, retired: !!life.retired,
      wagePeak: false, inCollege: life.edu === "university", employed: life.job && life.job !== "none",
      militaryDone: false, hasHome: life.home === "own", caregivingParent: !!life.care, inherited: false,
      majorChosen: false, roleChosen: life.role && life.role !== "none", chronic: false,
      divorced: false, widowed: false, spouseAlive: !!life.married, contestWin: false, albaExp: 0, spec: 0
    };
    for (const k in d) if (life.flags[k] == null) life.flags[k] = d[k];
    life.role = life.role || "none";
    life.major = life.major || "none";
    life.family = life.family || { mother: null, father: null, spouse: null, children: [] };
    life.family.children = life.family.children || [];
    life.usedIds = life.usedIds || {};
    life.lastSeen = life.lastSeen || {};
    life.incomeLog = life.incomeLog || [];
    life.statLog = life.statLog || [];
    life.decQueue = life.decQueue || [];
    life.careUsed = life.careUsed || {};
    life.spendMode = life.spendMode || { food: "normal", leisure: "normal", living: "normal", health: "normal" };
    if (life.flags.dating == null) life.flags.dating = false;
    if (life.flags.investStyle == null) life.flags.investStyle = life.alloc || "safe";
    // v2.1 이전 저장본: 집안 배경이 없으면 가장 흔한 배경으로 채우고 조부모를 만든다
    if (life.flags.hasSibling == null) life.flags.hasSibling = (life.siblings || 0) > 0;
    if (life.flags.hasMother == null) life.flags.hasMother = !!(life.family.mother);
    if (life.flags.hasFather == null) life.flags.hasFather = !!(life.family.father);
    if (!life.flags.gpSetup) {
      life.flags.gpSetup = "holiday"; life.flags.gpSide = "paternal";
      life.flags.childArc = life.family.mother ? "city" : "single";
      life.flags.gpNone = false; life.flags.gpNear = false; life.flags.gpFar = true;
      life.flags.gmaAlive = !!(life.family.gma && life.family.gma.alive);
      life.flags.gpaAlive = !!(life.family.gpa && life.family.gpa.alive);
      life.flags.fJob = (life.family.father && life.family.father.job) || "회사원";
      life.flags.mJob = (life.family.mother && life.family.mother.job) || "전업주부";
      life.flags.famShop = life.flags.fJob === "가게" || life.flags.mJob === "가게";
      life.flags.famFarm = life.flags.fJob === "농사";
      life.flags.momWorks = life.flags.mJob !== "전업주부";
      if (!life.family.gma && !life.family.gpa && life.family.mother) {
        life.family.gma = { name: "할머니", side: "paternal", alive: true, age: (life.family.mother.age || 30) + 25, health: 52, relation: 60, job: "—", income: 0 };
      }
    }
    life.gpDeath = life.gpDeath || { gma: 82, gpa: 80 };
    syncStats(life);
    life.expenseItems = life.expenseItems || { housing: 0, food: 0, living: 0, education: 0, care: 0, taxInterest: 0, leisure: 0, health: 0 };
    return life;
  }

  // ---------- 직접 관리 (돈과 시간을 써서 지표를 올린다) ----------
  const LIFE_ACTIONS = {
    upskill:   { cost: 50,  label: "직무 공부·자격증", labelEn: "Study & certification", st: { spec: 4.5, knowledge: 3.5, stress: 2.2 }, inc: 0.025 },
    negotiate: { cost: 0,   label: "연봉·처우 협상",   labelEn: "Negotiate pay",         st: { stress: 3.0 }, needEmp: true },
    travel:    { cost: 90,  label: "짧은 여행·리프레시", labelEn: "Short trip",          st: { health: 1.5, happiness: 5.5, stress: -6.5 } },
    hobby:     { cost: 35,  label: "취미·모임 활동",   labelEn: "Hobby & meetup",        st: { happiness: 3.0, relation: 3.8, stress: -3.0 } },
    repay:     { cost: 300, label: "부채 원금 상환",   labelEn: "Pay down debt",         st: { happiness: 1.5, stress: -3.5 }, needDebt: true }
  };
  function lifeAction(life, kind) {
    const def = LIFE_ACTIONS[kind];
    if (!def) return { ok: false, why: "알 수 없는 활동" };
    if (life.age < 19) return { ok: false, why: "성인이 된 뒤 직접 고를 수 있습니다" };
    life.careUsed = life.careUsed || {};
    if (life.careUsed["act_" + kind] === life.age) return { ok: false, why: "올해는 이미 했습니다" };
    if (def.needEmp && (!life.flags.employed || life.flags.retired)) return { ok: false, why: "현재 일하는 중이 아닙니다" };
    if (def.needDebt && (life.debt || 0) <= 0) return { ok: false, why: "갚을 부채가 없습니다" };
    const cost = kind === "repay" ? Math.min(300, life.debt || 0) : def.cost;
    const have = (life.cash || 0) + (life.assets || 0);
    if (have < cost) return { ok: false, why: "돈이 모자랍니다", need: cost - have };
    const fromCash = Math.min(life.cash || 0, cost);
    life.cash -= fromCash;
    if (cost - fromCash > 0) life.assets = Math.max(0, life.assets - (cost - fromCash));
    life.careUsed["act_" + kind] = life.age;
    if (kind === "repay") {
      life.debt = Math.max(0, (life.debt || 0) - cost);
    }
    if (kind === "negotiate") {
      const chance = clamp(0.28 + ((life.stats.spec || 0) + (life.stats.reputation || 0) - 80) * 0.006, 0.15, 0.85);
      if (R() < chance) {
        life.wageBonus = clamp((life.wageBonus || 0) + 0.045, -0.15, 0.30);
        bump(life, "happiness", 3); bump(life, "reputation", 2);
        return { ok: true, cost: 0, label: def.label, msg: "협상 성공 · 소득이 오릅니다 (+4.5%)", msgEn: "Pay raise agreed (+4.5%)" };
      } else {
        bump(life, "happiness", -1.5); bump(life, "stress", 3);
        return { ok: true, cost: 0, label: def.label, msg: "이번엔 보류되었습니다", msgEn: "Held off this time" };
      }
    }
    const st = def.st || {};
    for (const k in st) bump(life, k, st[k]);
    if (def.inc) life.wageBonus = clamp((life.wageBonus || 0) + def.inc, -0.15, 0.30);
    return { ok: true, cost, label: def.label };
  }

  const SELF_CARE = {
    exercise:   { cost: 45, label: "운동·PT", st: { health: 4.2, happiness: 1, stress: -3.2 } },
    checkup:    { cost: 30, label: "정기검진", st: { health: 1.2, stress: -1.4 } },
    rest:       { cost: 10, label: "휴식·숙면", st: { health: 1.6, happiness: 1.4, stress: -6 } },
    supplement: { cost: 22, label: "영양제·보약", st: { health: 2.2, stress: -0.6 } },
    dental:     { cost: 55, label: "치과·검진", st: { health: 2, happiness: 0.6 } }
  };
  const FAMILY_CARE = {
    checkup: { cost: 70, label: "부모님 건강검진", who: ["mother", "father"], health: 9, rel: 3, st: { stress: -1 } },
    tonic:   { cost: 35, label: "부모님 보약", who: ["mother", "father"], health: 4, rel: 2, st: {} },
    meal:    { cost: 30, label: "가족 외식", rel: 4, st: { happiness: 2, stress: -2 } },
    trip:    { cost: 220, label: "가족 여행", rel: 8, st: { happiness: 5, stress: -5, health: 1 } },
    spouse:  { cost: 25, label: "배우자와 시간", spouseRel: 6, st: { happiness: 3, stress: -2.5 } },
    child:   { cost: 40, label: "자녀와 시간", childRel: 6, st: { happiness: 3, stress: -2 } },
    grand:   { cost: 25, label: "조부모 문안", who: ["gma", "gpa"], health: 4, rel: 5, st: { happiness: 1.5, stress: -1.2 } }
  };
  function careAction(life, kind) {
    const self = SELF_CARE[kind], fam = FAMILY_CARE[kind], def = self || fam;
    if (!def) return { ok: false, why: "알 수 없는 항목" };
    if (life.age < 16) return { ok: false, why: "아직 직접 고를 수 없습니다" };
    life.careUsed = life.careUsed || {};
    if (life.careUsed[kind] === life.age) return { ok: false, why: "올해는 이미 했습니다" };
    const have = (life.cash || 0) + (life.assets || 0);
    if (have < def.cost) return { ok: false, why: "돈이 모자랍니다", need: def.cost - have };
    const fromCash = Math.min(life.cash || 0, def.cost);
    life.cash -= fromCash;
    if (def.cost - fromCash > 0) life.assets = Math.max(0, life.assets - (def.cost - fromCash));
    life.careUsed[kind] = life.age;
    let dHap = 0, dRel = 0, dHea = 0;
    const st = def.st || {};
    for (const k in st) {
      bump(life, k, st[k]);
      if (k === "happiness") dHap += st[k]; else if (k === "relation") dRel += st[k]; else if (k === "health") dHea += st[k];
    }
    if (fam) {
      for (const p of (fam.who || [])) {
        const f = life.family[p];
        if (f && f.alive) {
          f.health = clamp((f.health || 0) + (fam.health || 0), 0, 100);
          if (fam.rel) f.relation = clamp((f.relation || 0) + fam.rel, 0, 100);
        }
      }
      if (fam.spouseRel && life.family.spouse && life.family.spouse.alive)
        life.family.spouse.relation = clamp((life.family.spouse.relation || 0) + fam.spouseRel, 0, 100);
      if (fam.childRel) for (const k of (life.family.children || [])) if (k.alive !== false)
        k.relation = clamp((k.relation || 0) + fam.childRel, 0, 100);
      bump(life, "relation", 1.5);
      dRel += 1.5;
    }
    stressLink(life, dHap, dRel, dHea);
    return { ok: true, cost: def.cost, label: def.label };
  }

  prepAll();

  window.ENGINE = {
    careAction, lifeAction, LIFE_ACTIONS, SELF_CARE, FAMILY_CARE, empTypeOf, applyEvent, bump, stressLink,
    setSpend(life, k, v) {
      if (!life.spendMode) life.spendMode = { food: "normal", leisure: "normal", living: "normal", health: "normal" };
      if (["save", "normal", "generous"].indexOf(v) < 0) return;
      if (["food", "leisure", "living", "health"].indexOf(k) < 0) return;
      life.spendMode[k] = v;
      const ex = expenseBreakdown(life);
      life.expenseItems = ex; life.expenses = ex.total;
    },
    createLife, tick, applyChoice, lifeType, homeRef, rollLovers, loadMem, netWorth, wealthPercentile, incomePercentile,
    survivalCurve, HOUSING_INDEX, JOB_KO, JOB_EN, koreanName, macroFor, homePrice,
    MAJORS, ROLES, FOCUS_CAT, condOK, entryGrade, gradeFor, familyView, expenseBreakdown, computeIncome, migrate,
    choiceAvailable,
    buyHome(life) {
      const price = homePrice(life);
      const down = Math.round(price * 0.3);
      if (life.home === "jeonse") { life.cash += life.deposit || 0; life.deposit = 0; }
      const have = life.cash + life.assets;
      if (have < down) return { ok: false, need: down - have };
      if ((price - down) > Math.max(12000, life.income * 4.5)) return { ok: false, need: Math.round((price - down) - life.income * 4.5) };
      let rest = down;
      const useCash = Math.min(life.cash, rest);
      life.cash -= useCash; rest -= useCash;
      life.assets = Math.max(0, life.assets - rest);
      life.homeValue = price;
      life.debt += price - down;
      life.home = "own"; life.flags.hasHome = true; life.moves++;
      return { ok: true, price, down };
    },
    sellHome(life) {
      if (life.home === "jeonse") { life.cash += life.deposit || 0; life.deposit = 0; life.home = "none"; return { ok: true, price: 0 }; }
      if (life.home !== "own") return { ok: false };
      const price = life.homeValue;
      life.cash += Math.max(0, price - life.debt);
      life.debt = Math.max(0, life.debt - price);
      life.homeValue = 0; life.home = "none"; life.flags.hasHome = false;
      return { ok: true, price };
    },
    setSeed: (s) => { rnd = mulberry32(s); }
  };
})();
