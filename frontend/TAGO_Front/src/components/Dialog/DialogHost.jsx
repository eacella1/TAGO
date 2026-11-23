import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { closeDialog, dismissToast, getSnapshot, subscribe } from './dialogService';
import './Dialog.css';

const DEFAULT_TITLE = {
  info: '안내',
  success: '완료',
  warning: '확인해 주세요',
  error: '오류가 발생했습니다',
};

function ToneIcon({ tone }) {
  const common = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  if (tone === 'success') return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (tone === 'warning') return <svg {...common}><path d="M12 8v5" /><path d="M12 16.5v.01" /><path d="M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>;
  if (tone === 'error') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.01" /></svg>;
}

/* ---------------- 토스트 ---------------- */
function Toast({ toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration]);

  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast__icon"><ToneIcon tone={toast.tone} /></span>
      <p className="toast__text">{toast.message}</p>
      <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="알림 닫기">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

/* ---------------- 모달 ---------------- */
function Modal({ dialog: d }) {
  const isConfirm = d.kind === 'confirm';
  const tone = d.tone ?? (isConfirm ? (d.danger ? 'warning' : 'info') : 'info');
  const title = d.title ?? (isConfirm ? '확인해 주세요' : DEFAULT_TITLE[tone]);
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const primaryRef = useRef(null);

  const finish = (result) => closeDialog(d.id, result);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish(isConfirm ? false : undefined);
      return;
    }
    if (e.key !== 'Tab') return;
    // 포커스를 모달 안에 가둔다
    const focusables = panelRef.current?.querySelectorAll('button:not([disabled])');
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      className="dlg-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isConfirm) finish(undefined); }}
    >
      <div
        ref={panelRef}
        className={`dlg dlg--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
      >
        <div className="dlg__body">
          <span className="dlg__icon"><ToneIcon tone={tone} /></span>
          <h2 id={titleId} className="dlg__title">{title}</h2>
          <p id={descId} className="dlg__message">{d.message}</p>
        </div>
        <div className="dlg__actions">
          {isConfirm && (
            <button type="button" className="ui-btn ui-btn--neutral dlg__btn" onClick={() => finish(false)}>
              {d.cancelLabel ?? '닫기'}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className={`ui-btn dlg__btn${d.danger ? ' is-danger' : ''}`}
            onClick={() => finish(isConfirm ? true : undefined)}
          >
            {d.confirmLabel ?? '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DialogHost() {
  const { dialogs, toasts } = useSyncExternalStore(subscribe, getSnapshot);
  const active = dialogs[0];

  return (
    <>
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => <Toast key={t.id} toast={t} />)}
      </div>
      {active && <Modal key={active.id} dialog={active} />}
    </>
  );
}
