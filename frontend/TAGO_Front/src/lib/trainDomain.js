// 열차 도메인 계산 도우미 (화면과 분리된 순수 함수 위주)
// 근거: 이 서비스 API 가 실제로 주는 값(노선, 잔여석, 예매 오픈 시각, 호차별 잔여석, 좌석 번호)만 사용한다.

export const LINE_NAMES = ['경부선', '호남선', '전라선', '경전선', '동해선'];
export const TOTAL_SEATS_DEFAULT = 935; // KTX 1편성(18량) 총 좌석 수 (백엔드 SeatTemplateGenerator 와 동일)

const pad = (n) => String(n).padStart(2, '0');
const toMs = (v) => {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
};

/* ---------- 시간 ---------- */
export function minutesUntil(ts, now = Date.now()) {
  const t = toMs(ts);
  return Number.isNaN(t) ? null : Math.round((t - now) / 60000);
}

/** 출발 3시간 안이면 "출발까지 1시간 20분", 20분 안이면 "곧 출발". 아니면 null */
export function departureHint(ts, now = Date.now()) {
  const m = minutesUntil(ts, now);
  if (m === null || m <= 0 || m > 180) return null;
  if (m <= 20) return { text: `곧 출발 · ${m}분 전`, tone: 'warn' };
  const h = Math.floor(m / 60);
  const r = m % 60;
  return { text: `출발까지 ${h ? `${h}시간 ` : ''}${r ? `${r}분` : ''}`.trim(), tone: 'info' };
}

/** 예매 오픈 전이면 { dDay, openAt, text }, 이미 열렸으면 null */
export function bookingOpenHint(openTs, now = Date.now()) {
  const t = toMs(openTs);
  if (Number.isNaN(t) || t <= now) return null;
  const d = new Date(t);
  const dDay = Math.max(1, Math.ceil((t - now) / 86400000));
  const openAt = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { dDay, openAt, text: `예매 오픈 D-${dDay} · ${openAt}` };
}

/* ---------- 혼잡도(실제 잔여석 비율) ---------- */
// 예측이 아니라 지금 남은 좌석 수 기준이다. filled 는 5칸 막대에서 채울 칸 수(많을수록 혼잡).
export function occupancy(available, total = TOTAL_SEATS_DEFAULT) {
  const a = Number(available ?? 0);
  const ratio = total > 0 ? a / total : 0;
  if (a <= 0) return { level: 'sold', label: '매진', filled: 5, remaining: 0 };
  if (a <= 30 || ratio <= 0.03) return { level: 'low', label: '마감 임박', filled: 4, remaining: a };
  if (ratio < 0.2) return { level: 'busy', label: '혼잡', filled: 3, remaining: a };
  if (ratio < 0.5) return { level: 'normal', label: '보통', filled: 2, remaining: a };
  return { level: 'ok', label: '여유', filled: 1, remaining: a };
}

/** 같은 날 같은 구간 안에서 예매 가능한 열차 중 소요시간이 가장 짧은 것에 '최단 시간' */
export function fastestTags(items) {
  const groups = new Map();
  for (const it of items) {
    const dep = toMs(it.depplandtime);
    const arr = toMs(it.arrplandtime);
    if (Number.isNaN(dep) || Number.isNaN(arr) || !((it.availableSeats ?? 0) > 0)) continue;
    const day = new Date(dep);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}|${it.depStationName ?? it.depplacename}|${it.arrStationName ?? it.arrplacename}`;
    const dur = arr - dep;
    const g = groups.get(key);
    if (!g || dur < g.dur) groups.set(key, { id: it.schedule_seq, dur });
  }
  // 한 그룹에 후보가 하나뿐이면 의미가 없으므로 2개 이상일 때만 표시
  const counts = new Map();
  for (const it of items) {
    const dep = toMs(it.depplandtime);
    if (Number.isNaN(dep) || !((it.availableSeats ?? 0) > 0)) continue;
    const day = new Date(dep);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}|${it.depStationName ?? it.depplacename}|${it.arrStationName ?? it.arrplacename}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = new Set();
  for (const [key, g] of groups) if ((counts.get(key) ?? 0) >= 2) out.add(g.id);
  return out; // Set<schedule_seq>
}

/** 이 열차 뒤에 출발하는, 예매 가능한 가장 가까운 같은 구간 열차 */
export function nextAvailable(items, current) {
  const dep = toMs(current.depplandtime);
  const dName = current.depStationName ?? current.depplacename;
  const aName = current.arrStationName ?? current.arrplacename;
  return (
    items
      .filter((it) => (it.depStationName ?? it.depplacename) === dName && (it.arrStationName ?? it.arrplacename) === aName)
      .filter((it) => toMs(it.depplandtime) > dep && (it.availableSeats ?? 0) > 0)
      .sort((x, y) => toMs(x.depplandtime) - toMs(y.depplandtime))[0] ?? null
  );
}

/* ---------- 날짜 빠른 선택 / 최근 구간 ---------- */
export function quickDates(now = new Date()) {
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const add = (n) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const list = [{ label: '오늘', value: fmt(add(0)) }, { label: '내일', value: fmt(add(1)) }];
  const toSat = ((6 - now.getDay() + 7) % 7) || 7; // 다음 토요일
  const sat = fmt(add(toSat));
  if (!list.some((x) => x.value === sat)) list.push({ label: '이번 주말', value: sat });
  return list;
}

const RECENT_KEY = 'tago.recentRoutes';
export function loadRecentRoutes() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((r) => r && r.dep && r.arr).slice(0, 5) : [];
  } catch { return []; }
}
export function saveRecentRoute(dep, arr) {
  if (!dep || !arr || dep === '전체' || arr === '전체') return;
  try {
    const next = [{ dep, arr }, ...loadRecentRoutes().filter((r) => !(r.dep === dep && r.arr === arr))].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* 저장 불가 환경에서는 조용히 건너뜀 */ }
}

/* ---------- 좌석 자동 배정 ---------- */
// 좌석 번호 형식: "{행}{열}" (예: 12A). 열 A·D 는 창가, B·C 는 통로, 통로를 사이에 두고 AB | CD.
export function parseSeat(no) {
  const m = /^(\d+)([A-D])$/.exec(String(no));
  return m ? { row: Number(m[1]), col: m[2] } : null;
}
const WINDOW = ['A', 'D'];
const AISLE = ['B', 'C'];
const BLOCKS = [['A', 'B'], ['C', 'D']];

/**
 * 현재 호차에서 count 석을 고른다. pref: 'any' | 'window' | 'aisle'
 * 반환: { seats: ['3A','3B'], together: boolean } | null (자리가 부족하면 null)
 * together = 모두 같은 행(최대 두 줄 이내)에 붙어 있음
 */
export function autoPickSeats({ seatNos, isAvailable, count, pref = 'any' }) {
  const rows = new Map();
  for (const no of seatNos) {
    const p = parseSeat(no);
    if (!p || !isAvailable(no)) continue;
    if (!rows.has(p.row)) rows.set(p.row, new Set());
    rows.get(p.row).add(p.col);
  }
  const free = (r, c) => rows.get(r)?.has(c) === true;
  const sortedRows = [...rows.keys()].sort((a, b) => a - b);
  const total = sortedRows.reduce((s, r) => s + rows.get(r).size, 0);
  if (count < 1 || total < count) return null;

  const prefCols = pref === 'window' ? WINDOW : pref === 'aisle' ? AISLE : ['A', 'B', 'C', 'D'];

  if (count === 1) {
    for (const r of sortedRows) for (const c of prefCols) if (free(r, c)) return { seats: [`${r}${c}`], together: true };
    // 선호 열이 모두 찼으면 아무 자리나
    for (const r of sortedRows) for (const c of ['A', 'B', 'C', 'D']) if (free(r, c)) return { seats: [`${r}${c}`], together: true };
    return null;
  }

  const pairs = [];
  for (const r of sortedRows) {
    for (const [x, y] of BLOCKS) {
      if (free(r, x) && free(r, y)) {
        const fits = pref === 'any' || prefCols.includes(x) || prefCols.includes(y);
        pairs.push({ row: r, cols: [x, y], rank: fits ? 0 : 1 });
      }
    }
  }

  if (count === 2) {
    pairs.sort((a, b) => a.rank - b.rank || a.row - b.row);
    if (pairs[0]) return { seats: pairs[0].cols.map((c) => `${pairs[0].row}${c}`), together: true };
  } else {
    // 3석 이상: 이웃한 두 줄 안에서 쌍을 이어 붙인다
    for (const start of sortedRows) {
      const near = pairs.filter((p) => p.row === start || p.row === start + 1).sort((a, b) => a.row - b.row);
      const seats = near.flatMap((p) => p.cols.map((c) => `${p.row}${c}`));
      if (seats.length >= count) return { seats: seats.slice(0, count), together: true };
    }
  }

  // 붙어 앉을 자리가 없으면 앞쪽부터 선호 열 순으로 흩어서라도 채운다
  const picked = [];
  for (const r of sortedRows) {
    for (const c of [...prefCols, ...['A', 'B', 'C', 'D'].filter((x) => !prefCols.includes(x))]) {
      if (free(r, c) && picked.length < count) picked.push(`${r}${c}`);
    }
  }
  return picked.length === count ? { seats: picked, together: false } : null;
}
