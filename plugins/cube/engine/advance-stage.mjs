#!/usr/bin/env node
/**
 * advance-stage.mjs — Advance from current stage to next stage
 *
 * Checks current stage is PASS, then updates state.yaml in the
 * current branch's iteration directory.
 *
 * Usage:
 *   node advance-stage.mjs [--dry-run]
 *   cube-advance [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import {
  loadConfig, getIterationDir, loadState,
  getCurrentBranch, parseYaml, findGitRoot,
  getTestDirs, getTestResourceDirs
} from './lib/workflow-config.mjs';
import { checkStage, printReport } from './check-stage.mjs';

// ─── Stage Navigation ───────────────────────────────────────────────────────

function getStageOrder(config) {
  return (config.stages || []).map(s => s.id);
}

function getStageConfig(config, stageId) {
  return (config.stages || []).find(s => s.id === stageId) || null;
}

export function findCurrentStage(config) {
  const state = loadState(config);
  if (state && state.current_stage) return state.current_stage;
  const order = getStageOrder(config);
  return order.length > 0 ? order[0] : null;
}

export function nextStage(config, stageId) {
  const order = getStageOrder(config);
  const idx = order.indexOf(stageId);
  if (idx === -1 || idx + 1 >= order.length) return null;
  return order[idx + 1];
}

// ─── State Update ──────────────────────────────────────────────────────────

export function updateStateYaml(config, currentStage, newStage) {
  const iterDir = getIterationDir(config);
  const statePath = join(iterDir, 'state.yaml');

  if (!existsSync(statePath)) {
    console.log(`WARN: state.yaml not found at ${statePath}`);
    return;
  }

  const content = readFileSync(statePath, 'utf-8');
  const lines = content.split('\n');
  const out = [];

  for (const line of lines) {
    // Update current_stage
    if (line.trimStart().startsWith('current_stage:')) {
      out.push(`current_stage: ${newStage}`);
      continue;
    }
    // Update stage status: mark current as PASS
    if (line.includes(`${currentStage}:`) && (line.includes('PENDING') || line.includes('IN_PROGRESS'))) {
      out.push(line.replace(/PENDING|IN_PROGRESS/, 'PASS'));
      continue;
    }
    out.push(line);
  }

  // Append history entry
  const historyIdx = out.findIndex(l => l.trim() === 'history: []');
  if (historyIdx !== -1) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    out[historyIdx] = 'history:';
    out.splice(historyIdx + 1, 0,
      `  - time: "${ts}"`,
      `    action: advance`,
      `    detail: "${currentStage} → ${newStage}"`,
    );
  } else {
    // Append to existing history
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    out.push(`  - time: "${ts}"`);
    out.push(`    action: advance`);
    out.push(`    detail: "${currentStage} → ${newStage}"`);
  }

  const tmpPath = join(iterDir, `.state_${Date.now()}.tmp`);
  try {
    writeFileSync(tmpPath, out.join('\n'), 'utf-8');
    renameSync(tmpPath, statePath);
  } catch (e) {
    try { unlinkSync(tmpPath); } catch {}
    throw e;
  }
  console.log(`✅ Updated state.yaml`);
}

// ─── STATUS.yaml Creation ───────────────────────────────────────────────────

export function maybeCreateStatusYaml(config, newStage) {
  const stageCfg = getStageConfig(config, newStage);
  const onEnter = (stageCfg && stageCfg.on_enter) || [];
  if (!onEnter.includes('create_status_yaml')) return;

  const iterDir = getIterationDir(config);
  const statusFile = join(iterDir, 'STATUS.yaml');
  if (existsSync(statusFile)) {
    console.log(`STATUS.yaml already exists, skipping creation`);
    return;
  }

  const testMapPath = join(iterDir, 'test-map.yaml');
  if (!existsSync(testMapPath)) {
    console.error(`❌ test-map.yaml not found at ${testMapPath}`);
    console.error(`   STATUS.yaml requires test-map.yaml (generated in 03-test-cases stage)`);
    return;
  }

  const testMapText = readFileSync(testMapPath, 'utf-8');
  const testMap = parseYaml(testMapText);
  const mappedTasks = (testMap && testMap.tasks) || [];

  if (mappedTasks.length === 0) {
    console.error(`❌ test-map.yaml has no tasks`);
    return;
  }

  const projectName = config.project ? (config.project.name || config.project) : '';
  const branch = getCurrentBranch(config._projectRoot);
  const lines = [
    '# STATUS.yaml — Per-task TDD development progress',
    '# AI reads this file at session start to recover context',
    '# Update phase after completing each task',
    '#',
    '# phase values: locked | green | done',
    '# tracking fields (added during execution): started_at, completed_at, test_passed, test_total',
    '',
    `stage: ${newStage}`,
    `project: ${projectName}`,
    `branch: ${branch}`,
    '',
    'tasks:',
  ];

  for (const t of mappedTasks) {
    lines.push(`  - task: "${(t.task || '').replace(/"/g, '\\"')}"`);
    lines.push(`    test_file: ${t.test_file || ''}`);
    lines.push(`    phase: locked`);
  }
  lines.push('');

  mkdirSync(dirname(statusFile), { recursive: true });
  writeFileSync(statusFile, lines.join('\n'), 'utf-8');
  console.log(`✅ Created STATUS.yaml with ${mappedTasks.length} tasks`);
}

// ─── Test Locking ───────────────────────────────────────────────────────────

export async function maybeLockTests(config, newStage) {
  const stageCfg = getStageConfig(config, newStage);
  const onEnter = (stageCfg && stageCfg.on_enter) || [];
  if (!onEnter.includes('lock_tests')) return;

  const gitRoot = findGitRoot(config._projectRoot);

  for (const testsDir of getTestDirs(config)) {
    if (!existsSync(testsDir)) continue;
    console.log(`🔒 Locking ${testsDir}`);
    try {
      const { lockTests } = await import('./lock-tests.mjs');
      lockTests(testsDir, gitRoot);
    } catch (e) {
      console.log(`WARN: could not lock tests: ${e.message}`);
    }
  }

  for (const resourceDir of getTestResourceDirs(config)) {
    if (!existsSync(resourceDir)) continue;
    console.log(`🔒 Locking ${resourceDir}`);
    try {
      const { lockTests } = await import('./lock-tests.mjs');
      lockTests(resourceDir, gitRoot);
    } catch (e) {
      console.log(`WARN: could not lock test resources: ${e.message}`);
    }
  }
}

// ─── Main Advance Function ──────────────────────────────────────────────────

export async function advance(config, dryRun = false) {
  const current = findCurrentStage(config);
  if (current === null) {
    console.log(`✅ All stages complete`);
    return 0;
  }

  console.log(`Current stage: ${current}`);
  console.log(`Running check to verify completion...`);
  const report = checkStage(current, config);
  printReport(report);

  if (report.status !== 'PASS') {
    console.log(`\n❌ Cannot advance: ${current} is not fully complete.`);
    console.log(`   Missing: ${report.total - report.passed} deliverables`);
    return 1;
  }

  const nxt = nextStage(config, current);
  if (nxt === null) {
    console.log(`✅ ${current} is the last stage. Iteration is complete!`);
    return 0;
  }

  if (dryRun) {
    console.log(`\n🔍 [DRY-RUN] Would advance from ${current} to ${nxt}`);
    console.log(`   Would update state.yaml`);
    const stageCfg = getStageConfig(config, nxt);
    const onEnter = (stageCfg && stageCfg.on_enter) || [];
    if (onEnter.includes('create_status_yaml')) {
      console.log(`   Would create STATUS.yaml`);
    }
    if (onEnter.includes('lock_tests')) {
      console.log(`   Would lock tests directory`);
    }
    return 0;
  }

  console.log(`\n✅ ${current} is complete. Advancing to ${nxt}...`);
  updateStateYaml(config, current, nxt);
  maybeCreateStatusYaml(config, nxt);
  await maybeLockTests(config, nxt);

  console.log(`\n📝 Stage advanced from ${current} to ${nxt}`);
  return 0;
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const exitCode = await advance(config, dryRun);
  process.exit(exitCode);
}

if (process.argv[1] && (
  process.argv[1].endsWith('advance-stage.mjs') ||
  process.argv[1].endsWith('cube-advance')
)) {
  main();
}
