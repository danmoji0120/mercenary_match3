import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import {
  CURRENCY_METADATA,
  type CharacterRarity,
  type CharacterRole,
  type CurrencyId,
  type UserAccountState,
} from '@mercenary/shared';
import {
  applyDevelopmentCurrencyPreset,
  grantDevelopmentCharacters,
  type DevelopmentCurrencyPreset,
} from './account';

const currencyById = new Map(CURRENCY_METADATA.map((currency) => [currency.id, currency]));
export function formatCompactBalance(value: number) {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return `${Number((value / 1_000_000).toFixed(1))}M`;
}

export function GameIcon({ name }: { name: string }) {
  if (name === 'coin')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M9 9h6M9 15h6M12 7v10" />
      </svg>
    );
  if (name === 'contract')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10l3 4-8 14L4 7l3-4Z" />
        <path d="m7 3 5 5 5-5M4 7h16" />
      </svg>
    );
  if (name === 'roster' || name === 'profile')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
      </svg>
    );
  if (name === 'formation')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="6" r="3" />
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="m10 9-3 5m7-5 3 5" />
      </svg>
    );
  if (name === 'home')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 11 9-8 9 8v10h-6v-7H9v7H3V11Z" />
      </svg>
    );
  if (name === 'tools')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14 6 4-4 4 4-4 4M2 22l9-9M4 4l16 16" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 4 8v8l8 5 8-5V8l-8-5Z" />
    </svg>
  );
}

export function CurrencyChip({
  id,
  value,
  onClick,
}: {
  id: CurrencyId;
  value: number;
  onClick(): void;
}) {
  const metadata = currencyById.get(id)!;
  const full = value.toLocaleString('ko-KR');
  return (
    <button
      type="button"
      className="currency-chip"
      aria-label={`${metadata.displayName} ${full}`}
      title={`${metadata.displayName} ${full}`}
      onClick={onClick}
    >
      <GameIcon name={metadata.iconKey} />
      <b>{formatCompactBalance(value)}</b>
    </button>
  );
}

function FocusedSheet({
  title,
  onClose,
  children,
  testId,
}: PropsWithChildren<{ title: string; onClose(): void; testId?: string }>) {
  const dialog = useRef<HTMLElement>(null),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const values = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),[href],input,select,[tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = values[0],
        last = values.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div
      className="modal-sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        data-testid={testId}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header>
          <h2 id="sheet-title">{title}</h2>
          <button ref={close} className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function CurrencySheet({
  account,
  onClose,
}: {
  account: UserAccountState;
  onClose(): void;
}) {
  return (
    <FocusedSheet title="보유 재화" onClose={onClose} testId="currency-sheet">
      <div className="currency-list">
        {CURRENCY_METADATA.map((metadata) => (
          <div key={metadata.id}>
            <span className={`currency-icon ${metadata.iconKey}`}>
              <GameIcon name={metadata.iconKey} />
            </span>
            <span>
              <b>{metadata.displayName}</b>
              <small>현재 보유량</small>
            </span>
            <strong>{account.currencies[metadata.id].toLocaleString('ko-KR')}</strong>
          </div>
        ))}
      </div>
      <p className="sheet-note">조각 사용처는 아직 구현되지 않았습니다.</p>
    </FocusedSheet>
  );
}

const DevelopmentToolsSheet = import.meta.env.DEV
  ? function DevelopmentToolsSheet({
      account,
      token,
      onAccountSaved,
      onClose,
    }: {
      account: UserAccountState;
      token: string;
      onAccountSaved(value: UserAccountState): void;
      onClose(): void;
    }) {
      const [busy, setBusy] = useState(false),
        [message, setMessage] = useState('');
      const applyPreset = async (preset: DevelopmentCurrencyPreset) => {
        if (busy) return;
        setBusy(true);
        setMessage('');
        try {
          const result = await applyDevelopmentCurrencyPreset(token, preset);
          onAccountSaved(result.account);
          setMessage('재화 프리셋을 적용했습니다.');
        } catch {
          setMessage('재화 프리셋 적용에 실패했습니다.');
        } finally {
          setBusy(false);
        }
      };
      const grantAll = async () => {
        if (busy) return;
        setBusy(true);
        setMessage('');
        try {
          const result = await grantDevelopmentCharacters(token);
          onAccountSaved(result.account);
          setMessage(
            result.grant.addedCharacterIds.length
              ? `${result.grant.addedCharacterIds.length}명을 지급했습니다.`
              : '활성 캐릭터를 이미 모두 보유하고 있습니다.',
          );
        } catch {
          setMessage('캐릭터 지급에 실패했습니다.');
        } finally {
          setBusy(false);
        }
      };
      return (
        <FocusedSheet title="DEV 도구" onClose={onClose} testId="development-tools">
          <div className="dev-tool-grid">
            <button
              disabled={
                busy ||
                account.ownedCharacterIds.length >=
                  account.characters.filter((item) => item.enabled).length
              }
              data-testid="grant-representative-characters"
              onClick={() => void grantAll()}
            >
              전체 캐릭터 지급
            </button>
            <button
              disabled={busy}
              data-testid="currency-ui-preview"
              onClick={() => void applyPreset('ui-preview')}
            >
              UI 재화 프리셋
            </button>
            <button disabled={busy} onClick={() => void applyPreset('recruitment-test')}>
              계약석 테스트
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void applyPreset('reset-currencies')}
            >
              재화 초기화
            </button>
          </div>
          {message && <output role="status">{message}</output>}
        </FocusedSheet>
      );
    }
  : function DevelopmentToolsDisabled() {
      return null;
    };

export function TopResourceBar({
  account,
  name,
  guest,
  token,
  onAccount,
  onAccountSaved,
}: {
  account: UserAccountState | null;
  name: string;
  guest: boolean;
  token: string;
  onAccount(): void;
  onAccountSaved(value: UserAccountState): void;
}) {
  const [currencyOpen, setCurrencyOpen] = useState(false),
    [devOpen, setDevOpen] = useState(false);
  return (
    <>
      <header className="top-resource-bar" data-testid="app-header">
        <button
          className="profile-button"
          aria-label={`계정 관리, ${guest ? '게스트 계정' : '이메일 계정'}`}
          onClick={onAccount}
        >
          <GameIcon name="profile" />
          <span>
            <small>{guest ? '게스트' : '용병단장'}</small>
            <b data-testid="lobby-ready">{name}</b>
          </span>
        </button>
        <div className="resource-chips">
          {account && (
            <>
              <CurrencyChip
                id="recruit_token"
                value={account.currencies.recruit_token}
                onClick={() => setCurrencyOpen(true)}
              />
              <CurrencyChip
                id="gold"
                value={account.currencies.gold}
                onClick={() => setCurrencyOpen(true)}
              />
            </>
          )}
          {import.meta.env.DEV && account && (
            <button
              className="icon-button dev-tools-button"
              aria-label="개발 도구"
              data-testid="open-dev-tools"
              onClick={() => setDevOpen(true)}
            >
              <GameIcon name="tools" />
            </button>
          )}
        </div>
      </header>
      {currencyOpen && account && (
        <CurrencySheet account={account} onClose={() => setCurrencyOpen(false)} />
      )}{' '}
      {devOpen && account && (
        <DevelopmentToolsSheet
          account={account}
          token={token}
          onAccountSaved={onAccountSaved}
          onClose={() => setDevOpen(false)}
        />
      )}
    </>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow && <small>{eyebrow}</small>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function GamePanel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`game-panel ${className}`}>{children}</section>;
}
export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`icon-button ${props.className ?? ''}`} />;
}
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`primary-button ${props.className ?? ''}`} />;
}
export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={`secondary-button ${props.className ?? ''}`} />
  );
}
export function RarityBadge({ rarity }: { rarity: CharacterRarity }) {
  return <span className={`rarity-badge rarity-${rarity.toLowerCase()}`}>{rarity}</span>;
}
export function RoleBadge({ role }: { role: CharacterRole }) {
  return <span className="role-badge">{role}</span>;
}
export function CharacterCard({
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button type="button" {...props} className={`character-card ${props.className ?? ''}`}>
      {children}
    </button>
  );
}
export const ModalSheet = FocusedSheet;
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {action}
    </div>
  );
}
