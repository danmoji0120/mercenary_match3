import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { AccountAuthState } from './auth-state';
import { maskEmail } from './auth-state';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useCooldown() {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => { if (remaining <= 0) return; const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000); return () => clearInterval(timer) }, [remaining]);
  return { remaining, start: () => setRemaining(60) };
}

function DialogFrame({ titleId, children, onClose, danger = false }: { titleId: string; children: ReactNode; onClose(): void; danger?: boolean }) {
  const dialog = useRef<HTMLElement>(null), first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (danger) dialog.current?.querySelector<HTMLButtonElement>('button.secondary')?.focus(); else first.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button,input,[href],[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hasAttribute('disabled'));
      const head = focusable[0], tail = focusable.at(-1);
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail?.focus() }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head?.focus() }
    };
    addEventListener('keydown', keydown); return () => removeEventListener('keydown', keydown);
  }, [danger, onClose]);
  return <div className="auth-dialog-backdrop"><section ref={dialog} className={`auth-dialog ${danger ? 'danger' : ''}`} role={danger ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId}><button ref={first} type="button" className="auth-dialog-close" aria-label="닫기" onClick={onClose}>×</button>{children}</section></div>;
}

function EmailForm({ title, titleId, description, submitLabel, pending, error, onBack, onSubmit }: { title: string; titleId?: string; description: string; submitLabel: string; pending: boolean; error: string; onBack(): void; onSubmit(email: string): Promise<void> }) {
  const [email, setEmail] = useState(''), [localError, setLocalError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); const value = email.trim().toLowerCase(); if (!emailPattern.test(value)) { setLocalError('올바른 이메일 주소를 입력해 주세요.'); return } setLocalError(''); await onSubmit(value) };
  return <form className="auth-email-form" aria-busy={pending} onSubmit={submit}><header><small>ACCOUNT RECOVERY</small><h2 id={titleId}>{title}</h2><p>{description}</p></header><label htmlFor="auth-email">이메일</label><input id="auth-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} aria-invalid={Boolean(localError || error)} aria-describedby={(localError || error) ? 'auth-email-error' : undefined} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" disabled={pending}/>{(localError || error) && <p id="auth-email-error" className="auth-form-error" role="alert">{localError || error}</p>}<div className="auth-form-actions"><button type="button" className="secondary" disabled={pending} onClick={onBack}>뒤로</button><button type="submit" disabled={pending || !email.trim()}>{pending ? '요청 중…' : submitLabel}</button></div></form>;
}

export function AuthEntryScreen({ auth, onGuest, onEmail }: { auth: AccountAuthState; onGuest(): Promise<void>; onEmail(email: string): Promise<void> }) {
  const [view, setView] = useState<'entry' | 'email' | 'sent'>('entry'), [pending, setPending] = useState(false), [error, setError] = useState(''), [lastEmail, setLastEmail] = useState('');
  const cooldown = useCooldown();
  const send = async (email: string) => { if (pending) return; setPending(true); setError(''); try { await onEmail(email); setLastEmail(email); setView('sent'); cooldown.start() } catch (value) { setError(value instanceof Error ? value.message : '로그인 메일을 보내지 못했습니다.') } finally { setPending(false) } };
  const guest = async () => { if (pending) return; setPending(true); setError(''); try { await onGuest() } catch (value) { setError(value instanceof Error ? value.message : '게스트 계정을 시작하지 못했습니다.') } finally { setPending(false) } };
  return <main className="shell auth-entry-screen" data-testid="auth-entry" aria-busy={pending}>
    <div className="auth-entry-crest" aria-hidden="true">7×7</div>
    {view === 'entry' && <section className="auth-entry-card"><small>MERCENARY ACCOUNT</small><h1>폐급 용병단</h1><p>계정을 연결하면 다른 기기에서도<br/>용병과 편성을 이어서 이용할 수 있습니다.</p><div><button data-testid="start-guest" disabled={pending} onClick={guest}>게스트로 시작</button><button className="secondary" disabled={pending} onClick={() => { setView('email'); setError('') }}>이메일로 로그인</button></div>{(error || auth.error) && <p className="auth-form-error" role="alert">{error || auth.error}</p>}<small className="guest-note">게스트 계정은 브라우저 데이터가 삭제되면 복구할 수 없습니다.</small></section>}
    {view === 'email' && <EmailForm title="이메일 로그인" description="계정에 연결한 이메일을 입력하세요. 비밀번호 없이 로그인 링크를 보내드립니다." submitLabel="로그인 링크 보내기" pending={pending} error={error} onBack={() => { setView('entry'); setError('') }} onSubmit={send}/>} 
    {view === 'sent' && <section className="auth-mail-sent"><span aria-hidden="true">✉</span><h2>로그인 메일을 확인해 주세요.</h2><p>계정이 등록된 이메일이라면<br/>로그인 링크가 전송됩니다.</p><b>{maskEmail(lastEmail)}</b><button disabled={pending || cooldown.remaining > 0} onClick={() => void send(lastEmail)}>{cooldown.remaining > 0 ? `메일 다시 보내기 (${cooldown.remaining}초)` : '메일 다시 보내기'}</button><button className="secondary" onClick={() => { setView('email'); setError('') }}>다른 이메일 입력</button>{error && <p className="auth-form-error" role="alert">{error}</p>}</section>}
  </main>;
}

export function AuthCallbackScreen({ error, onRestart }: { error: string; onRestart(): void }) {
  return <main className="shell auth-entry-screen"><section className="auth-entry-card" data-testid="auth-callback"><small>AUTH CALLBACK</small><h1>{error ? '링크를 확인할 수 없습니다' : '계정을 복구하는 중'}</h1><p>{error || '안전한 세션을 확인하고 용병단 기록을 불러오고 있습니다.'}</p>{error && <button onClick={onRestart}>새 로그인 링크 요청</button>}</section></main>;
}

export function AccountScreen({ auth, displayName, blocked, onBack, onLink, onCheck, onSignOut }: { auth: AccountAuthState; displayName: string; blocked: boolean; onBack(): void; onLink(email: string): Promise<void>; onCheck(): Promise<void>; onSignOut(): Promise<void> }) {
  const [dialog, setDialog] = useState<'link' | 'logout' | 'abandon' | null>(null), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [linkCompleted] = useState(() => sessionStorage.getItem('mercenary-link-complete') === 'true');
  const cooldown = useCooldown(), session = auth.session;
  useEffect(() => { if (linkCompleted) sessionStorage.removeItem('mercenary-link-complete') }, [linkCompleted]);
  const link = async (email: string) => { setPending(true); setError(''); try { await onLink(email); cooldown.start(); setDialog(null) } catch (value) { setError(value instanceof Error ? value.message : '이메일을 연결하지 못했습니다.') } finally { setPending(false) } };
  const check = async () => { if (pending) return; setPending(true); setError(''); try { await onCheck() } catch (value) { setError(value instanceof Error ? value.message : '계정 상태를 확인하지 못했습니다.') } finally { setPending(false) } };
  const logout = async () => { setPending(true); await onSignOut(); setPending(false) };
  return <section className="app-screen account-screen" aria-labelledby="account-title"><header className="account-heading"><button className="secondary" aria-label="계정 화면 닫기" onClick={onBack}>←</button><div><small>ACCOUNT</small><h2 id="account-title">계정 관리</h2></div></header>
    {linkCompleted && <p className="account-blocked" role="status">계정 연결 완료 — 현재 용병과 편성이 이메일 계정에 안전하게 연결되었습니다.</p>}
    <section className={`account-status-card ${auth.status}`}><span aria-hidden="true">{auth.status === 'permanent' ? '✓' : '!'}</span><small>계정 상태</small><h3>{auth.status === 'permanent' ? '이메일 계정' : auth.status === 'link_pending' ? '이메일 확인 대기' : '게스트 계정'}</h3><b>{displayName}</b>{auth.status === 'permanent' ? <><em>{maskEmail(session?.email)}</em><p>다른 브라우저와 기기에서도 같은 이메일로 로그인할 수 있습니다.</p></> : auth.status === 'link_pending' ? <><em>{maskEmail(session?.pendingEmail)}</em><p>메일의 계정 연결 버튼을 눌러 주세요. 확인 전에도 현재 게임을 계속 이용할 수 있습니다.</p></> : <p>현재 기기에서는 계속 이용할 수 있지만 브라우저 데이터가 삭제되거나 다른 기기를 사용하면 복구할 수 없습니다.</p>}</section>
    {blocked && <p className="account-blocked" role="status">매칭 대기 중에는 계정 연결이나 로그아웃을 진행할 수 없습니다.</p>}
    <div className="account-actions">{auth.status === 'guest' && <><button disabled={blocked} onClick={() => { setDialog('link'); setError('') }}>이메일 계정 연결</button><button className="danger-button" disabled={blocked} onClick={() => setDialog('abandon')}>다른 계정으로 전환</button></>}{auth.status === 'link_pending' && <><button disabled={blocked || cooldown.remaining > 0 || pending} onClick={() => session?.pendingEmail && void link(session.pendingEmail)}>{cooldown.remaining > 0 ? `메일 다시 보내기 (${cooldown.remaining}초)` : '메일 다시 보내기'}</button><button className="secondary" disabled={pending} onClick={() => void check()}>완료 여부 확인</button></>}{auth.status === 'permanent' && <button className="secondary" disabled={blocked} onClick={() => setDialog('logout')}>로그아웃</button>}</div>
    {error && <p className="auth-form-error" role="alert">{error}</p>}
    {auth.error && <p className="auth-form-error" role="alert">{auth.error}</p>}
    {dialog === 'link' && <DialogFrame titleId="link-email-title" onClose={() => setDialog(null)}><EmailForm title="이메일로 계정 보호" titleId="link-email-title" description="확인 링크를 받을 이메일을 입력하세요. 확인이 끝나면 현재 용병과 편성이 그대로 보호됩니다." submitLabel="확인 링크 보내기" pending={pending} error={error} onBack={() => setDialog(null)} onSubmit={link}/></DialogFrame>}
    {dialog === 'logout' && <DialogFrame titleId="signout-title" danger onClose={() => setDialog(null)}><h2 id="signout-title">로그아웃하시겠습니까?</h2><p>이 기기에서는 계정 정보가 제거되며, 다시 이메일 로그인으로 접속할 수 있습니다.</p><div className="dialog-actions"><button className="secondary" onClick={() => setDialog(null)}>취소</button><button disabled={pending} onClick={() => void logout()}>로그아웃</button></div></DialogFrame>}
    {dialog === 'abandon' && <DialogFrame titleId="abandon-title" danger onClose={() => setDialog(null)}><h2 id="abandon-title">현재 게스트 진행을 포기하시겠습니까?</h2><p>이 계정은 이메일에 연결되지 않았습니다. 지금 로그아웃하면 현재 용병과 편성을 다시 복구할 수 없습니다.</p><strong>먼저 이메일 계정을 연결하는 것을 권장합니다.</strong><div className="dialog-actions three"><button className="secondary" onClick={() => setDialog(null)}>취소</button><button onClick={() => setDialog('link')}>계정 연결</button><button className="danger-button" disabled={pending} onClick={() => void logout()}>게스트 진행 포기</button></div></DialogFrame>}
  </section>;
}
