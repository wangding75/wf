import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './lib/workflow-config.mjs';
import { updateStateYaml } from './advance-stage.mjs';

function writeFile(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

test('updateStateYaml marks the next stage as IN_PROGRESS when advancing', () => {
  const tmpRoot = join(process.cwd(), '.tmp-engine-tests');
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(join(tmpRoot, 'cube-advance-'));

  writeFile(join(root, '.cube', 'config', 'workflow.yaml'), [
    'project:',
    '  name: advance-fixture',
    '  language: ts',
    'stages:',
    '  - id: 01-prd',
    '    name: PRD',
    '  - id: 02-design',
    '    name: Design',
    '  - id: 03-test-cases',
    '    name: Test Cases',
    '',
  ].join('\n'));

  writeFile(join(root, '.cube', 'iterations', 'main', 'state.yaml'), [
    'branch: main',
    'current_stage: 02-design',
    'created: 2026-05-05',
    '',
    'stages:',
    '  01-prd: PASS',
    '  02-design: IN_PROGRESS',
    '  03-test-cases: PENDING',
    '',
    'history: []',
    '',
  ].join('\n'));

  const config = loadConfig(root);
  updateStateYaml(config, '02-design', '03-test-cases');

  const stateText = readFileSync(join(root, '.cube', 'iterations', 'main', 'state.yaml'), 'utf-8');
  assert.match(stateText, /^current_stage: 03-test-cases$/m);
  assert.match(stateText, /^  02-design: PASS$/m);
  assert.match(stateText, /^  03-test-cases: IN_PROGRESS$/m);
});
