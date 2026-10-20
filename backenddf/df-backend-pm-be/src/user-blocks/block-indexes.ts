import { Connection } from 'mongoose';
export async function blockIndexes(
  db: Connection,
  apply = false,
  report = console.log,
) {
  const rows = db.db.collection('UserBlocks');
  const duplicates = await rows
    .aggregate([
      {
        $group: {
          _id: { blockerId: '$blockerId', blockedId: '$blockedId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  report(JSON.stringify({ collection: 'UserBlocks', apply, duplicates }));
  if (!apply) return duplicates;
  if (duplicates.length)
    throw new Error(
      'UserBlocks has duplicate pairs; resolve before applying indexes',
    );
  await rows.createIndex(
    { blockerId: 1, blockedId: 1 },
    { unique: true, name: 'block_pair_unique' },
  );
  await rows.createIndex({ blockedId: 1 }, { name: 'blocked_user' });
  await rows.createIndex({ blockerId: 1, _id: -1 }, { name: 'block_page' });
  return duplicates;
}
