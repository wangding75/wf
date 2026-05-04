#!/usr/bin/env node
/**
 * workflow-config.mjs — Load and parse workflow configuration
 *
 * Supports the new .cube/ directory structure:
 *   .cube/config/workflow.yaml    — project-level config
 *   .cube/config/deliverables/    — stage check rules
 *   .cube/iterations/{branch}/    — per-branch iteration files
 *
 * Includes a lightweight inline YAML parser.
 *
 * Exports: parseYaml, findConfigDir, loadConfig, getCurrentBranch,
 *          sanitizeBranchName, findGitRoot, resolveBranch, getIterationDir, loadState,
 *          resolveDeliverablePath, resolveCommand, getConfiguredPaths,
 *          getSourceDirs, getTestDirs, getTestResourceDirs, getDeliverablesDir,
 *          resolveDeliverableManifest, getLanguageConfig, getLanguagePreset,
 *          normalizeLanguage,
 *          getEffectiveSchemaConfig
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, isAbsolute, resolve, parse as parsePath } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Lightweight YAML Parser ───────────────────────────────────────────────

/**
 * Parse a YAML string into a JS object.
 * Supports: scalars, lists (- item), mappings (key: value), nested indentation,
 *           comments (#), single/double quoted strings, multiline values via indentation.
 * Does NOT support: anchors &, aliases *, flow syntax {}/[], multi-document ---, tags !!
 */
export function parseYaml(text) {
  const lines = text.split('\n');
  const result = _parseBlock(lines, 0, 0);
  return result.value;
}

function _parseBlock(lines, startIdx, baseIndent) {
  let i = startIdx;
  let result = null;

  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.replace(/#(?=\s|$).*$/, '').trimEnd();

    if (stripped.trim() === '' || raw.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    const indent = raw.length - raw.trimStart().length;

    if (indent < baseIndent) break;

    const content = stripped.trim();

    // List item
    if (content.startsWith('- ')) {
      if (result === null) {
        result = [];
      }
      const itemContent = content.slice(2).trim();

      const colonMatch = itemContent.match(/^(\w[\w\-.]*):\s*(.*)/);
      if (colonMatch && !_isPlainScalar(itemContent)) {
        const obj = {};
        const key = colonMatch[1];
        const val = colonMatch[2].trim();
        if (val) {
          obj[key] = _parseScalar(val);
        } else {
          const nested = _parseBlock(lines, i + 1, indent + 2);
          obj[key] = nested.value;
          i = nested.nextIdx;
          while (i < lines.length) {
            const nextRaw = lines[i];
            const nextStripped = nextRaw.replace(/#(?=\s|$).*$/, '').trimEnd();
            if (nextStripped.trim() === '' || nextRaw.trimStart().startsWith('#')) { i++; continue; }
            const nextIndent = nextRaw.length - nextRaw.trimStart().length;
            if (nextIndent <= indent) break;
            const nextContent = nextStripped.trim();
            const nextColon = nextContent.match(/^(\w[\w\-.]*):\s*(.*)/);
            if (nextColon) {
              const nk = nextColon[1];
              const nv = nextColon[2].trim();
              if (nv) {
                obj[nk] = _parseScalar(nv);
                i++;
              } else {
                const nn = _parseBlock(lines, i + 1, nextIndent + 2);
                obj[nk] = nn.value;
                i = nn.nextIdx;
              }
            } else {
              break;
            }
          }
          result.push(obj);
          continue;
        }
        const peekIdx = i + 1;
        if (peekIdx < lines.length) {
          const peekRaw = lines[peekIdx];
          const peekIndent = peekRaw.length - peekRaw.trimStart().length;
          if (peekIndent > indent && peekRaw.trim() && !peekRaw.trimStart().startsWith('#') && !peekRaw.trimStart().startsWith('- ')) {
            const more = _parseBlock(lines, peekIdx, peekIndent);
            if (typeof more.value === 'object' && more.value !== null && !Array.isArray(more.value)) {
              Object.assign(obj, more.value);
            }
            i = more.nextIdx;
            result.push(obj);
            continue;
          }
        }
        result.push(obj);
        i++;
      } else {
        result.push(_parseScalar(itemContent));
        i++;
      }
      continue;
    }

    // Mapping entry (key: value)
    const mappingMatch = content.match(/^(\w[\w\-.]*):\s*(.*)/);
    if (mappingMatch) {
      if (result === null) result = {};
      const key = mappingMatch[1];
      const val = mappingMatch[2].trim();

      if (val) {
        result[key] = _parseScalar(val);
        i++;
      } else {
        const nested = _parseBlock(lines, i + 1, indent + 2);
        result[key] = nested.value;
        i = nested.nextIdx;
      }
      continue;
    }

    i++;
  }

  return { value: result, nextIdx: i };
}

function _isPlainScalar(text) {
  if (text.startsWith('"') || text.startsWith("'")) return true;
  return !text.match(/^[\w][\w\-.]*:\s/);
}

function _parseScalar(text) {
  if (text === '' || text === '~' || text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;

  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1)
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
  }

  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }

  if (/^-?\d+$/.test(text)) return parseInt(text, 10);
  if (/^-?\d+\.\d+$/.test(text)) return parseFloat(text);

  return text;
}

// ─── Git Helpers ──────────────────────────────────────────────────────────

/**
 * Get the current git branch name.
 * Returns branch name with '/' replaced by '-' for safe directory naming.
 */
export function getCurrentBranch(cwd = process.cwd()) {
  const branch = tryGetCurrentBranch(cwd);
  if (branch) return branch;
  return 'main';
}

function tryGetCurrentBranch(cwd = process.cwd()) {
  const headBranch = tryReadGitHeadBranch(cwd);
  if (headBranch) return headBranch;

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    if (branch && branch !== 'HEAD') return branch;
  } catch {
    // Fall through to the secondary command.
  }

  try {
    const branch = execSync('git branch --show-current', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    if (branch) return branch;
  } catch {
    // No git branch available.
  }

  return null;
}

function tryReadGitHeadBranch(cwd = process.cwd()) {
  try {
    const gitRoot = findGitRoot(cwd);
    if (!gitRoot) return null;
    const headPath = join(gitRoot, '.git', 'HEAD');
    if (!existsSync(headPath)) return null;
    const head = readFileSync(headPath, 'utf-8').trim();
    const match = head.match(/^ref:\s+refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Sanitize branch name for use as directory name.
 * Replaces '/' with '-' to avoid nested directories.
 */
export function sanitizeBranchName(branch) {
  return branch.replace(/\//g, '-');
}

/**
 * Find the git root directory by walking up from startDir looking for .git/
 */
export function findGitRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }

  return null;
}

// ─── Config Loading ───────────────────────────────────────────────────────

/**
 * Find .cube/config/ directory by walking up from startDir.
 * @returns {string} Absolute path to the project root (parent of .cube/)
 * @throws If not found
 */
export function findConfigDir(startDir = process.cwd()) {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (true) {
    const candidate = join(dir, '.cube', 'config', 'workflow.yaml');
    if (existsSync(candidate)) return dir;
    const parent = dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }

  throw new Error(`.cube/config/workflow.yaml not found (searched upward from ${startDir})`);
}

/**
 * Load and parse .cube/config/workflow.yaml.
 * Attaches _projectRoot and _configDir for path resolution.
 */
export function loadConfig(startDir = process.cwd()) {
  const projectRoot = findConfigDir(startDir);
  const yamlPath = join(projectRoot, '.cube', 'config', 'workflow.yaml');
  const text = readFileSync(yamlPath, 'utf-8');
  const config = parseYaml(text);
  config._projectRoot = projectRoot;
  config._configDir = join(projectRoot, '.cube', 'config');
  config._cubeDir = join(projectRoot, '.cube');
  config._yamlPath = yamlPath;
  return config;
}

// ─── Iteration Directory ──────────────────────────────────────────────────

/**
 * Resolve the current branch for iteration lookups.
 * Priority:
 *   1. Explicit branch parameter passed by caller
 *   2. git rev-parse / git branch --show-current
 *   3. Existing .cube/iterations/{branch}/ directory (fallback scan)
 *   4. 'main' (last resort)
 */
export function resolveBranch(config, explicitBranch = null) {
  if (explicitBranch) return explicitBranch;

  const gitBranch = tryGetCurrentBranch(config._projectRoot);
  if (gitBranch) return gitBranch;

  // Scan .cube/iterations/ only when git branch detection is unavailable.
  const iterRoot = join(config._cubeDir, 'iterations');
  if (existsSync(iterRoot)) {
    try {
      const entries = readdirSync(iterRoot);
      for (const name of entries) {
        if (name && name !== '.' && name !== '..' && existsSync(join(iterRoot, name, 'state.yaml'))) {
          return name;
        }
      }
    } catch { /* ignore scan failures */ }
  }

  return 'main';
}

/**
 * Get the iteration directory for the current branch.
 * Uses resolveBranch for robust branch detection.
 * @returns {string} Absolute path to .cube/iterations/{sanitized-branch}/
 */
export function getIterationDir(config, branch = null) {
  if (!branch) branch = resolveBranch(config);
  const safeBranch = sanitizeBranchName(branch);
  return join(config._cubeDir, 'iterations', safeBranch);
}

/**
 * Load state.yaml from the current branch's iteration directory.
 * @returns {object|null} Parsed state or null if not found
 */
export function loadState(config, branch = null) {
  const iterDir = getIterationDir(config, branch);
  const statePath = join(iterDir, 'state.yaml');
  if (!existsSync(statePath)) return null;
  const text = readFileSync(statePath, 'utf-8');
  return parseYaml(text);
}

// ─── Path Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a deliverable path that may contain ${paths.xxx} or ${language_config.xxx} variables.
 * Paths without variables are resolved relative to the iteration directory.
 * Paths with ${paths.xxx} are resolved relative to the project root.
 */
export function resolveDeliverablePath(config, path, iterDir) {
  const varMatch = path.match(/^\$\{(\w+)\.(\w+)\}(.*)$/);
  if (varMatch) {
    const [, section, key, rest] = varMatch;
    const sectionObj = config[section];
    if (sectionObj && sectionObj[key]) {
      return join(config._projectRoot, sectionObj[key] + (rest || ''));
    }
    return join(config._projectRoot, path);
  }
  return join(iterDir, path);
}

function resolveProjectPath(config, pathValue) {
  if (!pathValue) return null;
  return isAbsolute(pathValue) ? pathValue : join(config._projectRoot, pathValue);
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

export function normalizeLanguage(language) {
  const value = (language || 'java').toLowerCase();
  if (value === 'py') return 'python';
  if (value === 'ts') return 'typescript';
  return value;
}

function getDefaultProjectPaths(config) {
  const language = normalizeLanguage(config.project && config.project.language);
  if (language === 'python') {
    return {
      source_dir: 'src',
      test_dir: 'tests',
      test_resource_dir: 'tests/resources',
    };
  }
  if (language === 'typescript') {
    return {
      source_dir: 'src',
      test_dir: 'tests',
      test_resource_dir: 'tests/resources',
    };
  }
  return {
    source_dir: 'src/main/java',
    test_dir: 'src/test/java',
    test_resource_dir: 'src/test/resources',
  };
}

/**
 * Resolve configured project paths. Supports both single-module `paths.*`
 * configs and multi-module `modules[].*` configs.
 */
export function getConfiguredPaths(config, key, fallback = null) {
  const paths = [];

  if (config.paths && config.paths[key]) {
    paths.push(resolveProjectPath(config, config.paths[key]));
  }

  if (Array.isArray(config.modules)) {
    for (const module of config.modules) {
      if (module && module[key]) {
        paths.push(resolveProjectPath(config, module[key]));
      }
    }
  }

  if (paths.length === 0 && fallback) {
    paths.push(resolveProjectPath(config, fallback));
  }

  return uniquePaths(paths);
}

export function getSourceDirs(config) {
  return getConfiguredPaths(config, 'source_dir', getDefaultProjectPaths(config).source_dir);
}

export function getTestDirs(config) {
  return getConfiguredPaths(config, 'test_dir', getDefaultProjectPaths(config).test_dir);
}

export function getTestResourceDirs(config) {
  return getConfiguredPaths(config, 'test_resource_dir', getDefaultProjectPaths(config).test_resource_dir);
}

/**
 * Resolve a deliverable command that may contain ${language_config.xxx} or ${engine_dir} variables.
 */
export function resolveCommand(config, cmd) {
  return cmd
    .replace(/\$\{engine_dir\}/g, join(__dirname, '..'))
    .replace(/\$\{(\w+)\.(\w+)\}/g, (match, section, key) => {
      const sectionObj = section === 'language_config'
        ? getLanguageConfig(config)
        : config[section];
      if (sectionObj && sectionObj[key]) return sectionObj[key];
      return match;
    });
}

/**
 * Get the plugin presets deliverables directory for the project's language.
 */
export function getDeliverablesDir(config) {
  const language = normalizeLanguage(config.project && config.project.language);
  const pluginRoot = join(__dirname, '..', '..');
  return join(pluginRoot, 'presets', language, 'deliverables');
}

export function getLanguagePreset(config) {
  const language = normalizeLanguage(config.project && config.project.language);
  const pluginRoot = join(__dirname, '..', '..');
  const presetPath = join(pluginRoot, 'presets', language, 'preset.yaml');
  if (!existsSync(presetPath)) return {};
  return parseYaml(readFileSync(presetPath, 'utf-8')) || {};
}

export function getEffectiveSchemaConfig(config) {
  const preset = getLanguagePreset(config);
  const effective = {};

  if (preset.test && preset.test.file_pattern) {
    effective.test_file_pattern = preset.test.file_pattern;
  }
  if (preset.schema) {
    if (preset.schema.file_pattern) effective.schema_file_pattern = preset.schema.file_pattern;
    if (preset.schema.model_regex) effective.model_regex = preset.schema.model_regex;
    if (preset.schema.error_regex) effective.error_regex = preset.schema.error_regex;
  }

  return { ...effective, ...(config.language_config || {}) };
}

/**
 * Resolve the deliverable manifest path for a stage.
 * Project-level override (.cube/config/deliverables/) takes priority;
 * falls back to plugin preset.
 */
export function resolveDeliverableManifest(config, stageId) {
  const projectPath = join(config._configDir, 'deliverables', `${stageId}.yaml`);
  if (existsSync(projectPath)) return projectPath;
  return join(getDeliverablesDir(config), `${stageId}.yaml`);
}

/**
 * Get the language_config section from config.
 */
export function getLanguageConfig(config) {
  const preset = getLanguagePreset(config);
  const effective = {};

  if (preset.build && preset.build.compile_command) {
    effective.compile_command = preset.build.compile_command;
  }

  if (preset.test) {
    if (preset.test.command) effective.test_command = preset.test.command;
    if (preset.test.single_command) effective.test_command_single = preset.test.single_command;
    if (preset.test.file_pattern) effective.test_file_pattern = preset.test.file_pattern;
    if (preset.test.case_regex) effective.test_case_regex = preset.test.case_regex;
    if (preset.test.presence_regex) effective.test_presence_regex = preset.test.presence_regex;
    if (preset.test.coverage_command) effective.coverage_command = preset.test.coverage_command;
  }

  if (preset.lint && preset.lint.command) {
    effective.lint_command = preset.lint.command;
  }

  // Common single-file defaults when preset omits an explicit command.
  if (!effective.test_command_single && effective.test_command) {
    const language = normalizeLanguage(config.project && config.project.language);
    if (language === 'python') effective.test_command_single = 'pytest {{file}}';
    if (language === 'typescript') effective.test_command_single = 'npm test -- {{file}}';
  }

  return { ...effective, ...(config.language_config || {}) };
}
