/* 5천만 분의 1 — life engine
   Deterministic per-seed simulation of one Korean life, one year at a time. */
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
    let r = R() * s;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- macro eras ----------
  const MACRO = [
    { from: 1997, to: 1998, id: "imf", job: 0.86, house: -0.06, mood: -6 },
    { from: 2003, to: 2003, id: "card", job: 0.98, house: 0.06, mood: -2 },
    { from: 2008, to: 2009, id: "gfc", job: 0.9, house: -0.04, mood: -5 },
    { from: 2015, to: 2021, id: "boom", job: 1.02, house: 0.085, mood: 2 },
    { from: 2020, to: 2021, id: "covid", job: 0.93, house: 0.07, mood: -4 },
    { from: 2022, to: 2023, id: "rate", job: 0.98, house: -0.03, mood: -3 },
    { from: 2024, to: 2026, id: "low", job: 0.99, house: -0.01, mood: -2 }
  ];
  function macroFor(year) {
    for (const m of MACRO) if (year >= m.from && year <= m.to) return m;
    return null;
  }
  const HOUSING_INDEX = (year) => {
    // 2000 = 100, long-run trend with the shocks above
    let v = 100;
    for (let y = 2000; y < year; y++) {
      const m = macroFor(y);
      let g = 0.035 + (y >= 2015 && y <= 2021 ? 0.06 : 0) + (y >= 2022 && y <= 2023 ? -0.05 : 0);
      if (m) g += m.house;
      v *= 1 + g;
    }
    for (let y = 2027; y <= Math.max(2026, year + 1); y++) { /* future: treated as flat scenario */ }
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

  function createLife(opt = {}) {
    const seed = opt.seed != null ? opt.seed : (Math.random() * 1e9) | 0;
    rnd = mulberry32(seed);
    const sex = opt.sex || (R() < 0.5 ? "f" : "m");
    const region = opt.region && C.regions.find(r => r.id === opt.region) ? C.regions.find(r => r.id === opt.region) : wpick(C.regions, r => r.w);
    const district = pick(region.districts);
    const zone = district[2] === "rural" ? "rural" : region.type;
    const cls = opt.cls || wpick(CLASS_FROM_CHAR[district[2]] || CLASS_FROM_CHAR.mid, x => x[1])[0];
    const cohort = opt.cohort || wpick(COHORTS, x => x[1])[0];
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
    const life = {
      seed, name: { ko: name.ko, en: name.en }, sex, region, district: { ko: district[0], en: district[1], char: district[2] },
      zone, cls, birthYear, cohort, era, family, siblings, singleParent, parents,
      age: 0, year: birthYear,
      familyAges: {
        mother: 30 + ri(0, 7), father: 32 + ri(0, 8),
        sibling: Array.from({ length: siblings }, (_, i) => ri(-3, 6))
      },
      parentDeath: { mother: 78 + ri(-8, 10), father: 74 + ri(-9, 10) },
      stats: { health: clamp(baseHealth, 30, 80), happiness: 56 + ri(-6, 8), knowledge: 28 + ri(-6, 8), relation: 60 + ri(-8, 6) },
      cash: cls === "high" ? ri(200, 600) : cls === "low" ? ri(0, 40) : ri(40, 160),
      assets: 0, homeValue: 0, debt: 0, home: "none", job: "none", edu: "none",
      married: 0, kids: 0, care: 0, retired: 0,
      income: 0, expenses: 0, alloc: "safe", focus: "balance",
      events: [], seen: {}, decisions: [], history: [], reflections: [],
      flags: {}, death: null, ageFocusLog: [], moves: 0,
      peers: [], startedYear: birthYear,
      pendingDecision: null, pendingReflection: false,
      incomeLog: [], statLog: []
    };
    // four peers born the same day
    const pool = C.peers.slice().sort(() => R() - 0.5).slice(0, 4);
    life.peers = pool.map(p => ({ ...p, name: p.name, age: 0, alive: true, milestoneAge: 0 }));
    life.stats.health = clamp(life.stats.health, 30, 82);
    return life;
  }

  // ---------- economy ----------
  const JOB_BASE = { none: 0, office: 3600, trade: 3050, public: 3350, self: 2600, free: 2450, farm: 2250 };
  const JOB_KO = { none: "무직", office: "사무·관리직", trade: "기술·생산직", public: "공무원·공공기관", self: "자영업", free: "프리랜서", farm: "농림어업" };
  const JOB_EN = { none: "No paid work", office: "Office and management", trade: "Skilled trades and production", public: "Public service", self: "Self-employed", free: "Freelance", farm: "Farming and fishing" };

  function eduMul(e) { return { none: 0.82, high: 0.86, college: 0.94, university: 1.0, grad: 1.14 }[e] || 0.9; }
  function zoneMul(z) { return { metro: 1.07, city: 0.96, rural: 0.85 }[z] || 1; }
  function ageCurve(a) {
    if (a < 22) return 0.3;
    if (a < 30) return 0.72 + (a - 22) * 0.035;
    if (a < 45) return 1.0 + (a - 30) * 0.012;
    if (a < 55) return 1.18;
    if (a < 62) return 1.05 - (a - 55) * 0.03;
    return 0.45;
  }

  function updateIncome(life) {
    if (life.age < 19 || life.job === "none" || life.age > 78) {
      if (life.age > 65 && life.retired) life.income = Math.round(620 * (life.income > 4000 ? 1.3 : 1)); // 연금
      else life.income = 0;
      return;
    }
    let base = JOB_BASE[life.job] * eduMul(life.edu) * zoneMul(life.zone) * ageCurve(life.age);
    base *= 1 + (life.stats.knowledge - 50) * 0.004 + (life.stats.health - 50) * 0.002;
    if (life.sex === "f") base *= 0.92; // measured gender pay gap
    if (life.retired && life.age < 78) base *= 0.55;
    const m = macroFor(life.year);
    if (m) base *= m.job;
    base *= 1 + (life.wageBonus || 0);
    life.income = Math.max(0, Math.round(base));
  }

  function housingCost(life) {
    const price = 26000 * zoneMul(life.zone) * HOUSING_INDEX(life.year) / HOUSING_INDEX(2026);
    if (life.home === "own") return { upkeep: Math.round(price * 0.012), interest: 0, rent: 0 };
    if (life.home === "jeonse") return { upkeep: 0, interest: Math.round(life.debt * 0.042), rent: 0 };
    if (life.home === "wolse") return { upkeep: 0, interest: 0, rent: Math.round(price * 0.16 * 0.05) };
    return { upkeep: 0, interest: 0, rent: 0 };
  }

  function yearEconomics(life) {
    updateIncome(life);
    if (life.age < 19) { life.expenses = 0; return; }  // the household carries a child's costs
    let exp = 0;
    if (life.age >= 19) {
      exp += 620 + (life.married ? 420 : 0) + life.kids * 460;
      if (life.care) exp += 380;
      if (life.parentSupport) exp += 240;
    } else {
      exp += 60;
    }
    const h = housingCost(life);
    exp += h.rent + h.interest + h.upkeep;
    if (life.home === "own" && life.debt > 0) exp += Math.round(life.debt * 0.06);
    exp += life.extraExpense || 0;
    life.extraExpense = 0;
    life.expenses = Math.round(exp);

    const net = life.income - life.expenses;
    if (net > 0) {
      const saveRate = { safe: 0.7, stock: 0.55, coin: 0.5, none: 0.85 }[life.alloc] || 0.6;
      const save = net * saveRate;
      life.cash += Math.round(save * (life.alloc === "safe" ? 0.75 : 0.25));
      life.assets += Math.round(save * (life.alloc === "safe" ? 0.25 : 0.75));
      life.cash += Math.round(net * (1 - saveRate));
    } else {
      const need = -net;
      const fromCash = Math.min(life.cash, need);
      life.cash -= fromCash;
      const rest = need - fromCash;
      if (rest > 0) { life.debt += Math.round(rest * 1.02); }
      if (need > 0 && life.cash <= 0) life.stats.happiness -= 1;
    }

    // returns
    const m = macroFor(life.year);
    const stockR = { safe: 0.028, stock: R() < 0.22 ? -0.16 : 0.075, coin: R() < 0.5 ? -0.35 : 0.42, none: 0.02 }[life.alloc] || 0.03;
    if (life.assets > 0) life.assets = Math.round(life.assets * (1 + stockR));
    if (life.assets < 0) life.assets = 0;
    if (life.home === "own") {
      const g = 0.03 + (m ? m.house : 0);
      life.homeValue = Math.round(life.homeValue * (1 + g));
    }
    life.cash = Math.max(0, Math.round(life.cash));
  }

  // ---------- events ----------
  function matchEvent(e, life, pad) {
    const p = pad || 0;
    if (life.age < e.age[0]) return false;           // never fire an event before the age it describes
    if (life.age > e.age[1] + p) return false;
    if (e.yr && (life.year < e.yr[0] || life.year > e.yr[1])) return false;
    if (e.reg !== "any" && e.reg !== life.zone) return false;
    if (e.cls !== "any" && e.cls !== life.cls) return false;
    if (e.sex !== "any" && e.sex !== life.sex) return false;
    if (e.era !== "any" && e.era !== life.era) return false;
    if (e.fam) {
      if (e.fam.m && !life.parents.mother) return false;
      if (e.fam.f && !life.parents.father) return false;
      if (e.fam.s && !(life.siblings > 0)) return false;
    }
    return true;
  }

  function familyEvents(life) {
    const out = [];
    const fa = life.familyAges;
    if (fa.mother != null) fa.mother++;
    if (fa.father != null) fa.father++;
    fa.sibling = (fa.sibling || []).map(a => a + 1);
    if (fa.father != null && fa.father >= life.parentDeath.father) {
      out.push({
        id: "fam_father", ic: "🕯", src: "src_death",
        t: { ko: "아버지의 장례", en: "Your Father's Funeral" },
        b: { ko: "아버지가 새벽에 숨을 거두었다. 사흘 동안 빈소를 지키며 조문객의 이름을 적었고, 마지막 날에는 당신이 상주로 서 있었다.",
             en: "Your father died before dawn. You kept the wake for three days, writing down the names of visitors, and stood as chief mourner on the last day." },
        st: { health: -2, happiness: -9, knowledge: 0, relation: 3 }, money: -450, inc: 0
      });
      fa.father = null; life.parents.father = false;
    }
    if (fa.mother != null && fa.mother >= life.parentDeath.mother) {
      out.push({
        id: "fam_mother", ic: "🕯", src: "src_death",
        t: { ko: "어머니의 빈방", en: "Your Mother's Empty Room" },
        b: { ko: "어머니가 병원에서 돌아오지 못했다. 집을 정리하다 냉장고에 남은 반찬과 달력에 적힌 약 복용 시간을 발견했다.",
             en: "Your mother did not come home from the hospital. Clearing the house, you found side dishes left in the fridge and medicine times pencilled on the calendar." },
        st: { health: -2, happiness: -10, knowledge: 0, relation: 2 }, money: -380, inc: 0
      });
      fa.mother = null; life.parents.mother = false;
    }
    return out;
  }

  function pickEvents(life, count) {
    const out = [];
    const recent = (x) => (life.lastSeen && life.lastSeen[x.id] != null) ? (life.age - life.lastSeen[x.id]) : 99;
    for (let i = 0; i < count; i++) {
      let pool = C.events.filter(e => matchEvent(e, life) && !out.includes(e) && !life.seen[e.id]);
      if (!pool.length) pool = C.events.filter(e => matchEvent(e, life, 2) && !out.includes(e) && !life.seen[e.id]);
      if (!pool.length) pool = C.events.filter(e => matchEvent(e, life, 4) && !out.includes(e) && !life.seen[e.id]);
      if (!pool.length) pool = C.events.filter(e => matchEvent(e, life, 3) && !out.includes(e) && recent(e) > 20);
      if (!pool.length) break;
      const e = wpick(pool, x => x.w * (1 / (1 + (life.seen[x.id] || 0) * 1.2)) * (x.age[1] === x.age[0] ? 1.25 : 1));
      out.push(e);
      life.seen[e.id] = (life.seen[e.id] || 0) + 1;
      life.lastSeen = life.lastSeen || {}; life.lastSeen[e.id] = life.age;
    }
    return out;
  }

  function applyEvent(life, e) {
    for (const k of ["health", "happiness", "knowledge", "relation"]) {
      life.stats[k] = clamp(life.stats[k] + (e.st[k] || 0), 0, 100);
    }
    if (e.money) {
      if (life.age < 19) {
        // a minor does not carry the household's costs; only pocket money reaches them
        if (e.money > 0) life.cash += Math.round(e.money * 0.05);
      } else if (e.money > 0) life.cash += e.money;
      else {
        const need = -e.money;
        const fromCash = Math.min(life.cash, need);
        life.cash -= fromCash;
        if (need - fromCash > 0) life.debt += Math.round((need - fromCash) * 1.02);
      }
    }
    if (e.inc) life.wageBonus = clamp((life.wageBonus || 0) + e.inc, -0.4, 0.8);
  }

  // ---------- yearly focus ----------
  const FOCUS_EFFECT = {
    health: { health: 2.4, happiness: 0.4, knowledge: 0, relation: -0.3, income: 0 },
    family: { health: 0.3, happiness: 1.2, knowledge: 0, relation: 2.6, income: -0.02 },
    career: { health: -1.1, happiness: -0.2, knowledge: 0.5, relation: -0.9, income: 0.035 },
    study:  { health: -0.6, happiness: 0.2, knowledge: 2.0, relation: -0.4, income: 0.012 },
    balance:{ health: 0.8, happiness: 0.8, knowledge: 0.4, relation: 0.5, income: 0 }
  };

  function applyFocus(life) {
    if (life.age < 6) return;
    const f = FOCUS_EFFECT[life.focus] || FOCUS_EFFECT.balance;
    life.stats.health = clamp(life.stats.health + f.health, 0, 100);
    life.stats.happiness = clamp(life.stats.happiness + f.happiness, 0, 100);
    life.stats.knowledge = clamp(life.stats.knowledge + f.knowledge * (life.age > 60 ? 0.3 : 1), 0, 100);
    life.stats.relation = clamp(life.stats.relation + f.relation, 0, 100);
    life.wageBonus = clamp((life.wageBonus || 0) + f.income, -0.4, 0.8);
    life.ageFocusLog.push(life.focus);
  }

  function drift(life) {
    const a = life.age;
    let dh = -0.25;
    if (a >= 40) dh -= 0.35;
    if (a >= 60) dh -= 0.55;
    if (a >= 75) dh -= 0.7;
    if (life.cls === "low") dh -= 0.15;
    life.stats.health = clamp(life.stats.health + dh, 0, 100);
    // happiness pulls toward 52 slowly, weighted by health and relations
    const target = 40 + life.stats.health * 0.2 + life.stats.relation * 0.2;
    life.stats.happiness = clamp(life.stats.happiness + (target - life.stats.happiness) * 0.08, 0, 100);
    if (a > 22) life.stats.relation = clamp(life.stats.relation - 0.25, 0, 100);
    if (a < 22) life.stats.knowledge = clamp(life.stats.knowledge + 0.6, 0, 100);
    if (a > 65) life.stats.knowledge = clamp(life.stats.knowledge - 0.2, 0, 100);
  }

  // ---------- decisions ----------
  function decisionFor(life) {
    const d = C.decisions.find(d => d.age === life.age && !life.decisions.includes(d.id));
    if (!d) return null;
    return d;
  }

  function applyChoice(life, dec, ch) {
    for (const k of ["health", "happiness", "knowledge", "relation"]) {
      life.stats[k] = clamp(life.stats[k] + (ch.st[k] || 0), 0, 100);
    }
    if (ch.money && life.age < 19) {
      // parents' decisions move household money, not a child's account
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
    if (ch.inc) life.wageBonus = clamp((life.wageBonus || 0) + ch.inc, -0.4, 0.8);
    const s = ch.set || {};
    if (s.edu) life.edu = s.edu;
    if (s.job) { life.job = s.job; }
    if (s.home) {
      if (s.home !== life.home) life.moves++;
      life.home = s.home;
      if (s.home === "own" && !life.homeValue) {
        const price = 26000 * zoneMul(life.zone) * HOUSING_INDEX(life.year) / HOUSING_INDEX(2026);
        const down = Math.round(price * 0.3);
        const take = Math.min(life.cash + life.assets, down);
        life.cash = Math.max(0, life.cash - take);
        life.assets = Math.max(0, life.assets - Math.max(0, down - life.cash));
        life.homeValue = price;
        life.debt += Math.round(price - down);
      }
      if (s.home === "jeonse") {
        const price = 26000 * zoneMul(life.zone) * HOUSING_INDEX(life.year) / HOUSING_INDEX(2026);
        const dep = Math.round(price * 0.68);
        life.debt += Math.round(dep * 0.5);
      }
    }
    if (s.married != null) life.married = s.married;
    if (s.kids != null) life.kids = s.kids;
    if (s.care != null) life.care = s.care;
    if (s.retired != null) life.retired = s.retired;
    if (s.invest) life.alloc = s.invest === "safe" ? "safe" : s.invest === "stock" ? "stock" : s.invest === "coin" ? "coin" : life.alloc;
    life.decisions.push(dec.id);
    life.flags[dec.id] = ch.id;
  }

  // ---------- death ----------
  function hazard(life) {
    const a = life.age;
    if (a < 30) return 0.0012;
    if (a < 45) return 0.0018 + (a - 30) * 0.0003;
    const g = 0.0009 * Math.exp(0.083 * (a - 45));
    const hm = clamp(1 + (55 - life.stats.health) / 30, 0.45, 3.4);
    return clamp(g * hm, 0, 0.5);
  }

  function pickDeathCause(life) {
    if (life.age < 40) {
      // a young death is rare; it is almost always an accident, suicide, or a childhood cancer
      const young = C.deaths.filter(d => /사고|자살|암/.test(d.cause));
      return wpick(young, d => d.cause === "사고" ? 5 : d.cause === "암" ? 3 : 2);
    }
    const bucket = life.age >= 90 ? "90" : life.age >= 75 ? "75" : "60";
    return wpick(C.deaths, d => (d.weight[bucket] || 1) * (life.stats.health < 40 && /암|심장|뇌혈관|폐렴|패혈/.test(d.cause) ? 1.4 : 1));
  }

  function makeDeath(life, cause) {
    life.death = {
      age: life.age, year: life.year,
      cause: cause ? cause.cause : "노환",
      causeEn: cause ? cause.causeEn : "Old age",
      line: cause ? cause.line : { ko: "잠든 채로 아침이 오지 않았다.", en: "The morning did not come." }
    };
    return life.death;
  }

  // ---------- main tick ----------
  function tick(life) {
    if (life.death) return { death: life.death };
    life.age += 1;
    life.year += 1;

    applyFocus(life);
    drift(life);
    yearEconomics(life);

    const evs = familyEvents(life).concat(pickEvents(life, life.age < 6 ? 1 : (R() < 0.35 ? 2 : 1)));
    evs.forEach(e => { if (e.st) applyEvent(life, e); else applyEvent(life, e); });

    // peer ages
    life.peers.forEach(p => {
      p.age = life.age;
      const ms = p.milestones.filter(m => m.age <= life.age);
      p.milestoneAge = ms.length ? ms[ms.length - 1].age : 0;
      const deathM = p.milestones.find(m => m.death && m.age <= life.age);
      p.alive = !deathM;
    });

    life.history.push({
      age: life.age, year: life.year,
      happiness: Math.round(life.stats.happiness),
      health: Math.round(life.stats.health),
      wealth: life.cash + life.assets + life.homeValue - life.debt,
      income: life.income,
      event: evs.length ? evs[0].t : null
    });

    const dec = decisionFor(life);
    if (dec) { life.pendingDecision = dec; return { events: evs, decision: dec }; }

    const refl = [5, 30, 50, 70].includes(life.age);
    if (refl) { life.pendingReflection = true; return { events: evs, reflection: life.age }; }

    const dead = life.age >= 105 ? true : R() < hazard(life);
    if (dead) {
      const c = pickDeathCause(life);
      const d = makeDeath(life, life.age >= 100 && life.stats.health > 55 ? C.deaths.find(x => x.cause === "노환") : c);
      return { events: evs, death: d };
    }
    return { events: evs };
  }

  // ---------- record ----------
  function netWorth(life) { return Math.round(life.cash + life.assets + life.homeValue - life.debt); }

  function wealthPercentile(w) {
    // rough Korean household net-wealth distribution (만원)
    const pts = [[-5000, 3], [0, 12], [2000, 26], [6000, 40], [12000, 52], [20000, 61], [30000, 70],
                 [45000, 78], [70000, 85], [100000, 90], [160000, 95], [300000, 98.5], [600000, 99.6]];
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
    const years = Math.max(1, life.history.length);
    const careerYears = life.ageFocusLog.filter(f => f === "career" || f === "study").length;
    const togetherYears = life.ageFocusLog.filter(f => f === "family").length + (life.married ? 8 : 0) + life.kids * 4;
    const bits = [];
    bits.push(careerYears > togetherYears ? 1 : 0);
    const wander = life.moves + (life.home === "wolse" ? 2 : 0) + Math.max(0, (life.region.zone === "rural" ? 0 : 0));
    bits.push(wander >= 5 ? 1 : 0);
    const haps = life.history.map(h => h.happiness);
    const mean = haps.reduce((a, b) => a + b, 0) / haps.length;
    const sd = Math.sqrt(haps.reduce((a, b) => a + (b - mean) ** 2, 0) / haps.length);
    bits.push(sd > 13 ? 1 : 0);
    const saved = Math.max(0, netWorth(life));
    bits.push(saved > 30000 && life.stats.happiness < 62 ? 1 : (saved > 60000 ? 1 : 0));
    const idx = bits[0] * 8 + bits[1] * 4 + bits[2] * 2 + bits[3];
    return C.lifeTypes.find(t => t.id === "g_" + bits.join("")) || C.lifeTypes[idx % 16];
  }

  function survivalCurve(life) {
    const out = [];
    for (let a = 0; a <= 100; a += 2) {
      let s = 1;
      for (let x = 30; x < a; x += 2) {
        const g = 0.0009 * Math.exp(0.083 * (x - 45));
        s *= 1 - clamp(g * clamp(1 + (55 - 58) / 30, 0.45, 3.4), 0, 0.5) * 2;
      }
      out.push([a, Math.max(0, Math.round(s * 1000) / 10)]);
    }
    return out;
  }

  function homePrice(life) {
    return Math.round(26000 * zoneMul(life.zone) * HOUSING_INDEX(life.year) / HOUSING_INDEX(2026));
  }

  window.ENGINE = {
    createLife, tick, applyChoice, lifeType, netWorth, wealthPercentile, incomePercentile,
    survivalCurve, HOUSING_INDEX, JOB_KO, JOB_EN, koreanName, macroFor, homePrice,
    buyHome(life) {
      const price = homePrice(life);
      const down = Math.round(price * 0.3);
      const have = life.cash + life.assets;
      if (have < down) return { ok: false, need: down - have };
      let rest = down;
      const useCash = Math.min(life.cash, rest);
      life.cash -= useCash; rest -= useCash;
      life.assets = Math.max(0, life.assets - rest);
      life.homeValue = price;
      life.debt += price - down;
      life.home = "own"; life.moves++;
      return { ok: true, price, down };
    },
    sellHome(life) {
      if (life.home !== "own") return { ok: false };
      const price = life.homeValue;
      life.cash += Math.max(0, price - life.debt);
      life.debt = Math.max(0, life.debt - price);
      life.homeValue = 0; life.home = "none";
      return { ok: true, price };
    },
    setSeed: (s) => { rnd = mulberry32(s); }
  };
})();
