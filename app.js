/* =====================================================================
 * 하이큐테크 ERP - 애플리케이션 로직 (app.js)
 * 외부 라이브러리 의존성 없음 / 완전 오프라인 동작
 * ===================================================================== */

/* ---------------- 유틸 ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const won = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");
// 금액 -> 한글 (예: 110000000 -> "일억일천만원")
function hangulMoney(n) {
  n = Math.round(n);
  if (n === 0) return "영원";
  const D = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const S = ["", "십", "백", "천"];
  const U = ["", "만", "억", "조"];
  const groups = [];
  let x = n;
  while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
  let res = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]; if (g === 0) continue;
    let part = "";
    for (let j = 3; j >= 0; j--) { const d = Math.floor(g / Math.pow(10, j)) % 10; if (d > 0) part += D[d] + S[j]; }
    res += part + U[i] + " ";
  }
  return res.trim() + "원";
}
const num = (n) => Math.round(n).toLocaleString("ko-KR");
const pct = (n) => (n).toFixed(1) + "%";
const itemOf = (code) => DB.items.find(i => i.code === code) || {};
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* 상태 -> 배지 클래스 */
const statusBadge = (s) => {
  const map = {
    "완료": "b-ok", "진행": "b-info", "지연": "b-danger", "보류": "b-gray",
    "대기": "b-gray", "절단": "b-purple", "압착": "b-warn", "조립": "b-info", "검사": "b-purple",
    "예정": "b-info", "미수": "b-warn", "연체": "b-danger",
  };
  return `<span class="badge ${map[s] || "b-gray"}">${s}</span>`;
};

/* =====================================================================
 * 인터랙션 엔진 (라벨 선택 / 수량 입력 / 모달 / 버튼)
 * ===================================================================== */
let CURRENT = "dashboard";       // 현재 탭
let ORDSEQ = 18, WOSEQ = 52, QSEQ = 612, ARSEQ = 90;  // 신규 번호 시퀀스
let STMT_SOURCE = null;           // 거래명세서 기준 수주번호
let STMT_DOC = null;              // 세금계산서 발행 → 거래명세서 연동 데이터
const pad = (n, l) => String(n).padStart(l, "0");

/* ---------- 입력 자동 변환 (날짜/전화/사업자/금액) ---------- */
const digits = (v) => String(v).replace(/[^0-9]/g, "");
function fmtDate(v) {
  const d = digits(v);
  if (d.length === 6) return "20" + d.slice(0, 2) + "-" + d.slice(2, 4) + "-" + d.slice(4, 6);
  if (d.length === 8) return d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
  return v;
}
function fmtBiz(v) { const d = digits(v); return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5) : v; }
function fmtPhone(v) {
  const d = digits(v);
  if (d.startsWith("010") && d.length === 11) return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  if (d.startsWith("02")) {
    if (d.length === 9) return "02-" + d.slice(2, 5) + "-" + d.slice(5);
    if (d.length === 10) return "02-" + d.slice(2, 6) + "-" + d.slice(6);
    return v;
  }
  if (d.length === 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
  if (d.length === 11) return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  return v;
}
const fmtMoney = (v) => { const d = digits(v); return d ? (+d).toLocaleString("ko-KR") : v; };
const unfmt = (v) => parseInt(digits(v), 10) || 0;

// 공급받는자(고객사) 추가정보 (자동작성용)
const CLIENT_INFO = {
  "경신":           { biz: "514-81-26580", fax: "053-589-1100", addr: "대구광역시 달서구 성서공단로 11길 32" },
  "유라코퍼레이션": { biz: "312-81-44021", fax: "041-339-2200", addr: "세종특별자치시 전의면 산단로 145" },
  "LS오토모티브":   { biz: "134-81-09197", fax: "043-260-3300", addr: "충청북도 청주시 흥덕구 옥산면 과학산업로 78" },
  "위니아":         { biz: "608-81-12340", fax: "055-608-4400", addr: "경상남도 창원시 성산구 정동로 100" },
  "삼보모터스":     { biz: "312-81-55012", fax: "041-589-5500", addr: "충청남도 천안시 서북구 입장면 신대길 21" },
  "대유플러스":     { biz: "126-81-33015", fax: "031-689-6600", addr: "경기도 화성시 향남읍 제약공단2길 50" },
};

// 라벨 셋(공정과정/상태) + 색상
const LABEL_SETS = {
  process:    ["대기", "절단", "압착", "조립", "검사", "완료"],
  order:      ["진행", "완료", "지연", "보류"],
  quote:      ["검토중", "발송", "수주확정", "반려"],
  cs:         ["접수", "대응중", "완료"],
  receivable: ["예정", "미수", "연체", "완료"],
};
const LABEL_COLOR = {
  "대기": "c-gray", "절단": "c-purple", "압착": "c-warn", "조립": "c-info", "검사": "c-purple", "완료": "c-ok",
  "진행": "c-info", "지연": "c-danger", "보류": "c-gray",
  "검토중": "c-warn", "발송": "c-info", "수주확정": "c-ok", "반려": "c-danger",
  "접수": "c-info", "대응중": "c-warn",
  "예정": "c-info", "미수": "c-warn", "연체": "c-danger",
};

// 라벨 드롭다운 (클릭하여 변경)
function labelSelect(setKey, coll, keyField, keyVal, field) {
  const rec = DB[coll].find(r => String(r[keyField]) === String(keyVal));
  const cur = rec ? rec[field] : LABEL_SETS[setKey][0];
  const cls = LABEL_COLOR[cur] || "c-gray";
  return `<select class="lblsel ${cls}" title="클릭하여 변경"
    data-coll="${coll}" data-keyfield="${keyField}" data-key="${keyVal}" data-field="${field}">
    ${LABEL_SETS[setKey].map(o => `<option ${o === cur ? "selected" : ""}>${o}</option>`).join("")}
  </select>`;
}
// 수량 직접입력
function numInput(coll, keyField, keyVal, field, val, opts = {}) {
  return `<input type="number" class="numin" value="${val}" min="${opts.min != null ? opts.min : 0}"
    ${opts.max != null ? `max="${opts.max}"` : ""}
    data-coll="${coll}" data-keyfield="${keyField}" data-key="${keyVal}" data-field="${field}"
    style="width:${opts.w || 72}px">`;
}
function applyEdit(el, numeric) {
  const rec = DB[el.dataset.coll].find(r => String(r[el.dataset.keyfield]) === String(el.dataset.key));
  if (!rec) return;
  rec[el.dataset.field] = numeric ? (parseInt(el.value, 10) || 0) : el.value;
}

// D-day 계산 (입금기한)
function dDay(due) {
  const diff = Math.round((new Date(due) - new Date(DB.meta.baseDate)) / 86400000);
  if (diff > 0) return { txt: "D-" + diff, cls: diff <= 7 ? "b-warn" : "b-gray" };
  if (diff === 0) return { txt: "D-day", cls: "b-warn" };
  return { txt: "D+" + (-diff), cls: "b-danger" };
}

/* ---------- 모달 ---------- */
function openModal(title, bodyHtml, wide) {
  closeModal();
  const w = document.createElement("div");
  w.className = "modal-wrap"; w.id = "modalWrap";
  w.innerHTML = `<div class="modal${wide ? " wide" : ""}">
    <div class="modal-h"><h3>${title}</h3><button class="modal-x" data-action="modal-close">✕</button></div>
    <div class="modal-b">${bodyHtml}</div></div>`;
  document.body.appendChild(w);
}
function closeModal() { const m = document.getElementById("modalWrap"); if (m) m.remove(); }
const mv = (sel) => { const e = document.querySelector(sel); return e ? e.value : ""; };
const opts = (arr) => arr.map(o => `<option value="${o.v}">${o.t}</option>`).join("");
const fld = (label, inner) => `<div class="fld"><label>${label}</label>${inner}</div>`;
const custList = () => DB.partners.filter(p => p.type === "고객사").map(p => ({ v: p.name, t: p.name }));
const fgList = () => DB.items.filter(i => i.cat === "완제품").map(i => ({ v: i.code, t: i.name }));
const LINES = [{ v: "조립 1라인", t: "조립 1라인" }, { v: "조립 2라인", t: "조립 2라인" },
  { v: "압착 1라인", t: "압착 1라인" }, { v: "압착 2라인", t: "압착 2라인" }];

/* ---------- 신규 등록 모달들 ---------- */
function openOrderModal() {
  const custOpts = custList().map(c => `<option ${c.v === LASTNEW_CUST ? "selected" : ""}>${c.t}</option>`).join("");
  openModal("신규 수주 등록", `
    ${fld("거래처", `<div style="display:flex;gap:8px">
       <select id="m_cust" style="flex:1">${custOpts}</select>
       <button class="btn" data-action="partner-add-o" style="white-space:nowrap">＋ 거래처 등록</button></div>`)}
    ${fld("품목", `<select id="m_item">${opts(fgList())}</select>`)}
    ${fld("수주수량", `<input type="number" id="m_qty" value="10000" min="1">`)}
    ${fld("납기일", `<input type="date" id="m_due" value="2026-06-30">`)}
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="order-save">등록</button></div>`);
}
function saveOrder() {
  const item = mv("#m_item"), it = itemOf(item);
  DB.orders.unshift({ no: `SO-2606-${pad(++ORDSEQ, 3)}`, date: DB.meta.baseDate, cust: mv("#m_cust"),
    item, itemName: it.name, qty: +mv("#m_qty") || 0, done: 0, due: mv("#m_due"), status: "진행" });
  LASTNEW_CUST = null;
  closeModal(); SUB.sales = "수주"; go("sales");
}
function openWOModal() {
  const orderOpts = DB.orders.map(o => ({ v: o.no, t: `${o.no} · ${o.itemName}` }));
  openModal("작업지시 발행", `
    ${fld("연결 수주", `<select id="m_so">${opts(orderOpts)}</select>`)}
    ${fld("생산라인", `<select id="m_line">${opts(LINES)}</select>`)}
    ${fld("계획수량", `<input type="number" id="m_plan" value="10000" min="1">`)}
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="wo-save">발행</button></div>`);
}
function saveWO() {
  const so = mv("#m_so"), ord = DB.orders.find(o => o.no === so) || {};
  DB.workorders.unshift({ wo: `WO-2606-${pad(++WOSEQ, 3)}`, so, item: ord.item || "", itemName: ord.itemName || "",
    plan: +mv("#m_plan") || 0, prod: 0, defect: 0, line: mv("#m_line"), status: "대기", start: DB.meta.baseDate, worker: "미배정" });
  closeModal(); go("production");
}
function openQuoteModal() {
  openModal("견적서 작성", `
    ${fld("고객사", `<select id="m_cust">${opts(custList())}</select>`)}
    ${fld("견적금액 (VAT 포함)", `<input type="number" id="m_amt" value="10000000" min="0">`)}
    ${fld("상태", `<select id="m_st"><option>검토중</option><option>발송</option><option>수주확정</option></select>`)}
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="quote-save">등록</button></div>`);
}
function saveQuote() {
  DB.quotes.unshift({ no: `Q-2026-${pad(++QSEQ, 4)}`, date: DB.meta.baseDate, cust: mv("#m_cust"),
    manager: DB.meta.ceo, amount: +mv("#m_amt") || 0, status: mv("#m_st") });
  closeModal(); go("quote");
}
function openDefectModal() {
  const woOpts = DB.workorders.map(w => ({ v: w.wo, t: `${w.wo} · ${w.itemName}` }));
  const typeOpts = DB.defectTypes.map(d => ({ v: d.type, t: d.type }));
  openModal("불량(오류) 등록", `
    ${fld("작업지시", `<select id="m_wo">${opts(woOpts)}</select>`)}
    ${fld("불량 유형", `<select id="m_dt">${opts(typeOpts)}</select>`)}
    ${fld("불량 수량 (EA)", `<input type="number" id="m_dq" value="1" min="1">`)}
    <p class="modal-note">등록 시 해당 작업지시의 공정불량 수와 당월 불량유형 집계, 양품률에 즉시 반영됩니다.</p>
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="defect-save">등록</button></div>`);
}
function saveDefect() {
  const wo = DB.workorders.find(w => w.wo === mv("#m_wo"));
  const dt = DB.defectTypes.find(d => d.type === mv("#m_dt"));
  const q = +mv("#m_dq") || 0;
  if (wo) wo.defect += q;
  if (dt) dt.count += q;
  closeModal(); go(CURRENT === "quality" ? "quality" : "production");
}
function openPOModal() {
  const low = DB.stock.filter(st => st.qty < itemOf(st.code).safety);
  if (!low.length) {
    openModal("발주서 자동생성", `<p class="modal-note">안전재고 미달 품목이 없습니다.</p>
      <div class="modal-f"><button class="btn primary" data-action="modal-close">확인</button></div>`);
    return;
  }
  const rows = low.map(st => {
    const it = itemOf(st.code), sug = Math.max(it.safety * 2 - st.qty, it.safety);
    return `<tr><td class="mono">${st.code}</td><td>${it.name}</td>
      <td class="num mono t-muted">${num(st.qty)}</td><td class="num mono">${num(it.safety)}</td>
      <td class="num"><input type="number" class="numin" id="po_${st.code}" value="${Math.round(sug)}" style="width:96px"></td></tr>`;
  }).join("");
  openModal("발주서 자동생성 (안전재고 미달 품목)", `
    <table class="tbl"><thead><tr><th>코드</th><th>품목</th><th class="num">현재고</th><th class="num">안전</th><th class="num">발주수량</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="po-confirm">발주 확정 (입고처리)</button></div>`, true);
}
function confirmPO() {
  DB.stock.forEach(st => { const inp = document.getElementById("po_" + st.code); if (inp) st.qty += parseInt(inp.value, 10) || 0; });
  closeModal(); go("inventory");
}
function settleAR(no) {
  const ar = DB.receivables.find(r => r.no === no);
  if (ar) ar.status = "완료";
  rerender();
}
function openTaxModal() {
  const custOpts = custList().map(c => `<option ${c.v === LASTNEW_CUST ? "selected" : ""}>${c.t}</option>`).join("");
  openModal("세금계산서 발행", `
    <p class="modal-note" style="margin-bottom:16px">입력 내용으로 매출 세금계산서가 발행되고, <b>아래 거래명세서가 자동 생성</b>됩니다.
    실제 홈택스 발행은 전자세금계산서 발급 연동(ASP)·공동인증서가 필요하며, 데모에서는 목록에 즉시 반영됩니다.</p>
    ${fld("작성일", `<input id="t_date" class="fmt-date" value="${DB.meta.baseDate}" placeholder="260908 → 2026-09-08">`)}
    ${fld("공급받는자(고객)", `<div style="display:flex;gap:8px">
       <select id="t_name" style="flex:1">${custOpts}</select>
       <button class="btn" data-action="partner-add-t" style="white-space:nowrap">＋ 거래처 등록</button></div>`)}
    ${fld("고객 사업자등록번호", `<input id="t_biz" class="fmt-biz" placeholder="0000000000 → 000-00-00000">`)}
    ${fld("품목", `<input id="t_item" placeholder="품목명">`)}
    <div style="display:flex;gap:10px">
      <div style="flex:1">${fld("수량", `<input type="number" id="t_qty" value="1" min="1">`)}</div>
      <div style="flex:2">${fld("단가 (원)", `<input id="t_price" class="fmt-money" value="10,000,000">`)}</div>
    </div>
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="tax-save">발행 + 거래명세서 생성</button></div>`);
}
function saveTax() {
  const cust = mv("#t_name"), qty = +mv("#t_qty") || 0, price = unfmt(mv("#t_price"));
  const supply = qty * price, vat = Math.round(supply * 0.1), date = fmtDate(mv("#t_date"));
  const p = DB.partners.find(x => x.name === cust) || {};
  const ci = CLIENT_INFO[cust] || {};
  DB.taxInvoices.unshift({ date, type: "매출", partner: cust, supply, vat, status: "발행" });
  STMT_DOC = { date, cust, biz: mv("#t_biz") || p.biz || "-", contact: p.contact || "-", tel: p.tel || "-",
    fax: ci.fax || "-", addr: p.addr || ci.addr || "-", item: mv("#t_item") || "-", qty, price, unit: "EA", supply, vat };
  LASTNEW_CUST = null;
  closeModal(); SUB.settlement = "명세서"; go("settlement");
}
function confirmMatch(txId, arNo) {
  const tx = DB.bankTx.find(t => t.id === txId);
  const ar = DB.receivables.find(r => r.no === arNo);
  if (tx) tx.matched = true;
  if (ar) ar.status = "완료";
  rerender();
}

/* ---------- 거래처 신규등록 (사업자등록정보) ---------- */
let LASTNEW_CUST = null, PARTNER_RETURN = "sales";
function openPartnerModal(returnTo) {
  PARTNER_RETURN = returnTo || "sales";
  openModal("거래처 신규등록", `
    <p class="modal-note" style="margin-bottom:14px">계산서 발행·이메일 전송에 사용되는 사업자등록정보를 입력합니다. 모든 항목은 직접 입력·수정 가능합니다.</p>
    ${fld("구분", `<select id="p_type"><option>고객사</option><option>매입처</option></select>`)}
    ${fld("사업자등록번호", `<input id="p_biz" placeholder="000-00-00000">`)}
    ${fld("회사명(상호)", `<input id="p_name" placeholder="(주)○○">`)}
    ${fld("대표자명", `<input id="p_ceo" placeholder="홍길동">`)}
    ${fld("담당자명", `<input id="p_contact" placeholder="담당자">`)}
    ${fld("전화번호", `<input id="p_tel" placeholder="031-000-0000">`)}
    ${fld("이메일", `<input id="p_email" placeholder="name@company.co.kr">`)}
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="partner-save">등록</button></div>`);
}
function savePartner() {
  const name = mv("#p_name").trim();
  if (!name) { const el = document.getElementById("p_name"); if (el) el.focus(); return; }
  const type = mv("#p_type"), prefix = type === "고객사" ? "C" : "V";
  const n = DB.partners.filter(p => p.code.startsWith(prefix)).length + 1;
  DB.partners.push({
    code: prefix + pad(n, 3), name, type, contact: mv("#p_contact") || "-", tel: mv("#p_tel") || "-",
    grade: "신규", credit: 0, balance: 0, biz: mv("#p_biz") || "-", ceo: mv("#p_ceo") || "-", email: mv("#p_email") || "-",
  });
  if (type === "고객사") LASTNEW_CUST = name;
  closeModal();
  if (PARTNER_RETURN === "orders") openOrderModal();
  else if (PARTNER_RETURN === "tax") openTaxModal();
  else { SUB.sales = "거래처"; go("sales"); }
}

/* ---------- 전역 이벤트 위임 (한 번만 등록) ---------- */
function bindEvents() {
  const ACTIONS = {
    "modal-close": closeModal, "order-add": openOrderModal, "order-save": saveOrder,
    "wo-add": openWOModal, "wo-save": saveWO, "quote-add": openQuoteModal, "quote-save": saveQuote,
    "defect-add": openDefectModal, "defect-save": saveDefect, "po-generate": openPOModal, "po-confirm": confirmPO,
    "stmt-pdf": () => window.print(), "tax-issue": openTaxModal, "tax-save": saveTax,
    "partner-add": () => openPartnerModal("sales"), "partner-add-o": () => openPartnerModal("orders"),
    "partner-add-t": () => openPartnerModal("tax"), "partner-save": savePartner,
  };
  document.addEventListener("click", e => {
    if (e.target.id === "modalWrap") { closeModal(); return; }
    const st = e.target.closest("[data-subtab]");
    if (st) { SUB[st.dataset.group] = st.dataset.subtab; rerender(); return; }
    const b = e.target.closest("[data-action]"); if (!b) return;
    if (b.dataset.action === "ar-settle") { settleAR(b.dataset.no); return; }
    if (b.dataset.action === "tax-toggle") {
      const r = DB.receivables.find(x => x.no === b.dataset.no);
      if (r) r.taxIssued = !(r.taxIssued != null ? r.taxIssued : r.status === "완료");
      rerender(); return;
    }
    if (b.dataset.action === "match-confirm") { confirmMatch(b.dataset.tx, b.dataset.ar); return; }
    (ACTIONS[b.dataset.action] || (() => {}))();
  });
  document.addEventListener("change", e => {
    const f = e.target;
    if (f.classList && f.classList.contains("fmt-date")) f.value = fmtDate(f.value);
    else if (f.classList && (f.classList.contains("fmt-phone") || f.classList.contains("fmt-fax"))) f.value = fmtPhone(f.value);
    else if (f.classList && f.classList.contains("fmt-biz")) f.value = fmtBiz(f.value);
    else if (f.classList && f.classList.contains("fmt-money")) f.value = fmtMoney(f.value);
    const ss = e.target.closest("#stmtSel");
    if (ss) { STMT_SOURCE = ss.value; STMT_DOC = null; rerender(); return; }
    const sel = e.target.closest("select.lblsel");
    if (sel) { applyEdit(sel, false); rerender(); return; }
    const ni = e.target.closest("input.numin");
    if (ni && ni.dataset.coll) { applyEdit(ni, true); rerender(); return; }
  });
  document.addEventListener("input", e => {
    const s = e.target.closest("input.search"); if (!s) return;
    const scope = s.closest(".card") || document;
    const q = s.value.trim().toLowerCase();
    scope.querySelectorAll("table.tbl tbody tr").forEach(r =>
      r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none");
  });
}
function rerender() { const y = window.scrollY; go(CURRENT, true); window.scrollTo(0, y); }

/* ---------- 거래명세서 데이터 (세금계산서 발행분 우선, 없으면 수주 기준) ---------- */
function statementDoc() {
  if (STMT_DOC) return STMT_DOC;
  if (!STMT_SOURCE) STMT_SOURCE = DB.orders[0].no;
  const ord = DB.orders.find(o => o.no === STMT_SOURCE) || DB.orders[0];
  const it = itemOf(ord.item);
  const p = DB.partners.find(x => x.name === ord.cust) || {};
  const ci = CLIENT_INFO[ord.cust] || {};
  const supply = ord.qty * it.price;
  return { date: ord.date, cust: ord.cust, biz: p.biz || "-", contact: p.contact || "-", tel: p.tel || "-",
    fax: ci.fax || "-", addr: p.addr || ci.addr || "-", item: ord.itemName, qty: ord.qty, price: it.price,
    unit: it.unit || "EA", supply, vat: Math.round(supply * 0.1) };
}

/* ---------- 거래명세서 (자동작성 + 편집 + PDF) ---------- */
function renderStatement() {
  const d = statementDoc();
  const supply = d.supply, vat = d.vat, total = supply + vat;
  const m = DB.meta;
  const e = (v) => `<td class="ed" contenteditable="true">${v}</td>`;
  const eN = (v) => `<td class="ed num" contenteditable="true">${num(v)}</td>`;

  let emptyRows = "";
  for (let i = 0; i < 7; i++)
    emptyRows += `<tr class="ih"><td class="ed" contenteditable="true"></td><td class="ed" contenteditable="true"></td>
      <td class="ed" contenteditable="true"></td><td class="ed num" contenteditable="true"></td><td class="ed num" contenteditable="true"></td>
      <td class="ed num" contenteditable="true"></td><td class="ed num" contenteditable="true"></td></tr>`;

  return `<div id="stmtArea"><div class="stmt">
    <table>
      <tr>
        <td class="lbl" style="width:13%">거래일자</td>
        <td class="title" rowspan="2">거 래 명 세 서</td>
        <td class="lbl" style="width:14%">등록번호</td>
      </tr>
      <tr>${e(d.date)}${e(m.biznum)}</tr>
    </table>
    <table>
      <tr><td class="sectionhead" colspan="4">공급받는자</td><td class="sectionhead" colspan="4">공급자</td></tr>
      <tr>
        <td class="lbl" style="width:11%">회사명</td>${e(d.cust)}<td class="lbl" style="width:11%">사업자</td>${e(d.biz)}
        <td class="lbl" style="width:11%">회사명</td>${e(m.company + " (" + m.companyEn + ")")}<td class="lbl" style="width:11%">사업자</td>${e(m.biznum)}
      </tr>
      <tr>
        <td class="lbl">연락처</td>${e(d.tel)}<td class="lbl">FAX</td>${e(d.fax)}
        <td class="lbl">연락처</td>${e("031-000-0000")}<td class="lbl">FAX</td>${e("031-000-0001")}
      </tr>
      <tr>
        <td class="lbl">소재지</td><td class="ed" colspan="3" contenteditable="true">${d.addr}</td>
        <td class="lbl">소재지</td><td class="ed" colspan="3" contenteditable="true">${m.addr}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td class="lbl" style="width:13%">날짜</td><td class="lbl">품목</td><td class="lbl" style="width:11%">규격</td>
        <td class="lbl" style="width:9%">수량</td><td class="lbl" style="width:14%">단가</td>
        <td class="lbl" style="width:16%">공급가액 (W)</td><td class="lbl" style="width:13%">세액 (W)</td>
      </tr>
      <tr class="ih">
        ${e(d.date)}${e(d.item)}${e(d.unit)}${eN(d.qty)}${eN(d.price)}${eN(supply)}${eN(vat)}
      </tr>
      ${emptyRows}
    </table>
    <table>
      <tr>
        <td class="lbl" style="width:14%">공급가액 (W)</td>${eN(supply)}
        <td class="lbl" style="width:10%">세액 (W)</td>${eN(vat)}
        <td class="lbl" style="width:14%">합계금액 (W)</td>
        <td class="num grand">${num(total)}<small>(${hangulMoney(total)})</small></td>
      </tr>
    </table>
  </div></div>`;
}

/* ---------------- SVG 차트 (직접 구현) ---------------- */

// 막대+선 복합: 월별 매출 vs 목표
function chartBarLine(data, { w = 640, h = 240 } = {}) {
  const pad = { l: 44, r: 16, t: 18, b: 28 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...data.map(d => Math.max(d.sales, d.target))) * 1.15;
  const bw = iw / data.length;
  const y = v => pad.t + ih - (v / max) * ih;
  const x = i => pad.l + bw * i + bw / 2;

  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = pad.t + (ih / 4) * g;
    const val = max * (1 - g / 4);
    grid += `<line x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}" stroke="#eef1f7"/>`;
    grid += `<text x="${pad.l - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#9aa4b8">${Math.round(val)}</text>`;
  }
  let bars = "", labels = "";
  data.forEach((d, i) => {
    const bh = (d.sales / max) * ih;
    const bx = pad.l + bw * i + bw * 0.26;
    const last = i === data.length - 1;
    bars += `<rect x="${bx}" y="${y(d.sales)}" width="${bw * 0.48}" height="${bh}" rx="4"
              fill="${last ? "#9db4ff" : "url(#barg)"}"/>`;
    bars += `<text x="${x(i)}" y="${y(d.sales) - 6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#3a4663">${d.sales}</text>`;
    labels += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10.5" fill="#7c889c">${d.m.slice(5)}월</text>`;
  });
  const line = data.map((d, i) => `${x(i)},${y(d.target)}`).join(" ");
  let dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.target)}" r="3.5" fill="#fff" stroke="#f0a020" stroke-width="2"/>`).join("");

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="barg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a63ff"/><stop offset="1" stop-color="#6a8dff"/>
      </linearGradient>
    </defs>
    ${grid}${bars}
    <polyline points="${line}" fill="none" stroke="#f0a020" stroke-width="2.5"/>
    ${dots}${labels}
  </svg>`;
}

// 일별 생산: 계획 대비 실적 (선 2개 + 면적)
function chartArea(data, { w = 640, h = 220 } = {}) {
  const pad = { l: 44, r: 16, t: 16, b: 26 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...data.map(d => Math.max(d.plan, d.prod))) * 1.12;
  const x = i => pad.l + (iw / (data.length - 1)) * i;
  const y = v => pad.t + ih - (v / max) * ih;

  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = pad.t + (ih / 4) * g;
    grid += `<line x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}" stroke="#eef1f7"/>`;
    grid += `<text x="${pad.l - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#9aa4b8">${Math.round(max * (1 - g / 4))}</text>`;
  }
  const lineP = data.map((d, i) => `${x(i)},${y(d.prod)}`).join(" ");
  const linePlan = data.map((d, i) => `${x(i)},${y(d.plan)}`).join(" ");
  const area = `${pad.l},${pad.t + ih} ${lineP} ${x(data.length - 1)},${pad.t + ih}`;
  const dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.prod)}" r="3.2" fill="#2f54eb"/>`).join("");
  const labels = data.map((d, i) => `<text x="${x(i)}" y="${h - 7}" text-anchor="middle" font-size="10" fill="#7c889c">${d.d}</text>`).join("");

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f54eb" stop-opacity=".22"/><stop offset="1" stop-color="#2f54eb" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${linePlan}" fill="none" stroke="#c2ccde" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${lineP}" fill="none" stroke="#2f54eb" stroke-width="2.6"/>
    ${dots}${labels}
  </svg>`;
}

// 도넛: 달성률 게이지
function chartDonut(value, { size = 150, label = "", color = "#2f54eb" } = {}) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(value, 100) / 100);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef1f7" stroke-width="13"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="13"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="26" font-weight="800" fill="#1a2233">${value.toFixed(0)}%</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="#7c889c">${label}</text>
  </svg>`;
}

// 도넛 파이 (다중 세그먼트)
function chartPie(segs, { size = 160, center = "" } = {}) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = segs.map(s => {
    const len = c * (s.value / total);
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="20"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len; return el;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef1f7" stroke-width="20"/>${arcs}
    ${center ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#1f2733">${center}</text>` : ""}
  </svg>`;
}

// 가로 막대: 불량 유형
function chartHBar(data, { w = 360 } = {}) {
  const max = Math.max(...data.map(d => d.count));
  const colors = ["#e02b2b", "#f0a020", "#2f54eb", "#7b3fe4", "#18a058"];
  return `<div style="display:flex;flex-direction:column;gap:13px">` +
    data.map((d, i) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:5px">
          <span>${d.type}</span><span class="t-muted">${d.count}건</span>
        </div>
        <div class="pbar" style="height:9px"><i style="width:${(d.count / max) * 100}%;background:${colors[i % colors.length]}"></i></div>
      </div>`).join("") + `</div>`;
}

/* ---------------- 진행률 셀 ---------------- */
function progressCell(done, total) {
  const p = total ? (done / total) * 100 : 0;
  const cls = p >= 100 ? "ok" : p >= 50 ? "" : "warn";
  return `<div class="pcell"><div class="pbar ${cls}"><i style="width:${Math.min(p, 100)}%"></i></div>
    <span class="pv">${p.toFixed(0)}%</span></div>`;
}

/* =====================================================================
 * 뷰(페이지) 렌더러
 * ===================================================================== */
const Views = {};

/* ---------------- 대시보드 ---------------- */
Views.dashboard = () => {
  // KPI 계산
  const ms = DB.monthlySales;
  const cur = ms[ms.length - 1], prev = ms[ms.length - 2];
  const ytd = ms.filter(x => x.m.startsWith("2026-")).reduce((s, x) => s + x.sales, 0);
  const goalTarget = DB.meta.goal.salesTarget;
  const goalRate = ytd / goalTarget * 100;
  const salesDelta = (cur.sales - prev.sales) / prev.sales * 100;
  const backlog = DB.orders.filter(o => o.status !== "완료")
    .reduce((s, o) => s + (o.qty - o.done) * itemOf(o.item).price, 0);
  // 생산 달성률(완료일 일평균)
  const doneDays = DB.dailyProd.slice(0, -1);
  const dPlan = doneDays.reduce((s, d) => s + d.plan, 0);
  const dProd = doneDays.reduce((s, d) => s + d.prod, 0);
  const achieve = dProd / dPlan * 100;
  // 출하 양품률 (전수검사 기준)
  const insQty = DB.shipInspect.reduce((s, r) => s + r.qty, 0);
  const insFail = DB.shipInspect.reduce((s, r) => s + r.fail, 0);
  const yieldRate = (1 - insFail / insQty) * 100;
  const ppm = Math.round(insFail / insQty * 1e6);
  // 작업지시 기준 누적
  const totalPlan = DB.workorders.reduce((s, w) => s + w.plan, 0);
  const totalProd = DB.workorders.reduce((s, w) => s + w.prod, 0);
  const totalDefect = DB.workorders.reduce((s, w) => s + w.defect, 0);
  const lowStock = DB.stock.filter(st => st.qty < itemOf(st.code).safety);

  const kpiCards = `
    <div class="card kpi fade">
      <div class="kpi-top"><div></div><div class="kpi-ic" style="background:#2f54eb">🎯</div></div>
      <div class="kpi-label">연 매출 목표 달성률 <span class="t-muted">(목표 20억)</span></div>
      <div class="kpi-val">${goalRate.toFixed(1)}<span class="unit">%</span></div>
      <div class="pbar" style="margin-top:9px"><i style="width:${Math.min(goalRate, 100)}%"></i></div>
      <div class="kpi-delta up" style="margin-top:7px"><span class="muted">누적 ${num(ytd)} / ${num(goalTarget)} 백만원</span></div>
    </div>
    <div class="card kpi fade">
      <div class="kpi-top"><div></div><div class="kpi-ic" style="background:#7b3fe4">📈</div></div>
      <div class="kpi-label">당월 매출 (진행중)</div>
      <div class="kpi-val">${num(cur.sales)}<span class="unit">백만원</span></div>
      <div class="kpi-delta ${salesDelta >= 0 ? "up" : "down"}">${salesDelta >= 0 ? "▲" : "▼"} ${Math.abs(salesDelta).toFixed(1)}% <span class="muted">전월 대비</span></div>
    </div>
    <div class="card kpi fade">
      <div class="kpi-top"><div></div><div class="kpi-ic" style="background:#18a058">🏭</div></div>
      <div class="kpi-label">생산 달성률 <span class="t-muted">(일평균)</span></div>
      <div class="kpi-val">${achieve.toFixed(1)}<span class="unit">%</span></div>
      <div class="kpi-delta up">▲ 2.1% <span class="muted">전주 대비</span></div>
    </div>
    <div class="card kpi fade">
      <div class="kpi-top"><div></div><div class="kpi-ic" style="background:#0a8f6e">✅</div></div>
      <div class="kpi-label">출하 양품률 <span class="t-muted">(전수검사)</span></div>
      <div class="kpi-val">${yieldRate.toFixed(3)}<span class="unit">%</span></div>
      <div class="kpi-delta up">불량 ${ppm} PPM <span class="muted">· 2026 목표 5 PPM</span></div>
    </div>`;

  // 진행중 작업지시
  const activeWO = DB.workorders.filter(w => w.status !== "완료");
  const woRows = activeWO.map(w => `
    <tr>
      <td class="mono t-strong">${w.wo}</td>
      <td>${w.itemName}</td>
      <td>${w.line}</td>
      <td>${labelSelect("process", "workorders", "wo", w.wo, "status")}</td>
      <td style="min-width:150px">${progressCell(w.prod, w.plan)}</td>
    </tr>`).join("");

  // 알림
  const alerts = [];
  DB.orders.filter(o => o.status === "지연").forEach(o =>
    alerts.push({ c: "var(--danger)", t: `<b>${o.cust}</b> 납기 지연 — ${o.itemName} (${o.no})`, time: "납기 " + o.due }));
  lowStock.forEach(st => {
    const it = itemOf(st.code);
    alerts.push({ c: "var(--warn)", t: `<b>${it.name}</b> 안전재고 미달 (현재 ${num(st.qty)}${it.unit} / 안전 ${num(it.safety)})`, time: "재고 경고" });
  });
  alerts.push({ c: "var(--ok)", t: `<b>SO-2606-015</b> 출하 완료 — 프론트 도어 하네스 2,000EA`, time: "오늘 09:14" });
  alerts.push({ c: "var(--info)", t: `<b>WO-2606-052</b> 조립 공정 진입 — 엔진룸 하네스`, time: "오늘 08:30" });

  const alertHtml = alerts.slice(0, 6).map(a => `
    <div class="aitem"><span class="dot" style="background:${a.c}"></span>
      <div><div class="txt">${a.t}</div><div class="time">${a.time}</div></div></div>`).join("");

  return `
  <div class="demo-banner">🔧 하이큐테크 스마트팩토리 ERP <b>베타(v0.9)</b> · 표시 수치는 일부 데모 데이터입니다.</div>

  <div class="grid g-4">${kpiCards}</div>

  <div class="card fade" style="margin-top:16px;padding:14px 20px">
    <div class="statline" style="gap:36px">
      <div class="s"><div class="lbl">설립</div><div class="val" style="font-size:16px">${DB.meta.founded}</div></div>
      <div class="s"><div class="lbl">대표</div><div class="val" style="font-size:16px">${DB.meta.ceo}</div></div>
      <div class="s"><div class="lbl">임직원</div><div class="val" style="font-size:16px">${DB.meta.emp.total}명 <span class="t-muted" style="font-size:12px;font-weight:600">(관리 ${DB.meta.emp.mgmt}·생산 ${DB.meta.emp.prod})</span></div></div>
      <div class="s"><div class="lbl">인증</div><div class="val" style="font-size:16px">${DB.meta.cert}</div></div>
      <div class="s"><div class="lbl">생산목표(2026)</div><div class="val" style="font-size:16px">${num(DB.meta.goal.prodTargetK)}K EA</div></div>
    </div>
  </div>

  <div class="grid g-2-1" style="margin-top:16px">
    <div class="card fade">
      <div class="card-h"><h3>월별 매출 추이</h3>
        <span class="hint">단위: 백만원 · 막대=실적 / 선=목표</span></div>
      <div class="card-b">${chartBarLine(DB.monthlySales)}
        <div class="legend">
          <div class="lg"><i style="background:#3a63ff"></i>매출 실적</div>
          <div class="lg"><i style="background:#f0a020"></i>매출 목표</div>
        </div>
      </div>
    </div>
    <div class="card fade">
      <div class="card-h"><h3>생산 달성률 (최근 일평균)</h3></div>
      <div class="card-b" style="display:flex;flex-direction:column;align-items:center;gap:10px">
        ${chartDonut(achieve, { label: "계획 대비 실적", color: "#18a058" })}
        <div class="statline" style="justify-content:center">
          <div class="s" style="text-align:center"><div class="lbl">계획</div><div class="val">${num(dPlan)}</div></div>
          <div class="s" style="text-align:center"><div class="lbl">실적</div><div class="val">${num(dProd)}</div></div>
          <div class="s" style="text-align:center"><div class="lbl">공정불량</div><div class="val" style="color:var(--danger)">${num(totalDefect)}</div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-2-1" style="margin-top:16px">
    <div class="card fade">
      <div class="card-h"><h3>일별 생산 실적 (최근 8일)</h3>
        <span class="hint">실선=실적 / 점선=계획</span></div>
      <div class="card-b">${chartArea(DB.dailyProd)}</div>
    </div>
    <div class="card fade">
      <div class="card-h"><h3>당월 불량 유형 분석</h3><span class="hint">총 ${num(DB.defectTypes.reduce((s,d)=>s+d.count,0))}건</span></div>
      <div class="card-b">${chartHBar(DB.defectTypes)}</div>
    </div>
  </div>

  <div class="grid g-2-1" style="margin-top:16px">
    <div class="card fade">
      <div class="card-h"><h3>진행중 작업지시 현황</h3>
        <span class="hint">현재 가동 라인 ${activeWO.length}건</span></div>
      <table class="tbl">
        <thead><tr><th>작업지시</th><th>품목</th><th>라인</th><th>공정</th><th>진행률</th></tr></thead>
        <tbody>${woRows}</tbody>
      </table>
    </div>
    <div class="card fade">
      <div class="card-h"><h3>실시간 알림</h3></div>
      <div class="card-b"><div class="alist">${alertHtml}</div></div>
    </div>
  </div>`;
};

/* ---------------- 수주관리 ---------------- */
function ordersView() {
  const total = DB.orders.reduce((s, o) => s + o.qty * itemOf(o.item).price, 0);
  const active = DB.orders.filter(o => o.status === "진행").length;
  const delayed = DB.orders.filter(o => o.status === "지연").length;
  const done = DB.orders.filter(o => o.status === "완료").length;

  const rows = DB.orders.map(o => {
    const amt = o.qty * itemOf(o.item).price;
    return `<tr>
      <td class="mono t-strong">${o.no}</td>
      <td class="t-muted">${o.date}</td>
      <td>${o.cust}</td>
      <td>${o.itemName}<div class="t-muted mono" style="font-size:11px">${o.item}</div></td>
      <td class="num mono">${num(o.qty)}</td>
      <td style="min-width:160px">${progressCell(o.done, o.qty)}</td>
      <td class="num mono t-strong">${won(amt)}</td>
      <td>${o.status === "완료"
        ? `<span class="t-muted">${o.due}</span>`
        : `<span class="due-cell"><b>${o.due}</b><span class="badge ${dDay(o.due).cls}">${dDay(o.due).txt}</span></span>`}</td>
      <td>${labelSelect("order", "orders", "no", o.no, "status")}</td>
    </tr>`;
  }).join("");

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 수주금액</div><div class="kpi-val" style="font-size:23px">${won(total)}</div></div>
    <div class="card kpi"><div class="kpi-label">진행중</div><div class="kpi-val">${active}<span class="unit">건</span></div></div>
    <div class="card kpi"><div class="kpi-label">완료</div><div class="kpi-val" style="color:var(--ok)">${done}<span class="unit">건</span></div></div>
    <div class="card kpi"><div class="kpi-label">납기지연</div><div class="kpi-val" style="color:var(--danger)">${delayed}<span class="unit">건</span></div></div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="toolbar" style="padding:14px 18px;margin:0;border-bottom:1px solid var(--line)">
      <div><span class="sec-title" style="margin:0"><span class="ic">📋</span>수주 목록</span></div>
      <div style="display:flex;gap:8px">
        <input class="search" placeholder="수주번호 · 거래처 · 품목 검색">
        <button class="btn primary" data-action="order-add">＋ 신규 수주</button>
      </div>
    </div>
    <table class="tbl">
      <thead><tr><th>수주번호</th><th>수주일</th><th>거래처</th><th>품목</th>
        <th class="num">수주수량</th><th>진행률</th><th class="num">수주금액</th><th>납기일</th><th>상태</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ---------------- 수주 / 거래처 (통합) ---------------- */
Views.sales = () => subnav("sales", [["수주", "수주관리"], ["거래처", "거래처"]]) +
  (SUB.sales === "수주" ? ordersView() : partnersView());

/* ---------------- 생산관리 ---------------- */
Views.production = () => {
  const totalPlan = DB.workorders.reduce((s, w) => s + w.plan, 0);
  const totalProd = DB.workorders.reduce((s, w) => s + w.prod, 0);
  const totalDefect = DB.workorders.reduce((s, w) => s + w.defect, 0);
  const active = DB.workorders.filter(w => w.status !== "완료").length;
  const achieve = (totalProd / totalPlan) * 100;
  const yieldRate = ((totalProd - totalDefect) / totalProd) * 100;

  // 라인별 집계
  const lines = {};
  DB.workorders.forEach(w => {
    lines[w.line] = lines[w.line] || { plan: 0, prod: 0, defect: 0 };
    lines[w.line].plan += w.plan; lines[w.line].prod += w.prod; lines[w.line].defect += w.defect;
  });

  const rows = DB.workorders.map(w => `
    <tr>
      <td class="mono t-strong">${w.wo}</td>
      <td class="mono t-muted">${w.so}</td>
      <td>${w.itemName}</td>
      <td>${w.line}</td>
      <td class="num mono">${num(w.plan)}</td>
      <td class="num mono">${num(w.prod)}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "defect", w.defect, { w: 62 })}</td>
      <td style="min-width:140px">${progressCell(w.prod, w.plan)}</td>
      <td>${labelSelect("process", "workorders", "wo", w.wo, "status")}</td>
    </tr>`).join("");

  const lineCards = Object.entries(lines).map(([name, v]) => {
    const a = (v.prod / v.plan) * 100;
    return `<div class="card" style="padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="t-strong">${name}</span>${statusBadge(a >= 100 ? "완료" : "진행")}</div>
      <div class="pbar ${a >= 100 ? "ok" : a >= 60 ? "" : "warn"}" style="height:9px"><i style="width:${Math.min(a, 100)}%"></i></div>
      <div style="display:flex;justify-content:space-between;margin-top:9px;font-size:12px" class="t-muted">
        <span>실적 ${num(v.prod)} / 계획 ${num(v.plan)}</span><span class="t-strong">${a.toFixed(0)}%</span></div>
    </div>`;
  }).join("");

  return `
  <div class="edit-hint">✎ <b>공정상태</b>·<b>불량수량</b>은 표에서 클릭하여 현장에서 직접 변경할 수 있고, 변경 즉시 KPI에 반영됩니다.</div>
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">진행중 작업지시</div><div class="kpi-val">${active}<span class="unit">건</span></div></div>
    <div class="card kpi"><div class="kpi-label">생산 달성률</div><div class="kpi-val" style="color:var(--ok)">${achieve.toFixed(1)}<span class="unit">%</span></div></div>
    <div class="card kpi"><div class="kpi-label">양품률 (수율)</div><div class="kpi-val">${yieldRate.toFixed(1)}<span class="unit">%</span></div></div>
    <div class="card kpi"><div class="kpi-label">누적 불량</div><div class="kpi-val" style="color:var(--danger)">${num(totalDefect)}<span class="unit">EA</span></div></div>
  </div>

  <div class="sec-title" style="margin-top:22px"><span class="ic">🏭</span>라인별 가동 현황</div>
  <div class="grid g-4 fade">${lineCards}</div>

  <div class="grid g-2" style="margin-top:18px">
    <div class="card fade">
      <div class="card-h"><h3>일별 생산 추이</h3><span class="hint">실선=실적 / 점선=계획</span></div>
      <div class="card-b">${chartArea(DB.dailyProd)}</div>
    </div>
    <div class="card fade">
      <div class="card-h"><h3>불량 유형 분석</h3></div>
      <div class="card-b">${chartHBar(DB.defectTypes)}</div>
    </div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>작업지시 목록</h3>
      <div style="display:flex;gap:8px">
        <button class="btn" data-action="defect-add">⚠ 불량 등록</button>
        <button class="btn primary" data-action="wo-add">＋ 작업지시 발행</button>
      </div></div>
    <table class="tbl">
      <thead><tr><th>작업지시</th><th>연결수주</th><th>품목</th><th>라인</th>
        <th class="num">계획</th><th class="num">생산</th><th class="num">불량</th><th>진행률</th><th>공정상태</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

/* ---------------- 재고관리 ---------------- */
Views.inventory = () => {
  const enriched = DB.stock.map(st => {
    const it = itemOf(st.code);
    return { ...st, name: it.name, cat: it.cat, unit: it.unit, price: it.price, safety: it.safety, value: st.qty * it.price };
  });
  const totalValue = enriched.reduce((s, e) => s + e.value, 0);
  const low = enriched.filter(e => e.qty < e.safety);
  const fgValue = enriched.filter(e => e.cat === "완제품").reduce((s, e) => s + e.value, 0);
  const rmValue = enriched.filter(e => e.cat === "원자재").reduce((s, e) => s + e.value, 0);

  const catBadge = (c) => {
    const m = { "완제품": "b-info", "반제품": "b-purple", "원자재": "b-gray" };
    return `<span class="badge ${m[c]}">${c}</span>`;
  };

  const rows = enriched.map(e => {
    const ratio = e.safety ? (e.qty / e.safety) * 100 : 200;
    const stat = e.qty < e.safety ? `<span class="badge b-danger">부족</span>`
      : ratio < 130 ? `<span class="badge b-warn">주의</span>`
      : `<span class="badge b-ok">정상</span>`;
    return `<tr>
      <td class="mono t-strong">${e.code}</td>
      <td>${e.name}</td>
      <td>${catBadge(e.cat)}</td>
      <td class="num mono">${num(e.qty)} ${e.unit}</td>
      <td class="num mono t-muted">${num(e.safety)}</td>
      <td class="num mono">${won(e.price)}</td>
      <td class="num mono t-strong">${won(e.value)}</td>
      <td class="t-muted">${e.loc}</td>
      <td>${stat}</td>
    </tr>`;
  }).join("");

  const lowRows = low.map(e => `
    <div class="aitem"><span class="dot" style="background:var(--danger)"></span>
      <div><div class="txt"><b>${e.name}</b></div>
      <div class="time">현재 ${num(e.qty)}${e.unit} / 안전재고 ${num(e.safety)}${e.unit} · ${e.loc}</div></div></div>`).join("")
    || `<div class="t-muted" style="padding:10px 0">안전재고 미달 품목이 없습니다.</div>`;

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 재고자산</div><div class="kpi-val" style="font-size:22px">${won(totalValue)}</div></div>
    <div class="card kpi"><div class="kpi-label">완제품 재고</div><div class="kpi-val" style="font-size:22px">${won(fgValue)}</div></div>
    <div class="card kpi"><div class="kpi-label">원자재 재고</div><div class="kpi-val" style="font-size:22px">${won(rmValue)}</div></div>
    <div class="card kpi"><div class="kpi-label">안전재고 미달</div><div class="kpi-val" style="color:var(--danger)">${low.length}<span class="unit">품목</span></div></div>
  </div>

  <div class="grid g-2-1" style="margin-top:18px">
    <div class="card fade">
      <div class="card-h"><h3>재고 현황</h3>
        <input class="search" placeholder="품목코드 · 품목명 검색" style="width:220px"></div>
      <table class="tbl">
        <thead><tr><th>품목코드</th><th>품목명</th><th>구분</th>
          <th class="num">현재고</th><th class="num">안전</th><th class="num">단가</th>
          <th class="num">재고금액</th><th>위치</th><th>상태</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="card fade" style="align-self:start">
      <div class="card-h"><h3>재발주 알림</h3><span class="badge b-danger">${low.length}</span></div>
      <div class="card-b"><div class="alist">${lowRows}</div>
        <button class="btn primary" style="width:100%;margin-top:12px" data-action="po-generate">발주서 자동생성</button>
      </div>
    </div>
  </div>`;
};

/* ---------------- 품목/BOM ---------------- */
Views.bom = () => {
  const itemRows = DB.items.map(it => {
    const m = { "완제품": "b-info", "반제품": "b-purple", "원자재": "b-gray" };
    return `<tr>
      <td class="mono t-strong">${it.code}</td>
      <td>${it.name}</td>
      <td><span class="badge ${m[it.cat]}">${it.cat}</span></td>
      <td>${it.unit}</td>
      <td class="num mono">${won(it.price)}</td>
      <td class="num mono t-muted">${num(it.safety)}</td>
    </tr>`;
  }).join("");

  const bomCards = DB.boms.map(b => {
    const fg = itemOf(b.parent);
    const matCost = b.comps.reduce((s, c) => s + c.qty * itemOf(c.code).price, 0);
    const margin = ((fg.price - matCost) / fg.price) * 100;
    const compRows = b.comps.map(c => `
      <tr><td class="mono t-muted">${c.code}</td><td>${c.name}</td>
        <td class="num mono">${c.qty} ${c.unit}</td>
        <td class="num mono">${won(itemOf(c.code).price)}</td>
        <td class="num mono t-strong">${won(c.qty * itemOf(c.code).price)}</td></tr>`).join("");
    return `<div class="card fade" style="margin-bottom:16px">
      <div class="card-h">
        <h3>${b.parentName} <span class="mono t-muted" style="font-size:12px;font-weight:600">${b.parent}</span></h3>
        <div style="display:flex;gap:16px;align-items:center">
          <span class="t-muted" style="font-size:12px">판매단가 <b style="color:var(--ink)">${won(fg.price)}</b></span>
          <span class="t-muted" style="font-size:12px">자재원가 <b style="color:var(--ink)">${won(matCost)}</b></span>
          <span class="badge ${margin > 50 ? "b-ok" : margin > 30 ? "b-warn" : "b-danger"}">자재마진 ${margin.toFixed(0)}%</span>
        </div>
      </div>
      <table class="tbl">
        <thead><tr><th>자재코드</th><th>자재명</th><th class="num">소요량</th><th class="num">단가</th><th class="num">소요금액</th></tr></thead>
        <tbody>${compRows}</tbody>
      </table>
    </div>`;
  }).join("");

  return `
  <div class="card fade">
    <div class="card-h"><h3>품목 마스터</h3><span class="hint">총 ${DB.items.length}개 품목</span></div>
    <table class="tbl">
      <thead><tr><th>품목코드</th><th>품목명</th><th>구분</th><th>단위</th><th class="num">단가</th><th class="num">안전재고</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="sec-title" style="margin-top:24px"><span class="ic">🧬</span>BOM (자재명세서) — 완제품별 구성</div>
  ${bomCards}`;
};

/* ---------------- 거래처 ---------------- */
function partnersView() {
  const cust = DB.partners.filter(p => p.type === "고객사");
  const vend = DB.partners.filter(p => p.type === "매입처");
  const recv = cust.reduce((s, p) => s + p.balance, 0);
  const pay = Math.abs(vend.reduce((s, p) => s + p.balance, 0));

  const gradeBadge = (g) => `<span class="badge ${g === "A" ? "b-ok" : g === "B" ? "b-info" : "b-gray"}">${g === "신규" ? "신규" : g + "등급"}</span>`;

  const row = (p) => `<tr>
    <td class="mono t-strong">${p.code}</td>
    <td>${p.name}</td>
    <td class="mono t-muted">${p.biz || "-"}</td>
    <td>${p.ceo || "-"}</td>
    <td>${gradeBadge(p.grade)}</td>
    <td>${p.contact}</td>
    <td class="t-muted mono">${p.tel}</td>
    <td class="num mono t-strong" style="color:${p.balance < 0 ? "var(--danger)" : "var(--ink)"}">${won(p.balance)}</td>
  </tr>`;

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">고객사</div><div class="kpi-val">${cust.length}<span class="unit">개사</span></div></div>
    <div class="card kpi"><div class="kpi-label">매입처</div><div class="kpi-val">${vend.length}<span class="unit">개사</span></div></div>
    <div class="card kpi"><div class="kpi-label">매출채권 (미수금)</div><div class="kpi-val" style="font-size:21px">${won(recv)}</div></div>
    <div class="card kpi"><div class="kpi-label">매입채무 (미지급금)</div><div class="kpi-val" style="font-size:21px;color:var(--danger)">${won(pay)}</div></div>
  </div>

  <div class="toolbar" style="margin-top:18px">
    <span class="sec-title" style="margin:0"><span class="ic">🤝</span>거래처 목록</span>
    <button class="btn primary" data-action="partner-add">＋ 거래처 신규등록</button>
  </div>

  <div class="card fade">
    <div class="card-h"><h3>고객사</h3><span class="hint">${cust.length}개사</span></div>
    <table class="tbl">
      <thead><tr><th>코드</th><th>거래처명</th><th>사업자번호</th><th>대표자</th><th>등급</th><th>담당자</th><th>연락처</th>
        <th class="num">미수잔액</th></tr></thead>
      <tbody>${cust.map(row).join("")}</tbody>
    </table>
  </div>

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>매입처</h3><span class="hint">${vend.length}개사</span></div>
    <table class="tbl">
      <thead><tr><th>코드</th><th>거래처명</th><th>사업자번호</th><th>대표자</th><th>등급</th><th>담당자</th><th>연락처</th>
        <th class="num">미지급잔액</th></tr></thead>
      <tbody>${vend.map(row).join("")}</tbody>
    </table>
  </div>`;
}

/* ---------------- 품질관리 ---------------- */
function qualityView() {
  const insQty = DB.shipInspect.reduce((s, r) => s + r.qty, 0);
  const insFail = DB.shipInspect.reduce((s, r) => s + r.fail, 0);
  const yieldRate = (1 - insFail / insQty) * 100;
  const ppm = Math.round(insFail / insQty * 1e6);
  const auditAvg = DB.lineAudit.reduce((s, a) => s + a.score, 0) / DB.lineAudit.length;
  const respAvg = Math.round(DB.complaints.reduce((s, c) => s + c.respMin, 0) / DB.complaints.length);

  const insRows = DB.shipInspect.map(r => {
    const pass = r.qty - r.fail;
    const rate = (pass / r.qty) * 100;
    return `<tr>
      <td class="t-muted">${r.date}</td>
      <td class="mono t-strong">${r.lot}</td>
      <td>${r.cust}</td>
      <td>${r.item}</td>
      <td class="num mono">${num(r.qty)}</td>
      <td class="num mono" style="color:var(--ok)">${num(pass)}</td>
      <td class="num mono" style="color:${r.fail ? "var(--danger)" : "var(--ink-soft)"}">${r.fail}</td>
      <td class="num mono t-strong">${rate.toFixed(3)}%</td>
      <td><span class="badge b-ok">합격</span></td>
    </tr>`;
  }).join("");

  const auditCards = DB.lineAudit.map(a => {
    const cls = a.score >= 95 ? "ok" : a.score >= 90 ? "" : "warn";
    const bcls = a.score >= 95 ? "b-ok" : a.score >= 90 ? "b-info" : "b-warn";
    return `<div class="card" style="padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="t-strong">${a.line}</span><span class="badge ${bcls}">${a.score}점</span></div>
      <div class="pbar ${cls}" style="height:9px"><i style="width:${a.score}%"></i></div>
      <div class="t-muted" style="font-size:12px;margin-top:8px">감사일 ${a.date} · ${a.auditor}</div>
    </div>`;
  }).join("");

  const csRows = DB.complaints.map(c => `
    <tr>
      <td class="mono t-strong">${c.no}</td>
      <td class="t-muted">${c.date}</td>
      <td>${c.cust}</td>
      <td>${c.content}</td>
      <td class="num mono"><span class="badge ${c.respMin <= 60 ? "b-ok" : "b-warn"}">${c.respMin}분</span></td>
      <td>${labelSelect("cs", "complaints", "no", c.no, "status")}</td>
    </tr>`).join("");

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">출하 양품률 (전수검사)</div><div class="kpi-val" style="color:var(--ok)">${yieldRate.toFixed(3)}<span class="unit">%</span></div></div>
    <div class="card kpi"><div class="kpi-label">당월 불량률</div><div class="kpi-val">${ppm}<span class="unit">PPM</span></div><div class="kpi-delta up">▲ 2026 목표 5 PPM</div></div>
    <div class="card kpi"><div class="kpi-label">공정감사 평균점수</div><div class="kpi-val">${auditAvg.toFixed(1)}<span class="unit">점</span></div></div>
    <div class="card kpi"><div class="kpi-label">고객불만 평균 대응</div><div class="kpi-val" style="color:var(--ok)">${respAvg}<span class="unit">분</span></div><div class="kpi-delta up">목표 60분 이내</div></div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>출하검사 현황 (전 제품 1:1 전수검사)</h3>
      <button class="btn" data-action="defect-add">⚠ 불량 등록</button></div>
    <table class="tbl">
      <thead><tr><th>검사일</th><th>LOT</th><th>고객사</th><th>품목</th>
        <th class="num">검사수량</th><th class="num">합격</th><th class="num">불합격</th><th class="num">합격률</th><th>판정</th></tr></thead>
      <tbody>${insRows}</tbody>
    </table>
  </div>

  <div class="grid g-2" style="margin-top:18px">
    <div>
      <div class="sec-title"><span class="ic">🔎</span>공정감사 (Line Audit Check Sheet)</div>
      <div class="grid g-2 fade">${auditCards}</div>
    </div>
    <div class="card fade" style="align-self:start">
      <div class="card-h"><h3>당월 불량 유형 분석</h3><span class="hint">총 ${num(DB.defectTypes.reduce((s,d)=>s+d.count,0))}건</span></div>
      <div class="card-b">${chartHBar(DB.defectTypes)}</div>
    </div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>고객불만 접수·대응 현황</h3><span class="badge b-ok">1시간 이내 대응 100%</span></div>
    <table class="tbl">
      <thead><tr><th>접수번호</th><th>접수일</th><th>고객사</th><th>내용</th><th class="num">대응시간</th><th>처리상태</th></tr></thead>
      <tbody>${csRows}</tbody>
    </table>
  </div>`;
}

/* ---------------- 설비현황 ---------------- */
function equipmentView() {
  const mfg = DB.equipment.filter(e => e.grp === "제조설비");
  const meas = DB.equipment.filter(e => e.grp === "계측기");
  const old = DB.equipment.filter(e => e.status === "노후");
  const yearOf = (s) => parseInt(s.slice(0, 4), 10);
  const avgAge = Math.round(DB.equipment.reduce((s, e) => s + (2026 - yearOf(e.year)), 0) / DB.equipment.length);

  const stBadge = (s) => {
    const m = { "정상": "b-ok", "점검필요": "b-warn", "노후": "b-danger" };
    return `<span class="badge ${m[s]}">${s}</span>`;
  };

  const mfgRows = mfg.map(e => `
    <tr>
      <td class="mono t-strong">${e.mgmt}</td>
      <td>${e.name}</td>
      <td class="mono t-muted">${e.spec}</td>
      <td>${e.maker}</td>
      <td class="t-muted">${e.year}</td>
      <td class="num mono">${2026 - yearOf(e.year)}년</td>
      <td>${stBadge(e.status)}</td>
    </tr>`).join("");

  const measRows = meas.map(e => `
    <tr>
      <td class="mono t-strong">${e.mgmt}</td>
      <td>${e.name}</td>
      <td class="mono t-muted">${e.spec}</td>
      <td class="t-muted">${e.year}</td>
      <td class="t-muted">${e.calib || "-"}</td>
      <td>${stBadge(e.status)}</td>
    </tr>`).join("");

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 설비</div><div class="kpi-val">${DB.equipment.length}<span class="unit">대</span></div></div>
    <div class="card kpi"><div class="kpi-label">제조설비 / 계측기</div><div class="kpi-val">${mfg.length}<span class="unit">/ ${meas.length}</span></div></div>
    <div class="card kpi"><div class="kpi-label">노후설비 (교체검토)</div><div class="kpi-val" style="color:var(--danger)">${old.length}<span class="unit">대</span></div></div>
    <div class="card kpi"><div class="kpi-label">평균 사용연수</div><div class="kpi-val">${avgAge}<span class="unit">년</span></div></div>
  </div>

  <div class="demo-banner" style="margin-top:18px;background:linear-gradient(90deg,#fff1f0,#fff8f7);border-color:#ffccc7;color:#a8261f">
    ⚠️ 전체 ${DB.equipment.length}대 중 <b>${old.length}대(${Math.round(old.length/DB.equipment.length*100)}%)</b>가 노후 설비(평균 ${avgAge}년)로 생산성·품질 향상을 위한 <b>설비 확충/교체 투자</b>가 필요합니다.
  </div>

  <div class="card fade" style="margin-top:4px">
    <div class="card-h"><h3>제조설비 목록</h3><span class="hint">${mfg.length}대</span></div>
    <table class="tbl">
      <thead><tr><th>관리번호</th><th>설비명</th><th>규격</th><th>제작업체</th><th>제작년도</th><th class="num">사용연수</th><th>상태</th></tr></thead>
      <tbody>${mfgRows}</tbody>
    </table>
  </div>

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>검사(계측기) 설비 목록</h3><span class="hint">교정주기 관리 · ${meas.length}대</span></div>
    <table class="tbl">
      <thead><tr><th>관리번호</th><th>설비명</th><th>규격</th><th>제작년도</th><th>차기 교정일</th><th>상태</th></tr></thead>
      <tbody>${measRows}</tbody>
    </table>
  </div>`;
}

/* ---------------- 품질관리 (+ 설비현황 하위탭) ---------------- */
Views.quality = () => subnav("quality", [["품질", "품질관리"], ["설비", "설비현황"]]) +
  (SUB.quality === "품질" ? qualityView() : equipmentView());

/* ---------------- 견적관리 ---------------- */
Views.quote = () => {
  const q = DB.quoteDetail;
  const sub = q.items.reduce((s, it) => s + it.price * it.qty, 0);
  const discAmt = Math.round(sub * q.discountRate / 100);
  const supply = sub - discAmt;
  const vat = q.vat ? Math.round(supply * 0.1) : 0;
  const total = supply + vat;

  const qStatus = (s) => {
    const m = { "발송": "b-info", "수주확정": "b-ok", "검토중": "b-warn" };
    return `<span class="badge ${m[s] || "b-gray"}">${s}</span>`;
  };
  const listRows = DB.quotes.map(x => `
    <tr>
      <td class="mono t-strong">${x.no}</td>
      <td class="t-muted">${x.date}</td>
      <td>${x.cust}</td>
      <td>${x.manager}</td>
      <td class="num mono t-strong">${won(x.amount)}</td>
      <td>${labelSelect("quote", "quotes", "no", x.no, "status")}</td>
    </tr>`).join("");

  const itemRows = q.items.map(it => `
    <tr>
      <td class="t-strong">${it.title}</td>
      <td class="t-muted">${it.desc}</td>
      <td class="num mono">${won(it.price)}</td>
      <td class="num mono">${num(it.qty)}</td>
      <td>${it.unit}</td>
      <td class="num mono t-strong">${won(it.price * it.qty)}</td>
    </tr>`).join("");

  const party = (p, label, color) => `
    <div class="party">
      <h4 style="color:${color}">${label}</h4>
      <div class="prow"><span class="k">상호</span><span class="v">${p.name}</span></div>
      <div class="prow"><span class="k">대표</span><span class="v">${p.ceo}</span></div>
      <div class="prow"><span class="k">사업자</span><span class="v">${p.biz}</span></div>
      <div class="prow"><span class="k">이메일</span><span class="v">${p.email}</span></div>
      <div class="prow"><span class="k">소재지</span><span class="v">${p.addr}</span></div>
    </div>`;

  const features = [
    "항목별 할인 입력", "PDF · 카카오 알림톡 발송", "총 합계 금액 숨기기(비교견적)",
    "수신↔공급자 위치 변경", "수주 자동 연결/전환", "수신자 정보 검색",
  ].map((f, i) => `<div class="f"><span class="n">${String(i + 1).padStart(2, "0")}</span><span>${f}</span></div>`).join("");

  return `
  <div class="toolbar" style="margin-bottom:14px">
    <span class="sec-title" style="margin:0"><span class="ic">🧾</span>견적 목록</span>
    <button class="btn primary" data-action="quote-add">＋ 견적서 작성</button>
  </div>
  <div class="card fade" style="margin-bottom:22px">
    <table class="tbl">
      <thead><tr><th>견적번호</th><th>견적일자</th><th>고객사</th><th>담당자</th><th class="num">견적금액(VAT포함)</th><th>상태</th></tr></thead>
      <tbody>${listRows}</tbody>
    </table>
  </div>

  <div class="quote fade">
    <div class="quote-top">
      <div class="quote-title">견적서</div>
      <div class="quote-meta">
        <div class="qm"><b>견적일자</b>${q.date}</div>
        <div class="qm"><b>견적번호</b>${q.no}</div>
        <div class="qm"><b>담당자</b>${q.manager}</div>
        <div class="qm"><b>유효기간</b>견적일로부터 ${q.validDays}일</div>
      </div>
    </div>

    <div class="party-wrap">
      ${party(q.supplier, "공급자", "var(--primary)")}
      ${party(q.client, "수신자", "#7b3fe4")}
    </div>

    <div class="quote-items">
      <div class="group-tag">${q.group}</div>
      <table class="tbl">
        <thead><tr><th>제목</th><th>작업 내용</th><th class="num">단가</th><th class="num">수량</th><th>단위</th><th class="num">공급가액</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="quote-summary">
      <div class="summary-box">
        <div class="srow"><span class="lab">총 합계</span><span class="val">${won(sub)}</span></div>
        <div class="srow discount"><span class="lab">할인 (${q.discountRate}%)</span><span class="val">- ${won(discAmt)}</span></div>
        <div class="srow"><span class="lab">공급가액</span><span class="val">${won(supply)}</span></div>
        <div class="srow"><span class="lab">VAT (10%) <span class="tgl"></span></span><span class="val">${won(vat)}</span></div>
        <div class="srow total"><span class="lab">최종 견적 (VAT 포함)</span><span class="val">${won(total)}</span></div>
      </div>
    </div>

    <div class="qnote">
      <b style="color:var(--ink)">안내사항</b><br>
      1) 본 견적서의 단가는 출하 전수검사 및 LOT 품질관리 비용이 포함된 금액입니다.<br>
      2) 원자재가 변동 시 단가는 사전 협의 후 조정될 수 있습니다. (협력사별 통계 기반 단가 관리)<br>
      3) 대금 지급은 선금 50% / 잔금 50%를 원칙으로 합니다.<br>
      4) 본 견적서는 견적일자로부터 ${q.validDays}일간 유효합니다.
    </div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>견적 시스템 주요 기능</h3><span class="badge b-info">개발 진행중</span></div>
    <div class="card-b"><div class="feature-grid">${features}</div></div>
  </div>`;
};

/* ---------------- 정산관리 (미수금 / 세금계산서) ---------------- */
const SUB = { settlement: "현황", sales: "수주", quality: "품질" };
function subnav(group, tabs) {
  return `<div class="subtabs">${tabs.map(([k, t]) => `<a data-group="${group}" data-subtab="${k}" class="${SUB[group] === k ? "active" : ""}">${t}</a>`).join("")}</div>`;
}

function arBuckets() {
  return {
    expected: DB.receivables.filter(r => r.status === "예정" || r.status === "미수"),
    overdue:  DB.receivables.filter(r => r.status === "연체"),
    done:     DB.receivables.filter(r => r.status === "완료"),
  };
}
function arCard(r) {
  const dd = dDay(r.due), settled = r.status === "완료";
  const issued = r.taxIssued != null ? r.taxIssued : settled;
  return `<div class="ar-card ${r.status === "연체" ? "od" : ""}">
    <div class="ar-top"><span class="ar-name">💰 ${r.cust}</span>${labelSelect("receivable", "receivables", "no", r.no, "status")}</div>
    <div class="ar-amt">${won(r.amount)}</div>
    <div class="ar-line">📄 ${r.item || r.so || "-"}</div>
    <div class="ar-line">🗓️ ${r.due} <span class="badge ${dd.cls}" style="margin-left:2px">${settled ? "완료" : dd.txt}</span></div>
    <div class="ar-line">
      <span class="tgl-sw ${issued ? "on" : ""}" data-action="tax-toggle" data-no="${r.no}"><span class="tk"></span>계산서 ${issued ? "발행" : "미발행"}</span>
      ${settled ? "" : `<button class="btn primary" style="padding:5px 11px;font-size:12px;margin-left:auto" data-action="ar-settle" data-no="${r.no}">정산 처리</button>`}
    </div>
  </div>`;
}
function kanbanCol(title, color, list) {
  const sum = list.reduce((s, r) => s + r.amount, 0);
  return `<div class="kan-col">
    <div class="kan-head" style="--kc:${color}">
      <div><div class="kan-title" style="color:${color}">${title}</div><div class="kan-sum">합계 ${won(sum)}</div></div>
      <span class="kan-cnt">${list.length}</span>
    </div>
    <div class="kan-body">${list.map(arCard).join("") || `<div class="t-muted" style="padding:14px;font-size:12px">항목 없음</div>`}</div>
  </div>`;
}
// 입금액 ↔ 미수금 자동 매칭 추천
function bankMatches() {
  return DB.bankTx.filter(t => t.type === "입금" && !t.matched).map(t => {
    const ar = DB.receivables.find(r => r.status !== "완료" && r.amount === t.amount && r.cust === t.partner);
    return ar ? { tx: t, ar } : null;
  }).filter(Boolean);
}

/* --- 정산현황 탭 --- */
function settleOverview() {
  const sales = DB.settle.sales, expense = DB.settle.expense, net = sales - expense, margin = net / sales * 100;
  const { expected, overdue, done } = arBuckets();
  const arTotal = [...expected, ...overdue].reduce((s, r) => s + r.amount, 0);
  const overdueAmt = overdue.reduce((s, r) => s + r.amount, 0);

  const open = DB.receivables.filter(r => r.status !== "완료");
  const todayDue = open.filter(r => dDay(r.due).txt === "D-day");
  const delayed = open.filter(r => (new Date(r.due) - new Date(DB.meta.baseDate)) < 0);
  const within7 = open.filter(r => { const d = Math.round((new Date(r.due) - new Date(DB.meta.baseDate)) / 86400000); return d > 0 && d <= 7; });
  const alertGroup = (icon, title, list, color) => !list.length ? "" : `
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;margin-bottom:6px">${icon} ${title}</div>
      ${list.map(r => `<div class="aitem"><span class="dot" style="background:${color}"></span>
        <div><div class="txt"><b>${r.cust}</b> · ${r.item || r.so} <b style="color:${color}">${won(r.amount)}</b></div>
        <div class="time">입금기한 ${r.due} (${dDay(r.due).txt})</div></div></div>`).join("")}
    </div>`;

  const feats = [
    { ic: "🤖", t: "자동 정산 추천", d: "등록된 정산 항목과 금액이 일치하는 입금이 들어오면 정산 항목을 자동 추천해 수동 작업을 줄입니다." },
    { ic: "🔔", t: "미수금 자동 알림", d: "입금 기한 초과 시 고객에게 자동 안내가 발송되어, 별도 연락 없이도 회수가 가능합니다." },
    { ic: "🔗", t: "견적·계약·세금계산서·입출금 연동", d: "정산 관련 문서·거래가 자동 연결되어 누락·중복 입력 오류를 최소화합니다." },
  ].map(f => `<div class="card" style="padding:18px 20px">
      <div style="font-size:22px">${f.ic}</div>
      <div style="font-weight:800;margin:8px 0 5px">${f.t}</div>
      <div class="t-muted" style="font-size:12.5px;line-height:1.6">${f.d}</div>
    </div>`).join("");

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">이번 달 순이익</div><div class="kpi-val">${won(net)}</div>
      <div class="kpi-delta up">이익률 ${margin.toFixed(1)}%</div></div>
    <div class="card kpi"><div class="kpi-label">이번 달 매출 (공급가)</div><div class="kpi-val" style="color:var(--primary)">${won(sales)}</div></div>
    <div class="card kpi"><div class="kpi-label">미수금 총액</div><div class="kpi-val" style="color:#b9760a">${won(arTotal)}</div></div>
    <div class="card kpi"><div class="kpi-label">정산 지연(연체)</div><div class="kpi-val" style="color:var(--danger)">${won(overdueAmt)}</div>
      <div class="kpi-delta down">${overdue.length}건 회수 필요</div></div>
  </div>

  <div class="sec-title" style="margin-top:22px"><span class="ic">📂</span>정산 상태별 현황 <span class="t-muted" style="font-size:12px;font-weight:600">· 상태를 바꾸면 칸반이 이동합니다</span></div>
  <div class="kanban fade">
    ${kanbanCol("정산 예정", "#3b6ef5", expected)}
    ${kanbanCol("정산 지연", "#e23b3b", overdue)}
    ${kanbanCol("정산 완료", "#7b3fe4", done)}
  </div>

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>🔔 미수금 자동 알림</h3><span class="badge b-danger">${delayed.length}</span></div>
    <div class="card-b">
      ${alertGroup("💰", "오늘 입금예정", todayDue, "#3b6ef5")}
      ${alertGroup("📨", "지연된 정산 (회수 필요)", delayed, "#e23b3b")}
      ${alertGroup("🗓️", "일주일 내 입금예정", within7, "#b9760a")}
      ${(!todayDue.length && !delayed.length && !within7.length) ? `<div class="t-muted">알림이 없습니다.</div>` : ""}
    </div>
  </div>

  <div class="sec-title" style="margin-top:24px"><span class="ic">💳</span>정산 시스템 핵심 가치</div>
  <div class="grid g-3 fade">${feats}</div>`;
}

/* --- 거래명세서 탭 --- */
function settleStatement() {
  return `
  ${STMT_DOC ? `<div class="demo-banner" style="margin-bottom:14px">🔗 방금 발행한 <b>세금계산서 내용과 연동</b>된 거래명세서입니다. 아래 기준 거래를 변경하면 수주 기준으로 전환됩니다.</div>` : ""}
  <div class="stmt-toolbar">
    <div class="left">
      <span class="t-muted" style="font-size:13px;font-weight:600">기준 거래(수주)</span>
      <select id="stmtSel">${DB.orders.map(o => `<option value="${o.no}" ${o.no === (STMT_SOURCE || DB.orders[0].no) ? "selected" : ""}>${o.no} · ${o.cust} · ${o.itemName}</option>`).join("")}</select>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <span class="t-muted" style="font-size:12px">셀을 클릭해 직접 수정 가능</span>
      <button class="btn primary" data-action="stmt-pdf">📄 PDF 다운로드</button>
    </div>
  </div>
  ${renderStatement()}`;
}

/* --- 세금계산서 탭 --- */
function settleTaxView() {
  const sell = DB.taxInvoices.filter(t => t.type === "매출");
  const buy = DB.taxInvoices.filter(t => t.type === "매입");
  const sumS = sell.reduce((s, t) => s + t.supply, 0), sumSv = sell.reduce((s, t) => s + t.vat, 0);
  const sumB = buy.reduce((s, t) => s + t.supply, 0), sumBv = buy.reduce((s, t) => s + t.vat, 0);
  const taxRows = DB.taxInvoices.map(t => `
    <tr>
      <td class="t-muted">${t.date}</td>
      <td>${t.type === "매출" ? `<span class="badge b-info">매출</span>` : `<span class="badge b-purple">매입</span>`}</td>
      <td>${t.partner}</td>
      <td class="num mono">${won(t.supply)}</td>
      <td class="num mono t-muted">${won(t.vat)}</td>
      <td class="num mono t-strong">${won(t.supply + t.vat)}</td>
      <td><span class="badge b-ok">${t.status}</span></td>
    </tr>`).join("");
  return `
  <div class="card fade">
    <div class="card-h"><h3>세금계산서 연동</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge b-info">홈택스 연동 예정</span>
        <button class="btn primary" data-action="tax-issue">＋ 세금계산서 발행</button>
      </div></div>
    <div class="card-b">
      <div class="demo-banner" style="margin-bottom:16px">
        📎 홈택스 매입·매출 세금계산서 파일을 첨부하면, 거래처·일자·공급가·부가세를 자동 분류하여 이 목록과 부가세 신고 자료로 정리합니다.
      </div>
      <div class="statline" style="margin-bottom:16px">
        <div class="s"><div class="lbl">매출 합계 (공급가)</div><div class="val" style="color:var(--primary)">${won(sumS)}</div></div>
        <div class="s"><div class="lbl">매입 합계 (공급가)</div><div class="val" style="color:#7b3fe4">${won(sumB)}</div></div>
        <div class="s"><div class="lbl">납부예상 부가세</div><div class="val" style="color:var(--danger)">${won(sumSv - sumBv)}</div></div>
      </div>
    </div>
    <table class="tbl">
      <thead><tr><th>작성일</th><th>구분</th><th>거래처</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">합계</th><th>상태</th></tr></thead>
      <tbody>${taxRows}</tbody>
    </table>
  </div>`;
}

/* --- 입출금내역 탭 --- */
function settleBank() {
  const inSum = DB.bankTx.filter(t => t.type === "입금").reduce((s, t) => s + t.amount, 0);
  const outSum = DB.bankTx.filter(t => t.type === "출금").reduce((s, t) => s + t.amount, 0);
  const matches = bankMatches();
  const txRows = DB.bankTx.map(t => `
    <tr>
      <td class="t-muted">${t.dt}</td>
      <td>🏦 ${t.bank}</td>
      <td class="mono t-muted">${t.acct}</td>
      <td>${t.partner}</td>
      <td class="num mono t-strong" style="color:${t.type === "입금" ? "var(--primary)" : "var(--danger)"}">${t.type === "입금" ? "+" : "−"}${won(t.amount)}</td>
      <td>${t.type === "입금" ? `<span class="badge b-info">입금</span>` : `<span class="badge b-danger">출금</span>`}</td>
      <td>${t.matched ? `<span class="badge b-ok">정산매칭</span>` : `<span class="badge b-gray">미매칭</span>`}</td>
    </tr>`).join("");
  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">계좌 총잔액</div><div class="kpi-val" style="font-size:23px">${won(DB.settle.bankBalance)}</div></div>
    <div class="card kpi"><div class="kpi-label">입금 합계</div><div class="kpi-val" style="color:var(--primary);font-size:23px">${won(inSum)}</div></div>
    <div class="card kpi"><div class="kpi-label">출금 합계</div><div class="kpi-val" style="color:var(--danger);font-size:23px">${won(outSum)}</div></div>
    <div class="card kpi"><div class="kpi-label">자동 정산추천</div><div class="kpi-val" style="color:#0a8f6e">${matches.length}<span class="unit">건</span></div></div>
  </div>

  ${matches.length ? `
  <div class="card fade" style="margin-top:16px;border-color:#bfe7d4;background:#f5fcf9">
    <div class="card-h" style="border-color:#cfeede"><h3>🤖 자동 정산 추천</h3><span class="hint">입금액과 일치하는 미수금을 찾았습니다</span></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:10px">
      ${matches.map(m => `<div class="match-card">
        <div><b>${m.tx.partner}</b> 입금 <b style="color:var(--primary)">${won(m.tx.amount)}</b> <span class="t-muted">(${m.tx.dt})</span>
          <div class="t-muted" style="font-size:12px;margin-top:3px">↔ 미수금 <b>${m.ar.no}</b> · ${m.ar.item || m.ar.so} · 금액 일치</div></div>
        <button class="btn primary" data-action="match-confirm" data-tx="${m.tx.id}" data-ar="${m.ar.no}">정산 처리</button>
      </div>`).join("")}
    </div>
  </div>` : ""}

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>입출금 내역</h3><input class="search" placeholder="은행 · 계좌 · 거래처 검색" style="width:240px"></div>
    <table class="tbl">
      <thead><tr><th>거래일시</th><th>은행</th><th>계좌번호</th><th>거래처</th><th class="num">금액</th><th>구분</th><th>정산</th></tr></thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>

  <div class="demo-banner" style="margin-top:16px">
    🔗 실제 계좌 연동은 <b>오픈뱅킹 / 계좌 스크래핑 API(코드에프 등) 또는 펌뱅킹</b> 연계가 필요합니다. 데모에서는 샘플 거래내역으로 자동매칭을 시연합니다.
  </div>`;
}

Views.settlement = () => {
  const body = SUB.settlement === "현황" ? settleOverview()
    : SUB.settlement === "세금계산서" ? settleTaxView()
    : SUB.settlement === "명세서" ? settleStatement()
    : settleBank();
  return subnav("settlement", [["현황", "정산 현황"], ["세금계산서", "세금계산서 발행"], ["명세서", "거래명세서"], ["입출금", "입출금내역"]]) + body;
};

/* =====================================================================
 * 네비게이션 & 라우팅
 * ===================================================================== */
const NAV = [
  { group: "현황" },
  { id: "dashboard",  name: "대시보드",     ic: "📊", title: "경영 대시보드",  sub: "스마트팩토리 통합 현황" },
  { group: "영업/생산" },
  { id: "quote",      name: "견적관리",     ic: "🧾", title: "견적관리",       sub: "견적서 작성 · 발송 · 수주 연결" },
  { id: "sales",      name: "수주/거래처",  ic: "📋", title: "수주 / 거래처",  sub: "수주 관리 · 거래처(사업자정보) 등록" },
  { id: "production", name: "생산관리",     ic: "🏭", title: "생산관리",       sub: "작업지시 · 라인 가동 현황" },
  { id: "inventory",  name: "재고관리",     ic: "📦", title: "재고관리",       sub: "자재 · 완제품 재고 / 재발주" },
  { id: "quality",    name: "품질관리",     ic: "✅", title: "품질관리",       sub: "출하검사 · 공정감사 · 고객불만 · 설비현황" },
  { group: "기준정보" },
  { id: "bom",        name: "품목 / BOM",   ic: "🧬", title: "품목 / BOM",     sub: "품목 마스터 및 자재명세서" },
  { group: "정산" },
  { id: "settlement", name: "정산관리",     ic: "💳", title: "정산관리",       sub: "미수금 · 거래명세서 · 세금계산서 · 입출금" },
];

const $$all = (s) => Array.from(document.querySelectorAll(s));

function buildNav() {
  $("#nav").innerHTML = NAV.filter(n => !n.group).map(n =>
    `<a data-route="${n.id}"><span class="ic">${n.ic}</span>${n.name}</a>`).join("");
  $("#nav").addEventListener("click", e => {
    const a = e.target.closest("a[data-route]");
    if (a) go(a.dataset.route);
  });
}

function go(route, keep) {
  CURRENT = route;
  const meta = NAV.find(n => n.id === route) || NAV.find(n => n.id === "dashboard");
  $$all(".tabs a[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === route));
  const head = `<div class="page-head fade"><h1>${meta.title}</h1><p>${meta.sub}</p></div>`;
  $("#content").innerHTML = head + (Views[route] || Views.dashboard)();
  if (!keep) window.scrollTo(0, 0);
}

/* 초기화 */
function init() {
  $("#brandName").innerHTML = `${DB.meta.company}<span> ${DB.meta.companyEn}</span>`;
  $("#brandSub").textContent = "스마트팩토리 ERP";
  $("#dateChip").textContent = "기준일 " + DB.meta.baseDate;
  $("#userName").textContent = DB.meta.ceo + " 대표";
  $("#userRole").textContent = DB.meta.company;
  $("#avatar").textContent = DB.meta.ceo.charAt(0);
  buildNav();
  bindEvents();
  go("dashboard");
}
document.addEventListener("DOMContentLoaded", init);
