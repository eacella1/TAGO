import { Link, useLocation } from 'react-router-dom';
import './QuickMenu.css';

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

/* 승차권 예매: 절취선이 있는 티켓 */
const TicketIcon = () => (
  <svg {...svgProps}>
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
    <path d="M14 6v2.5M14 11v2M14 15.5V18" />
  </svg>
);

/* 운행 시각표: 시계 */
const ClockIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/* 발권 승차권: 체크가 있는 문서 */
const IssuedIcon = () => (
  <svg {...svgProps}>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg {...svgProps} width={16} height={16} strokeWidth={2}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

const MENU_ITEMS = [
  { to: '/', label: '승차권 예매', Icon: TicketIcon },
  { to: '/schedule', label: '운행 시각표', Icon: ClockIcon },
  { to: '/mypage', label: '발권 승차권', Icon: IssuedIcon },
];

export default function QuickMenu() {
  const location = useLocation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside className="quick-menu" aria-label="빠른 바로가기">
      <div className="quick-menu-header">
        <span className="quick-menu-title">빠른 바로가기</span>
      </div>
      <nav className="quick-menu-list">
        {MENU_ITEMS.map(({ to, label, Icon }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`quick-menu-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <button type="button" className="quick-top-btn" onClick={scrollToTop}>
        <ArrowUpIcon />
        <span>TOP</span>
      </button>
    </aside>
  );
}
