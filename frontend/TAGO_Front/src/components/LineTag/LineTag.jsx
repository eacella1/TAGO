import './LineTag.css';

/** 노선 라벨: 노선색 점 + 노선 이름(경부선 등). 색만으로 구분하지 않도록 항상 이름을 같이 쓴다. */
export default function LineTag({ line, className = '' }) {
  if (!line) return null;
  return <span className={`line-tag ${className}`.trim()} data-line={line}>{line}</span>;
}
