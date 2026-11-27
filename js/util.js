/* small helpers shared by ui / charts / share */
(function () {
  const U = {};
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* 저장소가 막힌 브라우저(임베드된 iframe 등)에서도 게임이 서지 않게 한다.
     저장이 안 되면 이번 판은 기억되지 않을 뿐이다. */
  U.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to forget */ } }
  };

  /* 처음 온 사람에게 어느 언어로 열지: 한국어 브라우저면 한국어, 그 밖에는 영어.
     주소에 붙은 ?lang=과 앞서 고른 언어가 언제나 이보다 먼저다. */
  U.autoLang = () => {
    try {
      const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
      for (let i = 0; i < list.length; i++) {
        const s = String(list[i] || "").toLowerCase();
        if (!s) continue;
        return s.indexOf("ko") === 0 ? "ko" : "en";
      }
    } catch (e) { /* 언어를 알 수 없으면 영어로 둔다 */ }
    return "en";
  };

  U.lang = () => {
    const a = window.APP && window.APP.lang;
    if (a === "en" || a === "ko") return a;
    try {
      const q = new URLSearchParams(location.search).get("lang");
      if (q === "en" || q === "ko") return q;
      const s = localStorage.getItem("oifm2_lang");
      if (s === "en" || s === "ko") return s;
    } catch (e) { /* file:// or blocked storage */ }
    return U.autoLang();
  };
  U.T = (k, vars) => {
    const d = (window.I18N && window.I18N[U.lang()]) || (window.I18N && window.I18N.ko) || {};
    let s = d[k] != null ? d[k] : ((window.I18N && window.I18N.ko[k]) != null ? window.I18N.ko[k] : k);
    if (vars) for (const key in vars) s = s.replace(new RegExp("\\{" + key + "\\}", "g"), vars[key]);
    return s;
  };
  U.L = (obj) => obj ? (obj[U.lang()] != null ? obj[U.lang()] : obj.ko) : "";

  /* engine이 만들어 내는 짧은 이름표(직업·가족 호칭·돌봄 항목·사인 등)를 영어로 옮긴다.
     문장은 각 화면에서 직접 이중 언어로 쓰고, 이 표는 데이터에서 올라오는 낱말만 담당한다. */
  const EN = {
    "—": "—", "-": "—",
    // 가족 호칭
    "아버지": "Father", "어머니": "Mother", "할머니": "Grandmother", "할아버지": "Grandfather",
    "배우자": "Spouse", "자녀": "Child", "아들": "Son", "딸": "Daughter",
    "외가": "maternal", "친가": "paternal", "고인": "Deceased",
    // 부모 세대 직업
    "회사원": "Office worker", "전문직": "Professional", "가게": "Shop owner", "공무원": "Civil servant",
    "기술직": "Skilled worker", "운수·건설": "Transport and construction", "일용·건설": "Day labour, construction",
    "농사": "Farmer", "전업주부": "Homemaker", "교사": "Teacher", "간호사": "Nurse",
    "일용·서비스": "Day labour, services", "자영업": "Self-employed", "프리랜서": "Freelancer",
    "대학원생": "Graduate student", "무직": "No paid work", "은퇴": "Retired", "양육": "Raising children",
    "주부": "Homemaker", "구직": "Looking for work", "학생": "Student",
    // 아이 학력
    "고등학교": "High school", "전문대": "Two-year college", "대학교": "University", "대학원": "Graduate school",
    // 건강 관리
    "운동·PT": "Exercise and training", "정기검진": "Annual check-up", "휴식·숙면": "Rest and sleep",
    "영양제·보약": "Supplements", "치과·검진": "Dental check-up",
    "부모님 건강검진": "Check-up for your parents", "부모님 보약": "Tonics for your parents",
    "가족 외식": "A family dinner out", "가족 여행": "A family trip", "배우자와 시간": "An evening with your spouse",
    "자녀와 시간": "Time with your child", "조부모 문안": "A visit to your grandparents",
    // 돌봄이 막혔을 때
    "알 수 없는 항목": "Unknown item", "아직 직접 고를 수 없습니다": "Too young to choose this yourself",
    "올해는 이미 했습니다": "Already done this year", "돈이 모자랍니다": "Not enough money",
    "지금은 할 수 없습니다": "Not possible right now",
    // 사인
    "암": "Cancer", "심장질환": "Heart disease", "뇌혈관 질환": "Cerebrovascular disease",
    "폐렴": "Pneumonia", "패혈증": "Sepsis", "간 질환": "Liver disease", "당뇨 합병증": "Complications of diabetes",
    "만성 호흡기 질환": "Chronic respiratory disease", "신부전": "Kidney failure", "치매": "Dementia",
    "노환": "Old age", "사고": "An accident", "자살": "Suicide", "감염병": "An infectious disease",
    "출산": "Childbirth", "암·만성질환": "Cancer and chronic illness",
    // 입시·취업 등급
    "대기업·전문직": "Large firm or profession", "중견·정규직": "Mid-sized firm, permanent", "중소·계약직": "Small firm, contract",
    // 성별
    "여성": "Female", "남성": "Male", "여": "F", "남": "M",
    // 형편
    "넉넉한 편": "Comfortable", "보통": "Middle", "어려운 편": "Tight",
    // 주거
    "얹혀 삶": "Living with family", "월세": "Monthly rent", "전세": "Jeonse", "내 집": "Owned home",
    // 기타 화면 낱말
    "없음": "None", "생존": "Alive", "기록 없음": "No record", "연인": "Partner",
    "직무 공부·자격증": "Study & certification", "연봉·처우 협상": "Negotiate pay",
    "짧은 여행·리프레시": "Short trip", "취미·모임 활동": "Hobby & meetup",
    "부채 원금 상환": "Pay down debt", "알 수 없는 활동": "Unknown action",
    "성인이 된 뒤 직접 고를 수 있습니다": "Available once you reach adulthood",
    "현재 일하는 중이 아닙니다": "You are not currently employed",
    "갚을 부채가 없습니다": "You have no debt to pay down"
  };
  U.en = (s) => EN[s] != null ? EN[s] : String(s == null ? "" : s);
  U.tr = (s) => {
    if (s == null) return "";
    const v = String(s);
    if (U.lang() !== "en") return v;
    if (EN[v] != null) return EN[v];
    // '할머니 · 외가' 처럼 조합된 이름표
    if (v.indexOf(" · ") > 0) {
      const parts = v.split(" · ");
      return parts.map(p => (EN[p] != null ? EN[p] : p)).join(", ");
    }
    return v;
  };

  U.money = (man) => {
    const neg = man < 0;
    const v = Math.abs(Math.round(Number(man) || 0));   // 만 원 단위
    if (U.lang() === "en") {
      const krw = v * 10000;
      const sign = neg ? "−" : "";
      if (krw >= 1e8) return sign + "₩" + (krw / 1e8 >= 10 ? Math.round(krw / 1e8) : (krw / 1e8).toFixed(1).replace(/\.0$/, "")) + "B";
      if (krw >= 1e6) return sign + "₩" + Math.round(krw / 1e6) + "M";
      if (krw >= 1e3) return sign + "₩" + Math.round(krw / 1e3) + "k";
      return sign + "₩" + krw;
    }
    let s;
    if (v >= 10000) {
      const e = Math.floor(v / 10000), m = v % 10000;
      s = e + "억" + (m ? " " + m.toLocaleString() + "만" : "");
    } else s = v.toLocaleString() + "만";
    return (neg ? "-" : "") + s;
  };
  U.moneyUnit = (man) => U.lang() === "ko" ? "만 원" : "KRW";

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
