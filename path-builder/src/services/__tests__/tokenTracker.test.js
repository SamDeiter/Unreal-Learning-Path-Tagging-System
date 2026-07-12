import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordTokenUsage, fetchCloudStats } from '../tokenTracker';
import { doc, collection } from 'firebase/firestore';
import { getCurrentUser } from '../googleAuthService';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({ db: 'mock' }), doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue({}), collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }), query: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(),
}));
vi.mock('../firebaseConfig', () => ({ getFirebaseApp: vi.fn().mockReturnValue({}) }));
vi.mock('../googleAuthService', () => ({ getCurrentUser: vi.fn().mockReturnValue({ uid: 'u123' }) }));

describe('tokenTracker isolation', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('syncs to user-isolated path', async () => {
    recordTokenUsage('op', 100, 200);
    await new Promise(r => setTimeout(r, 10));
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'u123', 'token_usage', expect.any(String));
  });

  it('fetches from user-isolated path', async () => {
    await fetchCloudStats();
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'users', 'u123', 'token_usage');
  });

  it('skips sync when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockReturnValueOnce(null);
    recordTokenUsage('op', 100, 200);
    await new Promise(r => setTimeout(r, 10));
    expect(doc).not.toHaveBeenCalled();
  });
});
