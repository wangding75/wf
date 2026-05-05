#!/usr/bin/env node
/**
 * update-progress.mjs — Display iteration progress from state.yaml and deliverable checks
 *
 * Reads state.yaml from the current branch's iteration directory,
 * runs checkStage for each stage, and prints a progress summary.
 *
 * Usage:
 *   node update-progress.mjs
 *   cube-progress
 */

import {
  loadConfig, getIterationDir, loadState,
  getCurrentBranch, resolveBranch
} from './lib/workflow-config.mjs';
import { checkStage } from './check-stage.mjs';

// ─── Status Helpers ─────────────────────────────────────────────────────────

export function determineStageStatus(report) {
  if (report.status === 'PASS') return ['✅ Done', 'done'];
  if (report.status === 'NO_MANIFEST') return ['⏳ Pending', 'pending'];
  if (report.status === 'EMPTY') return ['⏳ Pending', 'pending'];
  if (report.passed === 0) return ['⏳ Pending', 'pending'];
  return [`🔄 In Progress (${report.passed}/${report.total})`, 'in_progress'];
}

// ─── Main Function ──────────────────────────────────────────────────────────

export function showProgress(config) {
  const branch = resolveBranch(config);
  const iterDir = getIterationDir(config, branch);
  const state = loadState(config, branch);

  if (!state) {
    console.log(`❌ No iteration found for branch: ${branch}`);
    console.log(`   Run /cube:init to create one.`);
    return 1;
  }

  const stages = config.stages || [];
  const projectName = config.project ? (config.project.name || config.project) : 'Project';

  console.log(`\n📊 ${projectName} — Progress`);
  console.log(`   Branch: ${branch}`);
  console.log(`   Current Stage: ${state.current_stage || 'unknown'}`);
  console.log('');
  console.log('   | Stage | Name | Status | Deliverables |');
  console.log('   |-------|------|--------|-------------|');

  let currentStageReport = null;

  for (const stage of stages) {
    const report = checkStage(stage.id, config);
    if (stage.id === state.current_stage) {
      currentStageReport = report;
    }
    const [statusLabel] = determineStageStatus(report);
    const progress = report.status === 'NO_MANIFEST' ? 'No manifest' : `${report.passed}/${report.total}`;
    const stageNum = stage.id.split('-')[0];
    console.log(`   | ${stageNum} | ${stage.name} | ${statusLabel} | ${progress} |`);
  }

  console.log('');

  // Show available commands based on current stage
  console.log('   Available commands:');
  console.log('     /cube:dev       — Execute current stage work');
  console.log('     /cube:check     — Check current stage deliverables');
  if (currentStageReport && currentStageReport.status === 'PASS') {
    console.log('     /cube:advance   — Advance to next stage');
  }
  console.log('     /cube:status    — Show this progress view');
  console.log('');

  return 0;
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const exitCode = showProgress(config);
  process.exit(exitCode);
}

if (process.argv[1] && (
  process.argv[1].endsWith('update-progress.mjs') ||
  process.argv[1].endsWith('cube-progress')
)) {
  main();
}
