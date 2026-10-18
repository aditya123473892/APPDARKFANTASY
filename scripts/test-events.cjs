const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      Date,
      require: (name) => {
        if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
        return mocks[name];
      },
    },
    { filename: file },
  );
  return module.exports;
}

function harness() {
  const calls = [];
  const identity = { generation: 1 };
  let upload;
  const request = (method) => async (url, body) => {
    calls.push({ method, url, body });
    return { data: { data: { _id: 'event-id', deleted: true } } };
  };
  const apiClient = { post: request('POST'), put: request('PUT'), delete: request('DELETE') };
  const service = load('src/features/events/service.ts', {
    '@/services/api/apiClient': { apiClient },
    '@/services/api/backend': {
      getCollection: async (url, key) => {
        calls.push({ url, key });
        return [];
      },
      getData: async (url) => {
        calls.push({ url });
        return { participants: [{ _id: 'accepted' }], pendingRequests: [{ _id: 'pending' }] };
      },
      unwrap: (body) => {
        if (body.error || body.statusCode >= 400) throw new Error('Rejected');
        return body.data;
      },
      serviceError: (error) => error,
    },
    '@/services/api/photoUpload': {
      uploadPhoto: async (asset) => {
        upload = asset;
        return 'upload-id';
      },
    },
    '@/features/auth/sessionRuntime': {
      sessionIdentity: identity,
      assertSessionCurrent: (scope) => {
        if (scope !== identity.generation) throw new Error('Session ended');
      },
    },
  }).eventsService;
  return { service, calls, identity, apiClient, uploaded: () => upload };
}

test('event local dates round-trip and reject rollover, invalid hours and ambiguous formats', () => {
  const { parseEventDate, localEventDate } = load('src/features/events/types.ts');
  assert.equal(localEventDate(parseEventDate('2028-02-29 18:30')), '2028-02-29 18:30');
  for (const invalid of [
    '2027-02-29 18:30',
    '2026-04-31 18:30',
    '2026-12-01 24:00',
    '2026-12-01 12:60',
    '12/01/2026',
    '',
  ]) {
    assert.equal(parseEventDate(invalid), undefined, invalid);
  }
});

test('applications close for deadlines, ended, canceled and completed events', () => {
  const { applicationsClosed } = load('src/features/events/types.ts');
  const now = Date.parse('2026-11-01T12:00:00Z');
  const event = { status: 'upcoming', endAt: '2026-12-01T12:00:00Z' };
  assert.equal(applicationsClosed(event, now), false);
  assert.equal(
    applicationsClosed({ ...event, registrationDeadline: '2026-11-01T12:00:00Z' }, now),
    true,
  );
  assert.equal(applicationsClosed({ ...event, status: 'canceled' }, now), true);
  assert.equal(applicationsClosed({ ...event, status: 'completed' }, now), true);
  assert.equal(applicationsClosed({ ...event, endAt: '2026-10-01T12:00:00Z' }, now), true);
});

test('listing uses pagination helper and requests and accepted participants use distinct envelopes', async () => {
  const h = harness();
  await h.service.list();
  assert.equal(h.calls[0].key, 'events');
  assert.equal((await h.service.participants('event-id'))[0]._id, 'accepted');
  assert.equal((await h.service.requests('event-id'))[0]._id, 'pending');
});

test('join and decisions send the existing backend fields without inventing status on join', async () => {
  const h = harness();
  await h.service.join('event-id', 'user-id');
  await h.service.decide('member-id', 'accepted');
  await h.service.decide('member-id', 'rejected');
  assert.equal(h.calls[0].url, '/event-members/join');
  assert.equal(
    JSON.stringify(h.calls[0].body),
    JSON.stringify({ event: 'event-id', user: 'user-id' }),
  );
  assert.equal(h.calls[1].url, '/event-members/member-id/status');
  assert.equal(h.calls[1].body.requestStatus, 'accepted');
  assert.equal(h.calls[2].body.requestStatus, 'rejected');
});

test('cover creation binds an approved upload ID; editing without a cover preserves it', async () => {
  const h = harness();
  const input = { name: 'Gathering', type: 'offline' };
  const photo = { uri: 'file://photo.jpg' };
  await h.service.save(input, undefined, photo);
  assert.equal(h.uploaded(), photo);
  assert.equal(h.calls[0].method, 'POST');
  assert.equal(h.calls[0].body.coverUploadId, 'upload-id');
  assert.equal(h.calls[0].body.creator, undefined);
  await h.service.save(input, 'event-id');
  assert.equal(h.calls[1].method, 'PUT');
  assert.equal(h.calls[1].body.coverUploadId, undefined);
  assert.equal(h.calls[1].body.status, undefined);
});

test('session ending during cover upload prevents submitting as a different account', async () => {
  const h = harness();
  const pending = h.service.save({ name: 'Gathering' }, undefined, { uri: 'file://photo.jpg' });
  h.identity.generation++;
  await assert.rejects(pending, /Session ended/);
  assert.equal(h.calls.length, 0);
});

test('member removal handles plain responses and rejects errors; event deletion uses envelope', async () => {
  const h = harness();
  h.apiClient.delete = async () => ({ data: { message: 'Removed' } });
  await h.service.removeMember('member-id');
  h.apiClient.delete = async () => ({ data: { error: true, statusCode: 403 } });
  await assert.rejects(h.service.removeMember('member-id'), /Rejected/);
  await assert.rejects(h.service.delete('event-id'), /Rejected/);
});
