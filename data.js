/* =====================================================================
 * 하이큐테크(HIQ TECH) ERP - 데모 데이터 (data.js)
 * 자동차/전자 전장(WIRE) 부품 & 파워코드(POWER CORD) 제조 기준
 * 모든 수치는 베타 데모 데이터이며 실제 거래와 무관합니다.
 * ===================================================================== */

const DB = {
  meta: {
    company: "하이큐테크",
    companyEn: "HIQ TECH",
    biznum: "000-00-00000",
    ceo: "이영민",
    founded: "2024-10-01",
    industry: "자동차·전자 전장(WIRE) 부품 & 파워코드(POWER CORD)",
    addr: "경기도 군포시 당산로148번안길 48, 1층 102호 (제1공장)",
    baseDate: "2026-06-13",
    slogan: "품질의 멋쟁이! · 높은 품질, 혁신적, 도약하는 2026",
    cert: "ISO 9001",
    // 인원 현황
    emp: { mgmt: 3, prod: 13, total: 16, note: "관리직 3명(품질1·생산2) / 생산직 13명(현장3·외주10)" },
    // 경영 목표 (백만원 / 천EA)
    goal: { salesTarget: 2000, prodTargetK: 6000, monthlyTargetK: 500 },
    // 품질 목표 (%)
    quality: { rate2025: 0.011, target2026: 0.0005, prod2025K: 4500, defect2025: 480 },
  },

  /* ---------------------- 거래처 (고객사 + 매입처) ---------------------- */
  partners: [
    { code: "C001", name: "경신",            type: "고객사", contact: "이정훈 책임", tel: "053-589-1xxx", grade: "A", credit: 200000000, balance: 38400000 },
    { code: "C002", name: "유라코퍼레이션",  type: "고객사", contact: "박서연 선임", tel: "041-339-2xxx", grade: "A", credit: 180000000, balance: 31200000 },
    { code: "C003", name: "LS오토모티브",    type: "고객사", contact: "정우성 책임", tel: "043-260-3xxx", grade: "B", credit: 150000000, balance: 24800000 },
    { code: "C004", name: "위니아",          type: "고객사", contact: "최민지 매니저", tel: "055-608-4xxx", grade: "B", credit: 120000000, balance: 17600000 },
    { code: "C005", name: "삼보모터스",      type: "고객사", contact: "강동원 팀장", tel: "041-589-5xxx", grade: "B", credit: 100000000, balance: 12400000 },
    { code: "C006", name: "대유플러스",      type: "고객사", contact: "한지민 선임", tel: "031-689-6xxx", grade: "C", credit: 80000000,  balance: 8900000  },
    { code: "V001", name: "협진전선",        type: "매입처", contact: "오세훈 과장", tel: "032-818-7xxx", grade: "A", credit: 0, balance: -21300000 },
    { code: "V002", name: "케이비전선",      type: "매입처", contact: "신유나 대리", tel: "031-499-8xxx", grade: "B", credit: 0, balance: -9800000  },
    { code: "V003", name: "대성터미널",      type: "매입처", contact: "임재현 차장", tel: "031-355-9xxx", grade: "A", credit: 0, balance: -13600000 },
    { code: "V004", name: "JST커넥터코리아", type: "매입처", contact: "윤보라 과장", tel: "02-2025-1xxx", grade: "A", credit: 0, balance: -7200000  },
  ],

  /* ---------------------- 품목 마스터 ----------------------
   * cat: 완제품 / 반제품 / 원자재,  unit: EA / M(미터) / R(릴)
   */
  items: [
    // 완제품
    { code: "FG-PWR-110", name: "파워코드 ASSY (KC 16A)",       cat: "완제품", unit: "EA", price: 1250, safety: 3000 },
    { code: "FG-PWR-220", name: "파워코드 ASSY (PSE 7A)",       cat: "완제품", unit: "EA", price: 980,  safety: 4000 },
    { code: "FG-APH-310", name: "가전 전원 하네스 ASSY",        cat: "완제품", unit: "EA", price: 640,  safety: 6000 },
    { code: "FG-CWH-420", name: "자동차 전장 와이어 ASSY",      cat: "완제품", unit: "EA", price: 420,  safety: 8000 },
    { code: "FG-LED-530", name: "LED 모듈 커넥터 하네스",       cat: "완제품", unit: "EA", price: 360,  safety: 10000 },
    { code: "FG-SEN-640", name: "센서 점퍼 와이어 ASSY",        cat: "완제품", unit: "EA", price: 175,  safety: 20000 },
    // 반제품
    { code: "SF-SUB-021", name: "전선 압착 서브 ASSY",          cat: "반제품", unit: "EA", price: 120,  safety: 15000 },
    { code: "SF-SUB-044", name: "커넥터 결선 서브 ASSY",        cat: "반제품", unit: "EA", price: 95,   safety: 12000 },
    // 원자재 - 전선
    { code: "RM-WIRE-PV", name: "PVC 전선 0.75sq",             cat: "원자재", unit: "M",  price: 45,   safety: 60000 },
    { code: "RM-WIRE-05", name: "AVSS 전선 0.5sq (흑)",        cat: "원자재", unit: "M",  price: 38,   safety: 50000 },
    { code: "RM-WIRE-20", name: "AVSS 전선 2.0sq (청)",        cat: "원자재", unit: "M",  price: 96,   safety: 15000 },
    // 원자재 - 플러그/터미널/커넥터/부자재
    { code: "RM-PLUG-16", name: "KC 16A 전원 플러그",          cat: "원자재", unit: "EA", price: 320,  safety: 8000 },
    { code: "RM-PLUG-07", name: "PSE 7A 전원 플러그",          cat: "원자재", unit: "EA", price: 260,  safety: 8000 },
    { code: "RM-TERM-A1", name: "F단자 터미널 250형",          cat: "원자재", unit: "EA", price: 14,   safety: 100000 },
    { code: "RM-TERM-B2", name: "F단자 터미널 090형",          cat: "원자재", unit: "EA", price: 11,   safety: 200000 },
    { code: "RM-CONN-J6", name: "JST 6핀 커넥터 하우징",        cat: "원자재", unit: "EA", price: 180,  safety: 25000 },
    { code: "RM-CONN-J8", name: "JST 8핀 커넥터 하우징",        cat: "원자재", unit: "EA", price: 240,  safety: 20000 },
    { code: "RM-TUBE-07", name: "콜게이트 튜브 7파이",          cat: "원자재", unit: "M",  price: 65,   safety: 10000 },
    { code: "RM-TAPE-19", name: "융착 테이프 19mm",            cat: "원자재", unit: "R",  price: 1200, safety: 3000 },
  ],

  /* ---------------------- BOM (완제품 -> 구성 원자재) ---------------------- */
  boms: [
    { parent: "FG-PWR-110", parentName: "파워코드 ASSY (KC 16A)", comps: [
      { code: "RM-WIRE-PV", name: "PVC 전선 0.75sq",   qty: 1.8,  unit: "M" },
      { code: "RM-PLUG-16", name: "KC 16A 전원 플러그", qty: 1,    unit: "EA" },
      { code: "RM-TERM-A1", name: "F단자 터미널 250형", qty: 2,    unit: "EA" },
      { code: "RM-TUBE-07", name: "콜게이트 튜브 7파이", qty: 0.3,  unit: "M" },
      { code: "RM-TAPE-19", name: "융착 테이프 19mm",   qty: 0.02, unit: "R" },
    ]},
    { parent: "FG-PWR-220", parentName: "파워코드 ASSY (PSE 7A)", comps: [
      { code: "RM-WIRE-PV", name: "PVC 전선 0.75sq",   qty: 1.5,  unit: "M" },
      { code: "RM-PLUG-07", name: "PSE 7A 전원 플러그", qty: 1,    unit: "EA" },
      { code: "RM-TERM-B2", name: "F단자 터미널 090형", qty: 2,    unit: "EA" },
      { code: "RM-TAPE-19", name: "융착 테이프 19mm",   qty: 0.015,unit: "R" },
    ]},
    { parent: "FG-APH-310", parentName: "가전 전원 하네스 ASSY", comps: [
      { code: "RM-WIRE-PV", name: "PVC 전선 0.75sq",   qty: 1.2,  unit: "M" },
      { code: "RM-TERM-A1", name: "F단자 터미널 250형", qty: 3,    unit: "EA" },
      { code: "RM-CONN-J6", name: "JST 6핀 커넥터 하우징", qty: 1, unit: "EA" },
      { code: "RM-TAPE-19", name: "융착 테이프 19mm",   qty: 0.01, unit: "R" },
    ]},
    { parent: "FG-CWH-420", parentName: "자동차 전장 와이어 ASSY", comps: [
      { code: "RM-WIRE-05", name: "AVSS 전선 0.5sq (흑)", qty: 2.5, unit: "M" },
      { code: "RM-TERM-B2", name: "F단자 터미널 090형",   qty: 6,   unit: "EA" },
      { code: "RM-TUBE-07", name: "콜게이트 튜브 7파이",   qty: 0.2, unit: "M" },
    ]},
    { parent: "FG-LED-530", parentName: "LED 모듈 커넥터 하네스", comps: [
      { code: "RM-WIRE-05", name: "AVSS 전선 0.5sq (흑)", qty: 0.8, unit: "M" },
      { code: "RM-TERM-B2", name: "F단자 터미널 090형",   qty: 2,   unit: "EA" },
      { code: "RM-CONN-J6", name: "JST 6핀 커넥터 하우징", qty: 1,  unit: "EA" },
    ]},
    { parent: "FG-SEN-640", parentName: "센서 점퍼 와이어 ASSY", comps: [
      { code: "RM-WIRE-05", name: "AVSS 전선 0.5sq (흑)", qty: 0.4, unit: "M" },
      { code: "RM-TERM-B2", name: "F단자 터미널 090형",   qty: 2,   unit: "EA" },
      { code: "RM-TUBE-07", name: "콜게이트 튜브 7파이",   qty: 0.1, unit: "M" },
    ]},
  ],

  /* ---------------------- 수주 (고객 주문) ---------------------- */
  orders: [
    { no: "SO-2606-018", date: "2026-06-11", cust: "경신",           item: "FG-PWR-110", itemName: "파워코드 ASSY (KC 16A)",   qty: 18000, done: 8200,  due: "2026-06-20", status: "진행" },
    { no: "SO-2606-017", date: "2026-06-10", cust: "위니아",         item: "FG-APH-310", itemName: "가전 전원 하네스 ASSY",    qty: 32000, done: 12400, due: "2026-06-24", status: "진행" },
    { no: "SO-2606-015", date: "2026-06-09", cust: "유라코퍼레이션", item: "FG-PWR-220", itemName: "파워코드 ASSY (PSE 7A)",   qty: 25000, done: 25000, due: "2026-06-15", status: "완료" },
    { no: "SO-2606-014", date: "2026-06-08", cust: "LS오토모티브",   item: "FG-LED-530", itemName: "LED 모듈 커넥터 하네스",   qty: 60000, done: 28500, due: "2026-06-18", status: "진행" },
    { no: "SO-2606-012", date: "2026-06-05", cust: "대유플러스",     item: "FG-SEN-640", itemName: "센서 점퍼 와이어 ASSY",    qty: 80000, done: 41000, due: "2026-06-12", status: "지연" },
    { no: "SO-2606-010", date: "2026-06-04", cust: "경신",           item: "FG-PWR-110", itemName: "파워코드 ASSY (KC 16A)",   qty: 15000, done: 15000, due: "2026-06-10", status: "완료" },
    { no: "SO-2606-008", date: "2026-06-03", cust: "삼보모터스",     item: "FG-CWH-420", itemName: "자동차 전장 와이어 ASSY",  qty: 38000, done: 38000, due: "2026-06-09", status: "완료" },
    { no: "SO-2606-006", date: "2026-06-02", cust: "유라코퍼레이션", item: "FG-CWH-420", itemName: "자동차 전장 와이어 ASSY",  qty: 45000, done: 9000,  due: "2026-06-26", status: "진행" },
    { no: "SO-2605-041", date: "2026-05-29", cust: "위니아",         item: "FG-LED-530", itemName: "LED 모듈 커넥터 하네스",   qty: 90000, done: 90000, due: "2026-06-08", status: "완료" },
    { no: "SO-2605-038", date: "2026-05-27", cust: "LS오토모티브",   item: "FG-PWR-110", itemName: "파워코드 ASSY (KC 16A)",   qty: 22000, done: 22000, due: "2026-06-05", status: "완료" },
  ],

  /* ---------------------- 작업지시 (생산) ----------------------
   * defect = 공정 검출 불량(EA), status: 대기/가공/압착/조립/검사/완료
   */
  workorders: [
    { wo: "WO-2606-052", so: "SO-2606-018", item: "FG-PWR-110", itemName: "파워코드 ASSY (KC 16A)",   plan: 18000, prod: 8200,  defect: 2, line: "조립 1라인", status: "조립",  start: "2026-06-12", worker: "현장 A조" },
    { wo: "WO-2606-051", so: "SO-2606-017", item: "FG-APH-310", itemName: "가전 전원 하네스 ASSY",    plan: 32000, prod: 12400, defect: 3, line: "조립 2라인", status: "절단",  start: "2026-06-12", worker: "외주 1조" },
    { wo: "WO-2606-049", so: "SO-2606-014", item: "FG-LED-530", itemName: "LED 모듈 커넥터 하네스",   plan: 60000, prod: 28500, defect: 3, line: "압착 1라인", status: "압착",  start: "2026-06-11", worker: "현장 B조" },
    { wo: "WO-2606-047", so: "SO-2606-012", item: "FG-SEN-640", itemName: "센서 점퍼 와이어 ASSY",    plan: 80000, prod: 41000, defect: 4, line: "압착 2라인", status: "검사",  start: "2026-06-10", worker: "외주 2조" },
    { wo: "WO-2606-045", so: "SO-2606-006", item: "FG-CWH-420", itemName: "자동차 전장 와이어 ASSY",  plan: 45000, prod: 9000,  defect: 0, line: "조립 2라인", status: "대기",  start: "2026-06-13", worker: "외주 1조" },
    { wo: "WO-2606-040", so: "SO-2606-015", item: "FG-PWR-220", itemName: "파워코드 ASSY (PSE 7A)",   plan: 25000, prod: 25000, defect: 2, line: "조립 1라인", status: "완료",  start: "2026-06-09", worker: "현장 A조" },
    { wo: "WO-2606-033", so: "SO-2606-010", item: "FG-PWR-110", itemName: "파워코드 ASSY (KC 16A)",   plan: 15000, prod: 15000, defect: 1, line: "조립 2라인", status: "완료",  start: "2026-06-04", worker: "현장 B조" },
    { wo: "WO-2606-028", so: "SO-2606-008", item: "FG-CWH-420", itemName: "자동차 전장 와이어 ASSY",  plan: 38000, prod: 38000, defect: 3, line: "압착 1라인", status: "완료",  start: "2026-06-03", worker: "외주 2조" },
  ],

  /* ---------------------- 재고 ---------------------- */
  stock: [
    { code: "FG-PWR-110", qty: 6200,   loc: "완제품 A-01" },
    { code: "FG-PWR-220", qty: 8400,   loc: "완제품 A-02" },
    { code: "FG-APH-310", qty: 11200,  loc: "완제품 A-03" },
    { code: "FG-CWH-420", qty: 4800,   loc: "완제품 B-01" },
    { code: "FG-LED-530", qty: 22000,  loc: "완제품 B-02" },
    { code: "FG-SEN-640", qty: 31000,  loc: "완제품 B-03" },
    { code: "SF-SUB-021", qty: 18400,  loc: "반제품 C-01" },
    { code: "SF-SUB-044", qty: 13600,  loc: "반제품 C-02" },
    { code: "RM-WIRE-PV", qty: 84000,  loc: "원자재 D-01" },
    { code: "RM-WIRE-05", qty: 38400,  loc: "원자재 D-02" },
    { code: "RM-WIRE-20", qty: 24800,  loc: "원자재 D-03" },
    { code: "RM-PLUG-16", qty: 9800,   loc: "원자재 E-01" },
    { code: "RM-PLUG-07", qty: 6200,   loc: "원자재 E-02" },
    { code: "RM-TERM-A1", qty: 154000, loc: "원자재 F-01" },
    { code: "RM-TERM-B2", qty: 312000, loc: "원자재 F-02" },
    { code: "RM-CONN-J6", qty: 41200,  loc: "원자재 G-01" },
    { code: "RM-CONN-J8", qty: 18600,  loc: "원자재 G-02" },
    { code: "RM-TUBE-07", qty: 14200,  loc: "원자재 H-01" },
    { code: "RM-TAPE-19", qty: 2150,   loc: "원자재 H-02" },
  ],

  /* ---------------------- 설비 현황 ----------------------
   * grp: 제조설비 / 계측기, status: 정상 / 점검필요 / 노후
   * (제작년도 2007년 이전 = 노후/교체검토, 계측기는 교정주기 관리)
   */
  equipment: [
    { mgmt: "ACP-02", grp: "제조설비", name: "자동 절단압착기", spec: "KM-104MP", maker: "KMD지텍",  year: "2008.02", status: "정상" },
    { mgmt: "ACP-03", grp: "제조설비", name: "자동 절단압착기", spec: "SONA-600", maker: "두성",     year: "2019.03", status: "정상" },
    { mgmt: "AC-01",  grp: "제조설비", name: "반자동 씰 압착기", spec: "KM-SS101", maker: "KMD지텍",  year: "2019.03", status: "정상" },
    { mgmt: "AC-02",  grp: "제조설비", name: "자동 전선절단기", spec: "KM-105MP", maker: "KMD지텍",  year: "2002.08", status: "노후" },
    { mgmt: "AC-03",  grp: "제조설비", name: "자동 전선절단기", spec: "KM-106MP", maker: "KMD지텍",  year: "2002.08", status: "노후" },
    { mgmt: "TC-01",  grp: "제조설비", name: "튜브 절단기",     spec: "KM-107MP", maker: "두성",     year: "2015.04", status: "정상" },
    { mgmt: "AP-01",  grp: "제조설비", name: "수동 압착기",     spec: "KM-108MP", maker: "두리정밀", year: "1999.02", status: "노후" },
    { mgmt: "AP-02",  grp: "제조설비", name: "수동 압착기",     spec: "KM-109MP", maker: "두리정밀", year: "1999.02", status: "노후" },
    { mgmt: "AP-03",  grp: "제조설비", name: "수동 압착기",     spec: "KM-110MP", maker: "두리정밀", year: "1999.02", status: "노후" },
    { mgmt: "AP-04",  grp: "제조설비", name: "수동 압착기",     spec: "KM-111MP", maker: "두리정밀", year: "1999.02", status: "노후" },
    { mgmt: "AP-05",  grp: "제조설비", name: "수동 압착기",     spec: "KM-112MP", maker: "두리정밀", year: "1999.02", status: "노후" },
    { mgmt: "AP-06",  grp: "제조설비", name: "수동 압착기",     spec: "KM-113MP", maker: "상아정밀", year: "2000.02", status: "노후" },
    { mgmt: "AP-07",  grp: "제조설비", name: "수동 압착기",     spec: "KM-114MP", maker: "상아정밀", year: "2000.02", status: "노후" },
    { mgmt: "AP-08",  grp: "제조설비", name: "수동 압착기",     spec: "KM-115MP", maker: "지영정밀", year: "2005.11", status: "노후" },
    { mgmt: "CP-02",  grp: "제조설비", name: "콤프레셔",       spec: "KM-116MP", maker: "한신",     year: "2006.02", status: "노후" },
    { mgmt: "SS-A-01", grp: "계측기", name: "MULTI TESTER",  spec: "501060",   maker: "-",        year: "2000.01", status: "점검필요", calib: "2026-07-15" },
    { mgmt: "SS-A-06", grp: "계측기", name: "고정식 확대경",  spec: "KM-108MP", maker: "-",        year: "2018.09", status: "정상",     calib: "2026-09-01" },
    { mgmt: "SS-A-10", grp: "계측기", name: "인장력 테스터",  spec: "-",        maker: "-",        year: "2013.12", status: "정상",     calib: "2026-08-20" },
    { mgmt: "SS-A-11", grp: "계측기", name: "온·습도계",      spec: "-",        maker: "-",        year: "2021.12", status: "정상",     calib: "2026-12-01" },
  ],

  /* ---------------------- 품질: 출하검사 (전수검사) ---------------------- */
  shipInspect: [
    { date: "2026-06-12", cust: "유라코퍼레이션", item: "파워코드 ASSY (PSE 7A)",  lot: "L260612-A", qty: 25000, fail: 2 },
    { date: "2026-06-11", cust: "LS오토모티브",   item: "LED 모듈 커넥터 하네스",  lot: "L260611-B", qty: 28500, fail: 3 },
    { date: "2026-06-10", cust: "경신",           item: "파워코드 ASSY (KC 16A)",  lot: "L260610-C", qty: 15000, fail: 1 },
    { date: "2026-06-09", cust: "삼보모터스",     item: "자동차 전장 와이어 ASSY", lot: "L260609-D", qty: 38000, fail: 3 },
    { date: "2026-06-08", cust: "위니아",         item: "LED 모듈 커넥터 하네스",  lot: "L260608-E", qty: 90000, fail: 4 },
  ],

  /* ---------------------- 품질: 공정감사 (Line Audit Check Sheet) ---------------------- */
  lineAudit: [
    { line: "조립 1라인", date: "2026-06-11", score: 98, auditor: "품질팀" },
    { line: "조립 2라인", date: "2026-06-11", score: 92, auditor: "품질팀" },
    { line: "압착 1라인", date: "2026-06-12", score: 96, auditor: "품질팀" },
    { line: "압착 2라인", date: "2026-06-12", score: 94, auditor: "품질팀" },
  ],

  /* ---------------------- 품질: 고객불만 대응 (1시간 내 대응 목표) ---------------------- */
  complaints: [
    { no: "CS-2606-03", date: "2026-06-09", cust: "경신",         content: "커넥터 삽입 불량 1건 혼입", respMin: 25, status: "완료" },
    { no: "CS-2606-02", date: "2026-06-05", cust: "LS오토모티브", content: "라벨 표기 오류",            respMin: 40, status: "완료" },
    { no: "CS-2606-01", date: "2026-06-02", cust: "위니아",       content: "포장 수량 상이",            respMin: 15, status: "완료" },
  ],

  /* ---------------------- 월별 매출 추이 (백만원) / 목표선 ---------------------- */
  monthlySales: [
    { m: "2025-12", sales: 138, target: 150 },
    { m: "2026-01", sales: 132, target: 160 },
    { m: "2026-02", sales: 149, target: 165 },
    { m: "2026-03", sales: 161, target: 167 },
    { m: "2026-04", sales: 170, target: 170 },
    { m: "2026-05", sales: 184, target: 175 },
    { m: "2026-06", sales: 92,  target: 180 }, // 진행중(월중)
  ],

  /* ---------------------- 일별 생산 실적 (최근 8일, 수량 EA) ---------------------- */
  dailyProd: [
    { d: "06-04", plan: 22000, prod: 21850 },
    { d: "06-05", plan: 23000, prod: 22760 },
    { d: "06-08", plan: 22500, prod: 22310 },
    { d: "06-09", plan: 23500, prod: 23180 },
    { d: "06-10", plan: 24000, prod: 23420 },
    { d: "06-11", plan: 24000, prod: 23880 },
    { d: "06-12", plan: 24500, prod: 24210 },
    { d: "06-13", plan: 12000, prod: 5400 }, // 진행중(당일)
  ],

  /* ---------------------- 불량 유형 분포 (당월, 출하 기준 합계와 정합) ---------------------- */
  defectTypes: [
    { type: "압착불량",   count: 4 },
    { type: "결선오류",   count: 3 },
    { type: "커넥터삽입", count: 3 },
    { type: "외관손상",   count: 2 },
    { type: "치수불량",   count: 1 },
  ],

  /* ---------------------- 견적서 (Quotation) ---------------------- */
  quotes: [
    { no: "Q-2026-0612", date: "2026-06-12", cust: "경신",           manager: "이영민", amount: 67402500,  status: "발송" },
    { no: "Q-2026-0608", date: "2026-06-08", cust: "유라코퍼레이션", manager: "이영민", amount: 28930000,  status: "수주확정" },
    { no: "Q-2026-0602", date: "2026-06-02", cust: "LS오토모티브",   manager: "이영민", amount: 19360000,  status: "검토중" },
    { no: "Q-2026-0528", date: "2026-05-28", cust: "위니아",         manager: "이영민", amount: 41250000,  status: "수주확정" },
  ],

  // 대표 견적서 1건 상세 (Q-2026-0612)
  quoteDetail: {
    no: "Q-2026-0612",
    date: "2026-06-12",
    manager: "이영민",
    validDays: 30,
    supplier: { name: "하이큐테크 (HIQ TECH)", biz: "000-00-00000", ceo: "이영민",
      email: "sales@hiqtech.co.kr", addr: "경기도 군포시 당산로148번안길 48, 1층 102호" },
    client: { name: "경신", biz: "-", ceo: "-",
      email: "purchase@kyungshin.co.kr", addr: "대구광역시 달서구" },
    group: "와이어 하네스 / 파워코드 납품",
    items: [
      { title: "파워코드 ASSY (KC 16A)",      desc: "PVC 0.75sq · KC 16A 플러그 · 출하 전수검사",      price: 1250,    qty: 18000, unit: "EA" },
      { title: "LED 모듈 커넥터 하네스",       desc: "AVSS 0.5sq · JST 6핀 · LOT 품질관리",            price: 360,     qty: 60000, unit: "EA" },
      { title: "자동차 전장 와이어 ASSY",      desc: "AVSS 0.5sq · 터미널 090형 6P · 공정감사 적용",     price: 420,     qty: 45000, unit: "EA" },
      { title: "신규 LOT 초도 셋업비",         desc: "검사지그 제작 및 초도양산 셋업 (1회성)",          price: 1500000, qty: 1,     unit: "식" },
    ],
    discountRate: 5, // %
    vat: true,
  },

  /* ---------------------- 정산: 당월 요약 (원) ---------------------- */
  settle: {
    sales: 150000000,    // 당월 매출(공급가)
    expense: 128000000,  // 당월 지출(공급가)
    bankBalance: 84500000, // 현재 계좌 총잔액
    // 순이익 = sales - expense (뷰에서 계산)
  },

  /* ---------------------- 은행 입출금내역 (계좌 연동) ----------------------
   * type: 입금 / 출금,  matched: 정산 매칭 여부
   * ※ 일부 입금액은 미수금(receivables) 금액과 일치 -> 자동 정산추천 작동
   */
  bankTx: [
    { id: "TX01", dt: "2026-06-12 14:53", bank: "기업은행", acct: "043-123456-01-011", partner: "유라코퍼레이션", type: "입금", amount: 24500000, matched: false },
    { id: "TX02", dt: "2026-06-11 10:37", bank: "기업은행", acct: "043-123456-01-011", partner: "협진전선",       type: "출금", amount: 14080000, matched: true },
    { id: "TX03", dt: "2026-06-10 09:34", bank: "기업은행", acct: "043-123456-01-011", partner: "경신",           type: "입금", amount: 18750000, matched: false },
    { id: "TX04", dt: "2026-06-09 13:22", bank: "기업은행", acct: "043-123456-01-011", partner: "JST커넥터코리아", type: "출금", amount: 7040000,  matched: true },
    { id: "TX05", dt: "2026-06-08 09:15", bank: "기업은행", acct: "043-123456-01-011", partner: "대성터미널",     type: "출금", amount: 5720000,  matched: true },
    { id: "TX06", dt: "2026-06-05 18:00", bank: "기업은행", acct: "043-123456-01-011", partner: "급여(생산직)",   type: "출금", amount: 32400000, matched: true },
    { id: "TX07", dt: "2026-06-05 11:20", bank: "기업은행", acct: "043-123456-01-011", partner: "대유플러스",     type: "입금", amount: 8900000,  matched: false },
    { id: "TX08", dt: "2026-06-03 16:10", bank: "기업은행", acct: "043-123456-01-011", partner: "위니아",         type: "입금", amount: 11200000, matched: false },
    { id: "TX09", dt: "2026-06-02 10:00", bank: "기업은행", acct: "043-123456-01-011", partner: "공장 임차료",    type: "출금", amount: 4500000,  matched: true },
    { id: "TX10", dt: "2026-06-01 11:30", bank: "기업은행", acct: "043-123456-01-011", partner: "4대보험·세금",   type: "출금", amount: 6800000,  matched: true },
  ],

  /* ---------------------- 미수금(매출채권) 현황 ----------------------
   * status: 예정 / 미수 / 연체 / 완료,  due: 입금기한
   */
  receivables: [
    { no: "AR-2606-02", cust: "유라코퍼레이션", so: "SO-2606-015", item: "파워코드 ASSY (PSE 7A)",  amount: 24500000, issued: "2026-05-15", due: "2026-06-14", status: "미수" },
    { no: "AR-2606-01", cust: "경신",           so: "SO-2606-010", item: "파워코드 ASSY (KC 16A)",  amount: 18750000, issued: "2026-05-20", due: "2026-06-19", status: "미수" },
    { no: "AR-2605-08", cust: "LS오토모티브",   so: "SO-2605-038", item: "파워코드 ASSY (KC 16A)",  amount: 24800000, issued: "2026-04-30", due: "2026-05-30", status: "연체" },
    { no: "AR-2605-05", cust: "삼보모터스",     so: "SO-2606-008", item: "자동차 전장 와이어 ASSY", amount: 15960000, issued: "2026-05-25", due: "2026-06-24", status: "예정" },
    { no: "AR-2605-02", cust: "대유플러스",     so: "SO-2606-012", item: "센서 점퍼 와이어 ASSY",   amount: 8900000,  issued: "2026-05-10", due: "2026-05-25", status: "연체" },
    { no: "AR-2606-03", cust: "위니아",         so: "SO-2606-017", item: "가전 전원 하네스 ASSY",   amount: 17600000, issued: "2026-06-01", due: "2026-07-01", status: "예정" },
    { no: "AR-2604-11", cust: "경신",           so: "SO-2604-022", item: "파워코드 ASSY (KC 16A)",  amount: 21300000, issued: "2026-04-12", due: "2026-05-12", status: "완료" },
  ],

  /* ---------------------- 세금계산서 (홈택스 연동 예정) ----------------------
   * type: 매출 / 매입,  status: 발행 / 수취 / 미발행
   * ▶ 홈택스 매입·매출 세금계산서 자료를 첨부하면 이 목록을 자동 정리합니다.
   */
  taxInvoices: [
    { date: "2026-06-10", type: "매출", partner: "경신",           supply: 18750000, vat: 1875000, status: "발행" },
    { date: "2026-06-09", type: "매출", partner: "유라코퍼레이션", supply: 24500000, vat: 2450000, status: "발행" },
    { date: "2026-06-08", type: "매입", partner: "협진전선",       supply: 12800000, vat: 1280000, status: "수취" },
    { date: "2026-06-05", type: "매입", partner: "JST커넥터코리아", supply: 6400000,  vat: 640000,  status: "수취" },
    { date: "2026-06-03", type: "매출", partner: "LS오토모티브",   supply: 19360000, vat: 1936000, status: "발행" },
    { date: "2026-06-02", type: "매입", partner: "대성터미널",     supply: 5200000,  vat: 520000,  status: "수취" },
  ],
};
