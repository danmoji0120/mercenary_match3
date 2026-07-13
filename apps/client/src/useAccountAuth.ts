import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserAccountState } from '@mercenary/shared';
import { bootstrapGameAccount, resetAccountBootstrapForRetry, type AccountStage } from './account';
import { accountAuthClient } from './auth-client';
import { authErrorMessage, type AuthAction } from './auth-errors';
import { statusForSession, type AccountAuthSession, type AccountAuthState } from './auth-state';
import { connectAuthenticated, disconnectAuthenticated } from './socket';

interface UseAccountAuthOptions { onNavigate(path: string, replace?: boolean): void }

export function useAccountAuth({ onNavigate }: UseAccountAuthOptions) {
  const [auth, setAuth] = useState<AccountAuthState>({ status: 'loading', session: null, error: '' });
  const [account, setAccount] = useState<UserAccountState | null>(null), [accountStage, setAccountStage] = useState<AccountStage>('INITIALIZING'), [accountError, setAccountError] = useState('');
  const mounted = useRef(true), accountOwner = useRef(''), processing = useRef(Promise.resolve());

  const clearAccount = useCallback(() => {
    accountOwner.current = ''; setAccount(null); setAccountError(''); setAccountStage('INITIALIZING'); resetAccountBootstrapForRetry();
  }, []);

  const processSession = useCallback((session: AccountAuthSession | null, forceBootstrap = false) => {
    processing.current = processing.current.then(async () => {
      if (!mounted.current) return;
      if (!session) { clearAccount(); disconnectAuthenticated(); setAuth({ status: 'signed_out', session: null, error: '' }); return }
      const ownerChanged = Boolean(accountOwner.current && accountOwner.current !== session.userId);
      if (ownerChanged) clearAccount();
      setAuth({ status: statusForSession(session), session, error: '' });
      connectAuthenticated(session.accessToken, session.userId);
      if (!forceBootstrap && accountOwner.current === session.userId) { setAccountStage('READY'); return }
      setAccountStage('BOOTSTRAPPING_ACCOUNT'); setAccountError('');
      try {
        const value = await bootstrapGameAccount(session.accessToken);
        if (!mounted.current) return;
        accountOwner.current = session.userId; setAccount(value); setAccountStage('READY');
      } catch (error) {
        if (!mounted.current) return;
        setAccountStage('RETRYABLE_ERROR'); setAccountError(authErrorMessage('session', error));
      }
    });
    return processing.current;
  }, [clearAccount]);

  const fail = useCallback((action: AuthAction, error: unknown, fatal = false) => {
    const message = authErrorMessage(action, error);
    setAuth((value) => ({ ...value, status: fatal ? 'auth_error' : value.session ? statusForSession(value.session) : 'signed_out', error: message }));
    return message;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let unsubscribe = () => {};
    try {
      const client = accountAuthClient();
      unsubscribe = client.subscribe((event, session) => {
        if (event === 'TOKEN_REFRESHED') { if (session) { setAuth({ status: statusForSession(session), session, error: '' }); connectAuthenticated(session.accessToken, session.userId) } return }
        void processSession(session, event === 'SIGNED_IN');
      });
      void (async () => {
        setAccountStage('CHECKING_SESSION');
        try {
          if (location.pathname === '/auth/callback') {
            const before = await client.getSession(), linkedUserId = before?.isAnonymous ? before.userId : '';
            const session = await client.consumeCallback(new URL(location.href));
            if (linkedUserId && linkedUserId === session.userId) sessionStorage.setItem('mercenary-link-complete', 'true');
            history.replaceState(null, '', linkedUserId && linkedUserId === session.userId ? '/account' : '/lobby');
            onNavigate(linkedUserId && linkedUserId === session.userId ? '/account' : '/lobby', true);
            await processSession(session, true); return;
          }
          const session = await client.getSession();
          await processSession(session, Boolean(session));
          if (!session && location.pathname !== '/') { history.replaceState(null, '', '/'); onNavigate('/', true) }
          else if (session && location.pathname === '/') onNavigate('/lobby', true);
        } catch (error) {
          if (location.pathname === '/auth/callback') history.replaceState(null, '', '/auth/callback');
          fail(location.pathname === '/auth/callback' ? 'callback' : 'session', error, true);
          clearAccount(); disconnectAuthenticated();
        }
      })();
    } catch (error) { fail('session', error, true); setAccountStage('FATAL_ERROR') }
    return () => { mounted.current = false; unsubscribe() };
  }, [clearAccount, fail, onNavigate, processSession]);

  const startGuest = useCallback(async () => {
    setAuth({ status: 'loading', session: null, error: '' }); setAccountStage('SIGNING_IN_ANONYMOUSLY');
    try { const session = await accountAuthClient().signInAnonymously(); await processSession(session, true); onNavigate('/lobby', true) }
    catch (error) { fail('guest', error); setAccountStage('RETRYABLE_ERROR') }
  }, [fail, onNavigate, processSession]);

  const requestEmailSignIn = useCallback(async (email: string) => {
    try { await accountAuthClient().signInWithEmail(email); setAuth((value) => ({ ...value, error: '' })) }
    catch (error) { throw new Error(fail('signin', error)) }
  }, [fail]);

  const linkEmail = useCallback(async (email: string) => {
    const originalUserId = auth.session?.userId;
    if (!originalUserId || !auth.session?.isAnonymous) throw new Error('게스트 계정에서만 이메일을 연결할 수 있습니다.');
    try {
      const session = await accountAuthClient().updateUserEmail(email);
      if (session.userId !== originalUserId) { clearAccount(); disconnectAuthenticated(); throw new Error('ACCOUNT_ID_CHANGED') }
      setAuth({ status: 'link_pending', session, error: '' });
    } catch (error) { throw new Error(fail('link', error)) }
  }, [auth.session, clearAccount, fail]);

  const checkLink = useCallback(async () => {
    try { const session = await accountAuthClient().refreshUser(); await processSession(session, Boolean(session && !session.isAnonymous)); return session }
    catch (error) { throw new Error(fail('session', error)) }
  }, [fail, processSession]);

  const signOut = useCallback(async () => {
    clearAccount(); disconnectAuthenticated(); setAuth({ status: 'loading', session: null, error: '' });
    try { await accountAuthClient().signOut(); setAuth({ status: 'signed_out', session: null, error: '' }); onNavigate('/', true) }
    catch (error) { fail('signout', error, true) }
  }, [clearAccount, fail, onNavigate]);

  const retryAccount = useCallback(() => { if (auth.session) { resetAccountBootstrapForRetry(); void processSession(auth.session, true) } }, [auth.session, processSession]);

  return { auth, account, setAccount, accountStage, accountError, accessToken: auth.session?.accessToken ?? '', startGuest, requestEmailSignIn, linkEmail, checkLink, signOut, retryAccount };
}
