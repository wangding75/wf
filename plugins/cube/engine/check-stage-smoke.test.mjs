import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { checkStage } from './check-stage.mjs';
import { validateStructure } from './check-test-map.mjs';
import { getIterationDir, getLanguageConfig, getTestDirs, loadConfig, parseYaml } from './lib/workflow-config.mjs';

function writeFile(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

function createFixture(language, testFileName, testFileContent) {
  const tmpRoot = join(process.cwd(), '.tmp-engine-tests');
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(join(tmpRoot, `cube-stage-${language}-`));
  const iterDir = join(root, '.cube', 'iterations', 'main');

  writeFile(join(root, '.cube', 'config', 'workflow.yaml'), [
    'project:',
    `  name: smoke-${language}`,
    `  language: ${language}`,
    '  structure: single-module',
    'stages:',
    '  - id: 03-test-cases',
    '    name: Test Cases',
    '  - id: 04-development',
    '    name: Development',
    '',
  ].join('\n'));

  writeFile(join(iterDir, 'state.yaml'), [
    'current_stage: 03-test-cases',
    'history: []',
    '',
  ].join('\n'));

  writeFile(join(iterDir, 'design.md'), [
    '# Design',
    '',
    '## Development Tasks',
    '- Implement smoke behavior',
    '',
  ].join('\n'));

  writeFile(join(iterDir, 'test-map.yaml'), [
    'tasks:',
    '  - task: "Implement smoke behavior"',
    '    module: smoke',
    `    test_file: ${testFileName}`,
    '    test_cases: 1',
    '',
  ].join('\n'));

  writeFile(join(root, 'tests', testFileName), testFileContent);

  writeFile(join(iterDir, 'STATUS.yaml'), [
    'stage: 04-development',
    'tasks:',
    '  - task: "Implement smoke behavior"',
    `    test_file: ${testFileName}`,
    '    phase: done',
    '',
  ].join('\n'));

  return root;
}

function createSmokeCommandRunner(config) {
  return (cmd, options) => {
    const languageConfig = getLanguageConfig(config);
    const iterDir = getIterationDir(config);

    if (cmd === languageConfig.test_command) {
      return existsSync(join(options.cwd, '.tests-pass')) ? null : { status: 1, stderr: Buffer.from('') };
    }

    if (cmd.includes('check-test-map.mjs')) {
      const testMap = parseYaml(readFileSync(join(iterDir, 'test-map.yaml'), 'utf-8'));
      const mappedTasks = (testMap && testMap.tasks) || [];
      const { errors } = validateStructure(mappedTasks, getTestDirs(config), languageConfig);
      return errors.length === 0 ? null : { status: 1, stderr: Buffer.from(errors.join('\n')) };
    }

    if (cmd.includes('check-status.mjs')) {
      const status = parseYaml(readFileSync(join(iterDir, 'STATUS.yaml'), 'utf-8'));
      const tasks = (status && status.tasks) || [];
      const done = tasks.length > 0 && tasks.every(task => task.phase === 'done');
      return done ? null : { status: 1, stderr: Buffer.from('STATUS not complete') };
    }

    return { status: 1, stderr: Buffer.from(`unexpected command: ${cmd}`) };
  };
}

function assertStagePasses(stageId, config) {
  const report = checkStage(stageId, config, {
    commandRunner: createSmokeCommandRunner(config),
  });
  assert.equal(report.status, 'PASS', JSON.stringify(report, null, 2));
}

test('python alias fixture passes stage 03 then 04 with preset defaults', () => {
  const root = createFixture(
    'py',
    'test_smoke.py',
    [
      'def test_smoke_behavior():',
      '    assert False',
      '',
    ].join('\n')
  );

  const config = loadConfig(root);
  assertStagePasses('03-test-cases', config);

  writeFileSync(join(root, '.tests-pass'), '', 'utf-8');
  assertStagePasses('04-development', config);
});

test('typescript alias fixture passes stage 03 then 04 with preset defaults', () => {
  const root = createFixture(
    'ts',
    'smoke.test.ts',
    [
      "test('smoke behavior', () => {",
      '  expect(false).toBe(true);',
      '});',
      '',
    ].join('\n')
  );

  const config = loadConfig(root);
  assertStagePasses('03-test-cases', config);

  writeFileSync(join(root, '.tests-pass'), '', 'utf-8');
  assertStagePasses('04-development', config);
});
