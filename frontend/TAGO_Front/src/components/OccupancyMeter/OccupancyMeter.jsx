import { occupancy } from '../../lib/trainDomain';
import './OccupancyMeter.css';

/**
 * 혼잡도 막대: 지금 남은 좌석 수 기준(예측 아님). 5칸 중 채워진 칸이 많을수록 혼잡.
 * 막대만으로 뜻이 전달되지 않도록 항상 라벨(여유/보통/혼잡/마감 임박/매진)과 잔여석을 글자로 같이 보여 준다.
 */
export default function OccupancyMeter({ available, total, showCount = true, className = '' }) {
  const o = occupancy(available, total);
  const text = o.level === 'sold' ? '매진' : `${o.label}${showCount ? ` · 잔여 ${o.remaining.toLocaleString('ko-KR')}석` : ''}`;
  return (
    <span className={`occ ${className}`.trim()} data-level={o.level}>
      <span className="sr-only">{`혼잡도 ${o.label}${o.level === 'sold' ? '' : `, 잔여 ${o.remaining}석`}`}</span>
      <span className="occ__bar" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`occ__seg${i < o.filled ? ' is-on' : ''}`} />)}
      </span>
      <span className="occ__text num" aria-hidden="true">{text}</span>
    </span>
  );
}
