import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../pages/Api/client';

/* 곧 출발하는 열차 티커 (헤더 상단 운행 정보 바 가운데)
   - 데이터: 메인의 "실시간 운행 현황" 기본 조회와 같은 /schedule?upcoming=true (공개 API)
   - 출발 시각이 지금보다 뒤인 것만 클라이언트에서 거른 뒤 앞 3편
   - 호출 결과는 모듈 변수에 60초 캐시 (페이지를 옮겨도 다시 부르지 않는다)
   - 실패하거나 열차가 없으면 아무것도 그리지 않는다 (오류 안내 없음) */

const CACHE_MS = 60 * 1000;
const SHOW = 3;
const ROTATE_MS = 4000;
const TICK_MS = 30 * 1000;

let cache = null; // { at, items }
let inflight = null;

const pad = (n) => String(n).padStart(2, '0');

// 오늘이 아닌 열차에는 날짜를 붙인다(내일 새벽 열차를 "곧 출발"처럼 보이게 하지 않기 위해)
function dayPrefix(dep, now) {
  const a = new Date(dep);
  const b = new Date(now);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(a) - startOf(b)) / 86400000);
  if (diff <= 0) return '';
  if (diff === 1) return '내일';
  return `${a.getMonth() + 1}/${a.getDate()}`;
}

function toItem(row) {
  const dep = new Date(row?.depplandtime).getTime();
  if (Number.isNaN(dep)) return null;
  const d = new Date(dep);
  return {
    id: row.schedule_seq ?? `${dep}-${row.trainno}`,
    dep,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    from: row.depStationName || row.depplacename || '',
    to: row.arrStationName || row.arrplacename || '',
    train: `KTX ${String(row.trainno ?? '').padStart(3, '0')}`,
  };
}

function peekCache() {
  return cache && Date.now() - cache.at < CACHE_MS ? cache.items : null;
}

function loadUpcoming() {
  const hit = peekCache();
  if (hit) return Promise.resolve(hit);
  if (inflight) return inflight;
  inflight = client
    .get('/schedule', { params: { page: 1, size: 5, upcoming: true } })
    .then((res) => {
      const rows = Array.isArray(res.data?.schedules) ? res.data.schedules : [];
      return rows.map(toItem).filter((it) => it && it.from && it.to);
    })
    .catch(() => []) // 실패해도 조용히 숨긴다. 같은 60초 동안은 다시 부르지 않는다.
    .then((items) => {
      cache = { at: Date.now(), items };
      inflight = null;
      return items;
    });
  return inflight;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const ArrowIcon = () => (
  <svg className="nd__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function NextDepartures() {
  const [items, setItems] = useState(() => peekCache() ?? []);
  const [now, setNow] = useState(Date.now);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    let alive = true;
    loadUpcoming().then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 출발 시각이 지난 열차가 목록에 남지 않도록 30초마다 기준 시각 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const list = useMemo(() => items.filter((it) => it.dep > now).slice(0, SHOW), [items, now]);
  const count = list.length;

  useEffect(() => {
    if (reduced || paused || count < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced, paused, count]);

  if (count === 0) return null;

  const pos = reduced ? 0 : index % count;
  const current = list[pos];
  const label = `다음 출발 열차 ${count}편, 운행 시간표 보기. ${list
    .map((it) => `${dayPrefix(it.dep, now)} ${it.time} ${it.from}에서 ${it.to}, ${it.train}`.trim())
    .join('. ')}`;
  const currentDay = dayPrefix(current.dep, now);

  return (
    <div className="nd" aria-live="off">
      <Link
        to="/schedule"
        className="nd__link"
        aria-label={label}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <span className="nd__tag" aria-hidden="true">다음 열차</span>
        <span className="nd__viewport" aria-hidden="true">
          <span className="nd__item" key={current.id}>
            {currentDay && <span className="nd__day">{currentDay}</span>}
            <span className="nd__time num">{current.time}</span>
            <span className="nd__route">
              {current.from}
              <ArrowIcon />
              {current.to}
            </span>
            <span className="nd__train num">{current.train}</span>
          </span>
        </span>
        {count > 1 && !reduced && (
          <span className="nd__count num" aria-hidden="true">{pos + 1}/{count}</span>
        )}
      </Link>
    </div>
  );
}
