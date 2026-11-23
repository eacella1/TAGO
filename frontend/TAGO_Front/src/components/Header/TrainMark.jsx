/**
 * 로고 마크: 유선형 고속열차의 앞부분 옆모습 + 뒤로 흐르는 속도선 + 바퀴·레일 선.
 * 이 서비스 자체의 일반적인 고속열차 모티프이며 특정 철도 회사의 로고·마크를 따르지 않는다.
 * 색은 부모의 color(currentColor) 를 따른다. 장식이므로 접근성 트리에서는 숨긴다.
 */
export default function TrainMark({ className = 'logo-mark' }) {
  return (
    <svg
      className={className}
      width="44"
      height="20"
      viewBox="0 0 44 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 속도선 */}
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2 5.5h8.5" opacity="0.55" />
        <path d="M4.5 9.5h6" opacity="0.4" />
        <path d="M1 13.5h9.5" opacity="0.28" />
      </g>

      {/* 차체: 둥글게 길쭉한 코 */}
      <path
        d="M16 3H28.5C36.5 3 41.5 7.5 43.6 12.4C43.9 13.2 43.4 14 42.6 14H16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        fill="currentColor"
      />

      {/* 창문 한 줄 + 앞유리 */}
      <g fill="var(--white)">
        <rect x="17" y="6.2" width="4" height="3.4" rx="1" />
        <rect x="22.5" y="6.2" width="4" height="3.4" rx="1" />
        <path d="M28.5 6.2h3c2.4 0 4.4 1.6 5.6 3.4h-8.6z" />
      </g>

      {/* 바퀴와 레일 선 */}
      <circle cx="21" cy="16" r="1.7" fill="currentColor" />
      <circle cx="35" cy="16" r="1.7" fill="currentColor" />
      <path d="M12 18.7h32" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
