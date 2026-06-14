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
let EDIT_MODE = false;           // 수정 모드 (꺼져 있으면 보기 전용)
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
// 입력 도중 단계별 자동 하이픈 (000-00-00000)
function fmtBizLive(v) {
  const d = digits(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return d.slice(0, 3) + "-" + d.slice(3);
  return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
}
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
  equip:      ["정상", "점검필요", "노후"],
  verdict:    ["합격", "불합격", "재검사"],
  grade:      ["A", "B", "C", "신규"],
};
const LABEL_COLOR = {
  "대기": "c-gray", "절단": "c-purple", "압착": "c-warn", "조립": "c-info", "검사": "c-purple", "완료": "c-ok",
  "진행": "c-info", "지연": "c-danger", "보류": "c-gray",
  "검토중": "c-warn", "발송": "c-info", "수주확정": "c-ok", "반려": "c-danger",
  "접수": "c-info", "대응중": "c-warn",
  "예정": "c-info", "미수": "c-warn", "연체": "c-danger",
  "정상": "c-ok", "점검필요": "c-warn", "노후": "c-danger",
  "합격": "c-ok", "불합격": "c-danger", "재검사": "c-warn",
  "A": "c-ok", "B": "c-info", "C": "c-gray", "신규": "c-gray",
};

// 라벨 드롭다운 (클릭하여 변경)
function labelSelect(setKey, coll, keyField, keyVal, field) {
  const rec = DB[coll].find(r => String(r[keyField]) === String(keyVal));
  const cur = (rec && rec[field] != null) ? rec[field] : LABEL_SETS[setKey][0];
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

/* ---------- 인라인 편집 공용 헬퍼 ---------- */
// 텍스트 직접입력 (표 셀 인라인)
function textInput(coll, keyField, keyVal, field, val, opts = {}) {
  const v = val == null ? "" : String(val).replace(/"/g, "&quot;");
  return `<input type="text" class="celledit txtin${opts.cls ? " " + opts.cls : ""}" value="${v}"
    data-coll="${coll}" data-keyfield="${keyField}" data-key="${keyVal}" data-field="${field}"
    style="width:${opts.w || 120}px${opts.right ? ";text-align:right" : ""}"${opts.ph ? ` placeholder="${opts.ph}"` : ""}>`;
}
// 옵션 선택 (단일 텍스트 필드)
function optSelect(coll, keyField, keyVal, field, val, options) {
  const list = options.includes(val) ? options : [val, ...options];
  return `<select class="celledit optsel" data-coll="${coll}" data-keyfield="${keyField}" data-key="${keyVal}" data-field="${field}">
    ${list.map(o => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
}
// 등록된 품목에서 선택 → 작업지시(item 코드 + itemName 동기화)
function woItemSelect(woVal) {
  const rec = DB.workorders.find(r => String(r.wo) === String(woVal));
  const cur = rec ? rec.item : "";
  return `<select class="celledit wo-itemsel" data-key="${woVal}">
    ${DB.items.map(i => `<option value="${i.code}" ${i.code === cur ? "selected" : ""}>${i.name}</option>`).join("")}</select>`;
}
// 등록된 품목에서 선택 → 재고(stock.code 변경)
function stockItemSelect(codeVal) {
  return `<select class="celledit stock-itemsel" data-key="${codeVal}">
    ${DB.items.map(i => `<option value="${i.code}" ${i.code === codeVal ? "selected" : ""}>${i.name} · ${i.code}</option>`).join("")}</select>`;
}
// 행 삭제 버튼
function delBtn(coll, keyField, keyVal) {
  return `<button class="rowdel" title="이 행 삭제" data-action="row-del" data-coll="${coll}" data-keyfield="${keyField}" data-key="${keyVal}">✕</button>`;
}

/* ---------- 활동 로그 / 되돌리기 ---------- */
let ACTLOG = [];
function nowTime() { const d = new Date(); return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`; }
function logAct(text, undo) { ACTLOG.unshift({ time: nowTime(), text, undo }); if (ACTLOG.length > 50) ACTLOG.pop(); }
function undoAct(i) { const a = ACTLOG[i]; if (a && a.undo) { a.undo(); ACTLOG.splice(i, 1); rerender(); } }

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
  const selName = LASTNEW_CUST || (custList()[0] || {}).v;
  const selBiz = (DB.partners.find(p => p.name === selName) || {}).biz || "";
  openModal("신규 수주 등록", `
    ${fld("거래처", `<div style="display:flex;gap:8px">
       <select id="m_cust" style="flex:1">${custOpts}</select>
       <button class="btn" data-action="partner-add-o" style="white-space:nowrap">＋ 거래처 등록</button></div>`)}
    ${fld("거래처 사업자등록번호", `<input id="m_biz" class="fmt-biz" value="${selBiz}" placeholder="000-00-00000">`)}
    ${fld("품목", `<select id="m_item">${opts(fgList())}</select>`)}
    ${fld("수주수량", `<input type="number" id="m_qty" value="10000" min="1">`)}
    ${fld("납기일", `<input type="date" id="m_due" value="2026-06-30">`)}
    <p class="modal-note">거래처를 선택하면 등록된 사업자등록번호가 자동으로 채워지며, 직접 수정할 수 있습니다.</p>
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="order-save">등록</button></div>`);
}
function saveOrder() {
  const item = mv("#m_item"), it = itemOf(item), cust = mv("#m_cust"), biz = mv("#m_biz");
  // 입력한 사업자번호를 해당 거래처에도 반영(거래처에 번호가 비어있으면 채움)
  const p = DB.partners.find(x => x.name === cust);
  if (p && biz && (!p.biz || p.biz === "-")) p.biz = biz;
  DB.orders.unshift({ no: `SO-2606-${pad(++ORDSEQ, 3)}`, date: DB.meta.baseDate, cust, biz: biz || "-",
    item, itemName: it.name, qty: +mv("#m_qty") || 0, done: 0, due: mv("#m_due"), status: "진행" });
  LASTNEW_CUST = null;
  closeModal(); SUB.sales = "수주"; go("sales");
}
function openWOModal() {
  const orderOpts = DB.orders.map(o => ({ v: o.no, t: `${o.no} · ${o.cust} · ${o.itemName}` }));
  const itemOpts = DB.items.filter(i => i.cat === "완제품").map(i => ({ v: i.code, t: i.name }));
  const procOpts = LABEL_SETS.process.map(s => `<option ${s === "대기" ? "selected" : ""}>${s}</option>`).join("");
  openModal("작업지시 발행", `
    <p class="modal-note" style="margin-bottom:14px">생산 현장에 내릴 작업지시를 발행합니다. 연결 수주를 선택하면 품목이 자동 지정되며, 모든 항목은 발행 후 표에서도 수정할 수 있습니다.</p>
    ${fld("작업지시번호", `<input id="m_wono" value="WO-2606-${pad(WOSEQ + 1, 3)}">`)}
    ${fld("연결 수주", `<select id="m_so">${opts(orderOpts)}</select>`)}
    ${fld("품목 (완제품)", `<select id="m_woitem">${opts(itemOpts)}</select>`)}
    ${fld("생산라인", `<select id="m_line">${opts(LINES)}</select>`)}
    <div style="display:flex;gap:10px">
      <div style="flex:1">${fld("계획수량 (EA)", `<input type="number" id="m_plan" value="10000" min="1">`)}</div>
      <div style="flex:1">${fld("기생산수량 (EA)", `<input type="number" id="m_prod" value="0" min="0">`)}</div>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1">${fld("착수예정일", `<input type="date" id="m_start" value="${DB.meta.baseDate}">`)}</div>
      <div style="flex:1">${fld("초기 공정상태", `<select id="m_wostatus">${procOpts}</select>`)}</div>
    </div>
    ${fld("작업자 / 배정조", `<input id="m_worker" value="미배정" placeholder="예: 현장 A조 / 외주 1조">`)}
    ${fld("비고", `<input id="m_wonote" placeholder="특이사항 (선택)">`)}
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="wo-save">발행</button></div>`);
}
function saveWO() {
  const so = mv("#m_so"), ord = DB.orders.find(o => o.no === so) || {};
  const itemCode = mv("#m_woitem") || ord.item || "";
  const it = itemOf(itemCode) || {};
  WOSEQ++;
  DB.workorders.unshift({ wo: mv("#m_wono").trim() || `WO-2606-${pad(WOSEQ, 3)}`, so,
    item: itemCode, itemName: it.name || ord.itemName || "",
    plan: +mv("#m_plan") || 0, prod: +mv("#m_prod") || 0, defect: 0, line: mv("#m_line"),
    status: mv("#m_wostatus") || "대기", start: mv("#m_start") || DB.meta.baseDate,
    worker: mv("#m_worker") || "미배정", note: mv("#m_wonote") || "" });
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
  const procOpts = ["절단", "압착", "조립", "검사", "기타"].map(s => `<option>${s}</option>`).join("");
  openModal("불량(오류) 등록", `
    <p class="modal-note" style="margin-bottom:14px">현장에서 발생한 불량을 등록합니다. 등록 시 해당 작업지시의 공정불량 수와 당월 불량유형 집계, 양품률(수율)에 즉시 반영됩니다.</p>
    <div style="display:flex;gap:10px">
      <div style="flex:1">${fld("발생일자", `<input type="date" id="m_ddate" value="${DB.meta.baseDate}">`)}</div>
      <div style="flex:1">${fld("발생 공정", `<select id="m_dproc">${procOpts}</select>`)}</div>
    </div>
    ${fld("작업지시", `<select id="m_wo">${opts(woOpts)}</select>`)}
    <div style="display:flex;gap:10px">
      <div style="flex:2">${fld("불량 유형", `<select id="m_dt">${opts(typeOpts)}</select>`)}</div>
      <div style="flex:1">${fld("불량 수량 (EA)", `<input type="number" id="m_dq" value="1" min="1">`)}</div>
    </div>
    ${fld("불량 원인 / 조치내용", `<input id="m_dnote" placeholder="원인 및 조치내용 (선택)">`)}
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
function poRow(code, qty) {
  const itemOptions = DB.items.map(i => `<option value="${i.code}" ${i.code === code ? "selected" : ""}>${i.name} · ${i.code}</option>`).join("");
  return `<tr>
    <td><select class="celledit po-item" style="width:100%">${itemOptions}</select></td>
    <td class="num"><input type="number" class="numin po-qty" value="${qty}" min="0" style="width:110px"></td>
    <td><button class="rowdel" data-action="po-row-del">✕</button></td></tr>`;
}
function openPOModal() {
  const low = DB.stock.filter(st => st.qty < itemOf(st.code).safety);
  const rows = (low.length
    ? low.map(st => { const it = itemOf(st.code); const sug = Math.max(it.safety * 2 - st.qty, it.safety); return poRow(st.code, Math.round(sug)); })
    : [poRow(DB.items[0].code, 1000)]).join("");
  openModal("발주서 작성 (입고 처리)", `
    <p class="modal-note" style="margin-bottom:14px">발주할 품목을 직접 <b>선택</b>하고 수량을 입력하세요. 행 추가/삭제가 가능하며, 안전재고 미달 품목은 권장수량으로 미리 채워둡니다. <b>발주 확정 시 선택 품목의 재고로 입고</b>됩니다.</p>
    <table class="tbl"><thead><tr><th>품목 (선택)</th><th class="num">발주수량</th><th></th></tr></thead>
    <tbody id="poBody">${rows}</tbody></table>
    <button class="btn-addrow" data-action="po-add-row" style="margin-top:12px">＋ 품목 추가</button>
    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" data-action="po-confirm">발주 확정 (입고처리)</button></div>`, true);
}
function confirmPO() {
  document.querySelectorAll("#poBody tr").forEach(tr => {
    const sel = tr.querySelector(".po-item"), qi = tr.querySelector(".po-qty");
    if (!sel || !qi) return;
    const code = sel.value, q = parseInt(qi.value, 10) || 0;
    if (!q) return;
    const st = DB.stock.find(s => s.code === code);
    if (st) st.qty += q;
    else DB.stock.push({ code, qty: q, loc: "신규입고" });
  });
  closeModal(); go("inventory");
}
function settleAR(no) {
  const ar = DB.receivables.find(r => r.no === no);
  if (ar) { const prev = ar.status; ar.status = "완료"; logAct(`정산 처리 · ${ar.cust} ${won(ar.amount)} (${prev}→완료)`, () => { ar.status = prev; }); }
  rerender();
}
function unsettleAR(no) {
  const ar = DB.receivables.find(r => r.no === no);
  if (ar) { const prev = ar.status; ar.status = "미수"; logAct(`정산 취소 · ${ar.cust} ${won(ar.amount)} (${prev}→미수)`, () => { ar.status = prev; }); }
  rerender();
}
const fldRow = (label, inner) => `<div class="fldrow"><label>${label}</label><div>${inner}</div></div>`;
function openTaxModal() {
  const m = DB.meta, custs = custList();
  const sel = LASTNEW_CUST || (custs[0] || {}).v || "";
  const p0 = DB.partners.find(x => x.name === sel) || {}, ci0 = CLIENT_INFO[sel] || {};
  const custOpts = custs.map(c => `<option ${c.v === sel ? "selected" : ""}>${c.t}</option>`).join("");
  const biz0 = (p0.biz && p0.biz !== "-") ? p0.biz : (ci0.biz || "");
  openModal("세금계산서 발행", `
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">발행 전에 실제 전송될 정보를 확인하세요. 필수 항목이 누락되면 발행할 수 없습니다.</p>
    <div id="taxWarn"></div>

    <div class="form-sec"><h4>기본 정보</h4>
      ${fldRow("발행일", `<input type="date" id="t_date" value="${m.baseDate}">`)}
      ${fldRow("발행 구분", `<select id="t_kind"><option>청구</option><option>영수</option></select>`)}
      ${fldRow("설명", `<textarea id="t_memo" rows="2" placeholder="예: 2026년 6월 납품분 세금계산서"></textarea>`)}
    </div>

    <div class="form-sec"><h4>품목</h4>
      ${fldRow("품목명", `<input id="t_item" placeholder="품목명">`)}
      ${fldRow("일자", `<input type="date" id="t_idate" value="${m.baseDate}">`)}
      ${fldRow("수량", `<input type="number" id="t_qty" value="1" min="1">`)}
      ${fldRow("단가 (원)", `<input id="t_price" class="fmt-money" value="10,000,000">`)}
    </div>

    <div class="form-sec"><h4>공급자</h4>
      ${fldRow("사업자번호", `<input id="s_biz" value="${m.biznum}">`)}
      ${fldRow("상호", `<input id="s_name" value="${m.company} (${m.companyEn})">`)}
      ${fldRow("대표자명", `<input id="s_ceo" value="${m.ceo}">`)}
      ${fldRow("주소", `<input id="s_addr" value="${m.addr}">`)}
      ${fldRow("담당자명", `<input id="s_mgr" value="${m.ceo}">`)}
      ${fldRow("이메일", `<input id="s_email" value="sales@hiqtech.co.kr">`)}
      ${fldRow("연락처", `<input id="s_tel" value="031-000-0000">`)}
    </div>

    <div class="form-sec"><h4>공급받는자</h4>
      ${fldRow("거래처 선택", `<div style="display:flex;gap:8px">
         <select id="t_name" style="flex:1" onchange="syncTaxClient()">${custOpts}</select>
         <button class="btn" data-action="partner-add-t" style="white-space:nowrap">＋ 등록</button></div>`)}
      ${fldRow("사업자번호", `<input id="t_biz" class="fmt-biz" value="${biz0}" oninput="refreshTaxWarn()" placeholder="필수 입력">`)}
      ${fldRow("상호", `<input id="c_name" value="${sel}">`)}
      ${fldRow("대표자명", `<input id="c_ceo" value="${(p0.ceo && p0.ceo !== "-") ? p0.ceo : ""}">`)}
      ${fldRow("주소", `<input id="c_addr" value="${p0.addr || ci0.addr || ""}">`)}
      ${fldRow("담당자명", `<input id="c_mgr" value="${p0.contact || ""}">`)}
      ${fldRow("이메일", `<input id="c_email" oninput="refreshTaxWarn()" placeholder="필수 입력 (예: purchase@company.co.kr)">`)}
      ${fldRow("연락처", `<input id="c_tel" value="${p0.tel || ""}">`)}
    </div>

    <div class="modal-f"><button class="btn ghost" data-action="modal-close">취소</button>
      <button class="btn primary" id="taxIssueBtn" data-action="tax-save">발행 + 거래명세서 생성</button></div>`, true);
  refreshTaxWarn();
}
function refreshTaxWarn() {
  const box = document.getElementById("taxWarn"); if (!box) return;
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  const miss = [];
  if (!val("t_biz")) miss.push("공급받는자 사업자번호");
  if (!val("c_email")) miss.push("공급받는자 담당자 이메일");
  const btn = document.getElementById("taxIssueBtn");
  if (miss.length) {
    box.innerHTML = `<div class="tax-warn"><div class="t">발행 전에 확인이 필요한 항목이 있습니다.</div><ul>${miss.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
    if (btn) { btn.disabled = true; btn.style.opacity = ".5"; btn.style.cursor = "not-allowed"; }
  } else {
    box.innerHTML = "";
    if (btn) { btn.disabled = false; btn.style.opacity = ""; btn.style.cursor = ""; }
  }
}
function syncTaxClient() {
  const name = (document.getElementById("t_name") || {}).value || "";
  const p = DB.partners.find(x => x.name === name) || {}, ci = CLIENT_INFO[name] || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set("c_name", name);
  set("t_biz", (p.biz && p.biz !== "-") ? p.biz : (ci.biz || ""));
  set("c_ceo", (p.ceo && p.ceo !== "-") ? p.ceo : "");
  set("c_addr", p.addr || ci.addr || "");
  set("c_mgr", p.contact || "");
  set("c_tel", p.tel || "");
  refreshTaxWarn();
}
function saveTax() {
  const biz = mv("#t_biz"), email = mv("#c_email");
  if (!biz.trim() || !email.trim()) { refreshTaxWarn(); return; }
  const cust = mv("#c_name") || mv("#t_name");
  const qty = +mv("#t_qty") || 0, price = unfmt(mv("#t_price"));
  const supply = qty * price, vat = Math.round(supply * 0.1), date = fmtDate(mv("#t_date"));
  DB.taxInvoices.unshift({ date, type: "매출", partner: cust, supply, vat, status: "발행" });
  STMT_DOC = { date, cust, biz, contact: mv("#c_mgr") || "-", tel: mv("#c_tel") || "-",
    fax: (CLIENT_INFO[cust] || {}).fax || "-", addr: mv("#c_addr") || "-", item: mv("#t_item") || "-",
    qty, price, unit: "EA", supply, vat, email };
  logAct(`세금계산서 발행 · ${cust} ${won(supply + vat)}`, () => { DB.taxInvoices.shift(); });
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
    ${fld("사업자등록번호", `<input id="p_biz" class="fmt-biz" placeholder="000-00-00000">`)}
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

/* ---------- 행 추가 (각 표) ---------- */
function addStockRow() {
  const used = DB.stock.map(s => s.code);
  const it = DB.items.find(i => !used.includes(i.code)) || DB.items[0];
  DB.stock.push({ code: it.code, qty: 0, loc: "신규" });
  logAct(`재고품목 추가 · ${it.name}`, () => DB.stock.pop());
  rerender();
}
function addItemRow() {
  let n = DB.items.length + 1, code;
  do { code = "NEW-" + pad(n++, 3); } while (DB.items.some(i => i.code === code));
  DB.items.push({ code, name: "신규 품목", cat: "완제품", unit: "EA", price: 0, safety: 0 });
  logAct(`품목 추가 · ${code}`, () => { const i = DB.items.findIndex(x => x.code === code); if (i >= 0) DB.items.splice(i, 1); });
  rerender();
}
function addComplaint() {
  let n = DB.complaints.length + 1, no;
  do { no = "CS-2606-" + pad(n++, 2); } while (DB.complaints.some(c => c.no === no));
  DB.complaints.unshift({ no, date: DB.meta.baseDate, cust: (custList()[0] || {}).v || "", channel: "전화", content: "", respMin: 0, status: "접수" });
  logAct(`고객불만 접수 추가 · ${no}`, () => { const i = DB.complaints.findIndex(x => x.no === no); if (i >= 0) DB.complaints.splice(i, 1); });
  rerender();
}
function addQuoteListRow() {
  const no = `Q-2026-${pad(++QSEQ, 4)}`;
  DB.quotes.unshift({ no, date: DB.meta.baseDate, cust: (custList()[0] || {}).v || "", manager: DB.meta.ceo, amount: 0, status: "검토중" });
  rerender();
}
function addQuoteItem() {
  DB.quoteDetail.items.push({ title: "신규 항목", desc: "", price: 0, qty: 1, unit: "EA" });
  rerender();
}
function addAuditRow() {
  DB.lineAudit.push({ line: LINES[0].v, date: DB.meta.baseDate, score: 95, auditor: "품질팀" });
  rerender();
}
function addGlRow() {
  let n = DB.glLedger.length + 1, id;
  do { id = "GL" + pad(n++, 2); } while (DB.glLedger.some(g => g.id === id));
  DB.glLedger.unshift({ id, date: DB.meta.baseDate, account: "", desc: "", debit: 0, credit: 0 });
  logAct(`총계정원장 행 추가 · ${id}`, () => { const i = DB.glLedger.findIndex(g => g.id === id); if (i >= 0) DB.glLedger.splice(i, 1); });
  rerender();
}
function addInspectRow() {
  let n = DB.shipInspect.length + 1, lot;
  do { lot = "L-N" + pad(n++, 3); } while (DB.shipInspect.some(r => r.lot === lot));
  DB.shipInspect.unshift({ date: DB.meta.baseDate, cust: (custList()[0] || {}).v || "", item: "", lot, qty: 0, fail: 0 });
  rerender();
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
    "po-add-row": () => { const b = document.getElementById("poBody"); if (b) b.insertAdjacentHTML("beforeend", poRow(DB.items[0].code, 1000)); },
    "stock-add": addStockRow, "item-add": addItemRow, "complaint-add": addComplaint,
    "quote-list-add": addQuoteListRow, "quote-item-add": addQuoteItem,
    "audit-add": addAuditRow, "inspect-add": addInspectRow, "gl-add": addGlRow,
  };
  document.addEventListener("click", e => {
    if (e.target.id === "modalWrap") { closeModal(); return; }
    const st = e.target.closest("[data-subtab]");
    if (st) { SUB[st.dataset.group] = st.dataset.subtab; rerender(); return; }
    const ty = e.target.closest("[data-taxyear]");
    if (ty) { TAX_YEAR = ty.dataset.taxyear; rerender(); return; }
    const b = e.target.closest("[data-action]"); if (!b) return;
    if (b.dataset.action === "ar-settle") { settleAR(b.dataset.no); return; }
    if (b.dataset.action === "ar-unsettle") { unsettleAR(b.dataset.no); return; }
    if (b.dataset.action === "tax-toggle") {
      const r = DB.receivables.find(x => x.no === b.dataset.no);
      if (r) r.taxIssued = !(r.taxIssued != null ? r.taxIssued : r.status === "완료");
      rerender(); return;
    }
    if (b.dataset.action === "match-confirm") { confirmMatch(b.dataset.tx, b.dataset.ar); return; }
    if (b.dataset.action === "row-del") {
      const arr = DB[b.dataset.coll];
      const i = arr.findIndex(r => String(r[b.dataset.keyfield]) === String(b.dataset.key));
      if (i >= 0) { const rec = arr[i]; arr.splice(i, 1); logAct(`행 삭제 · ${b.dataset.coll}`, () => arr.splice(i, 0, rec)); }
      rerender(); return;
    }
    if (b.dataset.action === "act-undo") { undoAct(+b.dataset.i); return; }
    if (b.dataset.action === "edit-mode-toggle") { EDIT_MODE = !EDIT_MODE; rerender(); return; }
    if (b.dataset.action === "partner-row-add") {
      const type = b.dataset.type, prefix = type === "고객사" ? "C" : "V";
      let n = DB.partners.filter(p => p.code.startsWith(prefix)).length + 1, code;
      do { code = prefix + pad(n++, 3); } while (DB.partners.some(p => p.code === code));
      DB.partners.push({ code, name: "신규 거래처", type, contact: "", tel: "", grade: "신규", credit: 0, balance: 0, biz: "", ceo: "", email: "" });
      logAct(`거래처 추가 · ${code}`, () => { const i = DB.partners.findIndex(p => p.code === code); if (i >= 0) DB.partners.splice(i, 1); });
      rerender(); return;
    }
    if (b.dataset.action === "qitem-del") { DB.quoteDetail.items.splice(+b.dataset.i, 1); rerender(); return; }
    if (b.dataset.action === "vat-toggle") { DB.quoteDetail.vat = !DB.quoteDetail.vat; rerender(); return; }
    if (b.dataset.action === "po-row-del") { b.closest("tr").remove(); return; }
    (ACTIONS[b.dataset.action] || (() => {}))();
  });
  document.addEventListener("change", e => {
    const f = e.target;
    if (f.classList && f.classList.contains("fmt-date")) f.value = fmtDate(f.value);
    else if (f.classList && (f.classList.contains("fmt-phone") || f.classList.contains("fmt-fax"))) f.value = fmtPhone(f.value);
    else if (f.classList && f.classList.contains("fmt-biz")) f.value = fmtBiz(f.value);
    else if (f.classList && f.classList.contains("fmt-money")) f.value = fmtMoney(f.value);
    const ss = e.target.closest("#stmtSel");
    if (ss) { STMT_SOURCE = ss.value; STMT_DOC = buildStmtDoc(ss.value); rerender(); return; }
    const se = e.target.closest(".stmt-edit");
    if (se) { statementDoc(); STMT_DOC[se.dataset.field] = se.dataset.num ? (parseFloat(se.value) || 0) : se.value; rerender(); return; }
    const tm = e.target.closest("#taxMonth");
    if (tm) { TAX_MONTH = tm.value; rerender(); return; }
    const sel = e.target.closest("select.lblsel");
    if (sel) { applyEdit(sel, false); rerender(); return; }
    // 수주등록 모달: 거래처 선택 시 사업자등록번호 자동 채움
    const mc = e.target.closest("#m_cust");
    if (mc) { const p = DB.partners.find(x => x.name === mc.value); const bz = document.getElementById("m_biz"); if (bz && p) bz.value = p.biz || ""; return; }
    // 견적 상세(단일 객체) 편집
    const qm = e.target.closest(".qmeta-edit");
    if (qm) { DB.quoteDetail[qm.dataset.field] = qm.dataset.num ? (parseFloat(qm.value) || 0) : qm.value; rerender(); return; }
    const qp = e.target.closest(".qparty-edit");
    if (qp) { DB.quoteDetail[qp.dataset.side][qp.dataset.field] = qp.value; rerender(); return; }
    const qit = e.target.closest(".qitem-edit");
    if (qit) { const it = DB.quoteDetail.items[+qit.dataset.idx]; if (it) it[qit.dataset.field] = qit.dataset.num ? (parseFloat(qit.value) || 0) : qit.value; rerender(); return; }
    const bc = e.target.closest(".bomcomp-edit");
    if (bc) { const b = DB.boms.find(x => x.parent === bc.dataset.bom); if (b && b.comps[+bc.dataset.ci]) b.comps[+bc.dataset.ci].qty = parseFloat(bc.value) || 0; rerender(); return; }
    const fe = e.target.closest(".fin-edit");
    if (fe) { DB.finance[fe.dataset.field] = fe.dataset.text ? fe.value : (parseFloat(fe.value) || 0); rerender(); return; }
    // 품목 선택 드롭다운
    const wis = e.target.closest("select.wo-itemsel");
    if (wis) { const r = DB.workorders.find(x => String(x.wo) === String(wis.dataset.key)); if (r) { const it = itemOf(wis.value); r.item = wis.value; r.itemName = it.name; } rerender(); return; }
    const sis = e.target.closest("select.stock-itemsel");
    if (sis) { const r = DB.stock.find(x => String(x.code) === String(sis.dataset.key)); if (r) r.code = sis.value; rerender(); return; }
    const os = e.target.closest("select.optsel");
    if (os) { applyEdit(os, false); rerender(); return; }
    const ti = e.target.closest("input.txtin");
    if (ti && ti.dataset.coll) { applyEdit(ti, false); rerender(); return; }
    const ni = e.target.closest("input.numin");
    if (ni && ni.dataset.coll) { applyEdit(ni, true); rerender(); return; }
  });
  document.addEventListener("input", e => {
    // 사업자등록번호: 입력하는 즉시 000-00-00000 형태로 변환
    const bz = e.target.closest(".fmt-biz");
    if (bz) { bz.value = fmtBizLive(bz.value); return; }
    const s = e.target.closest("input.search"); if (!s) return;
    const scope = s.closest(".card") || document;
    const q = s.value.trim().toLowerCase();
    scope.querySelectorAll("table.tbl tbody tr").forEach(r =>
      r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none");
  });
}
function rerender() { const y = window.scrollY; go(CURRENT, true); window.scrollTo(0, y); }

/* ---------- 거래명세서 데이터 (세금계산서 발행분 우선, 없으면 수주 기준) ---------- */
function buildStmtDoc(no) {
  const ord = DB.orders.find(o => o.no === no) || DB.orders[0];
  const it = itemOf(ord.item);
  const p = DB.partners.find(x => x.name === ord.cust) || {};
  const ci = CLIENT_INFO[ord.cust] || {};
  return { source: ord.no, date: ord.date, cust: ord.cust,
    biz: (p.biz && p.biz !== "-") ? p.biz : (ci.biz || ""),
    contact: p.contact || "", tel: p.tel || "", fax: ci.fax || "",
    addr: p.addr || ci.addr || "", item: ord.itemName, qty: ord.qty, price: it.price, unit: it.unit || "EA" };
}
function statementDoc() {
  if (!STMT_DOC) { if (!STMT_SOURCE) STMT_SOURCE = DB.orders[0].no; STMT_DOC = buildStmtDoc(STMT_SOURCE); }
  const d = STMT_DOC;
  d.supply = (+d.qty || 0) * (+d.price || 0);   // 공급가액 = 수량 × 단가
  d.vat = Math.round(d.supply * 0.1);            // 세액 = 공급가액 × 10%
  return d;
}

/* ---------- 거래명세서 (자동작성 + 편집 + PDF) ---------- */
function renderStatement() {
  const d = statementDoc();
  const supply = d.supply, vat = d.vat, total = supply + vat;
  const m = DB.meta;
  const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
  // 저장되는 편집 셀 (거래명세서 데이터에 반영)
  const si = (field, val, span, cls) => `<td class="ed"${span ? ` colspan="${span}"` : ""}><input class="stmt-in stmt-edit${cls ? " " + cls : ""}" data-field="${field}" value="${esc(val)}"></td>`;
  const siN = (field, val) => `<td class="ed num"><input class="stmt-in num stmt-edit" data-field="${field}" data-num="1" type="number" value="${val}"></td>`;
  // 자동계산 셀 (읽기전용)
  const auto = (v) => `<td class="ed num auto">${num(v)}</td>`;
  // 자사(공급자) / 자유 메모 셀 (단순 직접입력)
  const e = (v) => `<td class="ed" contenteditable="true">${v}</td>`;

  let emptyRows = "";
  for (let i = 0; i < 6; i++)
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
      <tr>${si("date", d.date)}${e(m.biznum)}</tr>
    </table>
    <table>
      <tr><td class="sectionhead" colspan="4">공급받는자</td><td class="sectionhead" colspan="4">공급자</td></tr>
      <tr>
        <td class="lbl" style="width:11%">회사명</td>${si("cust", d.cust)}<td class="lbl" style="width:11%">사업자</td>${si("biz", d.biz, 0, "fmt-biz")}
        <td class="lbl" style="width:11%">회사명</td>${e(m.company + " (" + m.companyEn + ")")}<td class="lbl" style="width:11%">사업자</td>${e(m.biznum)}
      </tr>
      <tr>
        <td class="lbl">연락처</td>${si("tel", d.tel)}<td class="lbl">FAX</td>${si("fax", d.fax)}
        <td class="lbl">연락처</td>${e("031-000-0000")}<td class="lbl">FAX</td>${e("031-000-0001")}
      </tr>
      <tr>
        <td class="lbl">소재지</td>${si("addr", d.addr, 3)}
        <td class="lbl">소재지</td><td class="ed" colspan="3" contenteditable="true">${m.addr}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td class="lbl" style="width:13%">날짜</td><td class="lbl">품목</td><td class="lbl" style="width:11%">규격/단위</td>
        <td class="lbl" style="width:9%">수량</td><td class="lbl" style="width:14%">단가</td>
        <td class="lbl" style="width:16%">공급가액 (W)</td><td class="lbl" style="width:13%">세액 (W)</td>
      </tr>
      <tr class="ih">
        ${si("date", d.date)}${si("item", d.item)}${si("unit", d.unit)}${siN("qty", d.qty)}${siN("price", d.price)}${auto(supply)}${auto(vat)}
      </tr>
      ${emptyRows}
    </table>
    <table>
      <tr>
        <td class="lbl" style="width:14%">공급가액 (W)</td>${auto(supply)}
        <td class="lbl" style="width:10%">세액 (W)</td>${auto(vat)}
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
  const lineNames = LINES.map(l => l.v);
  const woRows = activeWO.map(w => `
    <tr>
      <td>${textInput("workorders", "wo", w.wo, "wo", w.wo, { w: 112 })}</td>
      <td>${woItemSelect(w.wo)}</td>
      <td>${optSelect("workorders", "wo", w.wo, "line", w.line, lineNames)}</td>
      <td>${labelSelect("process", "workorders", "wo", w.wo, "status")}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "plan", w.plan, { w: 78 })}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "prod", w.prod, { w: 78 })}</td>
      <td style="min-width:120px">${progressCell(w.prod, w.plan)}</td>
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
        <span class="hint">진행률 = 생산 ÷ 계획 · 모든 항목 수정 가능</span></div>
      <div style="padding:14px 18px 0"><div class="edit-hint" style="margin:0">✎ 작업지시·품목·라인·공정·계획·생산 수량을 직접 수정할 수 있고, <b>진행률(%)은 생산수량 ÷ 계획수량</b>으로 자동 계산됩니다.</div></div>
      <table class="tbl">
        <thead><tr><th>작업지시</th><th>품목</th><th>라인</th><th>공정</th><th class="num">계획</th><th class="num">생산</th><th>진행률</th></tr></thead>
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

  const lineNames = LINES.map(l => l.v);
  const rows = DB.workorders.map(w => `
    <tr>
      <td>${textInput("workorders", "wo", w.wo, "wo", w.wo, { w: 108 })}</td>
      <td>${optSelect("workorders", "wo", w.wo, "so", w.so, DB.orders.map(o => o.no))}</td>
      <td>${woItemSelect(w.wo)}</td>
      <td>${optSelect("workorders", "wo", w.wo, "line", w.line, lineNames)}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "plan", w.plan, { w: 72 })}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "prod", w.prod, { w: 72 })}</td>
      <td class="num">${numInput("workorders", "wo", w.wo, "defect", w.defect, { w: 60 })}</td>
      <td style="min-width:120px">${progressCell(w.prod, w.plan)}</td>
      <td>${labelSelect("process", "workorders", "wo", w.wo, "status")}</td>
      <td>${delBtn("workorders", "wo", w.wo)}</td>
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
  <div class="edit-hint">✎ 작업지시 목록의 <b>모든 항목</b>(작업지시번호·연결수주·품목·라인·계획·생산·불량·공정상태)을 직접 수정/삭제할 수 있고, 변경 즉시 <b>진행률(=생산÷계획)</b>과 KPI에 반영됩니다.</div>
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
        <th class="num">계획</th><th class="num">생산</th><th class="num">불량</th><th>진행률</th><th>공정상태</th><th></th></tr></thead>
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

  const ED = EDIT_MODE;
  const rows = enriched.map(e => {
    const ratio = e.safety ? (e.qty / e.safety) * 100 : 200;
    const stat = e.qty < e.safety ? `<span class="badge b-danger">부족</span>`
      : ratio < 130 ? `<span class="badge b-warn">주의</span>`
      : `<span class="badge b-ok">정상</span>`;
    const accent = CAT_ACCENT[e.cat] || "#8c98a8";
    return `<tr style="box-shadow:inset 3px 0 0 ${accent}">
      <td class="mono t-strong">${e.code}</td>
      <td style="min-width:180px">${ED ? stockItemSelect(e.code) : `<span class="t-strong">${e.name}</span>`}</td>
      <td>${ED ? optSelect("items", "code", e.code, "cat", e.cat, ["완제품", "반제품", "원자재"]) : catBadgeM(e.cat)}</td>
      <td class="num mono">${ED ? numInput("stock", "code", e.code, "qty", e.qty, { w: 82 }) : num(e.qty)} <span class="t-muted" style="font-size:11px">${e.unit}</span></td>
      <td class="num mono t-muted">${ED ? numInput("items", "code", e.code, "safety", e.safety, { w: 80 }) : num(e.safety)}</td>
      <td class="num mono">${ED ? numInput("items", "code", e.code, "price", e.price, { w: 86 }) : won(e.price)}</td>
      <td class="num mono t-strong">${won(e.value)}</td>
      <td>${ED ? textInput("stock", "code", e.code, "loc", e.loc, { w: 96 }) : `<span class="t-muted">${e.loc}</span>`}</td>
      <td>${stat}</td>
      <td class="act-col">${ED ? delBtn("stock", "code", e.code) : ""}</td>
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
      <div class="card-h"><h3>📦 재고 현황</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="search" placeholder="품목코드 · 품목명 검색" style="width:190px">
          ${ED ? `<button class="btn-addrow" data-action="stock-add">＋ 재고품목 추가</button>` : ""}</div></div>
      ${ED ? `<div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 품목명은 등록된 품목 중 <b>선택</b>하고, 구분·현재고·안전재고·단가·위치를 직접 수정할 수 있습니다. <b>재고금액 = 현재고 × 단가</b>로 자동 계산됩니다.</div></div>` : ""}
      <table class="tbl master-tbl">
        <thead><tr><th>품목코드</th><th>품목명</th><th>구분</th>
          <th class="num">현재고</th><th class="num">안전</th><th class="num">단가</th>
          <th class="num">재고금액</th><th>위치</th><th>상태</th><th class="act-col"></th></tr></thead>
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
const CAT_BADGE = { "완제품": "b-info", "반제품": "b-purple", "원자재": "b-gray" };
const CAT_ACCENT = { "완제품": "#2f54eb", "반제품": "#7b3fe4", "원자재": "#8c98a8" };
function catBadgeM(c) { return `<span class="badge ${CAT_BADGE[c] || "b-gray"}">${c}</span>`; }

Views.bom = () => {
  const ED = EDIT_MODE;
  const fg = DB.items.filter(i => i.cat === "완제품").length;
  const sf = DB.items.filter(i => i.cat === "반제품").length;
  const rm = DB.items.filter(i => i.cat === "원자재").length;
  const avgMargin = DB.boms.length ? DB.boms.reduce((s, b) => {
    const f = itemOf(b.parent), mc = b.comps.reduce((x, c) => x + c.qty * itemOf(c.code).price, 0);
    return s + (f.price ? (f.price - mc) / f.price * 100 : 0);
  }, 0) / DB.boms.length : 0;

  // 품목 마스터 — 구분별 그룹
  const cats = ["완제품", "반제품", "원자재"];
  const colCount = 7;
  const itemGroups = cats.map(cat => {
    const items = DB.items.filter(i => i.cat === cat);
    if (!items.length) return "";
    const head = `<tr class="grp-row"><td colspan="${colCount}">
      <span class="grp-dot" style="background:${CAT_ACCENT[cat]}"></span>${cat}
      <span class="grp-cnt">${items.length}</span></td></tr>`;
    const body = items.map(it => {
      const stk = DB.stock.find(s => s.code === it.code);
      return `<tr style="box-shadow:inset 3px 0 0 ${CAT_ACCENT[cat]}">
        <td class="mono t-strong">${it.code}</td>
        <td>${ED ? textInput("items", "code", it.code, "name", it.name, { w: 220 }) : `<span class="t-strong">${it.name}</span>`}</td>
        <td>${ED ? optSelect("items", "code", it.code, "unit", it.unit, ["EA", "M", "R", "SET", "식"]) : `<span class="t-muted">${it.unit}</span>`}</td>
        <td class="num mono">${ED ? numInput("items", "code", it.code, "price", it.price, { w: 96 }) : won(it.price)}</td>
        <td class="num mono t-muted">${ED ? numInput("items", "code", it.code, "safety", it.safety, { w: 88 }) : num(it.safety)}</td>
        <td class="num mono">${stk ? (ED ? numInput("stock", "code", it.code, "qty", stk.qty, { w: 88 }) : num(stk.qty)) : `<span class="t-muted" style="font-size:11px">—</span>`}</td>
        <td class="act-col">${ED ? delBtn("items", "code", it.code) : ""}</td>
      </tr>`;
    }).join("");
    return head + body;
  }).join("");

  // BOM 카드
  const bomCards = DB.boms.map(b => {
    const f = itemOf(b.parent);
    const matCost = b.comps.reduce((s, c) => s + c.qty * itemOf(c.code).price, 0);
    const margin = f.price ? ((f.price - matCost) / f.price) * 100 : 0;
    const mcls = margin > 50 ? "b-ok" : margin > 30 ? "b-warn" : "b-danger";
    const bcls = margin > 50 ? "ok" : margin > 30 ? "" : "warn";
    const compRows = b.comps.map((c, ci) => `
      <tr>
        <td class="mono t-muted">${c.code}</td><td>${c.name}</td>
        <td class="num">${ED
          ? `<input type="number" class="numin bomcomp-edit" data-bom="${b.parent}" data-ci="${ci}" value="${c.qty}" min="0" step="0.01" style="width:74px"> <span class="t-muted" style="font-size:11px">${c.unit}</span>`
          : `<span class="mono">${c.qty}</span> <span class="t-muted" style="font-size:11px">${c.unit}</span>`}</td>
        <td class="num mono t-muted">${won(itemOf(c.code).price)}</td>
        <td class="num mono t-strong">${won(c.qty * itemOf(c.code).price)}</td>
      </tr>`).join("");
    return `<div class="card fade bom-card">
      <div class="bom-head">
        <div>
          <div class="bom-title">${b.parentName}</div>
          <div class="mono t-muted" style="font-size:11.5px;font-weight:600;margin-top:2px">${b.parent}</div>
        </div>
        <span class="badge ${mcls}" style="font-size:12.5px">자재마진 ${margin.toFixed(0)}%</span>
      </div>
      <div class="bom-metrics">
        <div class="bm"><div class="bm-l">판매단가</div><div class="bm-v">${won(f.price)}</div></div>
        <div class="bm"><div class="bm-l">자재원가</div><div class="bm-v">${won(matCost)}</div></div>
        <div class="bm"><div class="bm-l">자재마진액</div><div class="bm-v" style="color:var(--ok)">${won(f.price - matCost)}</div></div>
      </div>
      <div class="bom-bar"><div class="pbar ${bcls}" style="height:7px"><i style="width:${Math.max(0, Math.min(margin, 100))}%"></i></div></div>
      <table class="tbl bom-tbl">
        <thead><tr><th>자재코드</th><th>자재명</th><th class="num">소요량</th><th class="num">단가</th><th class="num">소요금액</th></tr></thead>
        <tbody>${compRows}</tbody>
      </table>
    </div>`;
  }).join("");

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 품목</div><div class="kpi-val">${DB.items.length}<span class="unit">개</span></div></div>
    <div class="card kpi"><div class="kpi-label">완제품 / 반제품</div><div class="kpi-val">${fg}<span class="unit">/ ${sf}</span></div></div>
    <div class="card kpi"><div class="kpi-label">원자재</div><div class="kpi-val">${rm}<span class="unit">종</span></div></div>
    <div class="card kpi"><div class="kpi-label">평균 자재마진</div><div class="kpi-val" style="color:var(--ok)">${avgMargin.toFixed(0)}<span class="unit">%</span></div></div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>📦 품목 마스터</h3>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="hint">총 ${DB.items.length}개 품목</span>
        ${ED ? `<button class="btn-addrow" data-action="item-add">＋ 품목 추가</button>` : ""}</div></div>
    ${ED ? `<div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 품목명·단위·단가·안전재고·재고수량을 직접 수정하고 행 추가/삭제할 수 있습니다. 여기 등록한 품목이 재고·작업지시·견적의 <b>선택 목록</b>이 됩니다. (코드는 연결 보존을 위해 고정)</div></div>` : ""}
    <table class="tbl master-tbl">
      <thead><tr><th>품목코드</th><th>품목명</th><th>단위</th><th class="num">단가</th><th class="num">안전재고</th><th class="num">재고수량</th><th class="act-col"></th></tr></thead>
      <tbody>${itemGroups}</tbody>
    </table>
  </div>

  <div class="sec-title" style="margin-top:24px"><span class="ic">🧬</span>BOM (자재명세서) — 완제품별 구성 <span class="t-muted" style="font-size:12px;font-weight:600">· 판매단가 대비 자재원가/마진 자동 계산</span></div>
  <div class="grid g-2">${bomCards}</div>`;
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
    <td>${textInput("partners", "code", p.code, "name", p.name, { w: 130 })}</td>
    <td>${textInput("partners", "code", p.code, "biz", p.biz || "", { w: 116, ph: "000-00-00000", cls: "fmt-biz" })}</td>
    <td>${textInput("partners", "code", p.code, "ceo", p.ceo || "", { w: 70 })}</td>
    <td>${labelSelect("grade", "partners", "code", p.code, "grade")}</td>
    <td>${textInput("partners", "code", p.code, "contact", p.contact || "", { w: 96 })}</td>
    <td>${textInput("partners", "code", p.code, "tel", p.tel || "", { w: 116 })}</td>
    <td class="num">${numInput("partners", "code", p.code, "balance", p.balance, { w: 116, min: -999999999999 })}</td>
    <td>${delBtn("partners", "code", p.code)}</td>
  </tr>`;
  const addBtn = (type) => `<button class="btn-addrow" data-action="partner-row-add" data-type="${type}">＋ ${type} 추가</button>`;

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
    <div class="card-h"><h3>고객사</h3>
      <div style="display:flex;gap:8px;align-items:center"><span class="hint">${cust.length}개사</span>${addBtn("고객사")}</div></div>
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 거래처명·사업자번호·대표자·등급·담당자·연락처·잔액을 직접 수정하고, 행 추가/삭제할 수 있습니다.</div></div>
    <table class="tbl">
      <thead><tr><th>코드</th><th>거래처명</th><th>사업자번호</th><th>대표자</th><th>등급</th><th>담당자</th><th>연락처</th>
        <th class="num">미수잔액</th><th></th></tr></thead>
      <tbody>${cust.map(row).join("")}</tbody>
    </table>
  </div>

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>매입처</h3>
      <div style="display:flex;gap:8px;align-items:center"><span class="hint">${vend.length}개사</span>${addBtn("매입처")}</div></div>
    <table class="tbl">
      <thead><tr><th>코드</th><th>거래처명</th><th>사업자번호</th><th>대표자</th><th>등급</th><th>담당자</th><th>연락처</th>
        <th class="num">미지급잔액</th><th></th></tr></thead>
      <tbody>${vend.map(row).join("")}</tbody>
    </table>
  </div>`;
}

/* ---------------- 품질관리 ---------------- */
function qualityView() {
  const insQty = DB.shipInspect.reduce((s, r) => s + r.qty, 0);
  const insFail = DB.shipInspect.reduce((s, r) => s + r.fail, 0);
  const yieldRate = insQty ? (1 - insFail / insQty) * 100 : 100;
  const ppm = insQty ? Math.round(insFail / insQty * 1e6) : 0;
  const auditAvg = DB.lineAudit.length ? DB.lineAudit.reduce((s, a) => s + a.score, 0) / DB.lineAudit.length : 0;
  const respAvg = DB.complaints.length ? Math.round(DB.complaints.reduce((s, c) => s + c.respMin, 0) / DB.complaints.length) : 0;

  const insRows = DB.shipInspect.map(r => {
    const pass = r.qty - r.fail;
    const rate = r.qty ? (pass / r.qty) * 100 : 0;
    return `<tr>
      <td>${textInput("shipInspect", "lot", r.lot, "date", r.date, { w: 100 })}</td>
      <td>${textInput("shipInspect", "lot", r.lot, "lot", r.lot, { w: 96 })}</td>
      <td>${optSelect("shipInspect", "lot", r.lot, "cust", r.cust, custList().map(x => x.v))}</td>
      <td>${textInput("shipInspect", "lot", r.lot, "item", r.item, { w: 170 })}</td>
      <td class="num">${numInput("shipInspect", "lot", r.lot, "qty", r.qty, { w: 80 })}</td>
      <td class="num mono" style="color:var(--ok)">${num(pass)}</td>
      <td class="num">${numInput("shipInspect", "lot", r.lot, "fail", r.fail, { w: 56 })}</td>
      <td class="num mono t-strong">${rate.toFixed(3)}%</td>
      <td>${labelSelect("verdict", "shipInspect", "lot", r.lot, "verdict")}</td>
      <td>${delBtn("shipInspect", "lot", r.lot)}</td>
    </tr>`;
  }).join("");

  const auditLineNames = LINES.map(l => l.v);
  const auditCards = DB.lineAudit.map((a, ai) => {
    const cls = a.score >= 95 ? "ok" : a.score >= 90 ? "" : "warn";
    return `<div class="card" style="padding:16px 18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">
        <select class="celledit optsel" data-coll="lineAudit" data-keyfield="line" data-key="${a.line}" data-field="line">
          ${(auditLineNames.includes(a.line) ? auditLineNames : [a.line, ...auditLineNames]).map(o => `<option ${o === a.line ? "selected" : ""}>${o}</option>`).join("")}
        </select>
        <span style="display:flex;align-items:center;gap:4px">${numInput("lineAudit", "line", a.line, "score", a.score, { w: 56 })}<span class="t-muted" style="font-size:11px">점</span>${delBtn("lineAudit", "line", a.line)}</span></div>
      <div class="pbar ${cls}" style="height:9px"><i style="width:${Math.min(a.score, 100)}%"></i></div>
      <div class="t-muted" style="font-size:12px;margin-top:8px">감사일 ${textInput("lineAudit", "line", a.line, "date", a.date, { w: 92 })} · ${textInput("lineAudit", "line", a.line, "auditor", a.auditor, { w: 64 })}</div>
    </div>`;
  }).join("");

  const csRows = DB.complaints.map(c => `
    <tr>
      <td>${textInput("complaints", "no", c.no, "no", c.no, { w: 104 })}</td>
      <td>${textInput("complaints", "no", c.no, "date", c.date, { w: 104 })}</td>
      <td>${optSelect("complaints", "no", c.no, "cust", c.cust, custList().map(x => x.v))}</td>
      <td>${optSelect("complaints", "no", c.no, "channel", c.channel || "전화", ["전화", "이메일", "방문", "카카오톡", "홈페이지", "기타"])}</td>
      <td>${textInput("complaints", "no", c.no, "content", c.content, { w: 240, ph: "접수 내용 / 응대 메모" })}</td>
      <td class="num">${numInput("complaints", "no", c.no, "respMin", c.respMin, { w: 60 })} <span class="t-muted" style="font-size:11px">분</span></td>
      <td>${labelSelect("cs", "complaints", "no", c.no, "status")}</td>
      <td>${delBtn("complaints", "no", c.no)}</td>
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
      <div style="display:flex;gap:8px">
        <button class="btn-addrow" data-action="inspect-add">＋ 검사 추가</button>
        <button class="btn" data-action="defect-add">⚠ 불량 등록</button></div></div>
    <table class="tbl">
      <thead><tr><th>검사일</th><th>LOT</th><th>고객사</th><th>품목</th>
        <th class="num">검사수량</th><th class="num">합격</th><th class="num">불합격</th><th class="num">합격률</th><th>판정</th><th></th></tr></thead>
      <tbody>${insRows}</tbody>
    </table>
  </div>

  <div class="grid g-2" style="margin-top:18px">
    <div>
      <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center"><span><span class="ic">🔎</span>공정감사 (Line Audit Check Sheet)</span>
        <button class="btn-addrow" data-action="audit-add">＋ 감사 추가</button></div>
      <div class="grid g-2 fade">${auditCards}</div>
    </div>
    <div class="card fade" style="align-self:start">
      <div class="card-h"><h3>당월 불량 유형 분석</h3><span class="hint">총 ${num(DB.defectTypes.reduce((s,d)=>s+d.count,0))}건</span></div>
      <div class="card-b">${chartHBar(DB.defectTypes)}</div>
    </div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>고객불만 접수·대응 현황</h3>
      <button class="btn-addrow" data-action="complaint-add">＋ 접수 추가</button></div>
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 어디서(전화·이메일·방문 등) 어떤 불만이 접수되어 어떻게 응대했는지 직접 입력·수정하고, 행을 추가/삭제할 수 있습니다. 대응시간(분)은 평균 대응 KPI에 반영됩니다.</div></div>
    <table class="tbl">
      <thead><tr><th>접수번호</th><th>접수일</th><th>고객사</th><th>접수경로</th><th>내용 / 응대</th><th class="num">대응시간</th><th>처리상태</th><th></th></tr></thead>
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

  const normal = DB.equipment.filter(e => e.status === "정상");
  const needChk = DB.equipment.filter(e => e.status === "점검필요");
  // 관리가 필요한 설비(점검필요·노후)만 노출 — 정상 가동 기계 전체 나열은 생략
  const watch = DB.equipment.filter(e => e.status !== "정상");
  const total = DB.equipment.length || 1;

  const watchRows = watch.map(e => `
    <tr>
      <td>${textInput("equipment", "mgmt", e.mgmt, "mgmt", e.mgmt, { w: 84 })}</td>
      <td>${textInput("equipment", "mgmt", e.mgmt, "name", e.name, { w: 160 })}</td>
      <td>${optSelect("equipment", "mgmt", e.mgmt, "grp", e.grp, ["제조설비", "계측기"])}</td>
      <td>${textInput("equipment", "mgmt", e.mgmt, "year", e.year, { w: 84 })}</td>
      <td>${labelSelect("equip", "equipment", "mgmt", e.mgmt, "status")}</td>
      <td>${delBtn("equipment", "mgmt", e.mgmt)}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="t-muted" style="padding:14px">점검/교체가 필요한 설비가 없습니다.</td></tr>`;

  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 설비</div><div class="kpi-val">${DB.equipment.length}<span class="unit">대</span></div></div>
    <div class="card kpi"><div class="kpi-label">정상 가동</div><div class="kpi-val" style="color:var(--ok)">${normal.length}<span class="unit">대</span></div></div>
    <div class="card kpi"><div class="kpi-label">점검필요</div><div class="kpi-val" style="color:#b9760a">${needChk.length}<span class="unit">대</span></div></div>
    <div class="card kpi"><div class="kpi-label">노후 (교체검토)</div><div class="kpi-val" style="color:var(--danger)">${old.length}<span class="unit">대</span></div></div>
  </div>

  <div class="demo-banner" style="margin-top:18px;background:linear-gradient(90deg,#fff1f0,#fff8f7);border-color:#ffccc7;color:#a8261f">
    ⚠️ 전체 ${DB.equipment.length}대 중 <b>${old.length}대(${Math.round(old.length/total*100)}%)</b>가 노후 설비(평균 ${avgAge}년)로 생산성·품질 향상을 위한 <b>설비 확충/교체 투자</b>가 필요합니다.
  </div>

  <div class="card fade" style="margin-top:4px">
    <div class="card-h"><h3>관리가 필요한 설비 (점검필요 · 노후)</h3>
      <span class="hint">정상 가동 ${normal.length}대는 요약에만 집계 · 조치 대상만 표시</span></div>
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 기계 한 대씩 전부 나열하는 대신 <b>점검·교체가 필요한 설비만</b> 보여줍니다. 상태를 "정상"으로 바꾸면 목록에서 빠지고, 관리번호·설비명·구분·제작년도를 직접 수정/삭제할 수 있습니다.</div></div>
    <table class="tbl">
      <thead><tr><th>관리번호</th><th>설비명</th><th>구분</th><th>제작년도</th><th>상태</th><th></th></tr></thead>
      <tbody>${watchRows}</tbody>
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
      <td>${textInput("quotes", "no", x.no, "no", x.no, { w: 108 })}</td>
      <td>${textInput("quotes", "no", x.no, "date", x.date, { w: 104 })}</td>
      <td>${textInput("quotes", "no", x.no, "cust", x.cust, { w: 130, ph: "고객사명 직접 입력" })}</td>
      <td>${textInput("quotes", "no", x.no, "manager", x.manager, { w: 80 })}</td>
      <td class="num">${numInput("quotes", "no", x.no, "amount", x.amount, { w: 116 })}</td>
      <td>${labelSelect("quote", "quotes", "no", x.no, "status")}</td>
      <td>${delBtn("quotes", "no", x.no)}</td>
    </tr>`).join("");

  const qInput = (idx, field, val, isNum, w) =>
    `<input type="${isNum ? "number" : "text"}" class="celledit qitem-edit ${isNum ? "" : "txtin"}" data-idx="${idx}" data-field="${field}"${isNum ? ' data-num="1"' : ""}
      value="${isNum ? val : String(val == null ? "" : val).replace(/"/g, "&quot;")}" style="width:${w}px${isNum ? ";text-align:right" : ""}">`;
  const itemRows = q.items.map((it, i) => `
    <tr>
      <td>${qInput(i, "title", it.title, false, 150)}</td>
      <td>${qInput(i, "desc", it.desc, false, 230)}</td>
      <td class="num">${qInput(i, "price", it.price, true, 92)}</td>
      <td class="num">${qInput(i, "qty", it.qty, true, 78)}</td>
      <td>${qInput(i, "unit", it.unit, false, 48)}</td>
      <td class="num mono t-strong">${won(it.price * it.qty)}</td>
      <td><button class="rowdel" data-action="qitem-del" data-i="${i}">✕</button></td>
    </tr>`).join("");

  const qpRow = (side, field, label, val) =>
    `<div class="prow"><span class="k">${label}</span><input class="qparty-edit" data-side="${side}" data-field="${field}" value="${String(val == null ? "" : val).replace(/"/g, "&quot;")}"></div>`;
  const party = (p, side, label, color) => `
    <div class="party">
      <h4 style="color:${color}">${label}</h4>
      ${qpRow(side, "name", "상호", p.name)}
      ${qpRow(side, "ceo", "대표", p.ceo)}
      ${qpRow(side, "biz", "사업자", p.biz)}
      ${qpRow(side, "email", "이메일", p.email)}
      ${qpRow(side, "addr", "소재지", p.addr)}
    </div>`;
  const defNote = `1) 본 견적서의 단가는 출하 전수검사 및 LOT 품질관리 비용이 포함된 금액입니다.
2) 원자재가 변동 시 단가는 사전 협의 후 조정될 수 있습니다. (협력사별 통계 기반 단가 관리)
3) 대금 지급은 선금 50% / 잔금 50%를 원칙으로 합니다.
4) 본 견적서는 견적일자로부터 ${q.validDays}일간 유효합니다.`;
  if (q.notes == null) q.notes = defNote;

  const features = [
    "항목별 할인 입력", "PDF · 카카오 알림톡 발송", "총 합계 금액 숨기기(비교견적)",
    "수신↔공급자 위치 변경", "수주 자동 연결/전환", "수신자 정보 검색",
  ].map((f, i) => `<div class="f"><span class="n">${String(i + 1).padStart(2, "0")}</span><span>${f}</span></div>`).join("");

  return `
  <div class="toolbar" style="margin-bottom:14px">
    <span class="sec-title" style="margin:0"><span class="ic">🧾</span>견적 목록</span>
    <div style="display:flex;gap:8px">
      <button class="btn-addrow" data-action="quote-list-add">＋ 행 추가</button>
      <button class="btn primary" data-action="quote-add">＋ 견적서 작성</button>
    </div>
  </div>
  <div class="card fade" style="margin-bottom:22px">
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 견적번호·일자·고객사·담당자·금액·상태를 직접 수정하거나 행을 추가/삭제할 수 있습니다.</div></div>
    <table class="tbl">
      <thead><tr><th>견적번호</th><th>견적일자</th><th>고객사</th><th>담당자</th><th class="num">견적금액(VAT포함)</th><th>상태</th><th></th></tr></thead>
      <tbody>${listRows}</tbody>
    </table>
  </div>

  <div class="edit-hint">✎ 아래 견적서의 <b>모든 항목</b>(메타정보·공급자/수신자·품목·할인율·VAT·안내사항)을 직접 수정할 수 있습니다. 금액은 단가×수량, 할인, VAT를 반영해 자동 계산됩니다.</div>
  <div class="quote fade">
    <div class="quote-top">
      <div class="quote-title">견적서</div>
      <div class="quote-meta">
        <div class="qm"><b>견적일자</b><input class="qmeta-edit" data-field="date" value="${q.date}" style="width:104px"></div>
        <div class="qm"><b>견적번호</b><input class="qmeta-edit" data-field="no" value="${q.no}" style="width:104px"></div>
        <div class="qm"><b>담당자</b><input class="qmeta-edit" data-field="manager" value="${q.manager}" style="width:84px"></div>
        <div class="qm"><b>유효기간</b>견적일로부터 <input class="qmeta-edit" data-field="validDays" data-num="1" type="number" value="${q.validDays}" style="width:54px">일</div>
      </div>
    </div>

    <div class="party-wrap">
      ${party(q.supplier, "supplier", "공급자", "var(--primary)")}
      ${party(q.client, "client", "수신자", "#7b3fe4")}
    </div>

    <div class="quote-items">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <input class="qmeta-edit group-tag" data-field="group" value="${q.group}" style="min-width:280px">
        <button class="btn-addrow" data-action="quote-item-add">＋ 품목 추가</button>
      </div>
      <table class="tbl">
        <thead><tr><th>제목</th><th>작업 내용</th><th class="num">단가</th><th class="num">수량</th><th>단위</th><th class="num">공급가액</th><th></th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="quote-summary">
      <div class="summary-box">
        <div class="srow"><span class="lab">총 합계</span><span class="val">${won(sub)}</span></div>
        <div class="srow discount"><span class="lab">할인 (<input class="qmeta-edit" data-field="discountRate" data-num="1" type="number" value="${q.discountRate}" style="width:46px">%)</span><span class="val">- ${won(discAmt)}</span></div>
        <div class="srow"><span class="lab">공급가액</span><span class="val">${won(supply)}</span></div>
        <div class="srow"><span class="lab">VAT (10%) <span class="tgl-sw ${q.vat ? "on" : ""}" data-action="vat-toggle"><span class="tk"></span></span></span><span class="val">${won(vat)}</span></div>
        <div class="srow total"><span class="lab">최종 견적 (VAT 포함)</span><span class="val">${won(total)}</span></div>
      </div>
    </div>

    <div class="qnote">
      <b style="color:var(--ink)">안내사항</b>
      <textarea class="qnote-edit qmeta-edit" data-field="notes" rows="5">${q.notes}</textarea>
    </div>
  </div>

  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>견적 시스템 주요 기능</h3><span class="badge b-info">개발 진행중</span></div>
    <div class="card-b"><div class="feature-grid">${features}</div></div>
  </div>`;
};

/* ---------------- 정산관리 (미수금 / 세금계산서) ---------------- */
const SUB = { settlement: "현황", sales: "수주", quality: "품질", finance: "손익계산서" };
let TAX_YEAR = "전체", TAX_MONTH = "전체";   // 세금계산서 기간 필터
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
    <div class="ar-top"><span class="ar-name">💰 ${optSelect("receivables", "no", r.no, "cust", r.cust, custList().map(x => x.v))}</span>${labelSelect("receivable", "receivables", "no", r.no, "status")}</div>
    <div class="ar-amt">${numInput("receivables", "no", r.no, "amount", r.amount, { w: 150 })} <span class="t-muted" style="font-size:11px">원</span></div>
    <div class="ar-line">📄 ${textInput("receivables", "no", r.no, "item", r.item || r.so || "", { w: 150 })}</div>
    <div class="ar-line">🗓️ ${textInput("receivables", "no", r.no, "due", r.due, { w: 104 })} <span class="badge ${dd.cls}" style="margin-left:2px">${settled ? "완료" : dd.txt}</span></div>
    <div class="ar-line">
      <span class="tgl-sw ${issued ? "on" : ""}" data-action="tax-toggle" data-no="${r.no}"><span class="tk"></span>계산서 ${issued ? "발행" : "미발행"}</span>
      ${settled
        ? `<button class="btn ghost" style="padding:5px 11px;font-size:12px;margin-left:auto" data-action="ar-unsettle" data-no="${r.no}">↩ 정산 취소</button>`
        : `<button class="btn primary" style="padding:5px 11px;font-size:12px;margin-left:auto" data-action="ar-settle" data-no="${r.no}">정산 처리</button>`}
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

  const logHtml = ACTLOG.length
    ? ACTLOG.map((a, i) => `<div class="row"><span class="time">${a.time}</span><span class="txt">${a.text}</span>${a.undo ? `<button class="undo" data-action="act-undo" data-i="${i}">↩ 되돌리기</button>` : ""}</div>`).join("")
    : `<div class="t-muted" style="font-size:12.5px;padding:6px 2px">아직 활동 내역이 없습니다. 정산 처리/취소나 행 추가·삭제 시 여기에 기록되고, 잘못 누른 작업은 <b>되돌리기</b>로 복구할 수 있습니다.</div>`;

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

  <div class="card fade" style="margin-top:16px">
    <div class="card-h"><h3>🕓 활동 로그 / 되돌리기</h3><span class="hint">정산 처리·취소, 행 추가/삭제 내역 (최근순)</span></div>
    <div class="card-b"><div class="actlog">${logHtml}</div></div>
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
      <span class="t-muted" style="font-size:12px">사업자번호·품목·단위·수량·단가를 셀에서 직접 수정 (공급가액·세액·합계는 자동계산)</span>
      <button class="btn primary" data-action="stmt-pdf">📄 PDF 다운로드</button>
    </div>
  </div>
  ${renderStatement()}`;
}

/* --- 세금계산서 탭 --- */
function settleTaxView() {
  const years = ["전체", "2026", "2025"];
  const inPeriod = (t) =>
    (TAX_YEAR === "전체" || t.date.slice(0, 4) === TAX_YEAR) &&
    (TAX_MONTH === "전체" || t.date.slice(5, 7) === TAX_MONTH);
  const list = DB.taxInvoices.filter(inPeriod);
  const sell = list.filter(t => t.type === "매출"), buy = list.filter(t => t.type === "매입");
  const sumS = sell.reduce((s, t) => s + t.supply, 0), sumSv = sell.reduce((s, t) => s + t.vat, 0);
  const sumB = buy.reduce((s, t) => s + t.supply, 0), sumBv = buy.reduce((s, t) => s + t.vat, 0);

  // 월별 집계
  const mAgg = {};
  list.forEach(t => {
    const ym = t.date.slice(0, 7); const a = (mAgg[ym] = mAgg[ym] || { sale: 0, buy: 0, sv: 0, bv: 0 });
    if (t.type === "매출") { a.sale += t.supply; a.sv += t.vat; } else { a.buy += t.supply; a.bv += t.vat; }
  });
  const monthRows = Object.keys(mAgg).sort().reverse().map(ym => {
    const a = mAgg[ym], net = a.sale - a.buy;
    return `<tr>
      <td class="t-strong">${ym}</td>
      <td class="num mono" style="color:var(--primary)">${won(a.sale)}</td>
      <td class="num mono" style="color:#7b3fe4">${won(a.buy)}</td>
      <td class="num mono t-strong" style="color:${net >= 0 ? "var(--ok)" : "var(--danger)"}">${won(net)}</td>
    </tr>`;
  }).join("");

  const yearChips = years.map(y => `<span class="chip ${TAX_YEAR === y ? "active" : ""}" data-taxyear="${y}">${y === "전체" ? "전체연도" : y + "년"}</span>`).join("");
  const monthOpts = ["전체", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    .map(m => `<option value="${m}" ${TAX_MONTH === m ? "selected" : ""}>${m === "전체" ? "전체 월" : parseInt(m, 10) + "월"}</option>`).join("");

  const taxRows = list.map(t => `
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
  <div class="toolbar" style="margin-bottom:14px">
    <div class="filters">${yearChips}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <select id="taxMonth" class="search" style="width:auto">${monthOpts}</select>
      <button class="btn primary" data-action="tax-issue">＋ 세금계산서 발행</button>
    </div>
  </div>

  <div class="grid g-4" style="margin-bottom:16px">
    <div class="card kpi"><div class="kpi-label">매출 합계 (공급가)</div><div class="kpi-val" style="font-size:20px;color:var(--primary)">${won(sumS)}</div><div class="kpi-delta up">${sell.length}건</div></div>
    <div class="card kpi"><div class="kpi-label">매입 합계 (공급가)</div><div class="kpi-val" style="font-size:20px;color:#7b3fe4">${won(sumB)}</div><div class="kpi-delta up">${buy.length}건</div></div>
    <div class="card kpi"><div class="kpi-label">매출 세액 <span class="t-muted" style="font-size:11px">(계산서)</span></div><div class="kpi-val" style="font-size:20px">${won(sumSv)}</div></div>
    <div class="card kpi"><div class="kpi-label">매입 세액 <span class="t-muted" style="font-size:11px">(계산서)</span></div><div class="kpi-val" style="font-size:20px">${won(sumBv)}</div></div>
  </div>

  <div class="demo-banner" style="margin-bottom:16px">
    ※ 본 화면은 <b>세금계산서 기준 금액</b>만 집계합니다. 사업용 카드매입·현금영수증 등 미연동 항목이 있어 실제 부가세 납부액과는 다릅니다. (카드·계좌 연동 시 자동 반영 예정)
  </div>

  <div class="card fade" style="margin-bottom:16px">
    <div class="card-h"><h3>월별 집계</h3><span class="hint">${TAX_YEAR === "전체" ? "전체 기간" : TAX_YEAR + "년"} · 공급가 기준</span></div>
    <table class="tbl">
      <thead><tr><th>연·월</th><th class="num">매출(공급가)</th><th class="num">매입(공급가)</th><th class="num">매출−매입</th></tr></thead>
      <tbody>${monthRows || `<tr><td colspan="4" class="t-muted">해당 기간 자료가 없습니다.</td></tr>`}</tbody>
    </table>
  </div>

  <div class="card fade">
    <div class="card-h"><h3>세금계산서 내역</h3><span class="hint">${list.length}건 · 홈택스 기준</span></div>
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

/* ---------------- 재무회계 (FI) ---------------- */
function finN(field, w) { return `<input class="celledit numin fin-edit" data-field="${field}" type="number" value="${DB.finance[field]}" style="width:${w || 140}px;text-align:right">`; }
function arOpenSum() { return DB.receivables.filter(r => r.status !== "완료").reduce((s, r) => s + r.amount, 0); }
function apOpenSum() { return Math.abs(DB.partners.filter(p => p.type === "매입처").reduce((s, p) => s + p.balance, 0)); }
function stockAssetSum() { return DB.stock.reduce((s, st) => s + st.qty * (itemOf(st.code).price || 0), 0); }

function incomeStatementView() {
  const f = DB.finance;
  const gross = f.sales - f.cogs, op = gross - f.sga;
  const ebt = op + f.nonOpIncome - f.nonOpExpense, net = ebt - f.corpTax;
  const opM = f.sales ? op / f.sales * 100 : 0, netM = f.sales ? net / f.sales * 100 : 0;
  const line = (label, cell) => `<tr><td>${label}</td><td class="num">${cell}</td></tr>`;
  const sum = (label, val) => `<tr class="fi-sum"><td class="t-strong">${label}</td><td class="num mono t-strong">${won(val)}</td></tr>`;
  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">매출액 (당월)</div><div class="kpi-val" style="font-size:21px">${won(f.sales)}</div></div>
    <div class="card kpi"><div class="kpi-label">영업이익</div><div class="kpi-val" style="font-size:21px;color:var(--ok)">${won(op)}</div><div class="kpi-delta up">영업이익률 ${opM.toFixed(1)}%</div></div>
    <div class="card kpi"><div class="kpi-label">당기순이익</div><div class="kpi-val" style="font-size:21px;color:var(--primary)">${won(net)}</div><div class="kpi-delta up">순이익률 ${netM.toFixed(1)}%</div></div>
    <div class="card kpi"><div class="kpi-label">매출총이익률</div><div class="kpi-val">${f.sales ? (gross / f.sales * 100).toFixed(1) : 0}<span class="unit">%</span></div></div>
  </div>
  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>손익계산서 <span class="t-muted" style="font-size:12px;font-weight:600">· ${f.period}</span></h3></div>
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 매출액·매출원가·판관비 등 파란 숫자만 입력하면 매출총이익·영업이익·당기순이익은 자동 계산됩니다. (상단 「수정」 버튼)</div></div>
    <table class="tbl fi-tbl"><tbody>
      ${line("매출액", finN("sales"))}
      ${line("(-) 매출원가", finN("cogs"))}
      ${sum("매출총이익", gross)}
      ${line("(-) 판매비와관리비", finN("sga"))}
      ${sum("영업이익", op)}
      ${line("(+) 영업외수익", finN("nonOpIncome"))}
      ${line("(-) 영업외비용", finN("nonOpExpense"))}
      ${sum("법인세비용차감전순이익", ebt)}
      ${line("(-) 법인세비용", finN("corpTax"))}
      ${sum("당기순이익", net)}
    </tbody></table>
  </div>`;
}

function balanceSheetView() {
  const f = DB.finance;
  const ar = arOpenSum(), inv = stockAssetSum(), ap = apOpenSum();
  const totalAsset = f.cash + ar + inv + f.tangible + f.otherAsset;
  const totalLiab = ap + f.shortLoan + f.otherLiab;
  const retained = totalAsset - totalLiab - f.capital;
  const totalEq = f.capital + retained;
  const row = (label, cell) => `<tr><td>${label}</td><td class="num">${cell}</td></tr>`;
  const auto = (v) => `<span class="mono">${won(v)}</span>`;
  const sum = (label, v) => `<tr class="fi-sum"><td class="t-strong">${label}</td><td class="num mono t-strong">${won(v)}</td></tr>`;
  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">자산총계</div><div class="kpi-val" style="font-size:20px">${won(totalAsset)}</div></div>
    <div class="card kpi"><div class="kpi-label">부채총계</div><div class="kpi-val" style="font-size:20px;color:var(--danger)">${won(totalLiab)}</div></div>
    <div class="card kpi"><div class="kpi-label">자본총계</div><div class="kpi-val" style="font-size:20px;color:var(--primary)">${won(totalEq)}</div></div>
    <div class="card kpi"><div class="kpi-label">부채비율</div><div class="kpi-val">${totalEq ? (totalLiab / totalEq * 100).toFixed(0) : 0}<span class="unit">%</span></div></div>
  </div>
  <div class="grid g-2" style="margin-top:18px">
    <div class="card fade">
      <div class="card-h"><h3>자산</h3></div>
      <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">매출채권·재고자산은 다른 화면 데이터에서 자동 집계됩니다.</div></div>
      <table class="tbl fi-tbl"><tbody>
        ${row("현금및현금성자산", finN("cash", 130))}
        ${row(`매출채권 <span class="t-muted" style="font-size:11px">(미수금 자동)</span>`, auto(ar))}
        ${row(`재고자산 <span class="t-muted" style="font-size:11px">(재고 자동)</span>`, auto(inv))}
        ${row("유형자산(설비 등)", finN("tangible", 130))}
        ${row("기타자산", finN("otherAsset", 130))}
        ${sum("자산총계", totalAsset)}
      </tbody></table>
    </div>
    <div class="card fade">
      <div class="card-h"><h3>부채 · 자본</h3></div>
      <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">매입채무는 매입처 잔액에서 자동, 이익잉여금은 대차 일치로 자동 계산됩니다.</div></div>
      <table class="tbl fi-tbl"><tbody>
        ${row(`매입채무 <span class="t-muted" style="font-size:11px">(미지급금 자동)</span>`, auto(ap))}
        ${row("단기차입금", finN("shortLoan", 130))}
        ${row("기타부채", finN("otherLiab", 130))}
        ${sum("부채총계", totalLiab)}
        ${row("자본금", finN("capital", 130))}
        ${row(`이익잉여금 <span class="t-muted" style="font-size:11px">(자동)</span>`, auto(retained))}
        ${sum("자본총계", totalEq)}
      </tbody></table>
    </div>
  </div>
  <div class="edit-hint" style="margin-top:14px;background:#f6ffed;border-color:#b7eb8f;color:#237804">✔ 자산총계 ${won(totalAsset)} = 부채+자본 ${won(totalLiab + totalEq)} · 대차평형 자동 일치</div>`;
}

function glLedgerView() {
  const debitSum = DB.glLedger.reduce((s, g) => s + (+g.debit || 0), 0);
  const creditSum = DB.glLedger.reduce((s, g) => s + (+g.credit || 0), 0);
  const accounts = ["보통예금", "현금", "외상매출금", "외상매입금", "미수금", "미지급금", "제품매출", "원재료", "급여", "지급임차료", "세금과공과", "복리후생비", "지급수수료", "기타"];
  const rows = DB.glLedger.map(g => `
    <tr>
      <td>${textInput("glLedger", "id", g.id, "date", g.date, { w: 104 })}</td>
      <td>${optSelect("glLedger", "id", g.id, "account", g.account || accounts[0], accounts)}</td>
      <td>${textInput("glLedger", "id", g.id, "desc", g.desc, { w: 220, ph: "적요" })}</td>
      <td class="num">${numInput("glLedger", "id", g.id, "debit", g.debit, { w: 116 })}</td>
      <td class="num">${numInput("glLedger", "id", g.id, "credit", g.credit, { w: 116 })}</td>
      <td>${delBtn("glLedger", "id", g.id)}</td>
    </tr>`).join("");
  return `
  <div class="grid g-4">
    <div class="card kpi"><div class="kpi-label">총 전표</div><div class="kpi-val">${DB.glLedger.length}<span class="unit">건</span></div></div>
    <div class="card kpi"><div class="kpi-label">차변 합계</div><div class="kpi-val" style="font-size:20px">${won(debitSum)}</div></div>
    <div class="card kpi"><div class="kpi-label">대변 합계</div><div class="kpi-val" style="font-size:20px">${won(creditSum)}</div></div>
    <div class="card kpi"><div class="kpi-label">대차 차액</div><div class="kpi-val" style="color:${debitSum === creditSum ? "var(--ok)" : "var(--danger)"}">${won(debitSum - creditSum)}</div></div>
  </div>
  <div class="card fade" style="margin-top:18px">
    <div class="card-h"><h3>총계정원장</h3><button class="btn-addrow" data-action="gl-add">＋ 전표 추가</button></div>
    <div style="padding:12px 18px 0"><div class="edit-hint" style="margin:0">✎ 일자·계정과목·적요·차변·대변을 직접 입력하고 행 추가/삭제할 수 있습니다.</div></div>
    <table class="tbl">
      <thead><tr><th>일자</th><th>계정과목</th><th>적요</th><th class="num">차변</th><th class="num">대변</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

Views.finance = () => subnav("finance", [["손익계산서", "손익계산서"], ["재무상태표", "재무상태표"], ["총계정원장", "총계정원장"]]) +
  (SUB.finance === "손익계산서" ? incomeStatementView()
    : SUB.finance === "재무상태표" ? balanceSheetView()
    : glLedgerView());

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
  { group: "정산/재무" },
  { id: "settlement", name: "정산관리",     ic: "💳", title: "정산관리",       sub: "미수금 · 거래명세서 · 세금계산서 · 입출금" },
  { id: "finance",    name: "재무회계",     ic: "📒", title: "재무회계 (FI)",  sub: "매출채권 · 매입채무 · 총계정원장 · 결산 및 재무제표" },
];

const $$all = (s) => Array.from(document.querySelectorAll(s));

function buildNav() {
  $("#nav").innerHTML = NAV.filter(n => !n.group).map(n =>
    `<a data-route="${n.id}"><span class="ic">${n.ic}</span>${n.name}</a>`).join("");
  $("#nav").addEventListener("click", e => {
    const a = e.target.closest("a[data-route]");
    if (a) go(a.dataset.route);
  });
  // 모바일 햄버거 메뉴 버튼
  const right = document.querySelector(".bar-right");
  if (right && !document.getElementById("navToggle")) {
    const btn = document.createElement("button");
    btn.id = "navToggle"; btn.type = "button"; btn.className = "nav-toggle"; btn.setAttribute("aria-label", "메뉴");
    btn.textContent = "☰";
    btn.addEventListener("click", () => document.getElementById("nav").classList.toggle("open"));
    right.insertBefore(btn, right.firstChild);
  }
}

function go(route, keep) {
  CURRENT = route;
  const meta = NAV.find(n => n.id === route) || NAV.find(n => n.id === "dashboard");
  $$all(".tabs a[data-route]").forEach(a => a.classList.toggle("active", a.dataset.route === route));
  const editBtn = `<button class="edit-mode-btn ${EDIT_MODE ? "on" : ""}" data-action="edit-mode-toggle">${EDIT_MODE ? "✓ 수정 완료" : "✎ 수정"}</button>`;
  const head = `<div class="page-head fade"><div><h1>${meta.title}</h1><p>${meta.sub}</p></div>${editBtn}</div>
    ${EDIT_MODE ? `<div class="edit-hint" style="background:#fff7e6;border-color:#ffd591;color:#a8590a">✎ <b>수정 모드</b>입니다. 표·항목을 직접 고치고 행 추가/삭제할 수 있어요. 다 고쳤으면 우측 상단 <b>「수정 완료」</b>를 누르세요.</div>` : ""}`;
  const c = $("#content");
  c.classList.toggle("viewmode", !EDIT_MODE);
  c.innerHTML = head + (Views[route] || Views.dashboard)();
  const nv = $("#nav"); if (nv) nv.classList.remove("open");  // 모바일 메뉴 닫기
  if (!keep) window.scrollTo(0, 0);
}

/* 초기화 */
function init() {
  const set = (sel, fn) => { const el = $(sel); if (el) fn(el); };
  set("#brandName", el => el.innerHTML = `${DB.meta.company}<span> ${DB.meta.companyEn}</span>`);
  set("#brandSub", el => el.textContent = "스마트팩토리 ERP");
  set("#dateChip", el => el.textContent = "기준일 " + DB.meta.baseDate);
  set("#userName", el => el.textContent = DB.meta.ceo + " 대표");
  set("#userRole", el => el.textContent = DB.meta.company);
  set("#avatar", el => el.textContent = DB.meta.ceo.charAt(0));
  buildNav();
  bindEvents();
  go("dashboard");
}
document.addEventListener("DOMContentLoaded", init);
