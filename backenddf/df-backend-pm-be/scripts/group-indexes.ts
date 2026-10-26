import { createConnection } from 'mongoose';
import { GROUP_CLIENT_ID_INDEX } from '../src/common/schemas/group-chat.schema';

// Operator entry point: run --report, then --apply. Additive only: existing
// groups have no clientId and are outside the partial unique index.
async function main() {
  const option = process.argv[2] || '--report';
  if (!['--report', '--apply'].includes(option)) throw new Error('Use --report or --apply');
  if (!process.env.DATABASE_URL || !process.env.DATABASE_NAME)
    throw new Error(
      'Set DATABASE_URL and DATABASE_NAME using your operator credential environment',
    );
  const db = await createConnection(process.env.DATABASE_URL, {
    dbName: process.env.DATABASE_NAME,
    autoIndex: false,
  }).asPromise();
  try {
    const groups = db.db.collection('Groups');
    const duplicates = await groups
      .aggregate([
        { $match: { clientId: { $type: 'string' } } },
        { $group: { _id: { admin: '$admin', clientId: '$clientId' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    console.log(
      JSON.stringify({
        collection: 'Groups',
        apply: option === '--apply',
        duplicateClientIds: duplicates.length,
      }),
    );
    if (option !== '--apply') return;
    if (duplicates.length)
      throw new Error('Groups has duplicate (admin, clientId) pairs; resolve before applying');
    await groups.createIndex(
      { admin: 1, clientId: 1 },
      {
        unique: true,
        name: GROUP_CLIENT_ID_INDEX,
        partialFilterExpression: { clientId: { $type: 'string' } },
      },
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
