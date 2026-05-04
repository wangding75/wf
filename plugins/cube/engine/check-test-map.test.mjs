import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateStructure } from './check-test-map.mjs';

function createJavaTestDir(actualTestCases) {
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

function createPythonTestDir(actualTestCases) {
  const root = mkdtempSync(join(tmpdir(), 'cube-check-test-map-'));
  const testDir = join(root, 'tests');
  mkdirSync(testDir, { recursive: true });

  const methods = Array.from({ length: actualTestCases }, (_, i) => [
    `def test_example_${i + 1}():`,
    '    assert False',
    '',
  ].join('\n'));

  writeFileSync(join(testDir, 'test_example.py'), methods.join('\n'), 'utf-8');
  return testDir;
}

function createTypeScriptTestDir(actualTestCases) {
  const root = mkdtempSync(join(tmpdir(), 'cube-check-test-map-'));
  const testDir = join(root, 'tests');
  mkdirSync(testDir, { recursive: true });

  const methods = Array.from({ length: actualTestCases }, (_, i) => (
    `test('example ${i + 1}', () => {\n  expect(true).toBe(false);\n});`
  ));

  writeFileSync(join(testDir, 'example.test.ts'), methods.join('\n\n'), 'utf-8');
  return testDir;
}

test('validateStructure fails when declared test_cases does not equal @Test count', () => {
  const testDir = createJavaTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'ExampleTest.java', test_cases: 1 },
  ], [testDir], { test_case_regex: '@Test\\b' });

  assert.equal(errors.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].message, /2 test case\(s\) \(declared 1\)/);
});

test('validateStructure passes when declared test_cases equals @Test count', () => {
  const testDir = createJavaTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'ExampleTest.java', test_cases: 2 },
  ], [testDir], { test_case_regex: '@Test\\b' });

  assert.deepEqual(errors, []);
  assert.equal(results[0].ok, true);
});

test('validateStructure counts pytest test functions for python projects', () => {
  const testDir = createPythonTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'test_example.py', test_cases: 2 },
  ], [testDir], { test_case_regex: '^\\s*def\\s+test_\\w+\\s*\\(' });

  assert.deepEqual(errors, []);
  assert.equal(results[0].ok, true);
  assert.match(results[0].message, /2 test case\(s\) \(declared 2\)/);
});

test('validateStructure counts test() blocks for typescript projects', () => {
  const testDir = createTypeScriptTestDir(2);

  const { results, errors } = validateStructure([
    { task: 'Implement example behavior', test_file: 'example.test.ts', test_cases: 2 },
  ], [testDir], { test_case_regex: '\\b(?:it|test)\\s*\\(' });

  assert.deepEqual(errors, []);
  assert.equal(results[0].ok, true);
  assert.match(results[0].message, /2 test case\(s\) \(declared 2\)/);
});
