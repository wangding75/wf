#!/usr/bin/env node
/**
 * check-schema-coverage.mjs — Verify TDD tests cover all schema definitions
 *
 * Reads language_config from workflow.yaml to determine regex patterns for
 * extracting model names and error constants, then checks test files reference them.
 *
 * Usage:
 *   node check-schema-coverage.mjs
 *   cube-check-coverage
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import {
  loadConfig, parseYaml, getSourceDirs, getTestDirs, getEffectiveSchemaConfig, normalizeLanguage
} from './lib/workflow-config.mjs';
import { fnmatch } from './check-stage.mjs';

// ─── Schema Extraction ─────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

export function extractSchemas(schemasDirs, modelRegex, errorRegex, schemaPattern = null) {
  const models = new Set();
  const errors = new Map(); // className -> [constName, ...]

  const modelRe = new RegExp(modelRegex, 'gm');
  const errorRe = errorRegex ? new RegExp(errorRegex, 'gm') : null;

  const dirs = Array.isArray(schemasDirs) ? schemasDirs : [schemasDirs];
  const files = dirs.flatMap(dir => walkDir(dir));

  for (const file of files) {
    const name = file.split(/[/\\]/).pop();
    if (name === '__init__.py' || name === 'common.py' || name === 'package-info.java') continue;
    if (schemaPattern && !fnmatch(name, schemaPattern)) continue;

    const content = readFileSync(file, 'utf-8');

    // Extract models
    let match;
    modelRe.lastIndex = 0;
    while ((match = modelRe.exec(content)) !== null) {
      models.add(match[1]);
    }

    // Extract error constants
    if (errorRe) {
      errorRe.lastIndex = 0;
      while ((match = errorRe.exec(content)) !== null) {
        // Use filename as class context
        const className = name.replace(/\.[^.]+$/, '');
        if (!errors.has(className)) errors.set(className, []);
        errors.get(className).push(match[1]);
      }
    }
  }

  return { models, errors };
}

export function extractTestReferences(testsDirs, testPattern) {
  const dirs = Array.isArray(testsDirs) ? testsDirs : [testsDirs];
  const files = dirs.flatMap(dir => walkDir(dir));
  const parts = [];

  for (const file of files) {
    const name = file.split(/[/\\]/).pop();
    if (fnmatch(name, testPattern)) {
      parts.push(readFileSync(file, 'utf-8'));
    }
  }

  return parts.join('\n');
}

// ─── Coverage Check ─────────────────────────────────────────────────────────

export function checkCoverage(config) {
  const langConfig = getEffectiveSchemaConfig(config);

  const sourceDirs = getSourceDirs(config).filter(dir => existsSync(dir));
  const testsDirs = getTestDirs(config).filter(dir => existsSync(dir));

  if (sourceDirs.length === 0) {
    console.log(`⚠️  source dir not found`);
    return 0;
  }

  if (testsDirs.length === 0) {
    console.log(`⚠️  test dir not found`);
    return 0;
  }

  // Default patterns for Python (Pydantic)
  const modelRegex = langConfig.model_regex || '^class\\s+(\\w+)\\s*\\(\\s*BaseModel\\s*\\)';
  const errorRegex = langConfig.error_regex || '^\\s+([A-Z_]+)\\s*=';
  const language = normalizeLanguage(config.project && config.project.language);
  const defaultTestPattern = language === 'python'
    ? 'test_*.py'
    : language === 'typescript'
      ? '*.test.ts'
      : '*Test.java';
  const testPattern = langConfig.test_pattern || langConfig.test_file_pattern || defaultTestPattern;
  const schemaPattern = langConfig.schema_file_pattern || null;

  const schemas = extractSchemas(sourceDirs, modelRegex, errorRegex, schemaPattern);
  const testContent = extractTestReferences(testsDirs, testPattern);

  // Word-boundary matching to avoid false positives
  const missingModels = [];
  for (const model of [...schemas.models].sort()) {
    const pattern = new RegExp(`\\b${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (!pattern.test(testContent)) {
      missingModels.push(model);
    }
  }

  const missingErrors = [];
  for (const [className, consts] of schemas.errors) {
    for (const constName of consts) {
      const pattern = new RegExp(`\\b${constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!pattern.test(testContent)) {
        missingErrors.push(`${className}.${constName}`);
      }
    }
  }

  const totalModels = schemas.models.size;
  const totalErrors = [...schemas.errors.values()].reduce((sum, arr) => sum + arr.length, 0);
  const projectName = config.project ? (config.project.name || config.project) : '';

  console.log(`\n📋 Schema coverage for ${projectName}`);
  console.log(`   Models: ${totalModels - missingModels.length}/${totalModels} covered`);
  console.log(`   Errors: ${totalErrors - missingErrors.length}/${totalErrors} covered`);

  if (missingModels.length > 0) {
    console.log(`\n❌ Models not referenced in tests:`);
    for (const m of missingModels) console.log(`   - ${m}`);
  }

  if (missingErrors.length > 0) {
    console.log(`\n❌ Error codes not referenced in tests:`);
    for (const e of missingErrors) console.log(`   - ${e}`);
  }

  if (missingModels.length === 0 && missingErrors.length === 0) {
    console.log(`\n✅ All schema items covered`);
    return 0;
  }

  return 1;
}

export function checkPresetSchemaConfig(presetDir) {
  const presetPath = join(resolve(presetDir), 'preset.yaml');
  if (!existsSync(presetPath)) {
    console.error(`ERROR: preset.yaml not found at ${presetPath}`);
    return 2;
  }

  const preset = parseYaml(readFileSync(presetPath, 'utf-8')) || {};
  const missing = [];

  if (!preset.schema || !preset.schema.model_regex) missing.push('schema.model_regex');
  if (!preset.schema || !preset.schema.error_regex) missing.push('schema.error_regex');
  if (!preset.test || !preset.test.file_pattern) missing.push('test.file_pattern');

  const label = preset.display_name || preset.language || presetDir;
  console.log(`\n📋 Preset schema coverage config for ${label}`);

  if (missing.length > 0) {
    console.log(`\n❌ Missing required preset fields:`);
    for (const field of missing) console.log(`   - ${field}`);
    return 1;
  }

  console.log(`   model_regex: ${preset.schema.model_regex}`);
  console.log(`   error_regex: ${preset.schema.error_regex}`);
  console.log(`   test.file_pattern: ${preset.test.file_pattern}`);
  console.log(`\n✅ Preset schema coverage config is complete`);
  return 0;
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const presetDir = args.find(a => !a.startsWith('--'));
  if (presetDir) {
    process.exit(checkPresetSchemaConfig(presetDir));
  }

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const exitCode = checkCoverage(config);
  process.exit(exitCode);
}

if (process.argv[1] && (
  process.argv[1].endsWith('check-schema-coverage.mjs') ||
  process.argv[1].endsWith('cube-check-coverage')
)) {
  main();
}
