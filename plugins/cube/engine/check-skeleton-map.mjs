#!/usr/bin/env node
/**
 * check-skeleton-map.mjs — Verify skeleton coverage against Development Tasks
 *
 * 1. Reads design.md to extract Development Tasks
 * 2. Reads skeleton-map.yaml to verify 100% task coverage
 * 3. Validates each mapped skeleton file: exists and non-empty
 * 4. Runs compile command to verify skeleton compiles
 *
 * Exits 0 if all checks pass, 1 otherwise.
 *
 * Usage:
 *   node check-skeleton-map.mjs
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execFileSync, execSync } from 'child_process';
import {
  loadConfig, getIterationDir, parseYaml, getLanguageConfig, getSourceDirs, normalizeLanguage
} from './lib/workflow-config.mjs';

function extractDevTasks(designPath) {
  const content = readFileSync(designPath, 'utf-8');
  const lines = content.split('\n');

  let inSection = false;
  let taskIndent = null;
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^#+\s*.*Development\s+Tasks/i.test(trimmed)) {
      inSection = true;
      taskIndent = null;
      continue;
    }

    if (inSection && /^#+\s/.test(trimmed) && !/Development\s+Tasks/i.test(trimmed)) {
      break;
    }

    if (!inSection) continue;

    const indent = line.length - line.trimStart().length;
    const taskMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (taskMatch) {
      if (taskIndent === null) taskIndent = indent;
      if (indent === taskIndent) tasks.push(taskMatch[2].trim());
      continue;
    }
    const numberedMatch = line.match(/^(\s*)\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      if (taskIndent === null) taskIndent = indent;
      if (indent === taskIndent) tasks.push(numberedMatch[2].trim());
    }
  }

  return tasks;
}

function resolveSkeletonPath(sourceDirs, rawPath) {
  if (!rawPath) return null;
  for (const sourceDir of sourceDirs) {
    const candidate = join(sourceDir, rawPath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function canRunWithoutShell(cmd) {
  return !/[|&;<>`]/.test(cmd);
}

function tokenizeCommand(cmd) {
  const tokens = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match;
  while ((match = re.exec(cmd)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function runCompileCommand(cmd, options) {
  try {
    execSync(cmd, { ...options, shell: true });
    return null;
  } catch (err) {
    if (err && err.code === 'EPERM' && canRunWithoutShell(cmd)) {
      const [file, ...args] = tokenizeCommand(cmd);
      execFileSync(file, args, options);
      return null;
    }
    return err;
  }
}

export function resolveCompileCommand(config, projectRoot = config._projectRoot) {
  const langConfig = getLanguageConfig(config);
  const compileCmd = langConfig && langConfig.compile_command;
  const language = normalizeLanguage(config.project && config.project.language);

  if (!compileCmd || language !== 'typescript' || compileCmd !== 'npm run build') {
    return compileCmd;
  }

  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return compileCmd;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const buildScript = packageJson && packageJson.scripts && packageJson.scripts.build;
    if (typeof buildScript === 'string' && buildScript.trim()) {
      return compileCmd;
    }
  } catch {
    return compileCmd;
  }

  const tsconfigPath = join(projectRoot, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    return 'npx tsc --noEmit --project tsconfig.json';
  }

  return compileCmd;
}

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const iterDir = getIterationDir(config);
  const projectRoot = config._projectRoot;

  const designPath = join(iterDir, 'design.md');
  if (!existsSync(designPath)) {
    console.error(`❌ design.md not found at ${designPath}`);
    process.exit(1);
  }

  const skeletonMapPath = join(iterDir, 'skeleton-map.yaml');
  if (!existsSync(skeletonMapPath)) {
    console.error(`❌ skeleton-map.yaml not found at ${skeletonMapPath}`);
    process.exit(1);
  }

  const devTasks = extractDevTasks(designPath);
  if (devTasks.length === 0) {
    console.error(`❌ No Development Tasks found in design.md`);
    process.exit(1);
  }

  const skeletonMapText = readFileSync(skeletonMapPath, 'utf-8');
  const skeletonMap = parseYaml(skeletonMapText);
  const mappedFiles = (skeletonMap && skeletonMap.files) || [];

  // ── Coverage check: every Development Task must appear in at least one file's tasks list ──
  const devTaskSet = new Set(devTasks);
  const coveredTasks = new Set();
  const mappingErrors = [];
  for (const entry of mappedFiles) {
    const entryTasks = entry.tasks || [];
    if (!Array.isArray(entryTasks) || entryTasks.length === 0) {
      mappingErrors.push(`${entry.path || '<no path>'}: tasks must list at least one Development Task`);
      continue;
    }
    for (const t of entryTasks) {
      if (devTaskSet.has(t)) {
        coveredTasks.add(t);
      } else {
        mappingErrors.push(`${entry.path || '<no path>'}: unknown task: ${t}`);
      }
    }
  }

  const uncovered = devTasks.filter(t => !coveredTasks.has(t));
  const coverage = ((devTasks.length - uncovered.length) / devTasks.length * 100).toFixed(0);

  console.log(`Development Tasks: ${devTasks.length}`);
  console.log(`Covered by skeleton: ${coveredTasks.size}`);
  console.log(`Coverage: ${coverage}%`);

  let hasErrors = false;

  if (uncovered.length > 0) {
    console.log(`\n❌ Uncovered tasks:`);
    for (const t of uncovered) {
      console.log(`   - ${t}`);
    }
    hasErrors = true;
  }

  if (mappingErrors.length > 0) {
    console.log(`\n❌ Invalid skeleton mapping entries:`);
    for (const err of mappingErrors) {
      console.log(`   - ${err}`);
    }
    hasErrors = true;
  }

  // ── File existence check ──
  const sourceDirs = getSourceDirs(config);

  console.log(`\nSkeleton file validation:`);
  for (const entry of mappedFiles) {
    const filePath = resolveSkeletonPath(sourceDirs, entry.path);
    if (!filePath) {
      console.log(`   ✗ ${entry.path || '<no path>'}`.padEnd(50) + 'file not found');
      hasErrors = true;
      continue;
    }
    const stat = statSync(filePath);
    if (stat.size === 0) {
      console.log(`   ✗ ${entry.path}`.padEnd(50) + 'file is empty');
      hasErrors = true;
      continue;
    }
    console.log(`   ✓ ${entry.path}`.padEnd(50) + 'ok');
  }

  // ── Compile check ──
  const compileCmd = resolveCompileCommand(config, projectRoot);

  if (compileCmd) {
    console.log(`\nCompile check: ${compileCmd}`);
    const err = runCompileCommand(compileCmd, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    if (!err) {
      console.log(`   ✓ compilation passed`);
    } else {
      const stderr = (err.stderr || '').toString().trim().slice(0, 500);
      console.log(`   ✗ compilation failed: ${stderr}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`\n✅ 100% coverage + all skeleton files exist + compilation passed`);
  process.exit(0);
}

if (process.argv[1] && (
  process.argv[1].endsWith('check-skeleton-map.mjs')
)) {
  main();
}
