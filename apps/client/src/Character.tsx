export function Character({ side, state }: { side: 'self' | 'opponent'; state: string }) {
  return <svg className={`fighter ${side} ${state}`} viewBox="0 0 120 130" aria-label={`${side} fighter`}>
    <path className="cape" d="M42 46L18 111h76L76 45z"/><circle className="head" cx="59" cy="31" r="20"/><path className="visor" d="M41 28h38v12H44z"/><path className="body" d="M39 51h40l12 63H29z"/><path className="weapon" d="M84 45l9-5 23 51-9 4z"/><path className="shield" d="M15 62l25 8-4 37c-20-9-25-23-21-45z"/>
  </svg>;
}
