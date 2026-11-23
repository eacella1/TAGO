/**
 * 브라우저 alert/confirm 대체. React 바깥(zustand 스토어 등)에서도 호출할 수 있도록
 * 모듈 단위 상태로 만들고, <DialogHost />(App 에 한 번 마운트)가 이 상태를 그린다.
 *
 *   notify.success('저장했습니다.')                    // 토스트: 잠깐 보였다 사라짐 (비차단)
 *   notify.warning('아이디를 입력해 주세요.')
 *   notify.error('실패했습니다.')
 *   await dialog.alert('메시지', { title, tone })      // 모달: 사용자가 닫을 때까지 남음. 닫히면 resolve
 *   if (await dialog.confirm('메시지', { danger: true })) { ... }   // true / false
 *
 * tone: 'info' | 'success' | 'warning' | 'error'
 * 메시지의 \n 은 줄바꿈으로 표시된다.
 */

let state = { dialogs: [], toasts: [] };
const listeners = new Set();
let uid = 0;

const emit = () => listeners.forEach((l) => l());

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getSnapshot = () => state;

function open(kind, message, options = {}) {
  return new Promise((resolve) => {
    const item = { id: ++uid, kind, message: String(message ?? ''), ...options, resolve };
    state = { ...state, dialogs: [...state.dialogs, item] };
    emit();
  });
}

export function closeDialog(id, result) {
  const target = state.dialogs.find((d) => d.id === id);
  if (!target) return;
  state = { ...state, dialogs: state.dialogs.filter((d) => d.id !== id) };
  emit();
  target.resolve(result);
}

export const dialog = {
  /** 확인 버튼 하나. 닫히면 resolve 되므로, 이후 동작(이동 등)이 있으면 await 한다. */
  alert: (message, options) => open('alert', message, options).then(() => undefined),
  /** 확인/취소. 확인이면 true, 취소·ESC 면 false. options: { title, confirmLabel, cancelLabel, danger } */
  confirm: (message, options) => open('confirm', message, options),
};

const DEFAULT_DURATION = { error: 6000, warning: 5000, info: 4000, success: 4000 };

function toast(tone, message, options = {}) {
  const id = ++uid;
  const duration = options.duration ?? DEFAULT_DURATION[tone] ?? 4000;
  const item = { id, tone, message: String(message ?? ''), duration };
  // 동시에 4개까지만 보여준다
  state = { ...state, toasts: [...state.toasts.slice(-3), item] };
  emit();
  return id;
}

export function dismissToast(id) {
  if (!state.toasts.some((t) => t.id === id)) return;
  state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
  emit();
}

export const notify = {
  info: (message, options) => toast('info', message, options),
  success: (message, options) => toast('success', message, options),
  warning: (message, options) => toast('warning', message, options),
  error: (message, options) => toast('error', message, options),
};

/** 받침 유무에 맞는 조사 선택: josa('아이디', '을', '를') → '를'. 한글이 아니면 '을(를)' 형태. */
function josa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangul) return `${withBatchim}(${withoutBatchim})`;
  return (code - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim;
}

/**
 * 브라우저 기본 검증 말풍선("이 입력란을 작성하세요") 대체.
 * <form noValidate onSubmit={...}> 로 두고, 핸들러 맨 앞(e.preventDefault() 다음, 첫 await 이전)에서
 *   if (!validateForm(e.currentTarget)) return;
 * required / type="email" / pattern / minLength 같은 HTML 제약을 그대로 검사하고,
 * 첫 번째로 어긋난 입력창으로 포커스를 옮기며 토스트로 안내한다. 통과하면 true.
 */
export function validateForm(form) {
  if (!form || form.checkValidity()) return true;

  const field = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
  if (!field) return true;

  const labelEl = field.id ? form.querySelector(`label[for="${CSS.escape(field.id)}"]`) : null;
  const name = (
    labelEl?.textContent ||
    field.getAttribute('aria-label') ||
    field.getAttribute('placeholder') ||
    field.name ||
    '입력값'
  ).replace(/[*\s]+$/g, '').replace(/\s*\(.*\)\s*$/, '').trim();

  const v = field.validity;
  let message;
  if (v.valueMissing) message = `${name}${josa(name, '을', '를')} 입력해 주세요.`;
  else if (v.typeMismatch || v.patternMismatch) message = `${name} 형식이 올바르지 않습니다.`;
  else if (v.tooShort) message = `${name}${josa(name, '은', '는')} 최소 ${field.minLength}자 이상이어야 합니다.`;
  else message = field.validationMessage || `${name}${josa(name, '을', '를')} 확인해 주세요.`;

  field.setAttribute('aria-invalid', 'true');
  field.addEventListener('input', () => field.removeAttribute('aria-invalid'), { once: true });
  field.focus();
  notify.warning(message);
  return false;
}
