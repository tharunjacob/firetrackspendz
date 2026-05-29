import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted ensures these refs are initialized before vi.mock factories run.
const { supabaseMock, isCloudEnabledMock } = vi.hoisted(() => {
  const supabaseMock = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  // Wire the Supabase query-builder chain: from().select().eq().eq().maybeSingle()
  supabaseMock.from.mockReturnValue(supabaseMock);
  supabaseMock.select.mockReturnValue(supabaseMock);
  supabaseMock.eq.mockReturnValue(supabaseMock);

  const isCloudEnabledMock = vi.fn().mockReturnValue(false);
  return { supabaseMock, isCloudEnabledMock };
});

vi.mock('../supabase', () => ({
  isCloudEnabled: isCloudEnabledMock,
  getSupabase: vi.fn().mockReturnValue(supabaseMock),
}));

// Imports must come after vi.mock
import { getUserSetting, setUserSetting } from '../userSettings';

// jsdom's localStorage is incomplete in this env (--localstorage-file warning).
// Use a fresh in-memory store each test via vi.stubGlobal so we control the full API.
const makeLocalStorageStub = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
};

const resetChain = () => {
  supabaseMock.from.mockReturnValue(supabaseMock);
  supabaseMock.select.mockReturnValue(supabaseMock);
  supabaseMock.eq.mockReturnValue(supabaseMock);
  supabaseMock.maybeSingle.mockResolvedValue({ data: null, error: null });
  supabaseMock.upsert.mockResolvedValue({ error: null });
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
  isCloudEnabledMock.mockReturnValue(false);
};

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageStub());
  vi.clearAllMocks();
  resetChain();
});

describe('getUserSetting', () => {
  it('returns fallback when both Supabase and localStorage have no data', async () => {
    const result = await getUserSetting('tsz_missing_key', 'default_val');
    expect(result).toBe('default_val');
  });

  it('returns typed fallback (array) when nothing is stored', async () => {
    const result = await getUserSetting<string[]>('tsz_empty_key', []);
    expect(result).toEqual([]);
  });

  it('returns localStorage value when Supabase is unavailable (not logged in)', async () => {
    localStorage.setItem('tsz_test_key', JSON.stringify({ amount: 42 }));
    const result = await getUserSetting('tsz_test_key', null);
    expect(result).toEqual({ amount: 42 });
  });

  it('returns localStorage value for a complex object (savings goals shape)', async () => {
    const goals = [{ id: '1', name: 'Emergency Fund', targetAmount: 10000 }];
    localStorage.setItem('tsz_savings_goals', JSON.stringify(goals));
    const result = await getUserSetting('tsz_savings_goals', []);
    expect(result).toEqual(goals);
  });
});

describe('setUserSetting', () => {
  it('writes to localStorage when Supabase is unavailable', async () => {
    await setUserSetting('tsz_test_key', [1, 2, 3]);
    expect(localStorage.getItem('tsz_test_key')).toBe(JSON.stringify([1, 2, 3]));
  });

  it('overwrites an existing localStorage entry', async () => {
    localStorage.setItem('tsz_test_key', JSON.stringify('old'));
    await setUserSetting('tsz_test_key', 'new');
    expect(localStorage.getItem('tsz_test_key')).toBe(JSON.stringify('new'));
  });

  it('does not attempt a Supabase upsert when isCloudEnabled is false', async () => {
    await setUserSetting('tsz_test_key', { x: 1 });
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it('written value is immediately readable back from localStorage', async () => {
    await setUserSetting('tsz_budgets', { food: 500 });
    const result = await getUserSetting('tsz_budgets', {});
    expect(result).toEqual({ food: 500 });
  });
});
