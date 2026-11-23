import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import QuickMenu from '../../components/QuickMenu/QuickMenu';
import RouteLine from '../../components/RouteLine/RouteLine';
import LineTag from '../../components/LineTag/LineTag';
import OccupancyMeter from '../../components/OccupancyMeter/OccupancyMeter';
import {
  departureHint,
  bookingOpenHint,
  nextAvailable,
  quickDates,
  loadRecentRoutes,
  saveRecentRoute,
} from '../../lib/trainDomain';
import client from '../Api/client';
import { notify } from '../../components/Dialog/dialogService';
import useWishStore from '../../store/useWishStore';
import './MainPage.css';

const DEFAULT_STATIONS = ['서울', '용산', '부산', '목포', '여수EXPO', '진주', '포항', '광주송정'];

/* ---------- 인라인 SVG 아이콘 (굵기 2, 둥근 끝) ---------- */
const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const ChevronDownIcon = ({ className }) => (
  <svg {...iconProps} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SwapIcon = () => (
  <svg {...iconProps} width={22} height={22} className="mp-swap__icon">
    <path d="M4 8h15M15 4l4 4-4 4" />
    <path d="M20 16H5M9 12l-4 4 4 4" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg {...iconProps} width={18} height={18}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const MinusIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12h14" />
  </svg>
);

const PlusIcon = () => (
  <svg {...iconProps}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg {...iconProps} fill={filled ? 'currentColor' : 'none'}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

/* 선택됨 표시용 체크 (색만으로 상태를 구분하지 않는다) */
const CheckIcon = () => (
  <svg {...iconProps} width={16} height={16} strokeWidth={2.5}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/* 출발 임박 · 예매 오픈 안내 아이콘 (색만으로 구분하지 않도록 글자와 함께 쓴다) */
const ClockIcon = () => (
  <svg {...iconProps} width={16} height={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const AlertIcon = () => (
  <svg {...iconProps} width={16} height={16}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const CalendarIcon = () => (
  <svg {...iconProps} width={16} height={16}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </svg>
);

/* 노선 모티프: ●──○ */
const RouteMotif = () => (
  <svg className="mp-intro__mark" width="30" height="14" viewBox="0 0 30 14" fill="none" aria-hidden="true" focusable="false">
    <circle cx="5" cy="7" r="3.5" fill="currentColor" />
    <path d="M8.5 7h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="25" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/* 히어로 장식: 선로 위를 달리는 긴 유선형 열차 실루엣 + 속도선 (아주 옅게, 장식 전용) */
const HeroTrainArt = () => (
  <svg className="mp-intro__deco" width="400" height="110" viewBox="0 0 400 110" fill="none" aria-hidden="true" focusable="false">
    {/* 선로: 레일 두 줄 + 침목 */}
    <path d="M0 96h400" stroke="currentColor" strokeWidth="10" strokeDasharray="3 13" opacity="0.6" />
    <path d="M0 91h400M0 101h400" stroke="currentColor" strokeWidth="2" />
    {/* 속도선 */}
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M8 40h40" />
      <path d="M0 54h50" />
      <path d="M14 68h34" />
    </g>
    {/* 차체 */}
    <path
      d="M74 28H300C346 28 380 46 395 76C395.6 78 394.4 80 392.5 80H74a12 12 0 0 1-12-12V40a12 12 0 0 1 12-12z"
      fill="currentColor"
    />
    {/* 객차 이음선과 창문 */}
    <g stroke="var(--white)" strokeWidth="2">
      <path d="M146 28v52M230 28v52M314 28v52" />
    </g>
    <g fill="var(--white)">
      <rect x="72" y="40" width="16" height="12" rx="4" />
      <rect x="96" y="40" width="16" height="12" rx="4" />
      <rect x="120" y="40" width="16" height="12" rx="4" />
      <rect x="156" y="40" width="16" height="12" rx="4" />
      <rect x="180" y="40" width="16" height="12" rx="4" />
      <rect x="204" y="40" width="16" height="12" rx="4" />
      <rect x="240" y="40" width="16" height="12" rx="4" />
      <rect x="264" y="40" width="16" height="12" rx="4" />
      <rect x="288" y="40" width="16" height="12" rx="4" />
      <rect x="324" y="40" width="16" height="12" rx="4" />
      <path d="M344 40h8c10 0 18 6 24 18h-32z" />
    </g>
    {/* 바퀴 */}
    <g fill="currentColor">
      <circle cx="100" cy="84" r="5" />
      <circle cx="128" cy="84" r="5" />
      <circle cx="184" cy="84" r="5" />
      <circle cx="212" cy="84" r="5" />
      <circle cx="268" cy="84" r="5" />
      <circle cx="296" cy="84" r="5" />
      <circle cx="352" cy="84" r="5" />
      <circle cx="372" cy="84" r="5" />
    </g>
  </svg>
);

/* 빈 상태 일러스트: 비어 있는 승차권 + 끊어진 노선 */
const EmptyTicketArt = () => (
  <svg className="mp-empty__art" width="132" height="84" viewBox="0 0 132 84" fill="none" aria-hidden="true" focusable="false">
    <rect x="6" y="10" width="120" height="64" rx="10" stroke="var(--gray-400)" strokeWidth="2" />
    <path d="M92 10v64" stroke="var(--gray-400)" strokeWidth="2" strokeDasharray="4 5" />
    <circle cx="92" cy="10" r="6" fill="var(--white)" stroke="var(--gray-400)" strokeWidth="2" />
    <circle cx="92" cy="74" r="6" fill="var(--white)" stroke="var(--gray-400)" strokeWidth="2" />
    <circle cx="22" cy="42" r="5" fill="var(--ktx-blue)" />
    <path d="M30 42h18M58 42h10" stroke="var(--ktx-blue)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="76" cy="42" r="4" stroke="var(--gray-400)" strokeWidth="2" />
  </svg>
);

function getLocalDateYMD(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalDateYMD(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeHHMM(timestamp) {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function calcDurationText(depTs, arrTs) {
  if (!depTs || !arrTs) return '-';
  const dep = new Date(depTs).getTime();
  const arr = new Date(arrTs).getTime();
  if (Number.isNaN(dep) || Number.isNaN(arr) || arr <= dep) return '-';
  const mins = Math.round((arr - dep) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function mapPreviewSchedule(item) {
  const trainNoStr = String(item.trainno ?? '').padStart(3, '0');
  const availableCount = item.availableSeats ?? 0;
  return {
    id: item.schedule_seq,
    scheduleSeq: item.schedule_seq,
    name: `KTX ${trainNoStr}`,
    type: item.vehiclekndnm || 'KTX',
    depStationName: item.depStationName || item.depplacename || '-',
    arrStationName: item.arrStationName || item.arrplacename || '-',
    depTime: formatTimeHHMM(item.depplandtime),
    arrTime: formatTimeHHMM(item.arrplandtime),
    depDateRaw: formatLocalDateYMD(item.depplandtime),
    duration: calcDurationText(item.depplandtime, item.arrplandtime),
    price: Number(item.standard_price || 0).toLocaleString(),
    status: availableCount > 0 ? '예매가능' : '매진',
    // 도메인 표시용 원본 값 (lib/trainDomain 의 helper 가 읽는 필드 이름 그대로)
    availableSeats: availableCount,
    schedule_seq: item.schedule_seq,
    depplandtime: item.depplandtime,
    arrplandtime: item.arrplandtime,
    booking_open_at: item.booking_open_at,
    lineCategory: item.lineCategory || '',
    firstPrice: item.first_price ? Number(item.first_price).toLocaleString() : '',
  };
}

export default function MainPage() {
  const todayStr = getLocalDateYMD(0);
  const [stationOptions, setStationOptions] = useState(DEFAULT_STATIONS);
  const [tripType, setTripType] = useState('편도');
  const [departureStation, setDepartureStation] = useState('서울');
  const [arrivalStation, setArrivalStation] = useState('부산');
  const [departureDate, setDepartureDate] = useState(todayStr);
  const [returnDate, setReturnDate] = useState(() => getLocalDateYMD(1));
  const [hasSelectedCondition, setHasSelectedCondition] = useState(false);
  const [isLoadingTrains, setIsLoadingTrains] = useState(false);
  const navigate = useNavigate();

  const handleDepartureDateChange = (nextDate) => {
    const safeDate = nextDate && nextDate < todayStr ? todayStr : nextDate;
    setDepartureDate(safeDate);
    setHasSelectedCondition(true);
    if (safeDate && returnDate && returnDate < safeDate) {
      setReturnDate(safeDate);
    }
  };

  const [passengers, setPassengers] = useState({
    adult: 1,
  });

  const [isPassengerOpen, setIsPassengerOpen] = useState(false);
  const passengerRef = useRef(null);

  // 빠른 조회 도구: 날짜 칩, 최근 구간 (최근 구간은 브라우저 localStorage, 개인 편의)
  const dateChips = quickDates();
  const [recentRoutes] = useState(loadRecentRoutes);

  // "출발까지 N분" 은 실제 시각 기준이므로 1분마다 다시 그려서 값이 굳지 않게 한다
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (passengerRef.current && !passengerRef.current.contains(event.target)) {
        setIsPassengerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const totalPassengerCount = passengers.adult;

  const handlePassengerChange = (delta) => {
    setPassengers((prev) => {
      const nextVal = prev.adult + delta;
      if (nextVal > 9) {
        notify.warning('승차권은 1회 최대 9명까지 예매하실 수 있습니다.');
        return prev;
      }
      if (nextVal < 1) {
        notify.warning('최소 1명 이상의 승객을 선택해야 합니다.');
        return prev;
      }
      return { adult: nextVal };
    });
  };

  const passengerSummaryText = `어른 ${passengers.adult}명`;

  const handleDepartureStationChange = (newDep) => {
    setDepartureStation(newDep);
    setHasSelectedCondition(true);
    if (arrivalStation === newDep) {
      const fallback = stationOptions.find((st) => st !== newDep) || '부산';
      setArrivalStation(fallback);
    }
  };

  const handleArrivalStationChange = (newArr) => {
    setArrivalStation(newArr);
    setHasSelectedCondition(true);
    if (departureStation === newArr) {
      const fallback = stationOptions.find((st) => st !== newArr) || '서울';
      setDepartureStation(fallback);
    }
  };

  const handleSwapStations = () => {
    const temp = departureStation;
    setDepartureStation(arrivalStation);
    setArrivalStation(temp);
    setHasSelectedCondition(true);
  };

  const visibleRecentRoutes = recentRoutes.filter(
    (r) => stationOptions.includes(r.dep) && stationOptions.includes(r.arr)
  );

  const handlePickRecentRoute = (route) => {
    setDepartureStation(route.dep);
    setArrivalStation(route.arr);
    setHasSelectedCondition(true);
  };

  const handleSearch = () => {
    saveRecentRoute(departureStation, arrivalStation);
    navigate('/schedule', {
      state: {
        departureStation,
        arrivalStation,
        departureDate,
        returnDate: tripType === '왕복' ? returnDate : null,
        passengerCount: passengerSummaryText,
        passengerDetail: passengers,
        tripType,
      }
    });
  };

  const formatDepartureDate = (dateStr) => {
    if (!dateStr) return '2026-11-16 (월)';
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return `${dateStr} (${days[d.getDay()]})`;
  };

  const handleGoToScheduleBooking = (train) => {
    const formattedDate = formatDepartureDate(train.depDateRaw || departureDate);
    navigate('/reservation', {
      state: {
        scheduleSeq: train.scheduleSeq || train.id || 1,
        trainName: train.name,
        trainType: 'KTX',
        depTime: train.depTime,
        arrTime: train.arrTime,
        duration: train.duration,
        depStation: train.depStationName || departureStation,
        arrStation: train.arrStationName || arrivalStation,
        depDate: formattedDate,
        returnDate: tripType === '왕복' ? formatDepartureDate(returnDate) : null,
        tripType,
        passenger: passengerSummaryText,
        passengerDetail: passengers,
        seatType: '일반실',
        price: train.price,
      }
    });
  };

  // 찜하기 중앙 스토어 연동 (메인·시각표·마이페이지 공통)
  const { fetchWishList, toggleWish, isWish } = useWishStore();

  useEffect(() => {
    fetchWishList();
  }, [fetchWishList]);

  useEffect(() => {
    client
      .get('/station')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const names = Array.from(new Set(res.data.map((st) => st.nodename).filter(Boolean)));
          if (names.length > 0) {
            setStationOptions(names);
          }
        }
      })
      .catch(() => {});
  }, []);

  const [previewTrains, setPreviewTrains] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadPreviewSchedules = async () => {
      setIsLoadingTrains(true);
      try {
        let rows = [];
        if (hasSelectedCondition) {
          const res = await client.get('/schedule', {
            params: {
              depStation: departureStation,
              arrStation: arrivalStation,
              date: departureDate,
              page: 1,
              size: 5,
            },
          });
          rows = Array.isArray(res.data?.schedules) ? res.data.schedules.map(mapPreviewSchedule) : [];
        } else {
          // 기본: 현재 시각 기준 가장 최신(곧 출발하는) 스케줄 5개
          const res = await client.get('/schedule', {
            params: { page: 1, size: 5, upcoming: true },
          });
          rows = Array.isArray(res.data?.schedules) ? res.data.schedules.map(mapPreviewSchedule) : [];
          if (rows.length === 0) {
            const fallbackRes = await client.get('/schedule', {
              params: { page: 1, size: 5 },
            });
            rows = Array.isArray(fallbackRes.data?.schedules)
              ? fallbackRes.data.schedules.map(mapPreviewSchedule)
              : [];
          }
        }

        if (!cancelled) {
          setPreviewTrains(rows.slice(0, 5));
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewTrains([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTrains(false);
        }
      }
    };

    loadPreviewSchedules();
    return () => {
      cancelled = true;
    };
  }, [hasSelectedCondition, departureStation, arrivalStation, departureDate]);

  return (
    <div className="main-page-wrapper">
      <Header showTopBar={true} />

      <main className="main-container">
        <section className="mp-intro" aria-labelledby="mp-intro-title">
          <HeroTrainArt />
          <span className="mp-intro__tag">
            <RouteMotif />
            TAGO KTX 공식 예매
          </span>
          <h1 className="ui-title mp-intro__title" id="mp-intro-title">더 빠르고 정밀한 고속철도 여정</h1>
          <p className="mp-intro__sub">전국 KTX 전 노선의 실시간 운행 시각표를 확인하고 간편하게 예매하세요.</p>
        </section>

        <section className="mp-search ui-card" aria-label="승차권 조회">
          <div className="ui-segment mp-seg" role="group" aria-label="여정 유형">
            <button type="button" aria-pressed={tripType === '편도'} onClick={() => setTripType('편도')}>
              편도
            </button>
            <button type="button" aria-pressed={tripType === '왕복'} onClick={() => setTripType('왕복')}>
              왕복
            </button>
          </div>

          {visibleRecentRoutes.length > 0 && (
            <div className="mp-recent" role="group" aria-label="최근 조회 구간">
              <span className="ui-field__label">최근 구간</span>
              <div className="mp-chips">
                {visibleRecentRoutes.map((r) => {
                  const selected = departureStation === r.dep && arrivalStation === r.arr;
                  return (
                    <button
                      type="button"
                      key={`${r.dep}-${r.arr}`}
                      className="ui-btn ui-btn--neutral ui-btn--sm mp-chip"
                      aria-pressed={selected}
                      aria-label={`최근 구간 ${r.dep} 출발 ${r.arr} 도착 선택`}
                      onClick={() => handlePickRecentRoute(r)}
                    >
                      {selected && <CheckIcon />}
                      {r.dep}
                      <ArrowRightIcon />
                      {r.arr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mp-route">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="mp-dep-station">출발역</label>
              <div className="mp-select-wrap mp-select-wrap--dep">
                <select
                  id="mp-dep-station"
                  value={departureStation}
                  onChange={(e) => handleDepartureStationChange(e.target.value)}
                  className="ui-field__control mp-select"
                >
                  {stationOptions.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <ChevronDownIcon className="mp-select-wrap__chevron" />
              </div>
            </div>

            <div className="mp-route__mid">
              <button
                type="button"
                className="mp-swap"
                onClick={handleSwapStations}
                title="출발/도착역 전환"
                aria-label="출발역과 도착역 서로 바꾸기"
              >
                <SwapIcon />
              </button>
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="mp-arr-station">도착역</label>
              <div className="mp-select-wrap mp-select-wrap--arr">
                <select
                  id="mp-arr-station"
                  value={arrivalStation}
                  onChange={(e) => handleArrivalStationChange(e.target.value)}
                  className="ui-field__control mp-select"
                >
                  {stationOptions.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <ChevronDownIcon className="mp-select-wrap__chevron" />
              </div>
            </div>
          </div>

          <div className="mp-stops" role="group" aria-label="주요 정차역">
            <span className="ui-field__label">주요 정차역</span>
            <div className="mp-stops__row">
              {stationOptions
                .filter((st) => st !== departureStation)
                .map((st) => {
                  const selected = hasSelectedCondition && arrivalStation === st;
                  return (
                    <button
                      type="button"
                      key={st}
                      className="ui-btn ui-btn--neutral ui-btn--sm mp-stop"
                      aria-pressed={selected}
                      onClick={() => handleArrivalStationChange(st)}
                    >
                      {selected && <CheckIcon />}
                      {st}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="mp-meta">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="mp-dep-date">출발일</label>
              <input
                id="mp-dep-date"
                type="date"
                value={departureDate}
                min={todayStr}
                onChange={(e) => handleDepartureDateChange(e.target.value)}
                className="ui-field__control mp-date"
              />
              <div className="mp-chips" role="group" aria-label="출발일 빠른 선택">
                {dateChips.map((chip) => {
                  const selected = departureDate === chip.value;
                  return (
                    <button
                      type="button"
                      key={chip.label}
                      className="ui-btn ui-btn--neutral ui-btn--sm mp-chip"
                      aria-pressed={selected}
                      onClick={() => handleDepartureDateChange(chip.value)}
                    >
                      {selected && <CheckIcon />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="ui-field mp-pax"
              ref={passengerRef}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsPassengerOpen(false);
              }}
            >
              <span className="ui-field__label" id="mp-pax-label">승객 인원</span>
              <button
                type="button"
                className="ui-field__control mp-pax__trigger"
                onClick={() => setIsPassengerOpen((prev) => !prev)}
                aria-labelledby="mp-pax-label mp-pax-value"
                aria-haspopup="dialog"
                aria-expanded={isPassengerOpen}
                aria-controls="mp-pax-panel"
              >
                <span className="mp-pax__value" id="mp-pax-value">{passengerSummaryText}</span>
                <ChevronDownIcon className="mp-pax__chevron" />
              </button>

              {isPassengerOpen && (
                <div className="mp-pax__panel" id="mp-pax-panel" role="dialog" aria-label="인원 선택">
                  <div className="mp-pax__head">
                    <h4>인원 선택</h4>
                    <span className="mp-pax__hint">1회 최대 9명</span>
                  </div>

                  <div className="mp-pax__row">
                    <div className="mp-pax__cat">
                      <strong>어른</strong>
                      <span>만 19세 이상</span>
                    </div>
                    <div className="mp-stepper">
                      <button
                        type="button"
                        className="mp-stepper__btn"
                        disabled={passengers.adult <= 1}
                        onClick={() => handlePassengerChange(-1)}
                        aria-label="어른 인원 줄이기"
                      >
                        <MinusIcon />
                      </button>
                      <span className="mp-stepper__count num" aria-live="polite">{passengers.adult}</span>
                      <button
                        type="button"
                        className="mp-stepper__btn"
                        disabled={passengers.adult >= 9}
                        onClick={() => handlePassengerChange(1)}
                        aria-label="어른 인원 늘리기"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>

                  <div className="mp-pax__foot">
                    <span className="mp-pax__total">총 <strong className="num">{passengers.adult}명</strong></span>
                    <button
                      type="button"
                      className="ui-btn mp-pax__done"
                      onClick={() => setIsPassengerOpen(false)}
                    >
                      선택 완료
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {tripType === '왕복' && (
            <div className="mp-return">
              <div className="mp-route mp-route--return">
                <div className="ui-field">
                  <label className="ui-field__label" htmlFor="mp-ret-dep">귀가 출발역</label>
                  <input id="mp-ret-dep" type="text" readOnly value={arrivalStation} className="ui-field__control mp-readonly" />
                </div>
                <div className="mp-route__mid">
                  <span className="mp-arrow-static"><ArrowRightIcon /></span>
                </div>
                <div className="ui-field">
                  <label className="ui-field__label" htmlFor="mp-ret-arr">귀가 도착역</label>
                  <input id="mp-ret-arr" type="text" readOnly value={departureStation} className="ui-field__control mp-readonly" />
                </div>
              </div>

              <div className="mp-meta">
                <div className="ui-field">
                  <label className="ui-field__label" htmlFor="mp-ret-date">귀가일</label>
                  <input
                    id="mp-ret-date"
                    type="date"
                    value={returnDate}
                    min={departureDate || todayStr}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="ui-field__control mp-date"
                  />
                </div>
                <div className="ui-field">
                  <label className="ui-field__label" htmlFor="mp-ret-pax">인원</label>
                  <input id="mp-ret-pax" type="text" readOnly value={passengerSummaryText} className="ui-field__control mp-readonly" />
                </div>
              </div>
            </div>
          )}

          <button type="button" className="ui-btn ui-btn--lg ui-btn--block mp-search-btn" onClick={handleSearch}>
            <span>KTX 열차 조회</span>
            <ArrowRightIcon />
          </button>
        </section>

        <section className="mp-live">
          <div className="mp-live__head">
            <div>
              <h2 className="ui-heading">실시간 KTX 운행 현황</h2>
              <p className="mp-live__sub">
                {hasSelectedCondition
                  ? `${departureStation} ➔ ${arrivalStation} (${departureDate}) 구간의 주요 배차 현황입니다. (최대 5건)`
                  : '현재 시각 기준 곧 출발하는 최신 KTX 열차 5편성입니다.'}
              </p>
            </div>
            <button
              type="button"
              className="mp-more"
              onClick={() => navigate('/schedule')}
            >
              <span>전체 시간표 확인</span>
              <ArrowRightIcon />
            </button>
          </div>

          {isLoadingTrains ? (
            <div className="mp-loading" role="status">
              <p className="mp-loading__text">실시간 KTX 운행 정보를 불러오는 중입니다...</p>
              <ul className="mp-train-list" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="ticket mp-skel">
                    <div className="ticket__main">
                      <span className="mp-skel__bar mp-skel__bar--short" />
                      <span className="mp-skel__bar mp-skel__bar--long" />
                    </div>
                    <div className="ticket__stub">
                      <span className="mp-skel__bar mp-skel__bar--short" />
                      <span className="mp-skel__bar mp-skel__btn" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : previewTrains && previewTrains.length > 0 ? (
            <ul className="mp-train-list">
              {previewTrains.map((train) => {
                const wishKey = train.scheduleSeq || train.id;
                const wished = isWish(wishKey);
                const soldOut = train.status === '매진';
                const openHint = bookingOpenHint(train.booking_open_at);
                const isNotOpen = Boolean(openHint);
                const isUnavailable = soldOut || isNotOpen;
                const depHint = isUnavailable ? null : departureHint(train.depplandtime);
                // 매진이면 같은 구간에서 뒤에 출발하는 예매 가능(오픈된) 열차를 제안한다
                const altTrain =
                  soldOut && !isNotOpen
                    ? nextAvailable(
                        previewTrains.filter((t) => !bookingOpenHint(t.booking_open_at)),
                        train
                      )
                    : null;
                const reasonId = `mp-reason-${train.id}`;
                return (
                  <li key={train.id}>
                    <article className={`ticket mp-train${altTrain ? ' has-alt' : ''}`}>
                      <div className="ticket__main">
                        <div className="mp-train__head">
                          <span className="badge-ktx">{train.type}</span>
                          <LineTag line={train.lineCategory} />
                          <strong className="mp-train__name num">{train.name}</strong>
                        </div>
                        <RouteLine
                          size="md"
                          className="mp-train__route"
                          depTime={train.depTime}
                          arrTime={train.arrTime}
                          depStation={train.depStationName}
                          arrStation={train.arrStationName}
                          duration={train.duration === '-' ? undefined : train.duration}
                          line={train.lineCategory || undefined}
                        />
                        {depHint && (
                          <p className="mp-train__hint" data-tone={depHint.tone}>
                            {depHint.tone === 'warn' ? <AlertIcon /> : <ClockIcon />}
                            {depHint.text}
                          </p>
                        )}
                      </div>

                      <div className="ticket__stub">
                        <div className="mp-train__price">
                          <span className="mp-train__price-label">일반실 운임</span>
                          <strong className="mp-train__price-num num">{train.price}원</strong>
                          {train.firstPrice && (
                            <span className="mp-train__price-first num">특실 {train.firstPrice}원</span>
                          )}
                          {isNotOpen ? (
                            <span className="mp-train__open">
                              <CalendarIcon />
                              <span className="num">{openHint.text}</span>
                            </span>
                          ) : (
                            <OccupancyMeter available={train.availableSeats} />
                          )}
                        </div>
                        <div className="mp-train__actions">
                          <button
                            type="button"
                            className={`mp-heart ${wished ? 'active' : ''}`}
                            onClick={() => toggleWish(wishKey)}
                            title={wished ? '찜 해제' : '열차 찜하기'}
                            aria-label="열차 찜하기"
                            aria-pressed={wished}
                          >
                            <HeartIcon filled={wished} />
                          </button>
                          <button
                            type="button"
                            className="ui-btn mp-reserve"
                            disabled={isUnavailable}
                            aria-describedby={isNotOpen ? reasonId : undefined}
                            onClick={() => handleGoToScheduleBooking(train)}
                          >
                            {soldOut ? '매진' : '예매'}
                          </button>
                        </div>
                        {isNotOpen && (
                          <span id={reasonId} className="mp-train__reason">
                            예매 오픈 전입니다. <span className="num">{openHint.openAt}</span>부터 예매할 수 있습니다.
                          </span>
                        )}
                      </div>

                      {altTrain && (
                        <div className="mp-alt ui-row">
                          <div className="ui-row__main">
                            <span className="ui-row__title">
                              가까운 예매 가능 열차 <span className="num">{altTrain.depTime}</span> 출발 · 잔여{' '}
                              <span className="num">{altTrain.availableSeats.toLocaleString('ko-KR')}</span>석
                            </span>
                          </div>
                          <button
                            type="button"
                            className="ui-btn ui-btn--weak mp-alt__btn"
                            aria-label={`${altTrain.name} ${altTrain.depTime} 출발 열차로 예매하기`}
                            onClick={() => handleGoToScheduleBooking(altTrain)}
                          >
                            이 열차로 예매
                          </button>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mp-empty">
              <EmptyTicketArt />
              <p>실시간 KTX 운행 정보를 불러오는 중이거나 조회된 열차가 없습니다.</p>
            </div>
          )}
        </section>
      </main>

      <QuickMenu />
      <Footer />
    </div>
  );
}
