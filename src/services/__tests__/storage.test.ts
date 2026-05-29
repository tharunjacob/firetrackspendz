import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Transaction } from '@/types';

// Hoisted refs let tests flip the cached _isLoggedIn flag inside storage.ts
// by triggering the captured onAuthStateChange callback.
const { authRef } = vi.hoisted(() => ({
  authRef: { handler: null as null | ((event: string, session: any) => void) },
}));

vi.mock('../localStorage', () => ({
  localSave: vi.fn().mockResolvedValue(undefined),
  localLoad: vi.fn().mockResolvedValue([]),
  localDelete: vi.fn().mockResolvedValue(undefined),
  localReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../cloudStorage', () => ({
  cloudSave: vi.fn().mockResolvedValue(undefined),
  cloudLoad: vi.fn().mockResolvedValue([]),
  cloudDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../supabase', () => ({
  isCloudEnabled: vi.fn().mockReturnValue(true),
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn((cb: any) => {
        authRef.handler = cb;
      }),
    },
  }),
}));

vi.mock('../logger', () => ({ logEvent: vi.fn() }));

// Imports MUST come after vi.mock calls
import { saveToStorage, loadFromStorage, syncLocalToCloud } from '../storage';
import * as local from '../localStorage';
import * as cloud from '../cloudStorage';

const mockTx = (id: string): Transaction => ({
  id,
  date: '2025-01-01',
  amount: 100,
  owner: 'Me',
  category: 'Food',
  subCategory: '',
  notes: '',
  type: 'Expense',
  time: null,
  project: null,
});

const setLoggedIn = (loggedIn: boolean) => {
  // Trigger the captured auth change to flip the module-level _isLoggedIn cache
  authRef.handler?.(loggedIn ? 'SIGNED_IN' : 'SIGNED_OUT', loggedIn ? { user: { id: 'u1' } } : null);
};

const resetMocks = () => {
  // mockReset clears both call history AND any pending mockResolvedValueOnce queue,
  // so we re-apply the safe defaults each time.
  (local.localSave as any).mockReset().mockResolvedValue(undefined);
  (local.localLoad as any).mockReset().mockResolvedValue([]);
  (local.localDelete as any).mockReset().mockResolvedValue(undefined);
  (local.localReset as any).mockReset().mockResolvedValue(undefined);
  (cloud.cloudSave as any).mockReset().mockResolvedValue(undefined);
  (cloud.cloudLoad as any).mockReset().mockResolvedValue([]);
  (cloud.cloudDelete as any).mockReset().mockResolvedValue(undefined);
};

describe('Storage Gateway', () => {
  beforeEach(() => {
    resetMocks();
    setLoggedIn(false);
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  it('routes to local storage when not logged in', async () => {
    const tx = mockTx('1');
    await saveToStorage([tx]);
    expect(local.localSave).toHaveBeenCalledWith([tx]);
    expect(cloud.cloudSave).not.toHaveBeenCalled();

    await loadFromStorage();
    expect(local.localLoad).toHaveBeenCalled();
    expect(cloud.cloudLoad).not.toHaveBeenCalled();
  });

  it('routes to cloud storage when logged in', async () => {
    setLoggedIn(true);
    const tx = mockTx('1');
    await saveToStorage([tx]);
    expect(cloud.cloudSave).toHaveBeenCalledWith([tx]);
    expect(local.localSave).not.toHaveBeenCalled();

    await loadFromStorage();
    expect(cloud.cloudLoad).toHaveBeenCalled();
    expect(local.localLoad).not.toHaveBeenCalled();
  });

  it('routes to cloud storage with mimic id in mimic mode', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?mimic_user_id=123' },
      writable: true,
    });

    await loadFromStorage();
    expect(cloud.cloudLoad).toHaveBeenCalledWith('123');
    expect(local.localLoad).not.toHaveBeenCalled();
  });

  it('saveToStorage is a no-op in mimic mode (admin viewing another user)', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?mimic_user_id=123' },
      writable: true,
    });
    setLoggedIn(true);

    await saveToStorage([mockTx('1')]);
    expect(cloud.cloudSave).not.toHaveBeenCalled();
    expect(local.localSave).not.toHaveBeenCalled();
  });

  it('save errors propagate so callers can show a toast', async () => {
    setLoggedIn(true);
    (cloud.cloudSave as any).mockRejectedValueOnce(new Error('Network down'));
    await expect(saveToStorage([mockTx('1')])).rejects.toThrow('Network down');
  });
});

describe('syncLocalToCloud', () => {
  beforeEach(() => {
    resetMocks();
    setLoggedIn(false);
    Object.defineProperty(window, 'location', { value: { search: '' }, writable: true });
  });

  it('is a no-op when user is not logged in', async () => {
    (local.localLoad as any).mockResolvedValueOnce([mockTx('1')]);
    await syncLocalToCloud();
    expect(cloud.cloudSave).not.toHaveBeenCalled();
    expect(local.localReset).not.toHaveBeenCalled();
  });

  it('promotes ALL local rows (no 500-cap) and then wipes local', async () => {
    setLoggedIn(true);
    // 750 rows — well past the 500 visibility limit. All must be promoted.
    const many = Array.from({ length: 750 }, (_, i) => mockTx(`tx-${i}`));
    (local.localLoad as any).mockResolvedValueOnce(many);

    await syncLocalToCloud();

    expect(cloud.cloudSave).toHaveBeenCalledTimes(1);
    const pushed = (cloud.cloudSave as any).mock.calls[0][0];
    expect(pushed).toHaveLength(750);
    expect(local.localReset).toHaveBeenCalledTimes(1);
  });

  it('does not call cloudSave or localReset when local is empty', async () => {
    setLoggedIn(true);
    (local.localLoad as any).mockResolvedValueOnce([]);
    await syncLocalToCloud();
    expect(cloud.cloudSave).not.toHaveBeenCalled();
    expect(local.localReset).not.toHaveBeenCalled();
  });
});
