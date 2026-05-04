#!/usr/bin/env node
/**
 * regress-stage.mjs — Regress to an earlier stage
 *
 * Validates the target is earlier than current, auto-unlocks tests if locked,
 * updates state.yaml, and marks regressed stages as PENDING.
 *
 * Usage:
 *   node regress-stage.mjs <targetStageId> [--dry-run]
 *   cube-regress 02-design [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  loadConfig, getIterationDir, loadState, findGitRoot,
  getTestDirs, getTestResourceDirs
} from './lib/workflow-config.mjs';

// ─── Stage Navigation ───────────────────────────────────────────────────────

function getStageOrder(config) {
  return (config.stages || []).map(s => s.id);
}

function findCurrentStage(config) {
  const state = loadState(config);
  if (state && state.current_stage) return state.current_stage;
  const order = getStageOrder(config);
  return order.length > 0 ? order[0] : null;
}

// ─── Test Unlock ────────────────────────────────────────────────────────────

async function maybeUnlockTests(config) {
  const gitRoot = findGitRoot(config._projectRoot);
  const reason = 'stage regress: auto-unlock for design rework';

  for (const testsDir of getTestDirs(config)) {
    if (!existsSync(testsDir)) continue;
    try {
      const { unlockTests } = await import('./unlock-tests.mjs');
      unlockTests(testsDir, reason, gitRoot);
      console.log(`🔓 Auto-unlocked tests`);
    } catch (e) {
      console.log(`WARN: could not unlock tests: ${e.message}`);
    }
  }

  for (const resourceDir of getTestResourceDirs(config)) {
    if (!existsSync(resourceDir)) continue;
    try {
      const { unlockTests } = await import('./unlock-tests.mjs');
      unlockTests(resourceDir, reason, gitRoot);
      console.log(`🔓 Auto-unlocked test resources`);
    } catch (e) {
      console.log(`WARN: could not unlock test resources: ${e.message}`);
    }
  }
}

// ─── State Update ──────────────────────────────────────────────────────────

function updateStateYaml(config, currentStage, targetStage) {
  const iterDir = getIterationDir(config);
  const statePath = join(iterDir, 'state.yaml');

  if (!existsSync(statePath)) {
    console.error(`ERROR: state.yaml not found at ${statePath}`);
    process.exit(2);
  }

  const order = getStageOrder(config);
  const targetIdx = order.indexOf(targetStage);

  const content = readFileSync(statePath, 'utf-8');
  const lines = content.split('\n');
  const out = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('current_stage:')) {
      out.push(`current_stage: ${targetStage}`);
      continue;
    }

    let replaced = false;
    for (let i = targetIdx; i < order.length; i++) {
      const stageId = order[i];
      if (line.includes(`${stageId}:`)) {
        if (i === targetIdx && line.includes('PASS')) {
          out.push(line.replace('PASS', 'IN_PROGRESS'));
          replaced = true;
        } else if (i > targetIdx && (line.includes('PASS') || line.includes('IN_PROGRESS'))) {
          out.push(line.replace(/PASS|IN_PROGRESS/, 'PENDING'));
          replaced = true;
        }
        break;
      }
    }
    if (!replaced) out.push(line);
  }

  const historyIdx = out.findIndex(l => l.trim() === 'history: []');
  if (historyIdx !== -1) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    out[historyIdx] = 'history:';
    out.splice(historyIdx + 1, 0,
      `  - time: "${ts}"`,
      `    action: regress`,
      `    detail: "${currentStage} → ${targetStage}"`,
    );
  } else {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    out.push(`  - time: "${ts}"`);
    out.push(`    action: regress`);
    out.push(`    detail: "${currentStage} → ${targetStage}"`);
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

// ─── Main Regress Function ─────────────────────────────────────────────────

export async function regress(config, targetStage, dryRun = false) {
  const order = getStageOrder(config);
  const current = findCurrentStage(config);

  if (current === null) {
    console.log(`❌ No current stage found`);
    return 1;
  }

  const currentIdx = order.indexOf(current);
  const targetIdx = order.indexOf(targetStage);

  if (targetIdx === -1) {
    console.log(`❌ Unknown stage: ${targetStage}`);
    console.log(`   Valid stages: ${order.join(', ')}`);
    return 1;
  }

  if (targetIdx >= currentIdx) {
    console.log(`❌ Target stage ${targetStage} is not earlier than current stage ${current}`);
    console.log(`   Use cube-advance to move forward`);
    return 1;
  }

  console.log(`Current stage: ${current}`);
  console.log(`Target stage:  ${targetStage}`);
  console.log(`Regressing ${currentIdx - targetIdx} stage(s)`);

  const needsUnlock = currentIdx >= order.indexOf('04-development');

  if (dryRun) {
    console.log(`\n🔍 [DRY-RUN] Would regress from ${current} to ${targetStage}`);
    console.log(`   Would update state.yaml`);
    if (needsUnlock) {
      console.log(`   Would auto-unlock test files`);
    }
    console.log(`   Would NOT delete any files`);
    return 0;
  }

  if (needsUnlock) {
    await maybeUnlockTests(config);
  }

  updateStateYaml(config, current, targetStage);

  console.log(`\n⏪ Stage regressed from ${current} to ${targetStage}`);
  console.log(`   Files are preserved — the stage prompt will continue from where it left off`);
  return 0;
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetStage = args.find(a => !a.startsWith('--'));

  if (!targetStage) {
    console.error('Usage: cube-regress <targetStageId> [--dry-run]');
    console.error('Example: cube-regress 02-design');
    process.exit(2);
  }

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const exitCode = await regress(config, targetStage, dryRun);
  process.exit(exitCode);
}

if (process.argv[1] && (
  process.argv[1].endsWith('regress-stage.mjs') ||
  process.argv[1].endsWith('cube-regress')
)) {
  main();
}
