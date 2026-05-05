import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './lib/workflow-config.mjs';
import { resolveCompileCommand } from './check-skeleton-map.mjs';

function writeFile(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

function createConfigRoot({ packageJson, tsconfig = true }) {
  const tmpRoot = join(process.cwd(), '.tmp-engine-tests');
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(join(tmpRoot, 'cube-skeleton-ts-'));

  writeFile(join(root, '.cube', 'config', 'workflow.yaml'), [
    'project:',
    '  name: compile-command-fixture',
    '  language: ts',
    '  structure: single-module',
    '',
  ].join('\n'));

  if (packageJson) {
    writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  if (tsconfig) {
    writeFile(join(root, 'tsconfig.json'), [
      '{',
      '  "compilerOptions": {',
      '    "noEmit": true',
      '  }',
      '}',
      '',
    ].join('\n'));
  }

  return loadConfig(root);
}

test('resolveCompileCommand falls back to tsc when typescript project has no build script', () => {
  const config = createConfigRoot({
    packageJson: {
      name: 'compile-command-fixture',
      private: true,
    },
  });

  assert.equal(
    resolveCompileCommand(config),
    'npx tsc --noEmit --project tsconfig.json'
  );
});

test('resolveCompileCommand keeps npm run build when build script exists', () => {
  const config = createConfigRoot({
    packageJson: {
      name: 'compile-command-fixture',
      private: true,
      scripts: {
        build: 'tsc -p tsconfig.build.json',
      },
    },
  });

  assert.equal(resolveCompileCommand(config), 'npm run build');
});
