export type AuthAction = 'guest' | 'link' | 'signin' | 'callback' | 'signout' | 'session';

export function authErrorMessage(action: AuthAction, error: unknown) {
  const source = error instanceof Error ? error.message.toLowerCase() : '';
  if (/rate|too many|429/.test(source)) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (/expired|invalid.*link|otp_expired/.test(source)) return '이미 사용되었거나 만료된 링크입니다. 새 링크를 요청해 주세요.';
  if (/network|fetch|unavailable/.test(source)) return '연결 상태를 확인하고 다시 시도해 주세요.';
  if (action === 'link') return '이 이메일을 계정에 연결할 수 없습니다.';
  if (action === 'signin') return '로그인 메일을 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (action === 'callback') return '계정 정보를 복구하지 못했습니다. 새 로그인 링크를 요청해 주세요.';
  if (action === 'guest') return '게스트 계정을 시작하지 못했습니다. 다시 시도해 주세요.';
  if (action === 'signout') return '로그아웃하지 못했습니다. 연결 상태를 확인해 주세요.';
  return '계정 정보를 복구하지 못했습니다. 다시 시도해 주세요.';
}
