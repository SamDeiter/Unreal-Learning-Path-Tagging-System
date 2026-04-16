import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordTokenUsage, fetchCloudStats } from '../tokenTracker';
import { getFirestore, doc, setDoc, collection, getDocs, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '../firebaseConfig';

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(() => ({ type: 'orderBy' })),
  limit: vi.fn(() => ({ type: 'limit' })),
}));
vi.mock('firebase/auth');
vi.mock('../firebaseConfig');

describe('tokenTracker', () => {
  const mockApp = { name: 'test-app' };
  const mockDb = { type: 'firestore' };
  const mockAuth = { currentUser: { uid: 'test-user-123' } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirebaseApp).mockReturnValue(mockApp);
    vi.mocked(getFirestore).mockReturnValue(mockDb);
    vi.mocked(getAuth).mockReturnValue(mockAuth);

    // Mock localStorage
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value.toString(); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { for (const key in store) delete store[key]; }
    });
  });

  it('syncs data to user-isolated Firestore path', async () => {
    const mockDocRef = { id: 'test-doc' };
    vi.mocked(doc).mockReturnValue(mockDocRef);

    await recordTokenUsage('testOp', 100, 200);

    // Verify doc path construction
    expect(doc).toHaveBeenCalledWith(
      mockDb,
      'token_usage',
      'test-user-123',
      'usage',
      expect.any(String) // dateKey
    );
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object), { merge: true });
  });

  it('queries user-isolated Firestore collection in fetchCloudStats', async () => {
    const mockCollectionRef = { id: 'test-collection' };
    vi.mocked(collection).mockReturnValue(mockCollectionRef);
    vi.mocked(getDocs).mockReturnValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(
      mockDb,
      'token_usage',
      'test-user-123',
      'usage'
    );
    expect(query).toHaveBeenCalledWith(
      mockCollectionRef,
      { type: 'orderBy' },
      { type: 'limit' }
    );
  });

  it('returns early if no user is authenticated', async () => {
    vi.mocked(getAuth).mockReturnValue({ currentUser: null });

    await recordTokenUsage('testOp', 100, 200);

    expect(setDoc).not.toHaveBeenCalled();
  });
});
