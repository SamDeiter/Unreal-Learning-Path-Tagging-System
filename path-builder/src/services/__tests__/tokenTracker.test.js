import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncDayToFirestore, fetchCloudStats, recordTokenUsage } from '../tokenTracker';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, query, collectionGroup, where } from 'firebase/firestore';
import { getFirebaseApp } from '../firebaseConfig';

vi.mock('firebase/auth');
vi.mock('firebase/firestore');
vi.mock('../firebaseConfig');

describe('tokenTracker isolation', () => {
  const mockUser = { uid: 'user123', getIdTokenResult: vi.fn() };
  const mockApp = { name: 'mock-app' };
  const mockDb = { type: 'firestore' };

  beforeEach(() => {
    vi.clearAllMocks();
    getFirebaseApp.mockReturnValue(mockApp);
    getFirestore.mockReturnValue(mockDb);
    getAuth.mockReturnValue({ currentUser: mockUser });
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { admin: false } });
    doc.mockReturnValue('mockDocRef');
  });

  it('syncDayToFirestore uses isolated path with userId', async () => {
    const dayData = { totalInput: 100, totalOutput: 50, calls: 2, operations: {} };
    // syncDayToFirestore is not exported, but it's called by recordTokenUsage
    // Wait, recordTokenUsage is exported.

    // We need to access syncDayToFirestore. Since it's internal, we test recordTokenUsage
    // which calls it.
    recordTokenUsage('testOp', 10, 5);

    // syncDayToFirestore is async but called without await in recordTokenUsage
    // We might need to wait a bit or mock it differently.
    // Actually, let's just test the logic inside if we can.
    // Since I can't export it easily without changing source, I'll check if recordTokenUsage
    // triggers the Firestore calls.

    // Wait, syncDayToFirestore is called at the end of recordTokenUsage:
    // syncDayToFirestore(today, day).catch(() => {});

    // Let's use a small delay to allow the fire-and-forget promise to run
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getAuth).toHaveBeenCalledWith(mockApp);
    expect(doc).toHaveBeenCalledWith(mockDb, "token_usage", "user123", "usage", expect.any(String));
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user123',
      totalInput: expect.any(Number),
    }), { merge: true });
  });

  it('fetchCloudStats uses isolated path for regular users', async () => {
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { admin: false } });
    getDocs.mockResolvedValue({ docs: [] });

    await fetchCloudStats(7);

    expect(collection).toHaveBeenCalledWith(mockDb, "token_usage", "user123", "usage");
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it('fetchCloudStats uses collectionGroup with date filter and aggregates for admins', async () => {
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { admin: true } });
    const mockDocs = [
      { id: '1', data: () => ({ date: '2026-01-01', totalInput: 100, estimatedCost: 0.1, calls: 1 }) },
      { id: '2', data: () => ({ date: '2026-01-01', totalInput: 200, estimatedCost: 0.2, calls: 1 }) },
      { id: '3', data: () => ({ date: '2026-01-02', totalInput: 50, estimatedCost: 0.05, calls: 1 }) },
    ];
    getDocs.mockResolvedValue({ docs: mockDocs });

    const stats = await fetchCloudStats(7);

    expect(collectionGroup).toHaveBeenCalledWith(mockDb, "usage");
    expect(where).toHaveBeenCalledWith("date", ">=", expect.any(String));
    expect(stats).toHaveLength(2);
    // Aggregated 2026-01-01
    const day1 = stats.find(s => s.date === '2026-01-01');
    expect(day1.totalInput).toBe(300);
    expect(day1.estimatedCost).toBeCloseTo(0.3);
    expect(day1.calls).toBe(2);
  });
});
