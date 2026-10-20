import { blockIndexes } from './block-indexes';
describe('Opt-in UserBlocks indexes', () => {
  const fixture = (duplicates: any[] = []) => {
    const rows = {
      aggregate: jest.fn(() => ({ toArray: async () => duplicates })),
      createIndex: jest.fn(),
    };
    return { rows, db: { db: { collection: () => rows } } as any };
  };
  it('reports duplicates without writes by default', async () => {
    const { rows, db } = fixture([{ count: 2 }]);
    const report = jest.fn();
    expect(await blockIndexes(db, false, report)).toEqual([{ count: 2 }]);
    expect(report).toHaveBeenCalled();
    expect(rows.createIndex).not.toHaveBeenCalled();
  });
  it('refuses unsafe unique-index application and creates required indexes only on explicit apply', async () => {
    const bad = fixture([{ count: 2 }]);
    await expect(blockIndexes(bad.db, true, () => {})).rejects.toThrow(
      'duplicate',
    );
    expect(bad.rows.createIndex).not.toHaveBeenCalled();
    const good = fixture();
    await blockIndexes(good.db, true, () => {});
    expect(good.rows.createIndex).toHaveBeenCalledWith(
      { blockerId: 1, blockedId: 1 },
      expect.objectContaining({ unique: true }),
    );
    expect(good.rows.createIndex).toHaveBeenCalledWith(
      { blockedId: 1 },
      expect.any(Object),
    );
  });
});
