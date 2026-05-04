#!/usr/bin/env node
/**
 * lock-tests.mjs — Lock test directory to prevent modifications
 *
 * Sets files to read-only (chmod 444 on POSIX, attrib +R on Windows)
 * and creates a lock marker in .git/locks/.
 *
 * Usage:
 *   node lock-tests.mjs [testsDir]
 *   cube-lock [testsDir]
 */

import { existsSync, readdirSync, chmodSync, mkdirSync, writeFileSync } from 'fs';
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

function setReadOnly(filePath) {
  if (platform() === 'win32') {
    try {
      execSync(`attrib +R "${filePath}"`, { stdio: 'pipe' });
    } catch {
      // Fallback: try with forward slashes
      try { execSync(`attrib +R "${filePath.replace(/\//g, '\\')}"`, { stdio: 'pipe' }); } catch {}
    }
  } else {
    chmodSync(filePath, 0o444);
  }
}

function setDirReadOnly(dirPath) {
  if (platform() !== 'win32') {
    chmodSync(dirPath, 0o555);
  }
}

// ─── Main Lock Function ────────────────────────────────────────────────────

export function lockTests(testsDir, gitRoot = null) {
  const resolvedDir = resolve(testsDir);

  if (!existsSync(resolvedDir)) {
    console.error(`ERROR: tests directory not found: ${resolvedDir}`);
    process.exit(2);
  }

  const { files, dirs } = walkDir(resolvedDir);

  if (files.length === 0) {
    console.log(`⚠️  No files found in ${testsDir}`);
    return;
  }

  // Set files to read-only
  let locked = 0;
  for (const f of files) {
    setReadOnly(f);
    locked++;
  }

  // Set directories to read-only (POSIX only)
  for (const d of dirs) {
    setDirReadOnly(d);
  }
  setDirReadOnly(resolvedDir);

  console.log(`🔒 Locked ${locked} files in ${testsDir}`);

  // Create lock marker in .git/locks/
  if (!gitRoot) gitRoot = findGitRoot(resolvedDir);
  if (gitRoot) {
    const locksDir = join(gitRoot, '.git', 'locks');
    mkdirSync(locksDir, { recursive: true });

    const hash = createHash('md5').update(resolvedDir).digest('hex').slice(0, 12);
    const lockFile = join(locksDir, `${hash}.lock`);

    let user = 'unknown';
    try { user = userInfo().username; } catch {}

    const content = [
      `tests_dir=${relative(gitRoot, resolvedDir)}`,
      `locked_at=${new Date().toISOString()}`,
      `locked_by=${user}@${hostname()}`,
      `file_count=${locked}`,
      '',
    ].join('\n');

    writeFileSync(lockFile, content, 'utf-8');
    console.log(`   Lock marker: .git/locks/${hash}.lock`);
  }
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let testsDir = args[0];

  if (!testsDir) {
    try {
      const config = loadConfig();
      const gitRoot = findGitRoot(config._projectRoot);
      const dirs = [...getTestDirs(config), ...getTestResourceDirs(config)];
      let lockedAny = false;
      for (const dir of dirs) {
        if (existsSync(dir)) {
          lockTests(dir, gitRoot);
          lockedAny = true;
        }
      }
      if (!lockedAny) {
        console.log(`⚠️  No configured test or test resource directories found`);
      }
      return;
    } catch (e) {
      console.error('Usage: cube-lock [testsDir]');
      console.error(`(workflow.yaml not found: ${e.message})`);
      process.exit(2);
    }
  }

  lockTests(testsDir);
}

if (process.argv[1] && (
  process.argv[1].endsWith('lock-tests.mjs') ||
  process.argv[1].endsWith('cube-lock')
)) {
  main();
}
