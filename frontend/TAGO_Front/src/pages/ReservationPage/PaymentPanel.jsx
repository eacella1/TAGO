import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { notify } from '../../components/Dialog/dialogService';
import './PaymentPanel.css';

/* =========================================================
   결제 단계 본문 (모의 결제)
   - 입력값(카드번호·유효기간·비밀번호·계좌번호 등)은 이 컴포넌트의 state 에만 둔다.
     서버 전송, localStorage/sessionStorage 저장, console 출력을 하지 않으며
     step 이 바뀌어 언마운트되면 함께 사라진다.
   - 부모에는 validate() 결과(통과 여부 + 마스킹된 수단 요약 + 진행 문구)만 넘긴다.
   ========================================================= */

/* ---- 인라인 SVG 아이콘 ---- */
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
const CardIcon = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></Icon>;
const BoltIcon = (p) => <Icon {...p}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" /></Icon>;
const BankIcon = (p) => <Icon {...p}><path d="M3 9.5L12 4l9 5.5M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18" /></Icon>;
const ChevronDownIcon = (p) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
const ClockIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const InfoIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></Icon>;
const AlertIcon = (p) => (
  <Icon {...p}>
    <path d="M12 8v5M12 16.5v.01" />
    <path d="M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
  </Icon>
);

/* ---- 상수 ---- */
const TABS = [
  { value: 'card', label: '신용·체크카드', Glyph: CardIcon },
  { value: 'easy', label: '간편결제', Glyph: BoltIcon },
  { value: 'transfer', label: '계좌이체', Glyph: BankIcon },
];

const ISSUERS = ['삼성', '현대', 'KB국민', '신한', '롯데', '하나', '우리', 'NH농협', 'BC', '카카오뱅크'];
const BANKS = ['국민', '신한', '우리', '하나', 'NH농협', '기업', '카카오뱅크', '토스뱅크'];
const INSTALLMENTS = [
  { value: '0', label: '일시불' },
  ...Array.from({ length: 11 }, (_, i) => ({ value: String(i + 2), label: `${i + 2}개월` })),
];

// 브랜드 색은 간편결제 타일의 워드마크(로고 취급)에만 쓴다. 실제 로고 이미지는 쓰지 않는다.
const EASY_APPS = [
  { name: '카카오페이', mark: 'kakao pay', cls: 'is-kakao' },
  { name: '네이버페이', mark: 'NAVER pay', cls: 'is-naver' },
  { name: '토스페이', mark: 'toss pay', cls: 'is-toss' },
  { name: 'PAYCO', mark: 'PAYCO', cls: 'is-payco' },
];

const RECEIPT_OPTIONS = [
  { value: 'income', label: '소득공제용' },
  { value: 'expense', label: '지출증빙용' },
  { value: 'none', label: '발행 안 함' },
];

const TERMS = [
  {
    title: '결제대행 서비스 이용약관',
    body:
      '데모 서비스용 가상의 약관입니다. 결제대행사가 결제 승인과 정산을 대신 처리한다는 흐름을 보여 주기 위한 문장이며 실제 계약이 아닙니다. 이 서비스에서는 어떤 결제도 실제로 이루어지지 않습니다.',
  },
  {
    title: '개인정보 수집·이용 동의',
    body:
      '데모 서비스용 가상의 약관입니다. 결제 단계에서 입력한 정보는 화면에서만 사용되고 서버로 전송되거나 저장되지 않습니다. 실제 개인정보를 입력하지 마세요.',
  },
  {
    title: '개인정보 제3자 제공 동의',
    body:
      '데모 서비스용 가상의 약관입니다. 입력한 정보는 어떤 제3자에게도 제공되지 않습니다. 실제 서비스라면 결제대행사와 카드사에 제공되는 항목을 이곳에 안내하게 됩니다.',
  },
];

const TEST_CARD = {
  issuer: '삼성',
  n: ['4242', '4242', '4242', '4242'],
  exp: '12/30',
  pw: '12',
  ownerType: 'personal',
  birth: '900101',
  installment: '0',
};

const INITIAL_FORM = {
  // 카드
  issuer: '',
  n: ['', '', '', ''],
  exp: '',
  pw: '',
  ownerType: 'personal',
  birth: '',
  biz: '',
  installment: '0',
  // 간편결제
  easyApp: '',
  // 계좌이체
  bank: '',
  account: '',
  holder: '',
  receipt: 'none',
  receiptNo: '',
  // 약관 (필수 3개)
  terms: [false, false, false],
};

/* ---- 순수 헬퍼 ---- */
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

// Luhn 검사 (4242 4242 4242 4242 는 통과)
function luhn(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function detectBrand(d) {
  if (!d) return '';
  if (d[0] === '4') return 'VISA';
  const p2 = Number(d.slice(0, 2));
  if (d[0] === '5' && (d.length === 1 || (p2 >= 51 && p2 <= 55))) return 'Mastercard';
  if (d.length >= 4) {
    const p4 = Number(d.slice(0, 4));
    if (p4 >= 2221 && p4 <= 2720) return 'Mastercard';
  }
  if (d.startsWith('35')) return 'JCB';
  if (d.startsWith('62')) return 'UnionPay';
  if (d.startsWith('34') || d.startsWith('37')) return 'AMEX';
  if (d[0] === '9') return '국내 전용';
  return '';
}

// 유효기간 입력 보정: 숫자만 받아 MM/YY 로. 슬래시는 두 번째 숫자를 칠 때 자동으로 붙고, 지울 때는 따라 지워진다.
function formatExp(raw, prev) {
  const d = onlyDigits(raw).slice(0, 4);
  const grew = raw.length > prev.length;
  if (d.length === 1 && grew && Number(d) >= 2) return `0${d}/`;
  if (d.length === 2) return grew ? `${d}/` : d;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

// 오류 문구가 비어 있으면 통과. 입력값 f 만 보는 순수 함수.
const RULES = {
  issuer: (f) => (f.issuer ? '' : '카드사를 선택해 주세요.'),
  cardNum: (f) => {
    const d = f.n.join('');
    if (d.length < 16) return '카드번호 16자리를 모두 입력해 주세요.';
    if (!luhn(d)) return '카드번호가 올바르지 않습니다. 다시 확인해 주세요.';
    return '';
  },
  exp: (f) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(f.exp);
    if (!m) return '유효기간을 MM/YY 형식으로 입력해 주세요.';
    const month = Number(m[1]);
    if (month < 1 || month > 12) return '유효기간의 월이 올바르지 않습니다. 01~12 사이로 입력해 주세요.';
    // 해당 월의 말일까지 유효: 다음 달 1일 이후면 지난 카드
    if (Date.now() >= new Date(2000 + Number(m[2]), month, 1).getTime()) return '유효기간이 지난 카드입니다.';
    return '';
  },
  pw: (f) => (/^\d{2}$/.test(f.pw) ? '' : '카드 비밀번호 앞 2자리를 입력해 주세요.'),
  ownerNo: (f) => {
    if (f.ownerType === 'corp') {
      return /^\d{10}$/.test(f.biz) ? '' : '사업자등록번호 10자리를 입력해 주세요.';
    }
    if (!/^\d{6}$/.test(f.birth)) return '생년월일 6자리(예: 900101)를 입력해 주세요.';
    const mm = Number(f.birth.slice(2, 4));
    const dd = Number(f.birth.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '생년월일이 올바르지 않습니다. YYMMDD 6자리로 입력해 주세요.';
    return '';
  },
  easyApp: (f) => (f.easyApp ? '' : '간편결제 수단을 선택해 주세요.'),
  bank: (f) => (f.bank ? '' : '은행을 선택해 주세요.'),
  account: (f) => (/^\d{10,14}$/.test(f.account) ? '' : '계좌번호 10~14자리를 숫자만 입력해 주세요.'),
  holder: (f) => {
    const name = f.holder.trim();
    if (!name) return '예금주명을 입력해 주세요.';
    if (name.length < 2 || !/^[가-힣a-zA-Z\s·.]+$/.test(name)) return '예금주명을 올바르게 입력해 주세요.';
    return '';
  },
  receiptNo: (f) => {
    if (f.receipt === 'none') return '';
    const d = f.receiptNo;
    return /^010\d{7,8}$/.test(d) || /^\d{10}$/.test(d)
      ? ''
      : '휴대폰 번호(010으로 시작) 또는 사업자등록번호 10자리를 입력해 주세요.';
  },
  terms: (f) => (f.terms.every(Boolean) ? '' : '필수 약관에 모두 동의해 주세요.'),
};

// 탭별로 검사하는 필드 (화면 위에서 아래 순서)
const KEYS_BY_METHOD = {
  card: ['issuer', 'cardNum', 'exp', 'pw', 'ownerNo'],
  easy: ['easyApp'],
  transfer: ['bank', 'account', 'holder', 'receiptNo'],
};

// 부모에 돌려주는 요약. 완료 화면 표시용이며 어디에도 저장하지 않는다.
function buildSummary(method, f) {
  if (method === 'card') return `신용/체크카드 · ${f.issuer} ****${f.n[3]}`;
  if (method === 'easy') return `간편결제 · ${f.easyApp}`;
  return `계좌이체 · ${f.bank}`;
}

function buildProgress(method, f) {
  if (method === 'card') return '카드사 승인 중입니다…';
  if (method === 'easy') return `${f.easyApp} 결제를 승인해 주세요…`;
  return '은행 인증 중입니다…';
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="ui-field__error pf-error">
      <AlertIcon size={14} />
      <span>{message}</span>
    </p>
  );
}

/**
 * props
 *  - ref: { validate() => { ok, summary?, progress? } }  (부모의 결제 버튼이 호출)
 *  - formId: 부모의 결제 버튼이 form 속성으로 연결하는 id
 *  - method / onMethodChange: 결제 수단 탭 ('card' | 'easy' | 'transfer')
 *  - disabled: 결제 진행·좌석 해제 중에는 입력 잠금
 *  - order: 주문 정보 한 줄 요약 조각들
 *  - onSubmit: form 제출(Enter 포함) 시 부모의 결제 핸들러
 */
export default function PaymentPanel({ ref, formId, method, onMethodChange, disabled, order, onSubmit }) {
  const uid = useId();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [openTerms, setOpenTerms] = useState([false, false, false]);

  const fieldRefs = useRef({});
  const cardRefs = useRef([]);
  const termRefs = useRef([]); // 0: 전체 동의, 1~3: 개별
  const easyRefs = useRef([]);
  const tabRefs = useRef([]);
  const pendingFocus = useRef(null);

  const id = (k) => `${uid}-${k}`;
  const errId = (k) => `${uid}-${k}-err`;
  const a11y = (k, hintId) => {
    const ids = [hintId, errors[k] ? errId(k) : null].filter(Boolean).join(' ');
    return { 'aria-invalid': errors[k] ? 'true' : undefined, 'aria-describedby': ids || undefined };
  };

  const focusField = (key, f) => {
    let el;
    if (key === 'cardNum') {
      const i = f.n.findIndex((g) => g.length < 4);
      el = cardRefs.current[i === -1 ? 0 : i];
    } else if (key === 'terms') {
      const i = f.terms.findIndex((t) => !t);
      el = termRefs.current[i === -1 ? 0 : i + 1];
    } else if (key === 'easyApp') {
      el = easyRefs.current[0];
    } else if (/^c[0-3]$/.test(key)) {
      el = cardRefs.current[Number(key[1])];
    } else {
      el = fieldRefs.current[key];
    }
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  // 자동 이동은 state 가 반영된 뒤에 포커스를 옮긴다 (blur 검증이 최신 값을 보도록)
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    focusField(key, form);
  });

  // 값 변경 + 이미 오류가 떠 있는 필드는 바로 다시 검사(고치면 오류가 사라짐)
  const commit = (patch, keys = [], clearKeys = []) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (keys.length === 0 && clearKeys.length === 0) return;
    setErrors((prev) => {
      const out = { ...prev };
      keys.forEach((k) => {
        if (prev[k]) out[k] = RULES[k](next);
      });
      clearKeys.forEach((k) => {
        out[k] = '';
      });
      return out;
    });
  };

  // blur 시점 검증
  const touch = (k) => setErrors((prev) => ({ ...prev, [k]: RULES[k](form) }));

  /* ---- 카드번호 4칸 ---- */
  const distributeCard = (digits, start) => {
    const n = [...form.n];
    let rest = digits;
    let idx = start;
    while (rest.length > 0 && idx < 4) {
      n[idx] = rest.slice(0, 4);
      rest = rest.slice(4);
      idx += 1;
    }
    commit({ n }, ['cardNum']);
    pendingFocus.current = idx >= 4 ? 'exp' : `c${idx}`;
  };

  const handleCardChange = (i, e) => {
    const d = onlyDigits(e.target.value);
    if (d.length > 5) {
      distributeCard(d.slice(0, 16), i); // 자동완성·긴 입력
      return;
    }
    const n = [...form.n];
    n[i] = d.slice(0, 4);
    commit({ n }, ['cardNum']);
    if (d.length >= 4 && i < 3) pendingFocus.current = `c${i + 1}`;
    else if (d.length >= 4 && i === 3) pendingFocus.current = 'exp';
  };

  const handleCardKeyDown = (i, e) => {
    if (e.key === 'Backspace' && form.n[i] === '' && i > 0) {
      e.preventDefault();
      cardRefs.current[i - 1]?.focus();
    }
  };

  const handleCardPaste = (i, e) => {
    const d = onlyDigits(e.clipboardData?.getData('text'));
    if (!d) return;
    e.preventDefault();
    distributeCard(d.slice(0, 16), d.length >= 16 ? 0 : i);
  };

  const handleCardGroupBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) touch('cardNum');
  };

  /* ---- 약관 ---- */
  const allChecked = form.terms.every(Boolean);
  const toggleAll = (checked) => commit({ terms: [checked, checked, checked] }, ['terms']);
  const toggleTerm = (i, checked) => {
    const terms = [...form.terms];
    terms[i] = checked;
    commit({ terms }, ['terms']);
  };
  const toggleOpen = (i) => setOpenTerms((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  /* ---- 테스트 카드 ---- */
  const fillTestCard = () => {
    onMethodChange('card');
    setForm((f) => ({ ...f, ...TEST_CARD, n: [...TEST_CARD.n] }));
    setErrors((prev) => ({ ...prev, issuer: '', cardNum: '', exp: '', pw: '', ownerNo: '' }));
    notify.info('테스트 카드 정보를 입력했습니다. 약관에 동의한 뒤 결제해 보세요.');
  };

  /* ---- 탭 키보드 (좌우 화살표, Home, End) ---- */
  const handleTabKeyDown = (e) => {
    const cur = TABS.findIndex((t) => t.value === method);
    let next = -1;
    if (e.key === 'ArrowRight') next = (cur + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onMethodChange(TABS[next].value);
    tabRefs.current[next]?.focus();
  };

  /* ---- 제출 시 전체 검증 (현재 탭 + 약관) ---- */
  const validate = () => {
    const keys = [...KEYS_BY_METHOD[method], 'terms'];
    const found = {};
    keys.forEach((k) => {
      const msg = RULES[k](form);
      if (msg) found[k] = msg;
    });
    setErrors((prev) => {
      const out = { ...prev };
      keys.forEach((k) => {
        out[k] = found[k] || '';
      });
      return out;
    });

    const failed = keys.filter((k) => found[k]);
    if (failed.length > 0) {
      const more = failed.length > 1 ? ` (외 ${failed.length - 1}건)` : '';
      notify.warning(`${found[failed[0]]}${more}`);
      focusField(failed[0], form);
      return { ok: false };
    }
    return { ok: true, summary: buildSummary(method, form), progress: buildProgress(method, form) };
  };

  useImperativeHandle(ref, () => ({ validate }));

  const brand = detectBrand(form.n.join(''));
  const isCorp = form.ownerType === 'corp';
  const receiptLabel = form.receipt === 'expense' ? '사업자등록번호 또는 휴대폰 번호' : '휴대폰 번호 또는 사업자등록번호';

  return (
    <form
      id={formId}
      className="pf"
      noValidate
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <fieldset className="pf-reset" disabled={disabled}>
        <legend className="sr-only">결제 정보 입력</legend>

        {/* 데모 안내 */}
        <div className="pf-demo">
          <InfoIcon size={20} className="pf-demo__icon" />
          <p className="pf-demo__text">
            <strong>데모 서비스입니다.</strong> 실제 결제가 이루어지지 않으니 실제 카드 정보를 입력하지 마세요.
          </p>
          <button type="button" className="ui-btn ui-btn--weak pf-demo__btn" onClick={fillTestCard}>
            테스트 카드 자동 입력
          </button>
        </div>

        {/* 1. 주문 정보 */}
        <section className="pf-section" aria-labelledby={id('order-title')}>
          <h3 id={id('order-title')} className="pf-section__title">주문 정보</h3>
          <p className="pf-order">
            {order.map((text, i) => (
              <span key={i} className="pf-order__item num">
                {text}
                {i < order.length - 1 && <span className="pf-order__sep" aria-hidden="true">·</span>}
              </span>
            ))}
          </p>
        </section>

        {/* 2. 결제 수단 */}
        <section className="pf-section" aria-labelledby={id('method-title')}>
          <h3 id={id('method-title')} className="pf-section__title">결제 수단</h3>

          <div role="tablist" aria-label="결제 수단" className="pf-tabs ui-segment" onKeyDown={handleTabKeyDown}>
            {TABS.map(({ value, label, Glyph }, i) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={id(`tab-${value}`)}
                className="pf-tab"
                aria-selected={method === value}
                aria-controls={id(`panel-${value}`)}
                tabIndex={method === value ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                onClick={() => onMethodChange(value)}
              >
                <Glyph size={18} className="pf-tab__icon" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 카드 */}
          <div
            role="tabpanel"
            id={id('panel-card')}
            aria-labelledby={id('tab-card')}
            hidden={method !== 'card'}
            className="pf-panel"
          >
            <div className="pf-grid">
              <div className="ui-field pf-field pf-field--full">
                <label htmlFor={id('issuer')} className="ui-field__label">카드사</label>
                <div className="pf-select">
                  <select
                    id={id('issuer')}
                    ref={(el) => {
                      fieldRefs.current.issuer = el;
                    }}
                    className={`ui-field__control${form.issuer ? '' : ' is-empty'}`}
                    value={form.issuer}
                    onChange={(e) => commit({ issuer: e.target.value }, ['issuer'])}
                    onBlur={() => touch('issuer')}
                    {...a11y('issuer')}
                  >
                    <option value="">카드사를 선택하세요</option>
                    {ISSUERS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDownIcon size={18} />
                </div>
                <FieldError id={errId('issuer')} message={errors.issuer} />
              </div>

              <div className="ui-field pf-field pf-field--full">
                <div className="pf-label-row">
                  <span id={id('cardNum-label')} className="ui-field__label">카드번호</span>
                  {brand && (
                    <span className="chip chip--info">
                      <span className="sr-only">카드 브랜드 </span>
                      {brand}
                    </span>
                  )}
                </div>
                <div
                  className="pf-cardnum"
                  role="group"
                  aria-labelledby={id('cardNum-label')}
                  onBlur={handleCardGroupBlur}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        cardRefs.current[i] = el;
                      }}
                      className="ui-field__control pf-input--center num"
                      type={i >= 2 ? 'password' : 'text'}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'cc-number' : 'off'}
                      placeholder="0000"
                      aria-label={`카드번호 ${i + 1}번째 4자리`}
                      value={form.n[i]}
                      onChange={(e) => handleCardChange(i, e)}
                      onKeyDown={(e) => handleCardKeyDown(i, e)}
                      onPaste={(e) => handleCardPaste(i, e)}
                      {...a11y('cardNum')}
                    />
                  ))}
                </div>
                <FieldError id={errId('cardNum')} message={errors.cardNum} />
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('exp')} className="ui-field__label">유효기간 (MM/YY)</label>
                <input
                  id={id('exp')}
                  ref={(el) => {
                      fieldRefs.current.exp = el;
                    }}
                  className="ui-field__control num"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  maxLength={5}
                  value={form.exp}
                  onChange={(e) => commit({ exp: formatExp(e.target.value, form.exp) }, ['exp'])}
                  onBlur={() => touch('exp')}
                  {...a11y('exp')}
                />
                <FieldError id={errId('exp')} message={errors.exp} />
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('pw')} className="ui-field__label">카드 비밀번호 앞 2자리</label>
                <input
                  id={id('pw')}
                  ref={(el) => {
                      fieldRefs.current.pw = el;
                    }}
                  className="ui-field__control num"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••"
                  maxLength={2}
                  value={form.pw}
                  onChange={(e) => commit({ pw: onlyDigits(e.target.value).slice(0, 2) }, ['pw'])}
                  onBlur={() => touch('pw')}
                  {...a11y('pw')}
                />
                <FieldError id={errId('pw')} message={errors.pw} />
              </div>

              <div className="ui-field pf-field pf-field--full">
                <span id={id('owner-label')} className="ui-field__label">소유자 구분</span>
                <div className="pf-radios" role="radiogroup" aria-labelledby={id('owner-label')}>
                  {[
                    { value: 'personal', label: '개인카드' },
                    { value: 'corp', label: '법인카드' },
                  ].map((opt) => (
                    <label key={opt.value} className="pf-radio">
                      <input
                        type="radio"
                        name={id('owner')}
                        value={opt.value}
                        checked={form.ownerType === opt.value}
                        onChange={() => commit({ ownerType: opt.value }, [], ['ownerNo'])}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('ownerNo')} className="ui-field__label">
                  {isCorp ? '사업자등록번호 10자리' : '생년월일 6자리'}
                </label>
                <input
                  id={id('ownerNo')}
                  ref={(el) => {
                      fieldRefs.current.ownerNo = el;
                    }}
                  className="ui-field__control num"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={isCorp ? '숫자 10자리' : '예) 900101'}
                  maxLength={isCorp ? 10 : 6}
                  value={isCorp ? form.biz : form.birth}
                  onChange={(e) => {
                    const v = onlyDigits(e.target.value).slice(0, isCorp ? 10 : 6);
                    commit(isCorp ? { biz: v } : { birth: v }, ['ownerNo']);
                  }}
                  onBlur={() => touch('ownerNo')}
                  {...a11y('ownerNo')}
                />
                <FieldError id={errId('ownerNo')} message={errors.ownerNo} />
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('installment')} className="ui-field__label">할부</label>
                <div className="pf-select">
                  <select
                    id={id('installment')}
                    className="ui-field__control"
                    value={form.installment}
                    onChange={(e) => commit({ installment: e.target.value })}
                  >
                    {INSTALLMENTS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDownIcon size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* 간편결제 */}
          <div
            role="tabpanel"
            id={id('panel-easy')}
            aria-labelledby={id('tab-easy')}
            hidden={method !== 'easy'}
            className="pf-panel"
          >
            <div className="ui-field pf-field">
              <span id={id('easy-label')} className="ui-field__label">간편결제 수단</span>
              <div
                className="pf-tiles"
                role="radiogroup"
                aria-labelledby={id('easy-label')}
              >
                {EASY_APPS.map((app, i) => {
                  const checked = form.easyApp === app.name;
                  return (
                    <label key={app.name} className={`pf-tile ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name={id('easy')}
                        value={app.name}
                        checked={checked}
                        ref={(el) => {
                          easyRefs.current[i] = el;
                        }}
                        onChange={() => commit({ easyApp: app.name }, ['easyApp'])}
                        {...a11y('easyApp')}
                      />
                      <span className={`pf-tile__mark ${app.cls}`} aria-hidden="true">{app.mark}</span>
                      <span className="pf-tile__name">
                        {app.name}
                        {checked && <span className="sr-only"> (선택됨)</span>}
                      </span>
                      <span className="pf-tile__check" aria-hidden="true">
                        <CheckIcon size={14} />
                      </span>
                    </label>
                  );
                })}
              </div>
              <FieldError id={errId('easyApp')} message={errors.easyApp} />
            </div>
            <p className="pf-notice">
              <InfoIcon size={16} />
              <span>선택한 앱의 결제 창이 열립니다. 앱에서 승인을 마쳐 주세요.</span>
            </p>
          </div>

          {/* 계좌이체 */}
          <div
            role="tabpanel"
            id={id('panel-transfer')}
            aria-labelledby={id('tab-transfer')}
            hidden={method !== 'transfer'}
            className="pf-panel"
          >
            <div className="pf-grid">
              <div className="ui-field pf-field pf-field--full">
                <label htmlFor={id('bank')} className="ui-field__label">은행</label>
                <div className="pf-select">
                  <select
                    id={id('bank')}
                    ref={(el) => {
                      fieldRefs.current.bank = el;
                    }}
                    className={`ui-field__control${form.bank ? '' : ' is-empty'}`}
                    value={form.bank}
                    onChange={(e) => commit({ bank: e.target.value }, ['bank'])}
                    onBlur={() => touch('bank')}
                    {...a11y('bank')}
                  >
                    <option value="">은행을 선택하세요</option>
                    {BANKS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDownIcon size={18} />
                </div>
                <FieldError id={errId('bank')} message={errors.bank} />
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('account')} className="ui-field__label">계좌번호</label>
                <input
                  id={id('account')}
                  ref={(el) => {
                      fieldRefs.current.account = el;
                    }}
                  className="ui-field__control num"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="숫자만 입력"
                  maxLength={14}
                  value={form.account}
                  onChange={(e) => commit({ account: onlyDigits(e.target.value).slice(0, 14) }, ['account'])}
                  onBlur={() => touch('account')}
                  {...a11y('account', id('account-hint'))}
                />
                <p id={id('account-hint')} className="ui-field__help">&apos;-&apos; 없이 숫자 10~14자리</p>
                <FieldError id={errId('account')} message={errors.account} />
              </div>

              <div className="ui-field pf-field">
                <label htmlFor={id('holder')} className="ui-field__label">예금주명</label>
                <input
                  id={id('holder')}
                  ref={(el) => {
                      fieldRefs.current.holder = el;
                    }}
                  className="ui-field__control"
                  type="text"
                  autoComplete="off"
                  placeholder="예금주 이름"
                  maxLength={30}
                  value={form.holder}
                  onChange={(e) => commit({ holder: e.target.value }, ['holder'])}
                  onBlur={() => touch('holder')}
                  {...a11y('holder')}
                />
                <FieldError id={errId('holder')} message={errors.holder} />
              </div>

              <div className="ui-field pf-field pf-field--full">
                <span id={id('receipt-label')} className="ui-field__label">현금영수증</span>
                <div className="pf-radios" role="radiogroup" aria-labelledby={id('receipt-label')}>
                  {RECEIPT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="pf-radio">
                      <input
                        type="radio"
                        name={id('receipt')}
                        value={opt.value}
                        checked={form.receipt === opt.value}
                        onChange={() => commit({ receipt: opt.value }, [], ['receiptNo'])}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.receipt !== 'none' && (
                <div className="ui-field pf-field pf-field--full">
                  <label htmlFor={id('receiptNo')} className="ui-field__label">{receiptLabel}</label>
                  <input
                    id={id('receiptNo')}
                    ref={(el) => {
                      fieldRefs.current.receiptNo = el;
                    }}
                    className="ui-field__control num"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="숫자만 입력"
                    maxLength={11}
                    value={form.receiptNo}
                    onChange={(e) => commit({ receiptNo: onlyDigits(e.target.value).slice(0, 11) }, ['receiptNo'])}
                    onBlur={() => touch('receiptNo')}
                    {...a11y('receiptNo')}
                  />
                  <FieldError id={errId('receiptNo')} message={errors.receiptNo} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. 약관 동의 */}
        <section className="pf-section" aria-labelledby={id('terms-title')}>
          <h3 id={id('terms-title')} className="pf-section__title">약관 동의</h3>
          <div className="pf-terms">
            <div className="pf-terms__all">
              <label className="pf-check pf-check--all">
                <input
                  type="checkbox"
                  ref={(el) => {
                    termRefs.current[0] = el;
                  }}
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  {...a11y('terms')}
                />
                <span>전체 동의</span>
              </label>
            </div>
            <ul className="pf-terms__list">
              {TERMS.map((term, i) => (
                <li key={term.title} className="pf-terms__item">
                  <div className="ui-row pf-terms__row">
                    <label className="pf-check">
                      <input
                        type="checkbox"
                        ref={(el) => {
                          termRefs.current[i + 1] = el;
                        }}
                        checked={form.terms[i]}
                        onChange={(e) => toggleTerm(i, e.target.checked)}
                        {...a11y('terms')}
                      />
                      <span>
                        <em className="pf-req">[필수]</em>
                        {term.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="pf-link-btn"
                      aria-expanded={openTerms[i]}
                      aria-controls={id(`term-body-${i}`)}
                      aria-label={`${term.title} 보기`}
                      onClick={() => toggleOpen(i)}
                    >
                      <span aria-hidden="true">보기</span>
                      <ChevronDownIcon size={16} />
                    </button>
                  </div>
                  <div id={id(`term-body-${i}`)} className="pf-terms__body" hidden={!openTerms[i]}>
                    <p>{term.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <FieldError id={errId('terms')} message={errors.terms} />
        </section>

        {/* 4. 취소·환불 안내 */}
        <p className="pf-notice">
          <InfoIcon size={16} />
          <span>
            <strong>취소·환불 안내</strong>
            <br />
            출발 전 승차권을 취소하면 반환 수수료가 부과될 수 있습니다. 자세한 기준은 이용약관을 확인해 주세요.
          </span>
        </p>
      </fieldset>
    </form>
  );
}

/* =========================================================
   결제 진행 오버레이
   - 부모가 isPaying 인 동안만 그린다. ESC·바깥 클릭으로 닫히지 않는다.
   - 선점 남은 시간을 카드 안에도 보여 준다(화면 위쪽 카운트다운이 스크롤로 가려져도 보이도록).
   ========================================================= */
const pad2 = (n) => String(n).padStart(2, '0');

function OverlayClock({ deadline }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  const total = Math.ceil(remaining / 1000);
  return (
    <p className="pay-overlay__clock" aria-hidden="true">
      <ClockIcon size={14} />
      <span>선점 남은 시간</span>
      <strong className="num">{`${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`}</strong>
    </p>
  );
}

export function PaymentOverlay({ message, deadline }) {
  const uid = useId();
  const cardRef = useRef(null);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });

    // 진행 중에는 뒤쪽 화면으로 포커스·스크롤이 새지 않게 한다
    const onKeyDown = (e) => {
      if (e.key === 'Tab') e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="pay-overlay" onMouseDown={(e) => e.preventDefault()}>
      <div
        ref={cardRef}
        className="pay-overlay__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-desc`}
        tabIndex={-1}
      >
        <span className="pay-overlay__spinner" aria-hidden="true" />
        <p id={`${uid}-title`} className="pay-overlay__title" aria-live="polite">{message}</p>
        <p id={`${uid}-desc`} className="pay-overlay__desc">창을 닫거나 새로고침하지 마세요.</p>
        <div className="pay-overlay__bar" aria-hidden="true">
          <span />
        </div>
        <OverlayClock deadline={deadline} />
      </div>
    </div>
  );
}
