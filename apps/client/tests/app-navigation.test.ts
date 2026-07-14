import { describe, expect, it } from 'vitest';
import { APP_TABS, mercenaryDetailPath, mercenaryRouteForPath, pathForTab, tabForPath } from '../src/app-navigation';

describe('app navigation routes', () => {
  it('exposes only implemented primary screens and uses lobby as root fallback', () => {
    expect(APP_TABS).toEqual(['mercenaries', 'lobby']);
    expect(tabForPath('/')).toBe('lobby'); expect(tabForPath('/unknown')).toBeNull();
    expect(tabForPath('/gacha')).toBeNull(); expect(tabForPath('/inventory')).toBeNull(); expect(tabForPath('/forge')).toBeNull();
  });
  it('round-trips canonical tab paths', () => { for (const tab of APP_TABS) expect(tabForPath(pathForTab(tab))).toBe(tab) });
  it('keeps collection, detail, and loadout URLs inside the mercenary tab', () => {
    expect(tabForPath('/mercenaries/yuria_counter_sword')).toBe('mercenaries'); expect(tabForPath('/mercenaries/loadout')).toBe('mercenaries');
    expect(mercenaryRouteForPath('/mercenaries')).toEqual({ kind: 'collection' }); expect(mercenaryRouteForPath('/mercenaries/loadout')).toEqual({ kind: 'loadout' });
    expect(mercenaryRouteForPath(mercenaryDetailPath('검사_유리아'))).toEqual({ kind: 'detail', characterId: '검사_유리아' });
  });
});
