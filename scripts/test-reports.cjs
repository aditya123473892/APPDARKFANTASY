const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const end = [], calls = [];
  let generation = 1, online = true, transport = async () => ({ data: { data: { reportId: 'case', status: 'open', targetOwnerId: 'owner' } } });
  const runtime = { get generation() { return generation; } };
  const isAxiosError = (error) => Boolean(error && error.isAxiosError);
  const mock = {
    axios: { default: { isAxiosError }, isAxiosError },
    'expo-network': { getNetworkStateAsync: async () => ({ isConnected: online, isInternetReachable: online }) },
    '@/services/api/apiClient': { apiClient: { post: async (...args) => { calls.push(args); return transport(...args); } } },
    '@/services/api/backend': { unwrap: value => value.data, getData: async (...args) => { calls.push(args); return {}; } },
    '@/features/auth/sessionRuntime': { sessionIdentity: runtime, isSessionCurrent: scope => scope === generation, registerSessionTeardown: fn => end.push(fn) },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/safety/reports.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Map, Set, Error })(name => { assert.ok(mock[name], name); return mock[name]; }, module, module.exports);
  return { api: module.exports, calls, offline: () => online = false, transport: fn => transport = fn, logout: () => { generation++; end.forEach(fn => fn()); } };
}
const target = { targetType: 'chat_media', targetId: '123', messageId: 'message' }, draft = { category: 'harassment', details: 'Private note' };
test('offline reports fail without transport or a queue and keep only an in-memory draft until logout', async () => {
  const h = harness(); h.offline();
  await assert.rejects(h.api.submitReport(target, draft), /offline/);
  assert.equal(h.calls.length, 0); assert.equal(h.api.getReportDraft(target).details, draft.details);
  h.logout(); assert.equal(h.api.getReportDraft(target).details, '');
});
test('synchronous double-submit prevention sends exactly one report and clears its draft on success', async () => {
  const h = harness(); let resolve;
  h.transport(() => new Promise(done => resolve = done));
  const pending = h.api.submitReport(target, draft);
  await assert.rejects(h.api.submitReport(target, draft), /already being submitted/);
  await new Promise(done => setImmediate(done));
  assert.equal(h.calls.length, 1);
  assert.equal(JSON.stringify(h.calls[0]), JSON.stringify(['/reports', { ...target, ...draft }]));
  resolve({ data: { data: { reportId: 'case', targetOwnerId: 'owner', status: 'open' } } });
  const result = await pending; assert.equal(result.targetOwnerId, 'owner'); assert.equal(h.api.getReportDraft(target).details, '');
});
test('failed reports never retry automatically and session changes cannot resurrect sensitive drafts', async () => {
  const h = harness(); h.transport(async () => { throw Error('network lost'); });
  await assert.rejects(h.api.submitReport(target, draft), /Could not submit/);
  assert.equal(h.calls.length, 1); assert.equal(h.api.getReportDraft(target).details, draft.details);
  let finish; h.transport(() => new Promise(done => finish = done));
  const pending = h.api.submitReport(target, draft); await new Promise(done => setImmediate(done));
  h.logout(); finish({ data: { data: { reportId: 'case' } } });
  await assert.rejects(pending, /Session ended/); assert.equal(h.api.getReportDraft(target).details, '');
});
test('report categories and note length are validated before transport; My reports requests are reporter-scoped', async () => {
  const h = harness();
  await assert.rejects(h.api.submitReport(target, { category: 'unknown', details: '' }), /Choose a category/);
  await assert.rejects(h.api.submitReport(target, { category: 'other', details: 'x'.repeat(501) }), /500/);
  assert.equal(h.calls.length, 0);
  await h.api.myReports('cursor'); await h.api.reportNotices();
  assert.equal(h.calls[0][0], '/reports/me'); assert.equal(h.calls[0][1].before, 'cursor'); assert.equal(h.calls[1][0], '/reports/notices');
});
test('report failures show the server reason for 403 and friendly copy for 404, 429 and network errors', async () => {
  const h = harness();
  const fail = (status, message) => h.transport(async () => { throw Object.assign(Error('Request failed with status code ' + status), { isAxiosError: true, response: status ? { status, data: { message } } : undefined }); });
  fail(403, 'You cannot report your own content');
  await assert.rejects(h.api.submitReport(target, draft), /^Error: You cannot report your own content$/);
  fail(429, 'Too many reports; please try again later');
  await assert.rejects(h.api.submitReport(target, draft), /a lot of reports recently/);
  fail(404, 'Reported content is unavailable');
  await assert.rejects(h.api.submitReport(target, draft), /no longer available/);
  fail(undefined);
  await assert.rejects(h.api.submitReport(target, draft), /Connection problem/);
  assert.equal(h.api.getReportDraft(target).details, draft.details);
});
