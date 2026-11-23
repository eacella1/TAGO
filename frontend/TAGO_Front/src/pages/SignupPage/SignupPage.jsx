import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../Api/client';
import { dialog, notify, validateForm } from '../../components/Dialog/dialogService';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import './SignupPage.css';

/* 필드 하단 메시지용 아이콘 (색만으로 상태를 구분하지 않는다) */
const msgIconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const AlertIcon = () => (
  <svg {...msgIconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
);

const CheckIcon = () => (
  <svg {...msgIconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </svg>
);

export default function SignupPage() {
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    phone: '',
    postcode: '',
    address: '',
    detailAddress: '',
  });

  const [passwordMatchError, setPasswordMatchError] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isIdChecked, setIsIdChecked] = useState(false);
  const [checkedId, setCheckedId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'userId') {
      setIsIdChecked(false);
      setCheckedId('');
    }
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'confirmPassword' || name === 'password') {
        const p1 = name === 'password' ? value : next.password;
        const p2 = name === 'confirmPassword' ? value : next.confirmPassword;
        setPasswordMatchError(p2.length > 0 && p1 !== p2);
      }
      return next;
    });
  };

  const handleOpenKakaoPostcode = () => {
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: (data) => {
          const fullAddress = data.roadAddress || data.jibunAddress;
          let extraAddress = '';

          if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
            extraAddress += data.bname;
          }
          if (data.buildingName !== '' && data.apartment === 'Y') {
            extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
          }

          const finalAddress = extraAddress !== '' ? `${fullAddress} (${extraAddress})` : fullAddress;

          setFormData((prev) => ({
            ...prev,
            postcode: data.zonecode,
            address: finalAddress,
          }));

          const detailInput = document.getElementById('detailAddressInput');
          if (detailInput) {
            detailInput.focus();
          }
        },
      }).open();
    } else {
      notify.info('주소 검색 서비스를 로드하는 중입니다. 잠시 후 다시 클릭해 주세요.');
    }
  };

  // 아이디 중복확인 (GET /member/checkId?id=...)
  // MemberController: public int checkId(@RequestParam String id) -> 0: 사용 가능, 1 이상: 중복됨
  const handleCheckDuplicateId = async () => {
    const userId = formData.userId.trim();

    if (!userId) {
      notify.warning('아이디를 입력해 주세요.');
      return;
    }

    try {
      const response = await client.get('/member/checkId', {
        params: { id: userId },
      });

      const count = Number(response.data);

      if (count === 0) {
        notify.success('사용 가능한 아이디입니다.');
        setIsIdChecked(true);
        setCheckedId(userId);
      } else {
        notify.warning('이미 사용 중인 아이디입니다.');
        setIsIdChecked(false);
        setCheckedId('');
      }
    } catch (error) {
      console.error('아이디 중복 확인 에러:', error);
      const message =
        error.response?.data?.message ||
        (typeof error.response?.data === 'string' ? error.response.data : null) ||
        '아이디 중복 확인 중 오류가 발생했습니다.';
      notify.error(message);
    }
  };

  // 회원가입 (POST /member)
  // MemberController: public int signup(@RequestBody MemberDTO dto) -> 성공 시 1 반환
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(e.currentTarget)) return;

    const currentId = formData.userId.trim();
    if (!isIdChecked || checkedId !== currentId) {
      notify.warning('아이디 중복확인을 진행해 주세요.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      notify.warning('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      return;
    }

    if (!formData.address) {
      notify.warning('우편번호 찾기를 통해 주소를 입력해 주세요.');
      return;
    }

    if (!agreed) {
      notify.warning('이용약관 및 개인정보 처리방침에 동의해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id: currentId,
        pw: formData.password,
        name: formData.name,
        phone: formData.phone.replace(/[^0-9]/g, ''),
        email: formData.email,
        zipcode: formData.postcode,
        address1: formData.address,
        address2: formData.detailAddress,
      };

      const response = await client.post('/member', payload);

      if (response.status === 200 && Number(response.data) === 1) {
        await dialog.alert(`${formData.name}님, 회원가입이 성공적으로 완료되었습니다.\n로그인 페이지로 이동합니다.`, {
          title: '회원가입 완료',
          tone: 'success',
        });
        navigate('/login');
      } else {
        await dialog.alert('회원가입 처리에 실패했습니다. 입력 정보를 다시 확인해 주세요.', {
          title: '회원가입 실패',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      const message =
        error.response?.data?.message ||
        (typeof error.response?.data === 'string' ? error.response.data : null) ||
        '회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.';
      await dialog.alert(message, { title: '회원가입 실패', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page-wrapper">
      <Header simple={true} showTopBar={false} />

      <main className="signup-container">
        <div className="signup-card ui-card">
          <div className="signup-header">
            <div className="signup-route" aria-hidden="true">
              <span className="signup-route__dot signup-route__dot--start" />
              <span className="signup-route__rail" />
              <span className="signup-route__dot" />
            </div>
            <h1 className="ui-title">회원가입</h1>
            <p className="signup-desc">TAGO 자체 회원으로 가입하여 승차권을 안전하게 예매하세요.</p>
          </div>

          <form noValidate onSubmit={handleSignupSubmit} className="signup-form">
            {/* 아이디 입력 + 중복체크 버튼 */}
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-userId">아이디 <span className="req">*</span></label>
              <div className="signup-row">
                <input
                  id="signup-userId"
                  className="ui-field__control"
                  type="text"
                  name="userId"
                  autoComplete="username"
                  placeholder="아이디를 입력하세요"
                  value={formData.userId}
                  onChange={handleChange}
                  aria-describedby={isIdChecked && checkedId === formData.userId.trim() ? 'signup-userId-ok' : undefined}
                  required
                />
                <button type="button" className="ui-btn ui-btn--weak signup-btn-sub" onClick={handleCheckDuplicateId}>
                  중복확인
                </button>
              </div>
              {isIdChecked && checkedId === formData.userId.trim() && (
                <p id="signup-userId-ok" className="ui-field__help signup-msg signup-ok">
                  <CheckIcon />
                  <span>사용 가능한 아이디입니다.</span>
                </p>
              )}
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-password">비밀번호 <span className="req">*</span></label>
              <input
                id="signup-password"
                className="ui-field__control"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="비밀번호 (8자 이상 영문/숫자/특수문자)"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-confirmPassword">비밀번호 재확인 <span className="req">*</span></label>
              <input
                id="signup-confirmPassword"
                className="ui-field__control"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="비밀번호를 한 번 더 입력하세요"
                value={formData.confirmPassword}
                onChange={handleChange}
                aria-invalid={passwordMatchError}
                aria-describedby={passwordMatchError ? 'signup-confirmPassword-error' : undefined}
                required
              />
              {passwordMatchError && (
                <p id="signup-confirmPassword-error" className="ui-field__error signup-msg" role="alert">
                  <AlertIcon />
                  <span>비밀번호가 일치하지 않습니다.</span>
                </p>
              )}
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-name">이름 <span className="req">*</span></label>
              <input
                id="signup-name"
                className="ui-field__control"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="이름(실명)을 입력하세요"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-email">이메일 <span className="req">*</span></label>
              <input
                id="signup-email"
                className="ui-field__control"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="예: user@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-phone">휴대전화 번호 <span className="req">*</span></label>
              <input
                id="signup-phone"
                className="ui-field__control"
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="예: 010-1234-5678"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="signup-postcode">주소 <span className="req">*</span></label>
              <div className="signup-row signup-row--zip">
                <input
                  id="signup-postcode"
                  className="ui-field__control"
                  type="text"
                  name="postcode"
                  placeholder="우편번호"
                  value={formData.postcode}
                  readOnly
                  required
                />
                <button type="button" className="ui-btn ui-btn--weak signup-btn-sub" onClick={handleOpenKakaoPostcode}>
                  우편번호 찾기
                </button>
              </div>

              <input
                className="ui-field__control"
                type="text"
                name="address"
                aria-label="기본 주소"
                placeholder="기본 주소 (우편번호 찾기로 자동 입력)"
                value={formData.address}
                readOnly
                required
              />

              <input
                className="ui-field__control"
                type="text"
                id="detailAddressInput"
                name="detailAddress"
                autoComplete="address-line2"
                aria-label="상세 주소"
                placeholder="상세 주소를 입력하세요 (동/호수 등)"
                value={formData.detailAddress}
                onChange={handleChange}
              />
            </div>

            {/* 약관 동의: 리스트 행 (체크 + 문구 + 오른쪽 "보기") */}
            <div className="signup-terms">
              <div className="ui-row signup-terms__row">
                <label className="ui-row__main signup-check">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span className="ui-row__title">[필수] TAGO 이용약관 및 개인정보 수집/이용에 동의합니다.</span>
                </label>
                <a
                  href="#terms"
                  className="ui-row__right signup-terms__view"
                  aria-label="이용약관 및 개인정보 수집/이용 내용 보기"
                >
                  보기
                </a>
              </div>
            </div>

            <button type="submit" className="ui-btn ui-btn--lg ui-btn--block signup-btn-submit" disabled={loading}>
              {loading ? '가입 처리 중...' : '가입하기'}
            </button>
          </form>

          <div className="signup-alt">
            <span>이미 계정이 있으신가요?</span>
            <Link to="/login" className="ui-btn ui-btn--weak ui-btn--block signup-alt__link">
              로그인 바로가기 →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
