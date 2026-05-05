import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from './check-stage.mjs';

test('runCommand falls back from shell node invocation to direct process exec on EPERM', () => {
  const calls = [];
  const result = runCommand(
    'node ./engine/check-skeleton-map.mjs',
    { cwd: process.cwd() },
    {
      shellRunner(command) {
        calls.push(['shell', command]);
        const err = new Error('spawnSync node EPERM');
        err.code = 'EPERM';
        throw err;
      },
      fileRunner(file, args) {
        calls.push(['file', file, args]);
        return null;
      },
    }
  );

  assert.equal(result, null);
  assert.deepEqual(calls, [
    ['shell', 'node ./engine/check-skeleton-map.mjs'],
    ['file', process.execPath, ['./engine/check-skeleton-map.mjs']],
  ]);
});
