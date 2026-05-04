import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeliverablesDir,
  getLanguageConfig,
  getLanguagePreset,
  normalizeLanguage,
  resolveCommand,
} from './lib/workflow-config.mjs';

test('normalizeLanguage maps aliases to canonical preset names', () => {
  assert.equal(normalizeLanguage('java'), 'java');
  assert.equal(normalizeLanguage('py'), 'python');
  assert.equal(normalizeLanguage('python'), 'python');
  assert.equal(normalizeLanguage('ts'), 'typescript');
  assert.equal(normalizeLanguage('typescript'), 'typescript');
});

test('getDeliverablesDir resolves preset directory for aliases', () => {
  const pyDir = getDeliverablesDir({ project: { language: 'py' } });
  const tsDir = getDeliverablesDir({ project: { language: 'ts' } });

  assert.match(pyDir, /presets[/\\]python[/\\]deliverables$/);
  assert.match(tsDir, /presets[/\\]typescript[/\\]deliverables$/);
});

test('getLanguagePreset loads canonical preset for aliases', () => {
  const pyPreset = getLanguagePreset({ project: { language: 'py' } });
  const tsPreset = getLanguagePreset({ project: { language: 'ts' } });

  assert.equal(pyPreset.language, 'python');
  assert.equal(tsPreset.language, 'typescript');
});

test('getLanguageConfig falls back to preset defaults for aliases', () => {
  const pyConfig = getLanguageConfig({ project: { language: 'py' } });
  const tsConfig = getLanguageConfig({ project: { language: 'ts' } });

  assert.equal(pyConfig.compile_command, 'python -m compileall src');
  assert.equal(pyConfig.test_command, 'pytest');
  assert.equal(pyConfig.test_command_single, 'pytest {{file}}');
  assert.equal(tsConfig.compile_command, 'npm run build');
  assert.equal(tsConfig.test_command, 'npm test');
  assert.equal(tsConfig.test_command_single, 'npm test -- {{file}}');
});

test('getLanguageConfig lets workflow overrides win over preset defaults', () => {
  const config = getLanguageConfig({
    project: { language: 'py' },
    language_config: {
      test_command: 'pytest -q',
      test_command_single: 'pytest -q {{file}}',
    },
  });

  assert.equal(config.compile_command, 'python -m compileall src');
  assert.equal(config.test_command, 'pytest -q');
  assert.equal(config.test_command_single, 'pytest -q {{file}}');
});

test('resolveCommand resolves language_config variables from preset defaults', () => {
  const pyCommand = resolveCommand(
    { project: { language: 'py' } },
    '${language_config.test_command}'
  );
  const tsCommand = resolveCommand(
    { project: { language: 'ts' } },
    '${language_config.compile_command}'
  );

  assert.equal(pyCommand, 'pytest');
  assert.equal(tsCommand, 'npm run build');
});
