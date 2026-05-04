#!/usr/bin/env node
/**
 * check-test-map.mjs — Verify test coverage map against Development Tasks
 *
 * 1. Reads design.md to extract Development Tasks
 * 2. Reads test-map.yaml to verify 100% task coverage
 * 3. Validates each mapped test file: exists, non-empty, contains @Test,
 *    and @Test count equals declared test_cases
 * 4. Validates optional type_tests entries for feature-level/type-specific
 *    tests and resources
 *
 * Exits 0 if all checks pass, 1 otherwise.
 *
 * Usage:
 *   node check-test-map.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  loadConfig, getIterationDir, parseYaml,
  getTestDirs, getTestResourceDirs
} from './lib/workflow-config.mjs';

// ─── Helpers ──────────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

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

function extractNamedSections(content, sectionNames) {
  const lines = content.split('\n');
  const wanted = sectionNames.map(name => new RegExp(`^#+\\s*.*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  const sections = [];
  let activeLevel = null;

  for (const line of lines) {
    const heading = line.trim().match(/^(#+)\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      if (activeLevel !== null && level <= activeLevel) {
        activeLevel = null;
      }
      if (wanted.some(re => re.test(line.trim()))) {
        activeLevel = level;
      }
    }

    if (activeLevel !== null) {
      sections.push(line);
    }
  }

  return sections.join('\n');
}

function extractRequiredTestingStandards(designPath) {
  const content = readFileSync(designPath, 'utf-8');
  const contractContent = extractNamedSections(content, ['Output Contract', 'Development Tasks']);
  const matches = contractContent.match(/standards\/testing\/[A-Za-z0-9_.-]+\.md/g) || [];
  return [...new Set(matches)];
}

// ─── Structure Validation ─────────────────────────────────────────────────

function validateMappedTaskEntries(mappedTasks, devTasks) {
  const taskSet = new Set(devTasks);
  const seen = new Set();
  const errors = [];

  for (const [idx, entry] of mappedTasks.entries()) {
    const label = entry.task || `<task #${idx + 1}>`;

    if (!entry.task) {
      errors.push(`${label}: missing task`);
    } else if (!taskSet.has(entry.task)) {
      errors.push(`${label}: unknown task`);
    } else if (seen.has(entry.task)) {
      errors.push(`${label}: duplicate task`);
    } else {
      seen.add(entry.task);
    }

    if (!entry.test_file) {
      errors.push(`${label}: missing test_file`);
    }
    if (!Number.isInteger(entry.test_cases) || entry.test_cases < 1) {
      errors.push(`${label}: test_cases must be a positive integer`);
    }
  }

  return errors;
}

export function validateStructure(mappedTasks, testDirs) {
  const allFiles = testDirs.flatMap(dir => walkDir(dir));
  const fileMap = new Map();
  for (const f of allFiles) {
    const name = f.split(/[/\\]/).pop();
    if (!fileMap.has(name)) {
      fileMap.set(name, [f]);
    } else {
      fileMap.get(name).push(f);
    }
  }

  const errors = [];
  const results = [];

  for (const entry of mappedTasks) {
    const fileName = entry.test_file;
    const fileLabel = fileName || '<missing test_file>';
    const declared = Number.isInteger(entry.test_cases) ? entry.test_cases : 0;

    const candidates = fileMap.get(fileName);
    if (!candidates || candidates.length === 0) {
      results.push({ file: fileLabel, ok: false, message: 'file not found' });
      errors.push(fileLabel);
      continue;
    }

    const filePath = candidates.length === 1
      ? candidates[0]
      : candidates.find(f => entry.module && f.includes(entry.module)) || candidates[0];

    const stat = statSync(filePath);
    if (stat.size === 0) {
      results.push({ file: fileLabel, ok: false, message: 'file is empty' });
      errors.push(fileLabel);
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const testCount = (content.match(/@Test\b/g) || []).length;

    if (testCount === 0) {
      results.push({ file: fileLabel, ok: false, message: 'no @Test annotations found' });
      errors.push(fileLabel);
      continue;
    }

    if (testCount !== declared) {
      results.push({ file: fileLabel, ok: false, message: `${testCount} @Test (declared ${declared})` });
      errors.push(fileLabel);
      continue;
    }

    results.push({ file: fileLabel, ok: true, message: `${testCount} @Test (declared ${declared})` });
  }

  return { results, errors };
}

function resolveExistingPath(projectRoot, testDirs, testResourceDirs, rawPath) {
  if (!rawPath) return null;

  const candidates = [
    ...testDirs.map(dir => join(dir, rawPath)),
    ...testResourceDirs.map(dir => join(dir, rawPath)),
    join(projectRoot, rawPath),
  ];

  const direct = candidates.find(p => existsSync(p));
  if (direct) return direct;

  const allTestFiles = testDirs.flatMap(dir => walkDir(dir));
  const allResourceFiles = testResourceDirs.flatMap(dir => walkDir(dir));
  const allFiles = [...allTestFiles, ...allResourceFiles];
  return allFiles.find(f => f.split(/[/\\]/).pop() === rawPath) || null;
}

function validateTypeTests(typeTests, devTasks, testDirs, testResourceDirs, projectRoot) {
  const standardsByType = new Map([
    ['integration', 'standards/testing/integration.md'],
    ['web-e2e', 'standards/testing/web-e2e.md'],
    ['sql-query', 'standards/testing/sql-query.md'],
    ['cli', 'standards/testing/cli.md'],
    ['batch-job', 'standards/testing/batch-job.md'],
    ['messaging', 'standards/testing/messaging.md'],
    ['library', 'standards/testing/library.md'],
  ]);
  const taskSet = new Set(devTasks);
  const errors = [];
  const results = [];

  for (const entry of typeTests) {
    const type = entry.type || '<missing type>';
    const label = `${type}:${entry.test_file || '<missing test_file>'}`;
    const entryErrors = [];

    if (!standardsByType.has(type)) {
      entryErrors.push(`unknown type "${type}"`);
    }
    if (!entry.standard || !entry.standard.startsWith('standards/testing/')) {
      entryErrors.push('standard must reference standards/testing/');
    } else if (standardsByType.has(type) && entry.standard !== standardsByType.get(type)) {
      entryErrors.push(`standard for ${type} must be ${standardsByType.get(type)}`);
    }
    if (!entry.test_file) {
      entryErrors.push('missing test_file');
    } else {
      const testPath = resolveExistingPath(projectRoot, testDirs, testResourceDirs, entry.test_file);
      if (!testPath) {
        entryErrors.push(`test file not found: ${entry.test_file}`);
      } else {
        const stat = statSync(testPath);
        if (stat.size === 0) {
          entryErrors.push(`test file is empty: ${entry.test_file}`);
        }
      }
    }

    const covers = Array.isArray(entry.covers) ? entry.covers : [];
    if (covers.length === 0) {
      entryErrors.push('covers must list at least one Development Task');
    } else {
      for (const task of covers) {
        if (!taskSet.has(task)) {
          entryErrors.push(`covers unknown task: ${task}`);
        }
      }
    }

    const resources = Array.isArray(entry.resources) ? entry.resources : [];
    for (const resource of resources) {
      if (!resolveExistingPath(projectRoot, testDirs, testResourceDirs, resource)) {
        entryErrors.push(`resource not found: ${resource}`);
      }
    }

    if (entryErrors.length > 0) {
      errors.push(...entryErrors.map(e => `${label}: ${e}`));
      results.push({ label, ok: false, message: entryErrors.join('; ') });
    } else {
      results.push({ label, ok: true, message: 'ok' });
    }
  }

  return { results, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const iterDir = getIterationDir(config);

  const designPath = join(iterDir, 'design.md');
  if (!existsSync(designPath)) {
    console.error(`❌ design.md not found at ${designPath}`);
    process.exit(1);
  }

  const testMapPath = join(iterDir, 'test-map.yaml');
  if (!existsSync(testMapPath)) {
    console.error(`❌ test-map.yaml not found at ${testMapPath}`);
    process.exit(1);
  }

  const devTasks = extractDevTasks(designPath);
  if (devTasks.length === 0) {
    console.error(`❌ No Development Tasks found in design.md`);
    process.exit(1);
  }
  const requiredTestingStandards = extractRequiredTestingStandards(designPath);

  const testMapText = readFileSync(testMapPath, 'utf-8');
  const testMap = parseYaml(testMapText);
  const mappedTasks = (testMap && testMap.tasks) || [];
  const typeTests = (testMap && testMap.type_tests) || [];

  // ── Coverage check ──
  const devTaskSet = new Set(devTasks);
  const mappedNames = new Set(mappedTasks.map(t => t.task).filter(t => devTaskSet.has(t)));
  const uncovered = devTasks.filter(t => !mappedNames.has(t));
  const coverage = ((devTasks.length - uncovered.length) / devTasks.length * 100).toFixed(0);

  console.log(`Development Tasks: ${devTasks.length}`);
  console.log(`Mapped in test-map: ${mappedNames.size}`);
  console.log(`Coverage: ${coverage}%`);
  if (requiredTestingStandards.length > 0) {
    console.log(`Required type standards: ${requiredTestingStandards.length}`);
  }

  let hasErrors = false;

  if (uncovered.length > 0) {
    console.log(`\n❌ Uncovered tasks:`);
    for (const t of uncovered) {
      console.log(`   - ${t}`);
    }
    hasErrors = true;
  }

  const taskEntryErrors = validateMappedTaskEntries(mappedTasks, devTasks);
  if (taskEntryErrors.length > 0) {
    console.log(`\n❌ Invalid task mapping entries:`);
    for (const err of taskEntryErrors) {
      console.log(`   - ${err}`);
    }
    hasErrors = true;
  }

  // ── Structure validation ──
  const testDirs = getTestDirs(config);
  const testResourceDirs = getTestResourceDirs(config);
  const { results, errors } = validateStructure(mappedTasks, testDirs);

  console.log(`\nStructure validation:`);
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`   ${mark} ${r.file.padEnd(40)} ${r.message}`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} structural error(s) found`);
    hasErrors = true;
  }

  if (requiredTestingStandards.length > 0) {
    const mappedStandards = new Set(typeTests.map(t => t.standard));
    const missingStandards = requiredTestingStandards.filter(s => !mappedStandards.has(s));
    if (missingStandards.length > 0) {
      console.log(`\n❌ Missing type_tests for standards:`);
      for (const s of missingStandards) {
        console.log(`   - ${s}`);
      }
      hasErrors = true;
    }
  }

  if (typeTests.length > 0) {
    const { results: typeResults, errors: typeErrors } = validateTypeTests(
      typeTests, devTasks, testDirs, testResourceDirs, config._projectRoot
    );

    console.log(`\nType-specific validation:`);
    for (const r of typeResults) {
      const mark = r.ok ? '✓' : '✗';
      console.log(`   ${mark} ${r.label.padEnd(40)} ${r.message}`);
    }

    if (typeErrors.length > 0) {
      console.log(`\n❌ ${typeErrors.length} type-specific error(s) found`);
      for (const err of typeErrors) {
        console.log(`   - ${err}`);
      }
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`\n✅ 100% coverage + all structural/type-specific checks passed`);
  process.exit(0);
}

if (process.argv[1] && (
  process.argv[1].endsWith('check-test-map.mjs')
)) {
  main();
}
