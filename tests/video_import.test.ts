import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { incrementedTitle, isVideoFileName, listVideoFilesInFolder } from '../src/utils/videoImport';

test('incremented titles append a 1-based index and stay within 160 characters', () => {
  assert.equal(incrementedTitle('Space Adventure', 1), 'Space Adventure 1');
  assert.equal(incrementedTitle('Space Adventure', 12), 'Space Adventure 12');
  assert.ok(incrementedTitle('A'.repeat(160), 99).length <= 160);
  assert.match(incrementedTitle('A'.repeat(160), 99), / 99$/);
});

test('only common video extensions are treated as importable files', () => {
  assert.equal(isVideoFileName('clip.mp4'), true);
  assert.equal(isVideoFileName('clip.MOV'), true);
  assert.equal(isVideoFileName('clip.m4v'), true);
  assert.equal(isVideoFileName('notes.txt'), false);
  assert.equal(isVideoFileName('thumb.jpg'), false);
});

test('folder import lists video files in numeric name order and skips other files', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'kido-import-'));
  try {
    await writeFile(path.join(folder, 'notes.txt'), 'skip');
    await writeFile(path.join(folder, 'video_10.mp4'), 'x');
    await writeFile(path.join(folder, 'video_2.MP4'), 'x');
    await writeFile(path.join(folder, 'intro.mov'), 'x');
    const files = await listVideoFilesInFolder(folder);
    assert.deepEqual(files.map((file) => path.basename(file)), ['intro.mov', 'video_2.MP4', 'video_10.mp4']);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
