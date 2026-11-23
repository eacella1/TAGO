import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { dialog } from '../Dialog/dialogService';
import TrainMark from './TrainMark';
import NextDepartures from './NextDepartures';
import './Header.css';

/* 내비 아이콘: 굵기 2, 둥근 끝. 라벨은 항상 함께 보인다(아이콘은 장식). */
const navIconProps = {
  className: 'nav-link__icon',
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const TicketIcon = () => (
  <svg {...navIconProps}>
    <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.2a2.2 2.2 0 0 0 0 4.4V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3.4a2.2 2.2 0 0 0 0-4.4z" />
    <path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5" />
  </svg>
);

const ClockIcon = () => (
  <svg {...navIconProps}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

const PersonIcon = () => (
  <svg {...navIconProps}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </svg>
);

const NAV_ITEMS = [
  { to: '/', label: '승차권 예매', Icon: TicketIcon },
  { to: '/schedule', label: '운행 시각표', Icon: ClockIcon },
  { to: '/mypage', label: '마이페이지', Icon: PersonIcon },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/* 역 전광판의 현재 시각: HH:mm + 날짜. 30초마다 갱신 */
function StationClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} (${WEEKDAYS[now.getDay()]})`;

  return (
    <div className="station-clock">
      <span className="station-clock__dot" aria-hidden="true" />
      <span className="sr-only">현재 시각</span>
      <time className="station-clock__time num" dateTime={hhmm}>{hhmm}</time>
      <span className="station-clock__date num">{date}</span>
    </div>
  );
}

export default function Header({ showTopBar = true, simple = false, isLoggedIn = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.id);
  const logout = useAuthStore((state) => state.logout);

  const loggedIn = isLoggedIn || Boolean(token || sessionStorage.getItem('token'));
  const currentId = userId || sessionStorage.getItem('id');

  const handleLogout = async (e) => {
    e.preventDefault();
    // 원래 alert 는 화면을 멈춰 두었으므로, 로그아웃 상태 반영은 안내를 닫은 뒤에 한다.
    // (모달이 떠 있는 동안 먼저 반영하면 보호 페이지의 로그인 가드가 끼어든다)
    await dialog.alert('로그아웃되었습니다.', { tone: 'success' });
    logout();
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('id');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <>
      {showTopBar && (
        <div className="top-bar">
          <div className="top-bar-inner">
            <StationClock />
            <NextDepartures />
            <div className="top-bar-right">
              {loggedIn ? (
                <>
                  <Link to="/mypage">{currentId ? `${currentId}님` : '마이페이지'}</Link>
                  <span className="divider" aria-hidden="true">/</span>
                  <a href="#logout" onClick={handleLogout}>로그아웃</a>
                </>
              ) : (
                <>
                  <Link to="/login">로그인</Link>
                  <span className="divider" aria-hidden="true">/</span>
                  <Link to="/signup">회원가입</Link>
                </>
              )}
              <span className="divider" aria-hidden="true">/</span>
              <a href="#support">고객센터 1544-7788</a>
              <span className="divider" aria-hidden="true">/</span>
              <span className="lang-tag">KR</span>
            </div>
          </div>
        </div>
      )}

      <header className={`header ${showTopBar ? 'sticky' : ''}`}>
        <div className="header-container">
          <Link to="/" className="logo" aria-label="TAGO KTX 홈">
            <TrainMark />
            <span className="logo-brand">TAGO</span>
            <span className="logo-badge-ktx">KTX</span>
          </Link>

          {!simple && (
            <>
              <nav className="main-menu" aria-label="주요 메뉴">
                {NAV_ITEMS.map((item) => {
                  const { Icon } = item;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="member-menu">
                {loggedIn ? (
                  <button type="button" onClick={handleLogout} className="ui-btn ui-btn--neutral btn-auth logout">
                    로그아웃
                  </button>
                ) : (
                  <>
                    <Link to="/login" className="ui-btn ui-btn--neutral btn-auth login">로그인</Link>
                    <Link to="/signup" className="ui-btn btn-auth signup">회원가입</Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
}
