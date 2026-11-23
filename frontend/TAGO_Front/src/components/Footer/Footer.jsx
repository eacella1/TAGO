import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-links">
            <a href="#terms" className="highlight">개인정보처리방침</a>
            <span className="dot" aria-hidden="true">/</span>
            <a href="#conditions">이용약관</a>
            <span className="dot" aria-hidden="true">/</span>
            <a href="#passenger">여객운송약관</a>
            <span className="dot" aria-hidden="true">/</span>
            <a href="#service">KTX 운행안내</a>
            <span className="dot" aria-hidden="true">/</span>
            <a href="#support">철도고객센터 1544-7788</a>
          </div>
          <div className="footer-info-tag">
            <svg className="footer-mark" width="30" height="14" viewBox="0 0 30 14" fill="none" aria-hidden="true" focusable="false">
              <circle cx="5" cy="7" r="3.5" fill="currentColor" />
              <path d="M8.5 7h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="25" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>한국철도공사 KTX 전용 발권 시스템</span>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="company-details">
            한국철도공사 (대전광역시 동구 중앙로 240) · 대표자: 한문희 · 사업자등록번호: 314-82-10042 · 통신판매업신고: 제 2005-대전동구-0036호
          </p>
          <p className="footer-copyright">
            Copyright © KOREA RAILROAD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
