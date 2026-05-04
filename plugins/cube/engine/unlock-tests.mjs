#!/usr/bin/env node
/**
 * unlock-tests.mjs — Unlock test directory for modifications
 *
 * Removes read-only flags, deletes lock marker, and appends audit log entry.
 * Requires a reason for audit trail.
 *
 * Usage:
 *   node unlock-tests.mjs <reason>
 *   node unlock-tests.mjs [testsDir] <reason>
 *   cube-unlock "interface changed: added new field to UserSchema"
 */

import { existsSync, readdirSync, chmodSync, unlinkSync, appendFileSync, mkdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { platform, hostname, userInfo } from 'os';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { loadConfig, findGitRoot, getTestDirs, getTestResourceDirs } from './lib/workflow-config.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function walkDir(dir) {
  const files = [];
  const dirs = [];
  if (!existsSync(dir)) return { files, dirs };
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(full);
      const sub = walkDir(full);
      files.push(...sub.files);
      dirs.push(...sub.dirs);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return { files, dirs };
}

function removeReadOnly(filePath) {
  if (platform() === 'win32') {
    try {
      execSync(`attrib -R "${filePath}"`, { stdio: 'pipe' });
    } catch {
      try { execSync(`attrib -R "${filePath.replace(/\//g, '\\')}"`, { stdio: 'pipe' }); } catch {}
    }
  } else {
    chmodSync(filePath, 0o644);
  }
}

function removeDirReadOnly(dirPath) {
  if (platform() !== 'win32') {
    chmodSync(dirPath, 0o755);
  }
}

// ─── Main Unlock Function ──────────────────────────────────────────────────

export function unlockTests(testsDir, reason, gitRoot = null) {
  const resolvedDir = resolve(testsDir);

  if (!existsSync(resolvedDir)) {
    console.error(`ERROR: tests directory not found: ${resolvedDir}`);
    process.exit(2);
  }

  if (!reason || reason.length < 10) {
    console.error('ERROR: reason is required (minimum 10 characters)');
    console.error('Usage: cube-unlock <reason>');
    process.exit(2);
  }

  // Remove directory read-only first (so we can modify contents)
  removeDirReadOnly(resolvedDir);

  const { files, dirs } = walkDir(resolvedDir);

  // Remove read-only from all directories first
  for (const d of [...dirs].reverse()) {
    removeDirReadOnly(d);
  }

  // Remove read-only from files
  let unlocked = 0;
  for (const f of files) {
    removeReadOnly(f);
    unlocked++;
  }

  console.log(`🔓 Unlocked ${unlocked} files in ${testsDir}`);

  // Remove lock marker and append audit log
  if (!gitRoot) gitRoot = findGitRoot(resolvedDir);
  if (gitRoot) {
    const locksDir = join(gitRoot, '.git', 'locks');
    const hash = createHash('md5').update(resolvedDir).digest('hex').slice(0, 12);
    const lockFile = join(locksDir, `${hash}.lock`);

    if (existsSync(lockFile)) {
      unlinkSync(lockFile);
      console.log(`   Removed lock marker`);
    }

    // Append audit log
    mkdirSync(locksDir, { recursive: true });
    const auditFile = join(locksDir, 'audit.log');
    let user = 'unknown';
    try { user = userInfo().username; } catch {}

    const entry = [
      '---',
      `unlocked_at: ${new Date().toISOString()}`,
      `unlocked_by: ${user}@${hostname()}`,
      `tests_dir: ${relative(gitRoot, resolvedDir)}`,
      `reason: "${reason}"`,
      '',
    ].join('\n');

    appendFileSync(auditFile, entry, 'utf-8');
    console.log(`   Audit entry appended to .git/locks/audit.log`);
  }
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: cube-unlock <reason>');
    console.error('       cube-unlock [testsDir] <reason>');
    process.exit(2);
  }

  let testsDir, reason;

  if (args.length === 1) {
    // Only reason provided, get testsDir from config
    reason = args[0];
    try {
      const config = loadConfig();
      const gitRoot = findGitRoot(config._projectRoot);
      const dirs = [...getTestDirs(config), ...getTestResourceDirs(config)];
      let unlockedAny = false;
      for (const dir of dirs) {
        if (existsSync(dir)) {
          unlockTests(dir, reason, gitRoot);
          unlockedAny = true;
        }
      }
      if (!unlockedAny) {
        console.log(`⚠️  No configured test or test resource directories found`);
      }
      return;
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      console.error('Provide testsDir explicitly: cube-unlock [testsDir] <reason>');
      process.exit(2);
    }
  } else {
    testsDir = args[0];
    reason = args.slice(1).join(' ');
  }

  unlockTests(testsDir, reason);
}

if (process.argv[1] && (
  process.argv[1].endsWith('unlock-tests.mjs') ||
  process.argv[1].endsWith('cube-unlock')
)) {
  main();
}
