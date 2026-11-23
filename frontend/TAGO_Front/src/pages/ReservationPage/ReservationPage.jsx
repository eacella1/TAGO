import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import QuickMenu from '../../components/QuickMenu/QuickMenu';
import RouteLine from '../../components/RouteLine/RouteLine';
import PaymentPanel, { PaymentOverlay } from './PaymentPanel';
import client from '../Api/client';
import { dialog, notify } from '../../components/Dialog/dialogService';
import { autoPickSeats } from '../../lib/trainDomain';
import './ReservationPage.css';

const KTX_CARS = [
  { carNo: 1, seats: 56, rows: 14, status: '여유' },
  { carNo: 2, seats: 35, rows: 9, status: '여유' },
  { carNo: 3, seats: 46, rows: 12, status: '여유' },
  { carNo: 4, seats: 50, rows: 13, status: '여유' },
  { carNo: 5, seats: 55, rows: 14, status: '여유' },
  { carNo: 6, seats: 56, rows: 14, status: '여유' },
  { carNo: 7, seats: 56, rows: 14, status: '여유' },
  { carNo: 8, seats: 56, rows: 14, status: '여유' },
  { carNo: 9, seats: 56, rows: 14, status: '여유' },
  { carNo: 10, seats: 56, rows: 14, status: '여유' },
  { carNo: 11, seats: 56, rows: 14, status: '여유' },
  { carNo: 12, seats: 56, rows: 14, status: '여유' },
  { carNo: 13, seats: 56, rows: 14, status: '여유' },
  { carNo: 14, seats: 56, rows: 14, status: '여유' },
  { carNo: 15, seats: 56, rows: 14, status: '여유' },
  { carNo: 16, seats: 56, rows: 14, status: '여유' },
  { carNo: 17, seats: 56, rows: 14, status: '여유' },
  { carNo: 18, seats: 21, rows: 6, status: '여유' },
];

/* ---- 인라인 SVG 아이콘 (굵기 2, 둥근 끝) ---- */
function Icon({ size = 16, className, children }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const CheckIcon = (p) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
const CloseIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const ArrowRightIcon = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
const ChevronDownIcon = (p) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
const ArrowUpIcon = (p) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>;
const LockIcon = (p) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Icon>;
const CalendarIcon = (p) => <Icon {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></Icon>;
const SpinnerIcon = (p) => <Icon {...p}><path d="M12 3a9 9 0 019 9" /></Icon>;
const ClockIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const AlertIcon = (p) => (
  <Icon {...p}>
    <path d="M12 8v5M12 16.5v.01" />
    <path d="M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
  </Icon>
);
const SparkleIcon = (p) => <Icon {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16v4M17 18h4" /></Icon>;
const ArrowLeftIcon = (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
const TrainNoseIcon = () => (
  <svg width="40" height="56" viewBox="0 0 40 56" aria-hidden="true" focusable="false">
    <path d="M40 4H22C10 4 3 18 3 36v14c0 1.1.9 2 2 2h35V4z" fill="currentColor" />
    <path d="M40 12H24c-6 0-11 8-12 18h28V12z" fill="var(--white)" opacity="0.9" />
  </svg>
);

const STEPS = [
  { key: 'search', name: '열차 조회' },
  { key: 'seat', name: '좌석 선택' },
  { key: 'pay', name: '결제' },
  { key: 'done', name: '완료' },
];
// 현재 step 이 stepper 의 몇 번째(0부터) 단계인지
const STEP_INDEX = { seat: 1, pay: 2, done: 3 };

// 선점 유효시간 기본값. 카운트다운은 서버 응답(expiresAt - reservedAt)을 우선 쓰고,
// 이 값은 응답에 시각이 없을 때와 "선점하면 N분간" 안내 문구에만 쓴다.
// 백엔드 HOLD_TTL_MINUTES 와 같은 값이어야 안내가 맞는다.
const HOLD_MINUTES = 10;
const HOLD_DEFAULT_MS = HOLD_MINUTES * 60 * 1000;
const WARN_MS = 3 * 60 * 1000;
const DANGER_MS = 60 * 1000;
// 스크린리더 안내 시점(남은 초). 매초 읽히지 않도록 이 시점에만 live region 을 갱신한다.
const ANNOUNCE_AT = [
  { at: 300, text: '결제 시간이 5분 남았습니다.' },
  { at: 60, text: '결제 시간이 1분 남았습니다.' },
  { at: 30, text: '결제 시간이 30초 남았습니다. 서둘러 결제를 완료해 주세요.' },
];

const pad2 = (n) => String(n).padStart(2, '0');
const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};
const holdTone = (ms) => (ms <= DANGER_MS ? 'danger' : ms <= WARN_MS ? 'warn' : 'info');

const HOLD_TONE_TEXT = {
  info: { title: '좌석을 선점했습니다', sub: '남은 시간 안에 결제를 완료해 주세요.', Glyph: ClockIcon },
  warn: { title: '결제 시간이 얼마 남지 않았습니다', sub: '남은 시간 안에 결제를 완료해 주세요.', Glyph: AlertIcon },
  danger: { title: '곧 좌석 선점이 해제됩니다', sub: '지금 바로 결제를 진행해 주세요.', Glyph: AlertIcon },
};

// 서버의 LocalDateTime 문자열("2026-11-20T10:15:30.123")을 화면용 "2026-11-20 10:15:30" 으로
const formatDateTime = (value) => {
  if (typeof value === 'string' && value.length >= 19) return value.slice(0, 19).replace('T', ' ');
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// 선점 유효시간 = 서버 expiresAt - reservedAt (서버 시계끼리의 차이라 클라이언트 시계 오차가 없다)
const holdDurationMs = (reservedAt, expiresAt) => {
  const diff = Date.parse(expiresAt) - Date.parse(reservedAt);
  return Number.isFinite(diff) && diff > 0 ? diff : HOLD_DEFAULT_MS;
};

// 호차 잔여석 히트맵용: 18량 편성에서 호차를 고를 때 쓰는 값들
const SEAT_COLS = ['A', 'B', 'C', 'D'];
const SEAT_PREFS = [
  { value: 'any', label: '상관없음' },
  { value: 'window', label: '창가' },
  { value: 'aisle', label: '통로' },
];
// 호차 혼잡 단계(잔여 비율). 목록의 occupancy() 는 열차 전체(935석) 기준 절대값이 섞여 있어 호차 한 량에는 맞지 않는다.
function carLevel(remaining, total) {
  if (remaining === null) return 'unknown';
  if (remaining <= 0) return 'sold';
  const ratio = total > 0 ? remaining / total : 0;
  if (remaining <= 5 || ratio <= 0.1) return 'low'; // 마감 임박
  if (ratio < 0.2) return 'busy'; // 혼잡
  if (ratio < 0.5) return 'normal'; // 보통
  return 'ok'; // 여유
}
const CAR_LEVEL_LABEL = { ok: '여유', normal: '보통', busy: '혼잡', low: '마감 임박', sold: '매진' };

// GET /api/seat: 한 호차의 점유(AVAILABLE 이 아닌) 좌석 번호 목록. 실패하면 null.
// onSummary: 같은 응답의 carSummaryList(호차별 잔여석)를 넘겨 받는 콜백(선택).
async function fetchOccupiedSeats(scheduleSeq, carNo, onSummary) {
  try {
    const res = await client.get(`/seat`, { params: { scheduleSeq, carNo } });
    if (res.data && res.data.seatList) {
      if (Array.isArray(res.data.carSummaryList)) onSummary?.(res.data.carSummaryList);
      return res.data.seatList.filter((s) => s.status !== 'AVAILABLE').map((s) => s.seatNo);
    }
  } catch (err) {
    console.warn('좌석 상태 조회 실패 (서버 연결 대기 또는 Mock 유지):', err.message);
  }
  return null;
}

const errorText = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (typeof data === 'string' && data) return data;
  return fallback;
};

/* ---- 결제 단계 카운트다운 바 ----
   매초 갱신되므로 페이지 전체가 아니라 이 컴포넌트만 다시 그린다.
   남은 시간은 매번 deadline - Date.now() 로 계산(누적 오차 없음), 탭이 다시 보일 때 즉시 재계산한다. */
function HoldTimer({ deadline, totalMs, onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const [announcement, setAnnouncement] = useState('');
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let finished = false;
    const announced = new Set();
    const startSec = Math.ceil(Math.max(0, deadline - Date.now()) / 1000);
    ANNOUNCE_AT.forEach(({ at }) => {
      if (startSec <= at) announced.add(at); // 시작 시점에 이미 지난 안내는 건너뜀
    });

    const tick = () => {
      if (finished) return;
      const rem = Math.max(0, deadline - Date.now());
      setRemaining(rem);

      const sec = Math.ceil(rem / 1000);
      const crossed = ANNOUNCE_AT.filter(({ at }) => sec <= at && !announced.has(at));
      if (crossed.length > 0) {
        crossed.forEach(({ at }) => announced.add(at));
        setAnnouncement(crossed[crossed.length - 1].text); // 한 번에 여러 시점을 넘겼으면 가장 급한 것만
      }

      if (rem <= 0) {
        finished = true;
        clearInterval(intervalId);
        onExpireRef.current?.();
      }
    };

    const intervalId = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    // live region 이 화면에 자리 잡은 뒤에 시작 안내를 넣어야 읽힌다
    const startId = setTimeout(() => {
      if (!finished) {
        setAnnouncement(`좌석을 선점했습니다. ${Math.round(totalMs / 60000)}분 안에 결제를 완료해 주세요.`);
      }
    }, 300);

    return () => {
      finished = true;
      clearInterval(intervalId);
      clearTimeout(startId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadline, totalMs]);

  const tone = holdTone(remaining);
  const { title, sub, Glyph } = HOLD_TONE_TEXT[tone];
  const ratio = Math.min(1, Math.max(0, remaining / totalMs));

  return (
    <section className={`hold-timer hold-timer--${tone}`} aria-label="좌석 선점 남은 시간">
      <div className="hold-timer__row">
        <span className="hold-timer__icon">
          <Glyph size={22} />
        </span>
        <div className="hold-timer__text">
          <strong className="hold-timer__title">{title}</strong>
          <span className="hold-timer__sub">{sub}</span>
        </div>
        <div className="hold-timer__clock">
          <span className="hold-timer__label">남은 시간</span>
          <span className="hold-timer__digits num" role="timer" aria-live="off" aria-atomic="true" aria-label="남은 결제 시간">
            {formatClock(remaining)}
          </span>
        </div>
      </div>
      <div className="hold-timer__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}

// 완료 화면의 기본 결제 수단 문구(폼에서 만든 마스킹 요약이 없을 때만 쓴다)
const PAY_METHODS = [
  { value: 'card', label: '신용/체크카드' },
  { value: 'easy', label: '간편결제' },
  { value: 'transfer', label: '계좌이체' },
];

// 결제 진행 오버레이를 최소로 보여 주는 시간(ms). POST /payment 응답이 더 빨라도 이 시간은 유지한다.
const PAY_OVERLAY_MIN_MS = 1600;
const PAY_FORM_ID = 'pay-form';

// "2026-11-20 (금)" -> "11/20(금)". 형식이 다르면 원문 그대로.
const shortDate = (value) => {
  const m = String(value ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*\(([^)]+)\)/);
  return m ? `${Number(m[2])}/${Number(m[3])}(${m[4]})` : String(value ?? '');
};

// [{carNo, seatId}] -> "1호차 1A·1B, 2호차 3C"
const seatsText = (seats) => {
  const byCar = new Map();
  seats.forEach(({ carNo, seatId }) => byCar.set(carNo, [...(byCar.get(carNo) || []), seatId]));
  return [...byCar].map(([carNo, ids]) => `${carNo}호차 ${ids.join('·')}`).join(', ');
};

// 다인원 예매는 좌석마다 예약이 생긴다(reservationIds). 해제·취소는 전부 대상으로 한다.
const holdIds = (hold) => (hold.reservationIds?.length ? hold.reservationIds : [hold.reservationId]);

export default function ReservationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const bookingInfo = useMemo(() => {
    const state = location.state || {};
    const rawPrice = state.price ?? state.train?.price;
    const parsedPrice = rawPrice
      ? parseInt(String(rawPrice).replace(/[^0-9]/g, ''), 10)
      : 59800;

    return {
      scheduleSeq: state.scheduleSeq || state.train?.scheduleSeq || 1,
      trainName: state.trainName || state.train?.name || 'KTX 001',
      trainType: 'KTX',
      depTime: state.depTime || state.train?.depTime || '05:15',
      arrTime: state.arrTime || state.train?.arrTime || '07:42',
      duration: state.duration || state.train?.duration || '2시간 27분',
      depStation: state.depStation || '서울',
      arrStation: state.arrStation || '부산',
      depDate: state.depDate || '2026-11-16 (월)',
      returnDate: state.returnDate || null,
      tripType: state.tripType || '편도',
      passenger: state.passenger || state.passengerCount || '어른 1명',
      unitPrice: Number.isNaN(parsedPrice) || parsedPrice <= 0 ? 59800 : parsedPrice,
    };
  }, [location.state]);

  const targetSeatCount = useMemo(() => {
    if (location.state?.passengerDetail?.adult) {
      return parseInt(location.state.passengerDetail.adult, 10);
    }
    const passengerStr = String(bookingInfo.passenger || '');
    const match = passengerStr.match(/(\d+)명/);
    if (match) {
      return parseInt(match[1], 10);
    }
    const anyDigit = passengerStr.match(/\d+/);
    if (anyDigit) {
      return parseInt(anyDigit[0], 10);
    }
    return 1;
  }, [bookingInfo.passenger, location.state]);

  const [selectedCarNo, setSelectedCarNo] = useState(1);
  const currentCar = useMemo(() => {
    return KTX_CARS.find((c) => c.carNo === selectedCarNo) || KTX_CARS[0];
  }, [selectedCarNo]);

  const formationScrollRef = useRef(null);

  const handleSelectCar = (carNo) => {
    setSelectedCarNo(carNo);
  };

  const isRoundTrip = bookingInfo.tripType === '왕복';
  const [activeLeg, setActiveLeg] = useState('outbound'); // 'outbound' | 'return'
  const [outboundSeats, setOutboundSeats] = useState([]);
  const [returnSeats, setReturnSeats] = useState([]);
  const selectedSeats = activeLeg === 'outbound' ? outboundSeats : returnSeats;
  const [paymentMethod, setPaymentMethod] = useState('card');

  // 진행 단계: 'seat'(좌석 선택) -> 'pay'(선점 완료 · 결제 수단) -> 'done'(발권 완료)
  const [step, setStep] = useState('seat');
  // 선점 결과: { reservationId, seats, deadline, totalMs }
  const [holds, setHolds] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [isHolding, setIsHolding] = useState(false); // POST /reservation 진행 중
  const [isPaying, setIsPaying] = useState(false); // POST /payment 진행 중
  const [isReleasing, setIsReleasing] = useState(false); // "좌석 다시 선택" 해제 진행 중
  const [payProgress, setPayProgress] = useState(''); // 결제 진행 오버레이 문구(수단별)

  // 언마운트/pagehide 시점에 "최신" 값을 읽기 위한 ref (StrictMode 이중 마운트에서도 안전하게)
  const stepRef = useRef(step);
  const holdsRef = useRef(holds);
  const payingRef = useRef(false);
  const paidRef = useRef(false);
  const expiringRef = useRef(false);
  const releasedOnHideRef = useRef(false);
  const wrapperRef = useRef(null);
  const payHeadingRef = useRef(null);
  const payPanelRef = useRef(null); // PaymentPanel.validate()
  const doneHeadingRef = useRef(null);
  const prevStepRef = useRef(step);

  useEffect(() => {
    stepRef.current = step;
    holdsRef.current = holds;
  }, [step, holds]);

  const [occupiedSeatsByCar, setOccupiedSeatsByCar] = useState({
    1: ['1A', '1B'],
  });
  // 서버가 준 호차별 잔여석 요약 { [carNo]: { total, available } } (가장 최근 /seat 응답)
  const [carSummary, setCarSummary] = useState({});
  // 좌석 목록을 실제로 불러온 호차 { [carNo]: true } — 이런 호차는 로컬 점유 정보(SSE 반영)가 요약보다 정확하다
  const [loadedCars, setLoadedCars] = useState({});
  const applySummary = useCallback((list) => {
    const next = {};
    list.forEach((c) => {
      if (c && Number.isFinite(Number(c.carNo))) {
        next[Number(c.carNo)] = { total: Number(c.totalSeats) || 0, available: Math.max(0, Number(c.availableSeats) || 0) };
      }
    });
    setCarSummary(next);
  }, []);

  // 한 호차의 좌석 현황을 다시 불러와 상태에 반영한다. 점유 좌석 목록을 돌려준다(실패 시 null).
  const loadCarSeats = useCallback(
    async (carNo) => {
      const occupied = await fetchOccupiedSeats(bookingInfo.scheduleSeq, carNo, applySummary);
      if (occupied) {
        setOccupiedSeatsByCar((prev) => ({ ...prev, [carNo]: occupied }));
        setLoadedCars((prev) => ({ ...prev, [carNo]: true }));
      }
      return occupied;
    },
    [bookingInfo.scheduleSeq, applySummary]
  );

  // 여러 호차를 한 번에 다시 불러온다. { [carNo]: 점유 좌석[] } (실패한 호차는 빠짐)
  const refreshCars = useCallback(
    async (carNos) => {
      const unique = [...new Set(carNos)];
      const results = await Promise.all(unique.map(async (carNo) => [carNo, await loadCarSeats(carNo)]));
      return Object.fromEntries(results.filter(([, occupied]) => occupied));
    },
    [loadCarSeats]
  );

  // 호차 변경 또는 스케줄 변경 시 백엔드 좌석 목록(GET /api/seat) 실시간 연동
  useEffect(() => {
    let isMounted = true;
    fetchOccupiedSeats(bookingInfo.scheduleSeq, selectedCarNo, (list) => {
      if (isMounted) applySummary(list);
    }).then((occupied) => {
      if (isMounted && occupied) {
        setOccupiedSeatsByCar((prev) => ({ ...prev, [selectedCarNo]: occupied }));
        setLoadedCars((prev) => ({ ...prev, [selectedCarNo]: true }));
      }
    });

    // SSE 실시간 좌석 스트림 연결 (GET /api/seat/stream)
    let eventSource = null;
    try {
      eventSource = new EventSource(
        `http://localhost:80/api/seat/stream?scheduleSeq=${bookingInfo.scheduleSeq}`
      );
      eventSource.addEventListener('SEAT_UPDATE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.carNo && data.seatNo) {
            setOccupiedSeatsByCar((prev) => {
              const current = prev[data.carNo] || [];
              if (data.status === 'AVAILABLE') {
                return { ...prev, [data.carNo]: current.filter((no) => no !== data.seatNo) };
              } else {
                return { ...prev, [data.carNo]: Array.from(new Set([...current, data.seatNo])) };
              }
            });
          }
        } catch (parseErr) {
          console.error('SSE 파싱 에러:', parseErr);
        }
      });
    } catch (sseErr) {
      console.warn('SSE 연결 대기:', sseErr.message);
    }

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, [bookingInfo.scheduleSeq, selectedCarNo, applySummary]);

  // 선택된 호차가 스트립 안에서 보이도록 스트립만 가로 스크롤 (페이지 스크롤은 건드리지 않음)
  useEffect(() => {
    const scroller = formationScrollRef.current;
    const el = scroller?.querySelector('.car.is-selected');
    if (!scroller || !el) return;
    scroller.scrollLeft = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
  }, [selectedCarNo]);

  // 호차 잔여석: 좌석 목록을 불러온 호차는 로컬 점유 정보(도면·SSE 와 같은 값), 아직 안 본 호차는 서버 요약값.
  // SSE 는 안 본 호차에 대해 일부 좌석만 알려 주므로(occupiedSeatsByCar 가 부분 목록) 그 값으로는 세지 않는다.
  const getRemainingSeats = (car) => {
    const occupied = occupiedSeatsByCar[car.carNo];
    if (loadedCars[car.carNo] && occupied) return Math.max(0, car.seats - occupied.length);
    const summary = carSummary[car.carNo];
    if (summary) return summary.available;
    return occupied ? Math.max(0, car.seats - occupied.length) : null;
  };

  const currentCarOccupied = occupiedSeatsByCar[selectedCarNo] || [];

  const currentCarSelectedSeatIds = useMemo(() => {
    return selectedSeats
      .filter((s) => s.carNo === selectedCarNo)
      .map((s) => s.seatId);
  }, [selectedSeats, selectedCarNo]);

  const leftColumns = ['A', 'B'];
  const rightColumns = ['C', 'D'];

  // 현재 호차의 좌석을 현재 레그(가는 편/오는 편)에 추가한다. 직접 클릭(1석)과 자동 배정(여러 석)이 같은 규칙을 쓴다.
  // 점유 좌석·이미 고른 좌석은 건너뛰고, 인원 수 상한을 넘으면 선택하지 않고 안내한다. 추가했으면 true.
  const addSeatsToLeg = (seatIds) => {
    const currentSeats = activeLeg === 'outbound' ? outboundSeats : returnSeats;
    const setCurrentSeats = activeLeg === 'outbound' ? setOutboundSeats : setReturnSeats;
    const legLabel = activeLeg === 'outbound' ? '가는 편' : '오는 편';

    const fresh = seatIds.filter(
      (id) => !currentCarOccupied.includes(id) && !currentSeats.some((s) => s.carNo === selectedCarNo && s.seatId === id)
    );
    if (fresh.length === 0) return false;
    if (currentSeats.length + fresh.length > targetSeatCount) {
      notify.warning(`${legLabel}은 선택하신 승객 인원(${targetSeatCount}명)에 맞춰 최대 ${targetSeatCount}석까지만 선택할 수 있습니다.`);
      return false;
    }
    setCurrentSeats([...currentSeats, ...fresh.map((seatId) => ({ carNo: selectedCarNo, seatId }))]);
    return true;
  };

  const handleSeatClick = (seatId) => {
    if (currentCarOccupied.includes(seatId)) return;

    const currentSeats = activeLeg === 'outbound' ? outboundSeats : returnSeats;
    const setCurrentSeats = activeLeg === 'outbound' ? setOutboundSeats : setReturnSeats;

    const existingIndex = currentSeats.findIndex(
      (s) => s.carNo === selectedCarNo && s.seatId === seatId
    );

    if (existingIndex > -1) {
      setCurrentSeats(currentSeats.filter((_, idx) => idx !== existingIndex));
    } else {
      addSeatsToLeg([seatId]);
    }
  };

  // ---- 좌석 자동 배정 (현재 호차 안에서, 현재 레그의 남은 인원만큼) ----
  const [seatPref, setSeatPref] = useState('any'); // 'any' | 'window' | 'aisle'
  const [flashSeatIds, setFlashSeatIds] = useState([]); // 방금 자동 배정된 좌석(잠깐 강조)
  const flashTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const seatNeed = Math.max(0, targetSeatCount - selectedSeats.length);
  const currentCarSeatNos = useMemo(() => {
    const list = [];
    for (let row = 1; row <= currentCar.rows; row += 1) {
      SEAT_COLS.forEach((col, idx) => {
        if ((row - 1) * 4 + idx < currentCar.seats) list.push(`${row}${col}`);
      });
    }
    return list;
  }, [currentCar]);

  // 추천 호차: 필요한 좌석 수 이상이면서 잔여석이 가장 많은 호차(같으면 앞 호차). 서버 요약이 있고 '여유/보통'일 때만.
  const recommendedCar = (() => {
    if (Object.keys(carSummary).length === 0) return null;
    let best = null;
    KTX_CARS.forEach((car) => {
      const remaining = getRemainingSeats(car);
      if (remaining === null || remaining < Math.max(1, seatNeed)) return;
      if (!best || remaining > best.remaining) best = { carNo: car.carNo, remaining };
    });
    if (!best) return null;
    const level = carLevel(best.remaining, KTX_CARS[best.carNo - 1].seats);
    return level === 'ok' || level === 'normal' ? best : null;
  })();

  const handleAutoAssign = () => {
    if (seatNeed < 1) return;
    const chosen = new Set(currentCarSelectedSeatIds);
    const result = autoPickSeats({
      seatNos: currentCarSeatNos,
      isAvailable: (no) => !currentCarOccupied.includes(no) && !chosen.has(no),
      count: seatNeed,
      pref: seatPref,
    });
    if (!result) {
      notify.warning(`이 호차에서 ${seatNeed}석을 선택할 수 있는 자리가 부족합니다. 다른 호차를 선택해 주세요.`);
      return;
    }
    if (!addSeatsToLeg(result.seats)) return;
    if (!result.together) notify.info('붙어 앉을 수 있는 자리가 없어 떨어진 자리로 배정했습니다.');
    setFlashSeatIds(result.seats);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashSeatIds([]), 1600);
  };

  const handleRemoveSeat = (carNo, seatId, leg = activeLeg) => {
    if (leg === 'return') {
      setReturnSeats((prev) => prev.filter((s) => !(s.carNo === carNo && s.seatId === seatId)));
    } else {
      setOutboundSeats((prev) => prev.filter((s) => !(s.carNo === carNo && s.seatId === seatId)));
    }
  };

  const isOutboundComplete = outboundSeats.length === targetSeatCount;
  const isReturnComplete = !isRoundTrip || returnSeats.length === targetSeatCount;
  const isSelectionComplete = isOutboundComplete && isReturnComplete;
  const totalSelectedSeatCount = outboundSeats.length + (isRoundTrip ? returnSeats.length : 0);
  const totalPrice = totalSelectedSeatCount * bookingInfo.unitPrice;

  const outboundSeatCarNos = () => [selectedCarNo, ...outboundSeats.map((s) => s.carNo)];

  // 선점/만료/해제 후 처음(좌석 선택)으로: 선택과 선점 정보를 비우고 좌석 현황을 다시 불러온다
  const resetToSeatStep = useCallback(
    (carNos) => {
      setHolds(null);
      setStep('seat');
      setOutboundSeats([]);
      setReturnSeats([]);
      setActiveLeg('outbound');
      refreshCars(carNos);
    },
    [refreshCars]
  );

  // 1) 좌석 확정: POST /api/reservation(선점)만 호출하고 결제 단계로 넘어간다
  const handleHoldSeats = async () => {
    if (!isOutboundComplete) {
      notify.warning(`가는 편 좌석을 모두 선택해 주세요. (현재 ${outboundSeats.length}/${targetSeatCount}석 선택됨)`);
      return;
    }
    if (!isReturnComplete) {
      setActiveLeg('return');
      notify.warning(`오는 편 좌석을 모두 선택해 주세요. (현재 ${returnSeats.length}/${targetSeatCount}석 선택됨)`);
      return;
    }
    if (isHolding) return;
    setIsHolding(true);

    const seatNoList = outboundSeats.map((s) => s.seatId);
    const outboundCarNo = outboundSeats[0]?.carNo || selectedCarNo;

    try {
      const resHold = await client.post('/reservation', {
        scheduleSeq: bookingInfo.scheduleSeq,
        carNo: outboundCarNo,
        seatList: seatNoList,
        count: seatNoList.length,
      });

      const data = resHold.data || {};
      const receivedAt = Date.now(); // 응답을 받은 시점 기준으로 deadline 을 만든다(서버 시계 차이 회피)
      const totalMs = holdDurationMs(data.reservedAt, data.expiresAt);

      paidRef.current = false;
      releasedOnHideRef.current = false;
      const reservationId = data.reservationId || data.reservationSeq;
      setHolds({
        reservationId,
        reservationIds: data.reservationIds || (reservationId ? [reservationId] : []),
        totalPrice: data.totalPrice ?? null,
        seats: outboundSeats,
        deadline: receivedAt + totalMs,
        totalMs,
      });
      setStep('pay');
    } catch (err) {
      console.error('좌석 선점 실패:', err);
      if (err.response?.status === 409) {
        // 충돌: 모달로 알리되, 사용자가 닫기를 기다리지 않고 좌석 현황을 바로 새로 불러온다
        dialog.alert(
          '다른 고객이 먼저 선택한 좌석이 있어 선점하지 못했습니다. 좌석 현황을 새로 불러왔으니 다른 좌석을 선택해 주세요.',
          { title: '이미 선택된 좌석이 있습니다', tone: 'warning' }
        );
        const fresh = await refreshCars(outboundSeatCarNos());
        setOutboundSeats((prev) => prev.filter((s) => !fresh[s.carNo]?.includes(s.seatId)));
      } else {
        dialog.alert(errorText(err, '좌석 선점 중 오류가 발생했습니다.'), { title: '예매 실패', tone: 'error' });
      }
    } finally {
      setIsHolding(false);
    }
  };

  // 선점 시간이 끝났을 때: 안내 후 좌석 선택 단계로 되돌린다
  const handleExpire = useCallback(async () => {
    const hold = holdsRef.current;
    if (!hold || stepRef.current !== 'pay' || expiringRef.current) return;
    if (payingRef.current) return; // 결제 응답을 먼저 기다린다(성공하면 발권, 실패/410 이면 아래에서 다시 호출됨)

    expiringRef.current = true;
    // 서버 스케줄러가 해제하지만, 먼저 풀리도록 시도만 한다(이미 해제됐다면 실패해도 무시)
    holdIds(hold).forEach((id) => client.post(`/reservation/${id}/cancel`).catch(() => {}));
    await dialog.alert('좌석 선점 시간이 지나 좌석이 해제되었습니다. 좌석을 다시 선택해 주세요.', {
      title: '선점 시간 만료',
      tone: 'warning',
    });
    expiringRef.current = false;

    if (holdsRef.current !== hold) return; // 안내를 보는 사이 이미 다른 경로로 정리됨
    resetToSeatStep(hold.seats.map((s) => s.carNo));
  }, [resetToSeatStep]);

  // 2) 결제: POST /api/payment (폼 검증을 통과한 뒤에만 호출된다)
  //    payLabel: 폼이 만든 마스킹 요약(예: "신용/체크카드 · 신한 ****1234"). 화면 state 에만 둔다.
  const handlePay = async (payLabel) => {
    if (isPaying || payingRef.current || isReleasing || step !== 'pay' || !holds) return;
    setIsPaying(true);
    payingRef.current = true;
    const startedAt = Date.now();
    const payAmount = holds.totalPrice ?? totalPrice; // 서버가 계산한 금액을 우선한다

    try {
      const resPay = await client.post('/payment', {
        reservationId: holds.reservationId,
        reservationIds: holdIds(holds),
        payMethod: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'easy' ? 'EASY' : 'TRANSFER',
        totalPrice: payAmount,
      });

      // 승인 오버레이는 응답이 빨라도 최소 시간 동안 보여 준다(둘 다 끝나면 발권 화면으로)
      const rest = PAY_OVERLAY_MIN_MS - (Date.now() - startedAt);
      if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));

      paidRef.current = true; // 이후 언마운트/pagehide 에서 좌석을 해제하지 않는다
      setReceipt({
        ticketNumber: resPay.data?.ticketNumber || null,
        approvedAt: formatDateTime(resPay.data?.approvedAt),
        amount: payAmount,
        payLabel: payLabel || PAY_METHODS.find((m) => m.value === paymentMethod)?.label || '',
        seats: holds.seats,
        returnSeats,
      });
      setStep('done');
    } catch (err) {
      console.error('결제 실패:', err);
      payingRef.current = false;
      const expired = err.response?.status === 410 || Date.now() >= holds.deadline;
      if (expired) {
        setIsPaying(false);
        await handleExpire();
        return;
      }
      dialog.alert(errorText(err, '결제 처리 중 오류가 발생했습니다.'), { title: '결제 실패', tone: 'error' });
    } finally {
      payingRef.current = false;
      setIsPaying(false);
    }
  };

  // 결제 버튼/폼 제출: 현재 탭의 입력값을 검증한 뒤 통과하면 기존 결제 흐름(handlePay)으로 넘긴다
  const handleSubmitPayment = () => {
    if (isPaying || payingRef.current || isReleasing || step !== 'pay' || !holds) return;
    const result = payPanelRef.current?.validate();
    if (!result?.ok) return;
    setPayProgress(result.progress);
    handlePay(result.summary);
  };

  // 선점한 좌석을 풀고 좌석 선택 단계로 돌아간다
  const handleReselect = async () => {
    const hold = holds;
    if (!hold || isPaying || isReleasing) return;

    const ok = await dialog.confirm('선점한 좌석이 해제됩니다. 좌석을 다시 선택하시겠습니까?', {
      title: '좌석 다시 선택',
      confirmLabel: '좌석 해제하고 돌아가기',
      cancelLabel: '계속 결제',
      danger: true,
    });
    if (!ok || holdsRef.current !== hold) return; // 확인창을 보는 사이 만료로 이미 정리된 경우 포함

    setIsReleasing(true);
    try {
      await Promise.all(holdIds(hold).map((id) => client.post(`/reservation/${id}/cancel`)));
      resetToSeatStep(hold.seats.map((s) => s.carNo));
    } catch (err) {
      console.error('좌석 해제 실패:', err);
      dialog.alert(errorText(err, '좌석 해제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'), {
        title: '좌석 해제 실패',
        tone: 'error',
      });
    } finally {
      setIsReleasing(false);
    }
  };

  const resetRef = useRef(resetToSeatStep);
  useEffect(() => {
    resetRef.current = resetToSeatStep;
  }, [resetToSeatStep]);

  // 이탈 시 해제(best effort): 결제 단계에서 라우트를 벗어나면 선점을 풀어 준다.
  //  - 결제 완료 후, 결제 요청 진행 중에는 해제하지 않는다(결제 결과를 모르는 상태에서 취소하면 안 됨).
  //  - 탭 닫기/새로고침(pagehide)은 keepalive fetch 로 같은 cancel 을 보낸다.
  useEffect(() => {
    const shouldRelease = () => {
      const hold = holdsRef.current;
      if (!hold || stepRef.current !== 'pay') return null;
      if (paidRef.current || payingRef.current) return null;
      return hold;
    };

    const onPageHide = () => {
      const hold = shouldRelease();
      if (!hold) return;
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      releasedOnHideRef.current = true;
      holdIds(hold).forEach((id) => {
        fetch(`${client.defaults.baseURL}/reservation/${id}/cancel`, {
          method: 'POST',
          keepalive: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {});
      });
    };

    // 뒤로가기 캐시(bfcache)로 돌아왔는데 이미 해제된 경우, 결제 화면을 그대로 두지 않는다
    const onPageShow = (e) => {
      if (!e.persisted || !releasedOnHideRef.current) return;
      releasedOnHideRef.current = false;
      const hold = holdsRef.current;
      if (hold && stepRef.current === 'pay') {
        notify.warning('페이지를 벗어나 선점한 좌석이 해제되었습니다. 좌석을 다시 선택해 주세요.');
        resetRef.current(hold.seats.map((s) => s.carNo));
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      const hold = shouldRelease(); // 언마운트(라우트 이동)
      if (hold) holdIds(hold).forEach((id) => client.post(`/reservation/${id}/cancel`).catch(() => {}));
    };
  }, []);

  // 단계가 바뀌면 화면 맨 위로, 결제/완료 화면은 제목으로 포커스를 옮긴다
  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (step === 'pay') payHeadingRef.current?.focus({ preventScroll: true });
    if (step === 'done') doneHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // 결제 단계의 카운트다운 바가 sticky 헤더 바로 아래에 붙도록 헤더 높이를 CSS 변수로 전달
  useEffect(() => {
    if (step !== 'pay') return undefined;
    const wrapper = wrapperRef.current;
    const header = wrapper?.querySelector('.header.sticky');
    if (!wrapper || !header) return undefined;
    const sync = () => wrapper.style.setProperty('--sticky-top', `${header.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, [step]);

  // 모바일에서 하단에 고정되는 결제 영역의 높이를 :root 변수로 알려, 토스트가 그 위로 뜨고
  // 본문이 가려지지 않게 한다(Dialog.css, 이 파일의 padding-bottom 에서 사용). 표현용이며 로직과 무관.
  useEffect(() => {
    if (step === 'done') return undefined;
    const stub = wrapperRef.current?.querySelector('.checkout-ticket .ticket__stub');
    if (!stub) return undefined;
    const root = document.documentElement;
    const media = window.matchMedia('(max-width: 720px)');
    const sync = () => {
      if (media.matches) root.style.setProperty('--ui-bottom-cta-h', `${stub.offsetHeight}px`);
      else root.style.removeProperty('--ui-bottom-cta-h');
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(stub);
    media.addEventListener('change', sync);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', sync);
      root.style.removeProperty('--ui-bottom-cta-h');
    };
  }, [step]);

  // 결제 본문 맨 위 "주문 정보" 한 줄 요약
  const passengerText = /\D/.test(String(bookingInfo.passenger)) ? String(bookingInfo.passenger) : `어른 ${bookingInfo.passenger}명`;
  const orderParts = holds
    ? [
        bookingInfo.trainName,
        `${bookingInfo.depStation} → ${bookingInfo.arrStation}`,
        `${shortDate(bookingInfo.depDate)} ${bookingInfo.depTime}–${bookingInfo.arrTime}`,
        seatsText(holds.seats),
        passengerText,
        ...(isRoundTrip ? [`왕복 (오는 편 ${returnSeats.length}석)`] : []),
      ]
    : [];

  const legLabelNow = activeLeg === 'outbound' ? '가는 편' : '오는 편';

  // 좌석 1개 렌더 (좌/우 쌍 공통). 동작은 기존 handleSeatClick/disabled 그대로.
  const renderSeat = (row, col, seatOrdinal) => {
    if (seatOrdinal >= currentCar.seats) {
      return <span key={`${row}${col}`} className="modern-seat-btn seat-filler" aria-hidden="true" />;
    }
    const seatId = `${row}${col}`;
    const isOccupied = currentCarOccupied.includes(seatId);
    const isSelected = currentCarSelectedSeatIds.includes(seatId);
    const isWindow = col === 'A' || col === 'D';
    const stateText = isOccupied ? '예약됨' : isSelected ? '선택됨' : '선택 가능';
    const seatInfo = `${seatId}, ${isWindow ? '창가' : '통로'}, ${stateText}`; // 좌석 방향은 데이터에 없어 넣지 않는다

    return (
      <button
        key={seatId}
        type="button"
        className={`modern-seat-btn ${isWindow ? 'window-seat' : ''} ${isOccupied ? 'occupied' : ''} ${
          isSelected ? 'selected' : ''
        }${flashSeatIds.includes(seatId) ? ' just-picked' : ''}`}
        disabled={isOccupied}
        aria-pressed={isOccupied ? undefined : isSelected}
        aria-label={seatInfo}
        data-tip={seatInfo}
        onClick={() => handleSeatClick(seatId)}
        title={seatInfo}
      >
        <span className="seat-id-label num">{seatId}</span>
        {isSelected && <CheckIcon size={12} className="seat-state-icon seat-check-mark" />}
        {isOccupied && <CloseIcon size={12} className="seat-state-icon" />}
      </button>
    );
  };

  const renderSeatChips = (seats, leg, readOnly = false) =>
    seats.map((s) => {
      const key = `${leg}-${s.carNo}-${s.seatId}`;
      if (readOnly) {
        // 선점 이후: 좌석을 바꿀 수 없으므로 삭제 버튼 없이 잠금 표시만
        return (
          <div key={key} className="chip chip--info seat-ticket-chip is-locked">
            <LockIcon size={12} />
            <span className="chip-car num">{s.carNo}호차</span>
            <strong className="chip-seat num">{s.seatId}석</strong>
          </div>
        );
      }
      return (
        <div key={key} className="chip chip--info seat-ticket-chip">
          <span className="chip-car num">{s.carNo}호차</span>
          <strong className="chip-seat num">{s.seatId}석</strong>
          <button
            type="button"
            className="chip-remove-btn"
            onClick={() => handleRemoveSeat(s.carNo, s.seatId, leg)}
            title="좌석 선택 취소"
            aria-label={`${s.carNo}호차 ${s.seatId}석 선택 취소`}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      );
    });

  const renderLegProgress = (done, count) =>
    done ? (
      <span className="chip seat-state seat-state--done">
        <CheckIcon size={12} />
        선택 완료
      </span>
    ) : (
      <span className="chip seat-state seat-state--pending num">
        {count}/{targetSeatCount}석
      </span>
    );

  return (
    <div ref={wrapperRef} className={`reservation-page-wrapper is-step-${step}${isPaying ? ' is-paying' : ''}`}>
      <Header showTopBar={true} />

      <main className="reservation-container">
        {step === 'pay' && holds && (
          <HoldTimer key={holds.deadline} deadline={holds.deadline} totalMs={holds.totalMs} onExpire={handleExpire} />
        )}

        <section className="reservation-header-card">
          <div className="res-card-top">
            <div className="train-id-badge">
              <span className="badge-ktx">KTX</span>
              <strong className="badge-name">{bookingInfo.trainName}</strong>
              <span className="badge-gen">KTX · 전 차량 일반실</span>
            </div>

            <ol className="booking-stepper" aria-label="예매 단계">
              {STEPS.map(({ key, name }, i) => {
                const current = STEP_INDEX[step];
                // 완료 화면에서는 4단계 모두 끝난 것으로 보여 준다
                const isDone = i < current || step === 'done';
                const isCurrent = i === current;
                return (
                  <li key={key} className="step-li">
                    <div
                      className={`step-item ${isDone ? 'done' : ''} ${isCurrent && !isDone ? 'active' : ''}`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      <span className="step-num num">{isDone ? <CheckIcon size={12} /> : i + 1}</span>
                      <span className="step-name">
                        {name}
                        {isDone && <span className="sr-only"> (완료)</span>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="res-card-main">
            <RouteLine
              className="res-route-compact"
              size="sm"
              depTime={bookingInfo.depTime}
              arrTime={bookingInfo.arrTime}
              depStation={bookingInfo.depStation}
              arrStation={bookingInfo.arrStation}
              duration={bookingInfo.duration}
            />

            <div className="header-meta-box">
              <div className="meta-pill">
                <span className="meta-k">탑승일</span>
                <strong className="meta-v num">{bookingInfo.depDate}</strong>
              </div>
              <div className="meta-pill">
                <span className="meta-k">승객 인원</span>
                <strong className="meta-v">{bookingInfo.passenger}</strong>
              </div>
              <div className="meta-pill">
                <span className="meta-k">여정 / 좌석 등급</span>
                <strong className="meta-v">
                  {bookingInfo.tripType} · 일반실 (<span className="num">{bookingInfo.unitPrice.toLocaleString()}</span>원)
                </strong>
              </div>
              {step === 'seat' && (
                <button
                  type="button"
                  className="ui-btn ui-btn--weak btn-change-journey"
                  onClick={() => navigate('/schedule')}
                >
                  다른 시간대 열차 변경
                </button>
              )}
            </div>
          </div>
        </section>

        {step === 'seat' && (
          <div className="reservation-layout-grid">
            <div className="train-coach-section">
              {isRoundTrip && (
                <div className="round-trip-leg-switcher" role="group" aria-label="가는 편 / 오는 편 선택">
                  <button
                    type="button"
                    className={`leg-switch-card ${activeLeg === 'outbound' ? 'active' : ''} ${isOutboundComplete ? 'done' : ''}`}
                    aria-pressed={activeLeg === 'outbound'}
                    onClick={() => setActiveLeg('outbound')}
                  >
                    <div className="leg-card-top">
                      <span className="leg-badge">가는 편</span>
                      {renderLegProgress(isOutboundComplete, outboundSeats.length)}
                    </div>
                    <strong className="leg-route">
                      <span>{bookingInfo.depStation}</span>
                      <ArrowRightIcon size={14} />
                      <span>{bookingInfo.arrStation}</span>
                    </strong>
                    <span className="leg-date num">{bookingInfo.depDate}</span>
                  </button>

                  <button
                    type="button"
                    className={`leg-switch-card ${activeLeg === 'return' ? 'active' : ''} ${isReturnComplete ? 'done' : ''}`}
                    aria-pressed={activeLeg === 'return'}
                    onClick={() => setActiveLeg('return')}
                  >
                    <div className="leg-card-top">
                      <span className="leg-badge return">오는 편</span>
                      {renderLegProgress(isReturnComplete, returnSeats.length)}
                    </div>
                    <strong className="leg-route">
                      <span>{bookingInfo.arrStation}</span>
                      <ArrowRightIcon size={14} />
                      <span>{bookingInfo.depStation}</span>
                    </strong>
                    <span className="leg-date num">{bookingInfo.returnDate || '귀가일 선택됨'}</span>
                  </button>
                </div>
              )}

              <div className="formation-panel">
                <div className="formation-header">
                  <div className="formation-title-group">
                    <h3 className="section-title">
                      {isRoundTrip ? `${legLabelNow} 좌석 선택` : '좌석 선택'}
                    </h3>
                    <span className="selected-car-badge">
                      현재 선택: <strong className="num">{currentCar.carNo}호차</strong> (일반실 <span className="num">{currentCar.seats}</span>석)
                    </span>
                  </div>
                </div>

                {recommendedCar && (
                  <div className="car-tip">
                    <SparkleIcon size={16} className="car-tip__icon" />
                    <p className="car-tip__text">
                      {recommendedCar.carNo === selectedCarNo ? (
                        <>
                          지금 보시는 <strong className="num">{recommendedCar.carNo}호차</strong>가 가장 여유 있습니다 (잔여{' '}
                          <span className="num">{recommendedCar.remaining}</span>석)
                        </>
                      ) : (
                        <>
                          가장 여유 있는 호차: <strong className="num">{recommendedCar.carNo}호차</strong> (잔여{' '}
                          <span className="num">{recommendedCar.remaining}</span>석)
                        </>
                      )}
                    </p>
                    {recommendedCar.carNo !== selectedCarNo && (
                      <button
                        type="button"
                        className="ui-btn ui-btn--neutral ui-btn--sm car-tip__go"
                        onClick={() => handleSelectCar(recommendedCar.carNo)}
                        aria-label={`${recommendedCar.carNo}호차로 이동`}
                      >
                        이동
                      </button>
                    )}
                  </div>
                )}

                <div className="train-formation" role="group" aria-label="호차 선택 (열차 편성)">
                  <div className="train-formation__scroll" ref={formationScrollRef}>
                    <div className="train-formation__track">
                      <span className="train-formation__nose" aria-hidden="true">
                        <TrainNoseIcon />
                      </span>
                      {KTX_CARS.map((car) => {
                        const isSelected = selectedCarNo === car.carNo;
                        const seatsChosenInThisCar = selectedSeats.filter((s) => s.carNo === car.carNo).length;
                        const remaining = getRemainingSeats(car);
                        const isSoldOut = remaining === 0;
                        const level = carLevel(remaining, car.seats);

                        return (
                          <button
                            key={car.carNo}
                            type="button"
                            className={`car car--${level} ${isSelected ? 'is-selected' : ''} ${isSoldOut ? 'is-soldout' : ''}`}
                            aria-pressed={isSelected}
                            disabled={isSoldOut}
                            onClick={() => handleSelectCar(car.carNo)}
                          >
                            {remaining !== null && !isSoldOut && (
                              <span className="car__heat" aria-hidden="true">
                                <span className="car__fill" style={{ transform: `scaleY(${Math.min(1, remaining / car.seats)})` }} />
                              </span>
                            )}
                            <span className="car__windows" aria-hidden="true" />
                            <span className="car__no num">
                              {car.carNo}
                              <small>호차</small>
                            </span>
                            <span className="car__seats num">
                              {isSoldOut
                                ? '매진'
                                : remaining === null
                                ? `총 ${car.seats}석`
                                : `잔여 ${remaining}석`}
                              {CAR_LEVEL_LABEL[level] && !isSoldOut && <span className="sr-only">, {CAR_LEVEL_LABEL[level]}</span>}
                            </span>
                            {recommendedCar?.carNo === car.carNo && <span className="car__tag">여유</span>}
                            {seatsChosenInThisCar > 0 && (
                              <span className="car__chosen num">
                                <span className="sr-only">선택 </span>
                                {seatsChosenInThisCar}석
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="coach-seatmap-card">
                <div className="seatmap-top-bar">
                  <div className="direction-indicator">
                    <ArrowUpIcon size={14} className="dir-icon" />
                    <span>
                      열차 진행 방향 ({activeLeg === 'outbound' ? bookingInfo.arrStation : bookingInfo.depStation} 방면)
                    </span>
                  </div>

                  <ul className="seatmap-legend" aria-label="좌석 범례">
                    <li className="legend-item">
                      <span className="legend-box available" aria-hidden="true" />
                      <span>선택가능</span>
                    </li>
                    <li className="legend-item">
                      <span className="legend-box selected" aria-hidden="true">
                        <CheckIcon size={12} />
                      </span>
                      <span>선택한 좌석</span>
                    </li>
                    <li className="legend-item">
                      <span className="legend-box occupied" aria-hidden="true">
                        <CloseIcon size={12} />
                      </span>
                      <span>예약됨 (매진)</span>
                    </li>
                  </ul>
                </div>

                <div className="auto-pick" role="group" aria-label="좌석 자동 배정">
                  <div className="auto-pick__pref">
                    <span className="auto-pick__label" id="auto-pick-pref-label">선호 좌석</span>
                    <div className="ui-segment" role="group" aria-labelledby="auto-pick-pref-label">
                      {SEAT_PREFS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={seatPref === value}
                          onClick={() => setSeatPref(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn--weak auto-pick__btn"
                    disabled={seatNeed < 1}
                    aria-describedby="auto-pick-hint"
                    onClick={handleAutoAssign}
                  >
                    <SparkleIcon size={16} />
                    자동 배정
                  </button>
                  <p id="auto-pick-hint" className="auto-pick__hint">
                    {seatNeed < 1
                      ? `${isRoundTrip ? `${legLabelNow} ` : ''}좌석 ${targetSeatCount}석을 모두 선택했습니다. 바꾸려면 선택한 좌석을 먼저 취소해 주세요.`
                      : `${currentCar.carNo}호차에서 ${isRoundTrip ? `${legLabelNow} ` : ''}${seatNeed}석을 골라 드립니다. 일행이면 붙은 자리를 먼저 찾습니다.`}
                  </p>
                </div>

                <div className="coach-fuselage">
                  <div className="seatmap-columns-head" aria-hidden="true">
                    <div className="col-pair-head">
                      <span className="col-title window">A (창가)</span>
                      <span className="col-title">B (복도)</span>
                    </div>
                    <div className="aisle-title-space">통로</div>
                    <div className="col-pair-head">
                      <span className="col-title">C (복도)</span>
                      <span className="col-title window">D (창가)</span>
                    </div>
                  </div>

                  <div className="coach-rows-container">
                    {Array.from({ length: currentCar.rows }, (_, i) => i + 1).map((row) => (
                      <div key={row} className="coach-row">
                        <span className="window-mark left" aria-hidden="true"></span>

                        <div className="seat-pair left">
                          {leftColumns.map((col, colIdx) => renderSeat(row, col, (row - 1) * 4 + colIdx))}
                        </div>

                        <div className="aisle-divider-box">
                          <span className="row-num-badge num">{row}</span>
                        </div>

                        <div className="seat-pair right">
                          {rightColumns.map((col, colIdx) => renderSeat(row, col, (row - 1) * 4 + 2 + colIdx))}
                        </div>

                        <span className="window-mark right" aria-hidden="true"></span>
                      </div>
                    ))}
                  </div>

                  <div className="coach-exit-foot">
                    <ChevronDownIcon size={14} />
                    <span>객실 연결 통로 및 화장실</span>
                    <ChevronDownIcon size={14} />
                  </div>
                </div>
              </div>
            </div>

            <aside className="checkout-sidebar-area" aria-label="승차권 예매 내역">
              <div className="ticket checkout-ticket">
                <div className="ticket__main checkout-ticket__main">
                  <div className="checkout-card-header">
                    <span className="card-sub-title">승차권 예매 내역</span>
                    <div className="checkout-train">
                      <span className="badge-ktx">KTX</span>
                      <h3 className="card-main-title">{bookingInfo.trainName}</h3>
                    </div>
                    <span className="card-gen-info">KTX 20량 편성 · 일반실</span>
                  </div>

                  <div className="checkout-route">
                    <RouteLine
                      size="md"
                      depTime={bookingInfo.depTime}
                      arrTime={bookingInfo.arrTime}
                      depStation={bookingInfo.depStation}
                      arrStation={bookingInfo.arrStation}
                      duration={bookingInfo.duration}
                    />
                    <p className="checkout-date num">
                      <CalendarIcon size={14} />
                      {bookingInfo.depDate}
                    </p>
                  </div>

                  <dl className="checkout-meta">
                    <div>
                      <dt>승객 인원</dt>
                      <dd>{bookingInfo.passenger}</dd>
                    </div>
                    <div>
                      <dt>여정</dt>
                      <dd>{bookingInfo.tripType} · 일반실</dd>
                    </div>
                  </dl>

                  <div className="checkout-section-block">
                    <div className="block-title-row">
                      <span className="block-name">
                        {isRoundTrip ? `가는 편 지정 좌석 (${targetSeatCount}석)` : `지정 좌석 (${targetSeatCount}석)`}
                      </span>
                      <span className={`chip seat-state num ${isOutboundComplete ? 'seat-state--done' : 'seat-state--pending'}`}>
                        {isOutboundComplete && <CheckIcon size={12} />}
                        {isOutboundComplete
                          ? '선택 완료'
                          : `${outboundSeats.length}/${targetSeatCount}석 선택 중`}
                      </span>
                    </div>

                    <div className="selected-seat-chips-box" aria-live="polite">
                      {outboundSeats.length > 0 ? (
                        renderSeatChips(outboundSeats, 'outbound')
                      ) : (
                        <div className="empty-seat-notice">
                          좌측 객실 배치도에서 원하시는 좌석을 클릭하여 지정해 주세요.
                        </div>
                      )}
                    </div>
                  </div>

                  {isRoundTrip && (
                    <div className="checkout-section-block">
                      <div className="block-title-row">
                        <span className="block-name">오는 편 지정 좌석 ({targetSeatCount}석)</span>
                        <span className={`chip seat-state num ${isReturnComplete ? 'seat-state--done' : 'seat-state--pending'}`}>
                          {isReturnComplete && <CheckIcon size={12} />}
                          {isReturnComplete
                            ? '선택 완료'
                            : `${returnSeats.length}/${targetSeatCount}석 선택 중`}
                        </span>
                      </div>

                      <div className="selected-seat-chips-box" aria-live="polite">
                        {returnSeats.length > 0 ? (
                          renderSeatChips(returnSeats, 'return')
                        ) : (
                          <div className="empty-seat-notice">
                            {activeLeg === 'return'
                              ? '좌측 객실 배치도에서 오는 편 좌석을 선택해 주세요.'
                              : (
                                <button
                                  type="button"
                                  className="ui-btn ui-btn--weak ui-btn--sm btn-switch-return-inline"
                                  onClick={() => setActiveLeg('return')}
                                >
                                  오는 편 좌석 선택하러 가기
                                  <ArrowRightIcon size={14} />
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="fare-summary-block">
                    <div className="fare-calc-row">
                      <span className="fare-k">기본 운임 (1인 일반실)</span>
                      <span className="fare-v num">{bookingInfo.unitPrice.toLocaleString()}원</span>
                    </div>
                    <div className="fare-calc-row">
                      <span className="fare-k">
                        {isRoundTrip ? `가는 편 (${targetSeatCount}명)` : `예매 승객 (${targetSeatCount}명)`}
                      </span>
                      <span className="fare-v num">× {outboundSeats.length}석</span>
                    </div>
                    {isRoundTrip && (
                      <div className="fare-calc-row">
                        <span className="fare-k">오는 편 ({targetSeatCount}명)</span>
                        <span className="fare-v num">× {returnSeats.length}석</span>
                      </div>
                    )}
                  </div>

                  <div className="checkout-guarantee-note">
                    <span><ClockIcon size={13} /> 좌석을 확정하면 {HOLD_MINUTES}분간 선점되며, 그 안에 결제를 완료해야 합니다.</span>
                    <span>결제는 다음 단계에서 진행합니다.</span>
                  </div>
                </div>

                <div className="ticket__stub checkout-ticket__stub">
                  <div className="checkout-total">
                    <span className="total-label">총 결제 금액 ({bookingInfo.tripType})</span>
                    <strong className="total-price-num num">
                      {totalPrice.toLocaleString()}
                      <span>원</span>
                    </strong>
                  </div>

                  <button
                    type="button"
                    className={`ui-btn ui-btn--lg ui-btn--block btn-checkout-primary${isHolding ? ' is-loading' : ''}`}
                    disabled={!isSelectionComplete}
                    aria-busy={isHolding}
                    aria-describedby={isSelectionComplete ? undefined : 'seat-hold-hint'}
                    onClick={handleHoldSeats}
                  >
                    {isHolding ? (
                      <>
                        <SpinnerIcon size={18} className="btn-spinner" />
                        <span>좌석 선점 중...</span>
                      </>
                    ) : (
                      <>
                        <span>좌석 확정하고 결제 단계로</span>
                        <ArrowRightIcon size={18} className="btn-arrow" />
                      </>
                    )}
                  </button>
                  {!isSelectionComplete && (
                    <p id="seat-hold-hint" className="checkout-hint">
                      {!isOutboundComplete
                        ? `${isRoundTrip ? '가는 편 ' : ''}좌석 ${targetSeatCount - outboundSeats.length}석을 더 선택해 주세요`
                        : `오는 편 좌석 ${targetSeatCount - returnSeats.length}석을 더 선택해 주세요`}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 'pay' && holds && (
          <div className="reservation-layout-grid pay-layout">
            <section className="pay-panel" aria-labelledby="pay-panel-title">
              <h2 id="pay-panel-title" className="section-title" ref={payHeadingRef} tabIndex={-1}>
                결제 정보 입력
              </h2>
              <p className="pay-panel__lead">
                좌석이 선점되었습니다. 결제 정보를 입력하고 시간 안에 결제를 완료해 주세요.
              </p>

              <PaymentPanel
                ref={payPanelRef}
                formId={PAY_FORM_ID}
                method={paymentMethod}
                onMethodChange={setPaymentMethod}
                disabled={isPaying || isReleasing}
                order={orderParts}
                onSubmit={handleSubmitPayment}
              />
            </section>

            <aside className="checkout-sidebar-area" aria-label="결제 금액">
              <div className="ticket checkout-ticket">
                <div className="ticket__main checkout-ticket__main">
                  <div className="checkout-card-header">
                    <span className="card-sub-title">결제 금액</span>
                    <div className="checkout-train">
                      <span className="badge-ktx">KTX</span>
                      <h3 className="card-main-title">{bookingInfo.trainName}</h3>
                    </div>
                  </div>

                  <dl className="fare-summary-block">
                    <div className="fare-calc-row">
                      <dt className="fare-k">
                        운임 (<span className="num">{bookingInfo.unitPrice.toLocaleString()}</span>원 ×{' '}
                        <span className="num">{targetSeatCount}</span>명{isRoundTrip ? ' × 왕복' : ''})
                      </dt>
                      <dd className="fare-v num">{totalPrice.toLocaleString()}원</dd>
                    </div>
                    <div className="fare-calc-row">
                      <dt className="fare-k">할인</dt>
                      <dd className="fare-v num">0원</dd>
                    </div>
                    <div className="fare-calc-row">
                      <dt className="fare-k">수수료</dt>
                      <dd className="fare-v num">0원</dd>
                    </div>
                  </dl>

                  <div className="checkout-section-block">
                    <div className="block-title-row">
                      <span className="block-name">
                        {isRoundTrip ? '가는 편 선점 좌석' : '선점 좌석'} (<span className="num">{holds.seats.length}</span>석)
                      </span>
                      <span className="chip seat-state seat-state--done">
                        <LockIcon size={12} />
                        선점 중
                      </span>
                    </div>
                    <div className="selected-seat-chips-box is-locked">
                      {renderSeatChips(holds.seats, 'outbound', true)}
                    </div>
                  </div>

                  {isRoundTrip && returnSeats.length > 0 && (
                    <div className="checkout-section-block">
                      <div className="block-title-row">
                        <span className="block-name">
                          오는 편 선택 좌석 (<span className="num">{returnSeats.length}</span>석)
                        </span>
                      </div>
                      <div className="selected-seat-chips-box is-locked">
                        {renderSeatChips(returnSeats, 'return', true)}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="ui-btn ui-btn--neutral ui-btn--block btn-reselect"
                    onClick={handleReselect}
                    disabled={isPaying || isReleasing}
                    aria-busy={isReleasing}
                  >
                    {isReleasing ? <SpinnerIcon size={16} className="btn-spinner" /> : <ArrowLeftIcon size={16} />}
                    <span>{isReleasing ? '좌석 해제 중...' : '좌석 다시 선택'}</span>
                  </button>
                </div>

                <div className="ticket__stub checkout-ticket__stub">
                  <div className="checkout-total">
                    <span className="total-label">총 결제 금액 ({bookingInfo.tripType})</span>
                    <strong className="total-price-num num">
                      {totalPrice.toLocaleString()}
                      <span>원</span>
                    </strong>
                  </div>

                  <button
                    type="submit"
                    form={PAY_FORM_ID}
                    className={`ui-btn ui-btn--lg ui-btn--block btn-checkout-primary${isPaying ? ' is-loading' : ''}`}
                    disabled={isReleasing}
                    aria-busy={isPaying}
                  >
                    {isPaying ? (
                      <>
                        <SpinnerIcon size={18} className="btn-spinner" />
                        <span>결제 처리 중...</span>
                      </>
                    ) : (
                      <>
                        <span className="num">{totalPrice.toLocaleString()}원 결제하기</span>
                        <ArrowRightIcon size={18} className="btn-arrow" />
                      </>
                    )}
                  </button>

                  <div className="pay-assure">
                    <p>결제 시 위 약관에 동의한 것으로 간주합니다.</p>
                    <p className="pay-assure__secure">
                      <LockIcon size={13} />
                      안전 결제
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            {isPaying && payProgress && <PaymentOverlay message={payProgress} deadline={holds.deadline} />}
          </div>
        )}

        {step === 'done' && receipt && (
          <section className="done-panel" aria-labelledby="done-title">
            <div className="done-hero">
              <span className="done-check" aria-hidden="true">
                <CheckIcon size={36} />
              </span>
              <h2 id="done-title" className="done-title" ref={doneHeadingRef} tabIndex={-1}>
                발권이 완료되었습니다
              </h2>
              <p className="done-lead">승차권은 마이페이지에서 언제든 다시 확인할 수 있습니다.</p>
            </div>

            <div className="ticket done-ticket">
              <div className="ticket__main done-ticket__main">
                <div className="checkout-card-header">
                  <span className="card-sub-title">KTX 승차권</span>
                  <div className="checkout-train">
                    <span className="badge-ktx">KTX</span>
                    <h3 className="card-main-title">{bookingInfo.trainName}</h3>
                  </div>
                </div>

                <div className="checkout-route">
                  <RouteLine
                    size="md"
                    depTime={bookingInfo.depTime}
                    arrTime={bookingInfo.arrTime}
                    depStation={bookingInfo.depStation}
                    arrStation={bookingInfo.arrStation}
                    duration={bookingInfo.duration}
                  />
                </div>

                <dl className="done-meta">
                  <div>
                    <dt>열차</dt>
                    <dd>{bookingInfo.trainName} · {bookingInfo.tripType}</dd>
                  </div>
                  <div>
                    <dt>탑승일</dt>
                    <dd className="num">{bookingInfo.depDate}</dd>
                  </div>
                  <div className="done-meta__wide">
                    <dt>{isRoundTrip ? '가는 편 좌석' : '좌석'}</dt>
                    <dd className="done-chips">{renderSeatChips(receipt.seats, 'outbound', true)}</dd>
                  </div>
                  {isRoundTrip && receipt.returnSeats.length > 0 && (
                    <div className="done-meta__wide">
                      <dt>오는 편 좌석</dt>
                      <dd className="done-chips">{renderSeatChips(receipt.returnSeats, 'return', true)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>결제 수단</dt>
                    <dd>{receipt.payLabel}</dd>
                  </div>
                  <div>
                    <dt>결제 시각</dt>
                    <dd className="num">{receipt.approvedAt}</dd>
                  </div>
                </dl>
              </div>

              <div className="ticket__stub done-ticket__stub">
                <div className="done-stub-block">
                  <span className="total-label">승차권 번호</span>
                  <strong className="done-ticket-no num">{receipt.ticketNumber || '마이페이지에서 확인'}</strong>
                </div>
                <div className="done-stub-block">
                  <span className="total-label">결제 금액</span>
                  <strong className="total-price-num num">
                    {receipt.amount.toLocaleString()}
                    <span>원</span>
                  </strong>
                </div>
              </div>
            </div>

            <div className="done-actions">
              <button type="button" className="ui-btn ui-btn--lg ui-btn--block btn-checkout-primary done-btn" onClick={() => navigate('/mypage', { replace: true })}>
                <span>마이페이지에서 승차권 확인</span>
                <ArrowRightIcon size={18} className="btn-arrow" />
              </button>
              <button type="button" className="ui-btn ui-btn--neutral ui-btn--lg ui-btn--block done-btn" onClick={() => navigate('/')}>
                <span>메인으로</span>
              </button>
            </div>
          </section>
        )}
      </main>

      <QuickMenu />
      <Footer />
    </div>
  );
}
