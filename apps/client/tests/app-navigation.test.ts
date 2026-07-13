import { describe, expect, it } from 'vitest';
import { APP_TABS, mercenaryDetailPath, mercenaryRouteForPath, pathForTab, tabForPath } from '../src/app-navigation';

describe('app navigation routes', () => {
  it('keeps the five-tab order and uses lobby as the root fallback', () => {
    expect(APP_TABS).toEqual(['gacha', 'mercenaries', 'lobby', 'inventory', 'forge']);
    expect(tabForPath('/')).toBe('lobby');
    expect(tabForPath('/unknown')).toBeNull();
  });

  it('round-trips every canonical tab path', () => {
    for (const tab of APP_TABS) expect(tabForPath(pathForTab(tab))).toBe(tab);
    expect(tabForPath('/inventory/')).toBe('inventory');
  });

  it('keeps collection, detail, and loadout URLs inside the mercenary tab', () => {
    expect(tabForPath('/mercenaries/yuria_counter_sword')).toBe('mercenaries');
    expect(tabForPath('/mercenaries/loadout')).toBe('mercenaries');
    expect(mercenaryRouteForPath('/mercenaries')).toEqual({ kind: 'collection' });
    expect(mercenaryRouteForPath('/mercenaries/loadout')).toEqual({ kind: 'loadout' });
    expect(mercenaryRouteForPath(mercenaryDetailPath('검사/유리아'))).toEqual({ kind: 'detail', characterId: '검사/유리아' });
    expect(mercenaryRouteForPath(mercenaryDetailPath('yuria_counter_sword'))).toEqual({ kind: 'detail', characterId: 'yuria_counter_sword' });
  });
});
