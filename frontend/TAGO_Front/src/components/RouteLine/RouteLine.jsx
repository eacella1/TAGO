import './RouteLine.css';

/**
 * 노선 라인: 출발 ●────[소요시간]────○ 도착
 * 시간표·예매내역·좌석선택 요약 등 "출발→도착"을 보여주는 모든 곳에서 재사용한다.
 *
 * size: 'lg' (시간표 행, 큰 시각) | 'md' (카드, 기본) | 'sm' (목록 요약)
 * line: 노선 이름(경부선 등). 주면 선로 색이 노선색으로 바뀐다.
 * 시각(depTime/arrTime)은 이미 "09:00" 형태의 문자열로 넘긴다.
 */
export default function RouteLine({
  depTime,
  arrTime,
  depStation,
  arrStation,
  duration,
  size = 'md',
  line,
  className = '',
}) {
  const label = `${depStation ?? ''} ${depTime ?? ''} 출발, ${arrStation ?? ''} ${arrTime ?? ''} 도착${
    duration ? `, 소요 ${duration}` : ''
  }`;

  return (
    <div className={`route route--${size} ${className}`.trim()} data-line={line || undefined}>
      <span className="sr-only">{label}</span>

      <div className="route__end" aria-hidden="true">
        <strong className="route__time num">{depTime}</strong>
        {depStation && <span className="route__station">{depStation}</span>}
      </div>

      <div className="route__track" aria-hidden="true">
        <span className="route__dot route__dot--start" />
        <span className="route__rail" />
        {duration && <span className="route__duration num">{duration}</span>}
        <span className="route__rail" />
        <span className="route__dot route__dot--end" />
      </div>

      <div className="route__end route__end--arr" aria-hidden="true">
        <strong className="route__time num">{arrTime}</strong>
        {arrStation && <span className="route__station">{arrStation}</span>}
      </div>
    </div>
  );
}
