#!/usr/bin/env node
/**
 * check-stage.mjs — Verify deliverables for an iteration stage
 *
 * Reads deliverables YAML from .cube/config/deliverables/, runs all checkers,
 * and reports PASS/FAIL/EMPTY/NO_MANIFEST status.
 *
 * Paths in deliverables are resolved:
 *   - Plain paths → relative to .cube/iterations/{branch}/
 *   - ${paths.xxx} → relative to project root, from workflow.yaml
 *   - ${language_config.xxx} → substituted from workflow.yaml
 *
 * Usage:
 *   node check-stage.mjs [stageId] [--json]
 *   cube-check 01-prd
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { execFileSync, execSync } from 'child_process';
import {
  loadConfig, getIterationDir, resolveDeliverableManifest,
  resolveDeliverablePath, resolveCommand, parseYaml
} from './lib/workflow-config.mjs';

// ─── Helpers ───────────────────────────────────────────────────────────────

export function fnmatch(name, pattern) {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(name);
}

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

function runCommand(cmd, options) {
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

// ─── Checkers ───────────────────────────────────────────────────────────────

export function checkFile(spec, iterDir, projectRoot, config) {
  const filePath = resolveDeliverablePath(config, spec.path, iterDir);
  if (!existsSync(filePath)) {
    return [false, `file not found: ${relative(projectRoot, filePath)}`];
  }
  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return [false, `not a file: ${relative(projectRoot, filePath)}`];
  }

  if (spec.min_size_bytes !== undefined) {
    if (stat.size < spec.min_size_bytes) {
      return [false, `file too small: ${stat.size} < ${spec.min_size_bytes} bytes`];
    }
  }

  if (spec.must_contain) {
    const content = readFileSync(filePath, 'utf-8');
    const missing = spec.must_contain.filter(s => !content.includes(s));
    if (missing.length > 0) {
      return [false, `missing required sections: [${missing.join(', ')}]`];
    }
  }

  return [true, 'ok'];
}

export function checkDir(spec, iterDir, projectRoot, config) {
  const dirPath = resolveDeliverablePath(config, spec.path, iterDir);
  if (!existsSync(dirPath)) {
    return [false, `dir not found: ${relative(projectRoot, dirPath)}`];
  }
  const stat = statSync(dirPath);
  if (!stat.isDirectory()) {
    return [false, `not a dir: ${relative(projectRoot, dirPath)}`];
  }

  const pattern = spec.pattern || '*';
  const allFiles = walkDir(dirPath);
  const matchedFiles = allFiles.filter(f => {
    const name = f.split(/[/\\]/).pop();
    return fnmatch(name, pattern);
  });

  if (spec.min_files !== undefined) {
    if (matchedFiles.length < spec.min_files) {
      return [false, `too few files: ${matchedFiles.length} < ${spec.min_files} (pattern=${pattern})`];
    }
  }

  return [true, `ok (${matchedFiles.length} files)`];
}

export function checkCommand(spec, iterDir, projectRoot, config, commandRunner = runCommand) {
  const cmd = resolveCommand(config, spec.cmd);
  const cwd = spec.cwd_stage !== false ? iterDir : projectRoot;
  const expectExit = spec.expect_exit_code !== undefined ? spec.expect_exit_code : 0;
  const options = {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
  };

  const err = commandRunner(cmd, options);
  if (!err) {
    if (expectExit !== 0) {
      return [false, `exit=0 (expected ${expectExit})`];
    }
    return [true, 'ok (exit=0)'];
  }

  const exitCode = err.status || 1;
  if (exitCode === expectExit) {
    return [true, `ok (exit=${exitCode})`];
  }
  const stderr = (err.stderr || '').toString().trim().slice(0, 200);
  return [false, `exit=${exitCode} (expected ${expectExit}): ${stderr}`];
}

export function checkFilesPatterns(spec, iterDir, projectRoot, config) {
  const base = resolveDeliverablePath(config, spec.path, iterDir);
  if (!existsSync(base)) {
    return [false, `base dir not found: ${relative(projectRoot, base)}`];
  }

  const patterns = spec.patterns;
  const allFiles = walkDir(base);
  const missing = [];

  for (const pat of patterns) {
    const matched = allFiles.some(f => {
      const name = f.split(/[/\\]/).pop();
      return fnmatch(name, pat);
    });
    if (!matched) {
      missing.push(pat);
    }
  }

  if (missing.length > 0) {
    return [false, `no files matching patterns: [${missing.join(', ')}]`];
  }
  return [true, `ok (all ${patterns.length} patterns matched)`];
}

const CHECKERS = {
  file: checkFile,
  dir: checkDir,
  command: checkCommand,
  files: checkFilesPatterns,
};

// ─── Main Check Function ───────────────────────────────────────────────────

export function checkStage(stageId, config, overrides = {}) {
  const iterDir = getIterationDir(config);
  const projectRoot = config._projectRoot;
  const manifest = resolveDeliverableManifest(config, stageId);

  if (!existsSync(manifest)) {
    return {
      project: config.project ? config.project.name || config.project : '',
      stage: stageId,
      status: 'NO_MANIFEST',
      total: 0,
      passed: 0,
      results: [],
      error: `${stageId}.yaml not found at ${relative(projectRoot, manifest)}`,
    };
  }

  const text = readFileSync(manifest, 'utf-8');
  const manifestConfig = parseYaml(text);

  const deliverables = manifestConfig.deliverables || [];
  const extraChecks = manifestConfig.checks || [];
  const allItems = [...deliverables, ...extraChecks];

  const results = [];
  let passed = 0;

  for (const item of allItems) {
    const itemType = item.type || (item.cmd ? 'command' : 'unknown');
    const checker = CHECKERS[itemType];

    if (!checker) {
      results.push({
        id: item.id || '<unnamed>',
        type: itemType,
        ok: false,
        message: `unknown deliverable type: ${itemType}`,
      });
      continue;
    }

    let ok, msg;
    try {
      [ok, msg] = itemType === 'command'
        ? checker(item, iterDir, projectRoot, config, overrides.commandRunner)
        : checker(item, iterDir, projectRoot, config);
    } catch (e) {
      ok = false;
      msg = `checker error: ${e.message}`;
    }

    results.push({
      id: item.id || '<unnamed>',
      type: itemType,
      ok,
      message: msg,
    });
    if (ok) passed++;
  }

  const total = allItems.length;
  let status;
  if (passed === total && total > 0) status = 'PASS';
  else if (total > 0) status = 'FAIL';
  else status = 'EMPTY';

  return {
    project: config.project ? config.project.name || config.project : '',
    stage: stageId,
    name: manifestConfig.name || stageId,
    status,
    total,
    passed,
    results,
  };
}

// ─── Report Printer ─────────────────────────────────────────────────────────

export function printReport(report) {
  const icons = { PASS: '✅', FAIL: '❌', EMPTY: '⚠️', NO_MANIFEST: '❓' };
  const icon = icons[report.status] || '?';
  console.log(`\n${icon} [${report.project}/${report.stage}] ${report.name || ''} — ${report.status}`);
  console.log(`   ${report.passed}/${report.total} deliverables met`);

  if (report.error) {
    console.log(`   ERROR: ${report.error}`);
    return;
  }

  for (const r of report.results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`   ${mark} ${r.id.padEnd(30)} ${r.message}`);
  }
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const stageId = args.find(a => !a.startsWith('--'));

  if (!stageId) {
    console.error('Usage: cube-check <stageId> [--json]');
    process.exit(2);
  }

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const report = checkStage(stageId, config);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  process.exit(report.status === 'PASS' ? 0 : 1);
}

if (process.argv[1] && (
  process.argv[1].endsWith('check-stage.mjs') ||
  process.argv[1].endsWith('cube-check')
)) {
  main();
}
