#!/usr/bin/env node
/**
 * check-status.mjs — Verify all tasks in STATUS.yaml are completed
 *
 * Reads STATUS.yaml from the current iteration directory,
 * checks that every task has phase = "done".
 *
 * Exits 0 if all done, 1 otherwise.
 *
 * Usage:
 *   node check-status.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, getIterationDir, parseYaml } from './lib/workflow-config.mjs';

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const iterDir = getIterationDir(config);
  const statusPath = join(iterDir, 'STATUS.yaml');

  if (!existsSync(statusPath)) {
    console.error(`❌ STATUS.yaml not found at ${statusPath}`);
    process.exit(1);
  }

  const text = readFileSync(statusPath, 'utf-8');
  const status = parseYaml(text);
  const tasks = (status && status.tasks) || [];

  if (tasks.length === 0) {
    console.error(`❌ STATUS.yaml has no tasks`);
    process.exit(1);
  }

  let incomplete = 0;
  console.log(`Tasks: ${tasks.length}`);

  for (const t of tasks) {
    const phase = t.phase || 'unknown';
    const done = phase === 'done';
    const mark = done ? '✓' : '✗';
    const desc = (t.task || '').slice(0, 50);
    console.log(`   ${mark} ${desc.padEnd(50)} ${phase}`);
    if (!done) incomplete++;
  }

  if (incomplete > 0) {
    console.log(`\n❌ ${incomplete} task(s) not completed`);
    process.exit(1);
  }

  console.log(`\n✅ All ${tasks.length} tasks completed`);
  process.exit(0);
}

main();
