import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateStructure } from './check-test-map.mjs';

function createTestDir(actualTestCases) {
  const root = mkdtempSync(join(tmpdir(), 'cube-check-test-map-'));
  const testDir = join(root, 'src', 'test', 'java');
  mkdirSync(testDir, { recursive: true });

  const methods = Array.from({ length: actualTestCases }, (_, i) => [
    '  @Test',
    `  void test${i + 1}() {}`,
  ].join('\n'));

  writeFileSync(join(testDir, 'ExampleTest.java'), [
    'package com.example;',
    '',
    'import org.junit.jupiter.api.Test;',
    '',
    'class ExampleTest {',
    ...methods,
    '}',
    '',
  ].join('\n'), 'utf-8');

  return testDir;
}

test('validateStructure fails when declared test_cases does not equal @Test count', () => {
  const testDir = createTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'ExampleTest.java', test_cases: 1 },
  ], [testDir]);

  assert.equal(errors.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].message, /2 @Test \(declared 1\)/);
});

test('validateStructure passes when declared test_cases equals @Test count', () => {
  const testDir = createTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'ExampleTest.java', test_cases: 2 },
  ], [testDir]);

  assert.deepEqual(errors, []);
  assert.equal(results[0].ok, true);
});
