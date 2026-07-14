import { useEffect, useState } from 'react';
import type { CharacterRarity, CharacterRole } from '@mercenary/shared';

export type CharacterPortraitVariant = 'card' | 'lobby' | 'detail' | 'support' | 'combat';

export interface CharacterPortraitProps {
  src?: string;
  alt: string;
  className?: string;
  eager?: boolean;
  variant?: CharacterPortraitVariant;
  characterId?: string;
  shortName?: string;
  rarity?: CharacterRarity;
  role?: CharacterRole;
}

export function stablePortraitVariant(characterId = ''): number {
  let hash = 0;
  for (const character of characterId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 4;
}

function RoleMark({ role }: { role?: CharacterRole }) {
  if (role === 'DEFENSE') return <path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z" />;
  if (role === 'HEAL') return <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />;
  if (role === 'SUPPORT') return <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 20c0-4 2-6 5-6s5 2 5 6M11 20c0-4 2-6 5-6s5 2 5 6" /></>;
  if (role === 'DISRUPT') return <><path d="m5 4 14 16M19 4 5 20" /><circle cx="12" cy="12" r="8" /></>;
  return <path d="m14 3-9 11h6l-1 7 9-12h-6l1-6Z" />;
}

export function CharacterPortrait({
  src,
  alt,
  className,
  eager = false,
  variant = 'card',
  characterId,
  shortName,
  rarity = 'R',
  role,
}: CharacterPortraitProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const classes = `character-portrait character-portrait-${variant}${className ? ` ${className}` : ''}`;
  if (src && !failed)
    return (
      <img
        className={classes}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        data-portrait-source="asset"
        onError={() => setFailed(true)}
      />
    );

  const initial = (shortName || alt || '용').trim().slice(0, 1);
  return (
    <span
      className={`${classes} character-portrait-fallback rarity-${rarity.toLowerCase()} role-${role?.toLowerCase() ?? 'unknown'} fallback-variant-${stablePortraitVariant(characterId)}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-portrait-source="fallback"
    >
      <span className="portrait-fallback-orbit" aria-hidden="true" />
      <svg className="portrait-fallback-silhouette" viewBox="0 0 100 120" aria-hidden="true">
        <circle cx="50" cy="38" r="20" />
        <path d="M17 113c2-29 14-48 33-48s31 19 33 48" />
      </svg>
      <span className="portrait-fallback-role" aria-hidden="true">
        <svg viewBox="0 0 24 24"><RoleMark role={role} /></svg>
      </span>
      <b aria-hidden="true">{initial}</b>
    </span>
  );
}
