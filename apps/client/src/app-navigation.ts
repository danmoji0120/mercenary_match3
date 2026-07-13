export const APP_TABS = ['gacha', 'mercenaries', 'lobby', 'inventory', 'forge'] as const;
export type AppTab = (typeof APP_TABS)[number];

const paths: Record<AppTab, string> = {
  gacha: '/gacha',
  mercenaries: '/mercenaries',
  lobby: '/lobby',
  inventory: '/inventory',
  forge: '/forge',
};

export function pathForTab(tab: AppTab) { return paths[tab] }

export function tabForPath(pathname: string): AppTab | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/account') return 'lobby';
  if (normalized === '/mercenaries' || normalized.startsWith('/mercenaries/')) return 'mercenaries';
  return APP_TABS.find((tab) => paths[tab] === normalized) ?? (normalized === '/' ? 'lobby' : null);
}

export type MercenaryRoute =
  | { kind: 'collection' }
  | { kind: 'detail'; characterId: string }
  | { kind: 'loadout' };

export function mercenaryRouteForPath(pathname: string): MercenaryRoute | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/mercenaries') return { kind: 'collection' };
  if (normalized === '/mercenaries/loadout') return { kind: 'loadout' };
  const match = normalized.match(/^\/mercenaries\/([^/]+)$/);
  if (!match) return null;
  try { return { kind: 'detail', characterId: decodeURIComponent(match[1]!) } }
  catch { return null }
}

export function mercenaryDetailPath(characterId: string) {
  return `/mercenaries/${encodeURIComponent(characterId)}`;
}
