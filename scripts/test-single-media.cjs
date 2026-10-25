const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function pickerHarness() {
  let result = { canceled: true, assets: [] };
  let options;
  let thumbnails = 0;
  const pick = async (value) => { options = value; return result; };
  const mocks = {
    'expo-image-picker': { launchImageLibraryAsync: pick, launchCameraAsync: pick, requestCameraPermissionsAsync: async () => ({ granted: true }) },
    'expo-file-system/legacy': { getInfoAsync: async () => ({ exists: true, size: 1024 }) },
    'react-native': { Platform: { OS: 'android' } },
    './videoThumbnail': { createVideoThumbnail: async () => { thumbnails++; return 'thumb.jpg'; } },
  };
  const code = ts.transpileModule(fs.readFileSync('src/features/create-post/singleMedia.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(name => mocks[name], module, module.exports);
  return { ...module.exports, result: (value) => { result = value; }, options: () => options, thumbnails: () => thumbnails };
}
const clip = { uri: 'clip.mp4', type: 'video', width: 1920, height: 1080, duration: 60000, fileSize: 50 * 1024 * 1024 };

test('picker allows exactly one item, cancellation keeps the draft, camera uses the same limits', async () => {
  const picker = pickerHarness();
  assert.equal(await picker.pickSingleMedia(), null);
  assert.equal(picker.options().allowsMultipleSelection, false);
  assert.equal(picker.options().videoMaxDuration, 60);
  picker.result({ canceled: false, assets: [clip, { ...clip, uri: 'must-not-be-selected' }] });
  const selected = await picker.pickSingleMedia(true);
  assert.equal(selected.asset.uri, 'clip.mp4');
  assert.equal(selected.thumbnail, 'thumb.jpg');
  assert.equal(picker.thumbnails(), 1);
});

test('60s / 50MB boundary is accepted; oversized, overlong and unknown-duration videos fail before thumbnail generation', async () => {
  const picker = pickerHarness();
  assert.equal((await picker.prepareSingleMedia(clip)).duration, 60);
  for (const invalid of [{ ...clip, duration: 60001 }, { ...clip, fileSize: clip.fileSize + 1 }, { ...clip, duration: undefined }]) {
    await assert.rejects(picker.prepareSingleMedia(invalid), /60 seconds|50 MB/);
  }
  assert.equal(picker.thumbnails(), 1);
});

test('images never generate video thumbnails, and missing file sizes are checked on disk', async () => {
  const picker = pickerHarness();
  const selected = await picker.prepareSingleMedia({ ...clip, type: 'image', uri: 'photo.jpg', duration: undefined });
  assert.equal(selected.asset.type, 'image/jpeg');
  assert.equal(picker.thumbnails(), 0);
  await picker.prepareSingleMedia({ ...clip, fileSize: undefined });
  assert.equal(picker.thumbnails(), 1);
});

test('post picker keeps photo selection order, enforces five photos and rejects mixed video selections', async () => {
  const picker = pickerHarness();
  assert.equal(await picker.pickPostMedia(), null);
  assert.equal(picker.options().allowsMultipleSelection, true);
  assert.equal(picker.options().orderedSelection, true);
  assert.equal(picker.options().selectionLimit, 5);
  const photos = Array.from({ length: 5 }, (_, index) => ({ uri: `photo-${index}.jpg`, type: 'image', width: 1080, height: 1350 }));
  picker.result({ canceled: false, assets: photos });
  const selected = await picker.pickPostMedia();
  assert.deepEqual(Array.from(selected, item => item.asset.uri), photos.map(item => item.uri));
  assert.equal(picker.thumbnails(), 0);
  picker.result({ canceled: false, assets: [...photos, photos[0]] });
  await assert.rejects(picker.pickPostMedia(), /up to 5/);
  picker.result({ canceled: false, assets: [photos[0], clip] });
  await assert.rejects(picker.pickPostMedia(), /one video/);
  picker.result({ canceled: false, assets: [clip] });
  assert.equal((await picker.pickPostMedia())[0].thumbnail, 'thumb.jpg');
});
