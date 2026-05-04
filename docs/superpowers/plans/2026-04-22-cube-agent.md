# CUBE Agent CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone CLI agent that drives the CUBE 5-stage workflow using Anthropic SDK toolRunner, with DAG-based parallel TDD execution and multi-layer review.

**Architecture:** Orchestrator dispatches independent Stage Agents (each a `toolRunner` call with stage-specific system prompt and tools). Agents communicate only through the filesystem. A DAG scheduler manages concurrent TDD agent execution in Stage 04.

**Tech Stack:** TypeScript, @anthropic-ai/sdk (toolRunner + betaZodTool), commander.js, js-yaml, zod

---

## Phase 1: Project Scaffold & Types

### Task 1: Initialize project and install dependencies

**Files:**
- Create: `cube-agent/package.json`
- Create: `cube-agent/tsconfig.json`
- Create: `cube-agent/.gitignore`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p cube-agent
cd cube-agent
```

```json
{
  "name": "cube-agent",
  "version": "0.1.0",
  "description": "Standalone CLI agent for CUBE stage-gate workflow",
  "type": "module",
  "bin": {
    "cube-agent": "./dist/bin/cube-agent.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd cube-agent
npm install @anthropic-ai/sdk commander js-yaml zod
npm install -D typescript vitest @types/node @types/js-yaml
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 5: Commit**

```bash
git add cube-agent/
git commit -m "chore: scaffold cube-agent project with dependencies"
```

---

### Task 2: Define core types

**Files:**
- Create: `cube-agent/src/types/config.ts`
- Create: `cube-agent/src/types/dag.ts`
- Create: `cube-agent/src/types/agent.ts`
- Create: `cube-agent/src/types/index.ts`
- Test: `cube-agent/tests/types/config.test.ts`

- [ ] **Step 1: Write failing test for config types**

Create `cube-agent/tests/types/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { CubeAgentConfig, FailStrategy } from '../../src/types/config.js';

describe('CubeAgentConfig type', () => {
  it('should accept valid config', () => {
    const config: CubeAgentConfig = {
      project: '/tmp/test-project',
      model: 'claude-sonnet-4-5-20250929',
      onFail: 'retry',
      maxRetry: 3,
      concurrency: 2,
      skipInterview: false,
      verbose: false,
    };
    expect(config.onFail).toBe('retry');
    expect(config.concurrency).toBe(2);
  });

  it('should accept all fail strategies', () => {
    const strategies: FailStrategy[] = ['retry', 'stop', 'skip'];
    expect(strategies).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/types/config.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement config types**

Create `cube-agent/src/types/config.ts`:

```typescript
export type FailStrategy = 'retry' | 'stop' | 'skip';

export type StageId =
  | '01-prd'
  | '02-design'
  | '03-test-cases'
  | '04-development'
  | '05-testing';

export const STAGE_ORDER: StageId[] = [
  '01-prd',
  '02-design',
  '03-test-cases',
  '04-development',
  '05-testing',
];

export interface CubeAgentConfig {
  project: string;
  branch?: string;
  model: string;
  onFail: FailStrategy;
  maxRetry: number;
  concurrency: number;
  skipInterview: boolean;
  startFrom?: StageId;
  verbose: boolean;
  doc?: string;
  input?: string;
  review?: ReviewConfig;
}

export interface ReviewConfig {
  stageReview: boolean;
  finalReview: boolean;
  maxReviewRounds: number;
}

export interface ProjectConfig {
  projectName: string;
  language: string;
  structure: string;
  paths: {
    sourceDir: string;
    testDir: string;
    testResourceDir: string;
  };
  languageConfig: {
    buildTool: string;
    compileCommand: string;
    testCommand: string;
    testCommandSingle: string;
    testFilePattern: string;
  };
}

export interface IterationState {
  branch: string;
  createdAt: string;
  stages: Record<StageId, 'PENDING' | 'IN_PROGRESS' | 'PASS'>;
  currentStage: StageId;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/types/config.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement DAG types**

Create `cube-agent/src/types/dag.ts`:

```typescript
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface DagTask {
  id: string;
  name: string;
  dependsOn: string[];
  testFiles: string[];
  status: TaskStatus;
}

export interface TaskDag {
  tasks: DagTask[];
}
```

- [ ] **Step 6: Implement agent types**

Create `cube-agent/src/types/agent.ts`:

```typescript
import type { StageId, CubeAgentConfig } from './config.js';

export type AgentMode = 'interactive' | 'auto';

export interface AgentContext {
  config: CubeAgentConfig;
  projectRoot: string;
  iterationDir: string;
  cubePluginDir: string;
  stage: StageId;
  mode: AgentMode;
}

export interface ReviewResult {
  result: 'PASS' | 'FAIL';
  round: number;
  issues: ReviewIssue[];
  checklistPassed: string[];
  checklistFailed: string[];
  skillsUsed: string[];
}

export interface ReviewIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  stage?: StageId;
}

export interface StageResult {
  stage: StageId;
  success: boolean;
  outputs: string[];
  error?: string;
}
```

- [ ] **Step 7: Create barrel export**

Create `cube-agent/src/types/index.ts`:

```typescript
export * from './config.js';
export * from './dag.js';
export * from './agent.js';
```

- [ ] **Step 8: Commit**

```bash
cd cube-agent
git add src/types/ tests/types/
git commit -m "feat: define core types for config, DAG, and agent"
```

---

## Phase 2: Tools

### Task 3: Implement filesystem tools

**Files:**
- Create: `cube-agent/src/tools/filesystem.ts`
- Test: `cube-agent/tests/tools/filesystem.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/tools/filesystem.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { filesystemTools } from '../../src/tools/filesystem.js';

describe('filesystemTools', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cube-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('read_file should return file contents', async () => {
    writeFileSync(join(dir, 'test.txt'), 'hello world');
    const tool = filesystemTools.find((t) => t.name === 'read_file')!;
    const result = await tool.run({ path: join(dir, 'test.txt') });
    expect(result).toBe('hello world');
  });

  it('write_file should create file with content', async () => {
    const tool = filesystemTools.find((t) => t.name === 'write_file')!;
    await tool.run({ path: join(dir, 'out.txt'), content: 'written' });
    const read = filesystemTools.find((t) => t.name === 'read_file')!;
    const result = await read.run({ path: join(dir, 'out.txt') });
    expect(result).toBe('written');
  });

  it('list_directory should list files', async () => {
    writeFileSync(join(dir, 'a.txt'), '');
    writeFileSync(join(dir, 'b.txt'), '');
    const tool = filesystemTools.find((t) => t.name === 'list_directory')!;
    const result = await tool.run({ path: dir });
    expect(result).toContain('a.txt');
    expect(result).toContain('b.txt');
  });

  it('glob should match patterns', async () => {
    writeFileSync(join(dir, 'a.ts'), '');
    writeFileSync(join(dir, 'b.js'), '');
    const tool = filesystemTools.find((t) => t.name === 'glob_files')!;
    const result = await tool.run({ pattern: '*.ts', cwd: dir });
    expect(result).toContain('a.ts');
    expect(result).not.toContain('b.js');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/tools/filesystem.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement filesystem tools**

Create `cube-agent/src/tools/filesystem.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export const filesystemTools = [
  betaZodTool({
    name: 'read_file',
    description: 'Read the contents of a file at the given path',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the file'),
    }),
    run: async ({ path }) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch (e: any) {
        return `Error reading file: ${e.message}`;
      }
    },
  }),

  betaZodTool({
    name: 'write_file',
    description: 'Write content to a file, creating parent directories if needed',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the file'),
      content: z.string().describe('Content to write'),
    }),
    run: async ({ path, content }) => {
      try {
        const dir = dirname(path);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(path, content, 'utf-8');
        return `File written: ${path}`;
      } catch (e: any) {
        return `Error writing file: ${e.message}`;
      }
    },
  }),

  betaZodTool({
    name: 'list_directory',
    description: 'List files and directories in a directory',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the directory'),
    }),
    run: async ({ path }) => {
      try {
        const entries = readdirSync(path, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`)
          .join('\n');
      } catch (e: any) {
        return `Error listing directory: ${e.message}`;
      }
    },
  }),

  betaZodTool({
    name: 'glob_files',
    description: 'Find files matching a glob pattern',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
      cwd: z.string().describe('Directory to search from'),
    }),
    run: async ({ pattern, cwd }) => {
      try {
        const { globSync } = await import('glob');
        const matches = globSync(pattern, { cwd });
        return matches.join('\n') || 'No matches found';
      } catch (e: any) {
        return `Error matching glob: ${e.message}`;
      }
    },
  }),
];
```

- [ ] **Step 4: Install glob dependency**

```bash
cd cube-agent && npm install glob
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/tools/filesystem.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd cube-agent
git add src/tools/filesystem.ts tests/tools/filesystem.test.ts package.json package-lock.json
git commit -m "feat: implement filesystem tools with betaZodTool"
```

---

### Task 4: Implement shell and git tools

**Files:**
- Create: `cube-agent/src/tools/shell.ts`
- Create: `cube-agent/src/tools/git.ts`
- Test: `cube-agent/tests/tools/shell.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/tools/shell.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { shellTools } from '../../src/tools/shell.js';
import { gitTools } from '../../src/tools/git.js';

describe('shellTools', () => {
  it('run_command should execute and return output', async () => {
    const tool = shellTools.find((t) => t.name === 'run_command')!;
    const result = await tool.run({ command: 'echo hello' });
    expect(result).toContain('hello');
    expect(result).toContain('exitCode: 0');
  });

  it('run_command should report non-zero exit code', async () => {
    const tool = shellTools.find((t) => t.name === 'run_command')!;
    const result = await tool.run({ command: 'exit 1' });
    expect(result).toContain('exitCode: 1');
  });
});

describe('gitTools', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cube-git-'));
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('git should execute git commands', async () => {
    const tool = gitTools.find((t) => t.name === 'git')!;
    const result = await tool.run({ args: 'status', cwd: dir });
    expect(result).toContain('On branch');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/tools/shell.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement shell tools**

Create `cube-agent/src/tools/shell.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { execSync } from 'child_process';

export const shellTools = [
  betaZodTool({
    name: 'run_command',
    description: 'Execute a shell command and return stdout, stderr, and exit code',
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    run: async ({ command, cwd }) => {
      try {
        const stdout = execSync(command, {
          cwd,
          encoding: 'utf-8',
          timeout: 120_000,
          shell: '/bin/bash',
        });
        return `stdout:\n${stdout}\nexitCode: 0`;
      } catch (e: any) {
        const stdout = e.stdout || '';
        const stderr = e.stderr || '';
        const code = e.status ?? 1;
        return `stdout:\n${stdout}\nstderr:\n${stderr}\nexitCode: ${code}`;
      }
    },
  }),
];
```

- [ ] **Step 4: Implement git tools**

Create `cube-agent/src/tools/git.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { execSync } from 'child_process';

export const gitTools = [
  betaZodTool({
    name: 'git',
    description: 'Execute a git command and return the output',
    inputSchema: z.object({
      args: z.string().describe('Git arguments (e.g. "status", "add .", "commit -m msg")'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    run: async ({ args, cwd }) => {
      try {
        const stdout = execSync(`git ${args}`, {
          cwd,
          encoding: 'utf-8',
          timeout: 60_000,
        });
        return `stdout:\n${stdout}\nexitCode: 0`;
      } catch (e: any) {
        const stdout = e.stdout || '';
        const stderr = e.stderr || '';
        const code = e.status ?? 1;
        return `stdout:\n${stdout}\nstderr:\n${stderr}\nexitCode: ${code}`;
      }
    },
  }),
];
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/tools/shell.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd cube-agent
git add src/tools/shell.ts src/tools/git.ts tests/tools/shell.test.ts
git commit -m "feat: implement shell and git tools"
```

---

### Task 5: Implement CUBE engine tools

**Files:**
- Create: `cube-agent/src/tools/cube-engine.ts`
- Test: `cube-agent/tests/tools/cube-engine.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/tools/cube-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createCubeEngineTools } from '../../src/tools/cube-engine.js';

describe('createCubeEngineTools', () => {
  it('should create tools with correct names', () => {
    const tools = createCubeEngineTools('/fake/engine/path', '/fake/project');
    const names = tools.map((t) => t.name);
    expect(names).toContain('cube_check');
    expect(names).toContain('cube_advance');
    expect(names).toContain('cube_lock');
    expect(names).toContain('cube_unlock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/tools/cube-engine.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement CUBE engine tools**

Create `cube-agent/src/tools/cube-engine.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { execSync } from 'child_process';
import { join } from 'path';

export function createCubeEngineTools(engineBinDir: string, projectRoot: string) {
  function runEngine(script: string, args: string = ''): string {
    const cmd = `node ${join(engineBinDir, script)} ${args}`.trim();
    try {
      const stdout = execSync(cmd, {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 60_000,
      });
      return stdout;
    } catch (e: any) {
      return `Error: ${e.stderr || e.message}\nexitCode: ${e.status ?? 1}`;
    }
  }

  return [
    betaZodTool({
      name: 'cube_check',
      description: 'Check deliverables for current or specified stage',
      inputSchema: z.object({
        stageId: z.string().optional().describe('Stage ID (e.g. "01-prd"). Omit for current stage.'),
      }),
      run: async ({ stageId }) => runEngine('cube-check', stageId || ''),
    }),

    betaZodTool({
      name: 'cube_advance',
      description: 'Advance to the next stage after current stage passes verification',
      inputSchema: z.object({}),
      run: async () => runEngine('cube-advance'),
    }),

    betaZodTool({
      name: 'cube_lock',
      description: 'Lock test directory to prevent modifications',
      inputSchema: z.object({}),
      run: async () => runEngine('cube-lock'),
    }),

    betaZodTool({
      name: 'cube_unlock',
      description: 'Temporarily unlock test directory for modifications',
      inputSchema: z.object({
        reason: z.string().describe('Reason for unlocking'),
      }),
      run: async ({ reason }) => runEngine('cube-unlock', `"${reason}"`),
    }),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/tools/cube-engine.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/tools/cube-engine.ts tests/tools/cube-engine.test.ts
git commit -m "feat: implement CUBE engine tools"
```

---

### Task 6: Implement user interaction tool

**Files:**
- Create: `cube-agent/src/tools/user-interaction.ts`
- Test: `cube-agent/tests/tools/user-interaction.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/tools/user-interaction.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createUserInteractionTool, type UserInterface } from '../../src/tools/user-interaction.js';

describe('createUserInteractionTool', () => {
  it('should call UserInterface.ask and return response', async () => {
    const mockUI: UserInterface = {
      ask: vi.fn().mockResolvedValue('user answer'),
      confirm: vi.fn().mockResolvedValue(true),
      display: vi.fn(),
      progress: vi.fn(),
    };
    const tool = createUserInteractionTool(mockUI);
    const result = await tool.run({ question: 'What do you think?' });
    expect(result).toBe('user answer');
    expect(mockUI.ask).toHaveBeenCalledWith('What do you think?', undefined);
  });

  it('should pass options to UserInterface.ask', async () => {
    const mockUI: UserInterface = {
      ask: vi.fn().mockResolvedValue('option A'),
      confirm: vi.fn(),
      display: vi.fn(),
      progress: vi.fn(),
    };
    const tool = createUserInteractionTool(mockUI);
    await tool.run({ question: 'Pick one', options: ['A', 'B'] });
    expect(mockUI.ask).toHaveBeenCalledWith('Pick one', ['A', 'B']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/tools/user-interaction.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement user interaction tool and interface**

Create `cube-agent/src/tools/user-interaction.ts`:

```typescript
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import * as readline from 'readline';

export interface UserInterface {
  ask(question: string, options?: string[]): Promise<string>;
  confirm(message: string): Promise<boolean>;
  display(message: string): void;
  progress(stage: string, percent: number): void;
}

export class CliInterface implements UserInterface {
  async ask(question: string, options?: string[]): Promise<string> {
    if (options?.length) {
      this.display(`\n${question}`);
      options.forEach((opt, i) => this.display(`  ${i + 1}. ${opt}`));
      const answer = await this.prompt('Your choice: ');
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) return options[idx];
      return answer;
    }
    return this.prompt(`\n${question}\n> `);
  }

  async confirm(message: string): Promise<boolean> {
    const answer = await this.prompt(`${message} (y/n): `);
    return answer.toLowerCase().startsWith('y');
  }

  display(message: string): void {
    console.log(message);
  }

  progress(stage: string, percent: number): void {
    process.stdout.write(`\r[${stage}] ${percent}%`);
  }

  private prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}

export function createUserInteractionTool(ui: UserInterface) {
  return betaZodTool({
    name: 'ask_user',
    description: 'Ask the user a question and wait for their response',
    inputSchema: z.object({
      question: z.string().describe('The question to ask the user'),
      options: z.array(z.string()).optional().describe('Optional multiple-choice options'),
    }),
    run: async ({ question, options }) => {
      return ui.ask(question, options);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/tools/user-interaction.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/tools/user-interaction.ts tests/tools/user-interaction.test.ts
git commit -m "feat: implement user interaction tool with CLI interface"
```

---

## Phase 3: Prompt Loader & Base Agent

### Task 7: Implement prompt loader

**Files:**
- Create: `cube-agent/src/prompts/loader.ts`
- Test: `cube-agent/tests/prompts/loader.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/prompts/loader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadStagePrompt, loadRules, loadStandards } from '../../src/prompts/loader.js';

describe('loadStagePrompt', () => {
  let pluginDir: string;

  beforeEach(() => {
    pluginDir = mkdtempSync(join(tmpdir(), 'cube-plugin-'));
    mkdirSync(join(pluginDir, 'prompts'), { recursive: true });
    writeFileSync(join(pluginDir, 'prompts', '01-prd.md'), '# PRD Prompt\nDo PRD stuff.');
  });

  afterEach(() => {
    rmSync(pluginDir, { recursive: true, force: true });
  });

  it('should load prompt file for a stage', () => {
    const prompt = loadStagePrompt(pluginDir, '01-prd');
    expect(prompt).toContain('PRD Prompt');
    expect(prompt).toContain('Do PRD stuff');
  });

  it('should throw for unknown stage', () => {
    expect(() => loadStagePrompt(pluginDir, '99-fake' as any)).toThrow();
  });
});

describe('loadRules', () => {
  let pluginDir: string;

  beforeEach(() => {
    pluginDir = mkdtempSync(join(tmpdir(), 'cube-plugin-'));
    mkdirSync(join(pluginDir, 'presets', 'java', 'rules'), { recursive: true });
    writeFileSync(join(pluginDir, 'presets', 'java', 'rules', 'coding-style.md'), '# Style\nUse 4 spaces.');
    writeFileSync(join(pluginDir, 'presets', 'java', 'rules', 'testing.md'), '# Testing\nUse JUnit 5.');
  });

  afterEach(() => {
    rmSync(pluginDir, { recursive: true, force: true });
  });

  it('should load all rule files for a language', () => {
    const rules = loadRules(pluginDir, 'java');
    expect(rules).toContain('Style');
    expect(rules).toContain('Testing');
  });
});

describe('loadStandards', () => {
  let pluginDir: string;

  beforeEach(() => {
    pluginDir = mkdtempSync(join(tmpdir(), 'cube-plugin-'));
    mkdirSync(join(pluginDir, 'standards'), { recursive: true });
    writeFileSync(join(pluginDir, 'standards', 'tdd-principles.md'), '# TDD\nRed Green Refactor.');
  });

  afterEach(() => {
    rmSync(pluginDir, { recursive: true, force: true });
  });

  it('should load all standard files', () => {
    const standards = loadStandards(pluginDir);
    expect(standards).toContain('TDD');
    expect(standards).toContain('Red Green Refactor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/prompts/loader.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement prompt loader**

Create `cube-agent/src/prompts/loader.ts`:

```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { StageId } from '../types/config.js';

const STAGE_PROMPT_MAP: Record<StageId, string> = {
  '01-prd': '01-prd.md',
  '02-design': '02-design.md',
  '03-test-cases': '03-test-cases.md',
  '04-development': '04-development.md',
  '05-testing': '05-testing.md',
};

export function loadStagePrompt(pluginDir: string, stage: StageId): string {
  const filename = STAGE_PROMPT_MAP[stage];
  if (!filename) throw new Error(`Unknown stage: ${stage}`);
  const filepath = join(pluginDir, 'prompts', filename);
  if (!existsSync(filepath)) throw new Error(`Prompt file not found: ${filepath}`);
  return readFileSync(filepath, 'utf-8');
}

export function loadRules(pluginDir: string, language: string): string {
  const rulesDir = join(pluginDir, 'presets', language, 'rules');
  if (!existsSync(rulesDir)) return '';
  return readdirSync(rulesDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join(rulesDir, f), 'utf-8'))
    .join('\n\n---\n\n');
}

export function loadStandards(pluginDir: string): string {
  const standardsDir = join(pluginDir, 'standards');
  if (!existsSync(standardsDir)) return '';
  return readdirSync(standardsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join(standardsDir, f), 'utf-8'))
    .join('\n\n---\n\n');
}

export function buildSystemPrompt(
  pluginDir: string,
  stage: StageId,
  language: string,
  projectDocs: string,
): string {
  const stagePrompt = loadStagePrompt(pluginDir, stage);
  const rules = loadRules(pluginDir, language);
  const standards = loadStandards(pluginDir);

  return [
    stagePrompt,
    rules ? `\n\n# Language Rules\n\n${rules}` : '',
    standards ? `\n\n# Standards\n\n${standards}` : '',
    projectDocs ? `\n\n# Project Context\n\n${projectDocs}` : '',
  ].join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/prompts/loader.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/prompts/loader.ts tests/prompts/loader.test.ts
git commit -m "feat: implement prompt loader for stage prompts, rules, and standards"
```

---

### Task 8: Implement base agent

**Files:**
- Create: `cube-agent/src/agents/base-agent.ts`
- Test: `cube-agent/tests/agents/base-agent.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/agents/base-agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../../src/agents/base-agent.js';

describe('BaseAgent', () => {
  it('should store name and system prompt', () => {
    const agent = new BaseAgent({
      name: 'test-agent',
      systemPrompt: 'You are a test agent.',
      model: 'claude-sonnet-4-5-20250929',
      tools: [],
      maxTokens: 4096,
    });
    expect(agent.name).toBe('test-agent');
  });

  it('should build tools array', () => {
    const agent = new BaseAgent({
      name: 'test-agent',
      systemPrompt: 'You are a test agent.',
      model: 'claude-sonnet-4-5-20250929',
      tools: [],
      maxTokens: 4096,
    });
    expect(agent.getTools()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/agents/base-agent.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement base agent**

Create `cube-agent/src/agents/base-agent.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/resources/beta/messages/messages';

export interface BaseAgentConfig {
  name: string;
  systemPrompt: string;
  model: string;
  tools: BetaRunnableTool<any>[];
  maxTokens: number;
  maxIterations?: number;
}

export class BaseAgent {
  readonly name: string;
  private config: BaseAgentConfig;
  private client: Anthropic;

  constructor(config: BaseAgentConfig) {
    this.name = config.name;
    this.config = config;
    this.client = new Anthropic();
  }

  getTools(): BetaRunnableTool<any>[] {
    return this.config.tools;
  }

  async run(userMessage: string): Promise<string> {
    const finalMessage = await this.client.beta.messages.toolRunner({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      max_iterations: this.config.maxIterations ?? 50,
      system: this.config.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools: this.config.tools,
    });

    const textBlocks = finalMessage.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    return textBlocks.map((b) => b.text).join('\n');
  }

  async runInteractive(
    initialMessage: string,
    onAssistantMessage: (text: string) => void,
  ): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: initialMessage },
    ];

    let lastResponse = '';

    while (true) {
      const response = await this.client.beta.messages.toolRunner({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        max_iterations: this.config.maxIterations ?? 50,
        system: this.config.systemPrompt,
        messages,
        tools: this.config.tools,
      });

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      lastResponse = textBlocks.map((b) => b.text).join('\n');

      if (response.stop_reason === 'end_turn') {
        onAssistantMessage(lastResponse);
        break;
      }

      onAssistantMessage(lastResponse);
      messages.push({ role: 'assistant', content: response.content });
    }

    return lastResponse;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/agents/base-agent.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/agents/base-agent.ts tests/agents/base-agent.test.ts
git commit -m "feat: implement base agent with toolRunner"
```

---

## Phase 4: DAG Scheduler

### Task 9: Implement DAG scheduler

**Files:**
- Create: `cube-agent/src/dag-scheduler.ts`
- Test: `cube-agent/tests/dag-scheduler.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/dag-scheduler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DagScheduler } from '../src/dag-scheduler.js';
import type { TaskDag, DagTask } from '../src/types/dag.js';

function makeDag(tasks: Partial<DagTask>[]): TaskDag {
  return {
    tasks: tasks.map((t, i) => ({
      id: t.id ?? `task-${i + 1}`,
      name: t.name ?? `Task ${i + 1}`,
      dependsOn: t.dependsOn ?? [],
      testFiles: t.testFiles ?? [],
      status: t.status ?? 'pending',
    })),
  };
}

describe('DagScheduler', () => {
  it('should return tasks with no dependencies first', () => {
    const dag = makeDag([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    const scheduler = new DagScheduler(dag, 2);
    const ready = scheduler.getReadyTasks();
    expect(ready.map((t) => t.id)).toEqual(['a']);
  });

  it('should return multiple independent tasks', () => {
    const dag = makeDag([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'c', dependsOn: ['a', 'b'] },
    ]);
    const scheduler = new DagScheduler(dag, 2);
    const ready = scheduler.getReadyTasks();
    expect(ready.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('should respect max concurrency', () => {
    const dag = makeDag([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: [] },
      { id: 'c', dependsOn: [] },
    ]);
    const scheduler = new DagScheduler(dag, 2);
    const ready = scheduler.getReadyTasks();
    expect(ready).toHaveLength(2);
  });

  it('should unblock dependent tasks after completion', () => {
    const dag = makeDag([
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    const scheduler = new DagScheduler(dag, 2);
    scheduler.markRunning('a');
    scheduler.markDone('a');
    const ready = scheduler.getReadyTasks();
    expect(ready.map((t) => t.id)).toEqual(['b']);
  });

  it('should detect cycles', () => {
    const dag = makeDag([
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ]);
    expect(() => new DagScheduler(dag, 2)).toThrow(/cycle/i);
  });

  it('should report isComplete when all tasks done', () => {
    const dag = makeDag([{ id: 'a', dependsOn: [] }]);
    const scheduler = new DagScheduler(dag, 2);
    expect(scheduler.isComplete()).toBe(false);
    scheduler.markRunning('a');
    scheduler.markDone('a');
    expect(scheduler.isComplete()).toBe(true);
  });

  it('should track failed tasks', () => {
    const dag = makeDag([{ id: 'a', dependsOn: [] }]);
    const scheduler = new DagScheduler(dag, 2);
    scheduler.markRunning('a');
    scheduler.markFailed('a');
    expect(scheduler.hasFailed()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/dag-scheduler.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement DAG scheduler**

Create `cube-agent/src/dag-scheduler.ts`:

```typescript
import type { TaskDag, DagTask } from './types/dag.js';

export class DagScheduler {
  private tasks: Map<string, DagTask>;
  private maxConcurrency: number;
  private runningCount = 0;

  constructor(dag: TaskDag, maxConcurrency: number) {
    this.tasks = new Map(dag.tasks.map((t) => [t.id, { ...t }]));
    this.maxConcurrency = maxConcurrency;
    this.validateNoCycles();
  }

  getReadyTasks(): DagTask[] {
    const available = this.maxConcurrency - this.runningCount;
    if (available <= 0) return [];

    const ready: DagTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending') continue;
      const depsComplete = task.dependsOn.every((dep) => {
        const depTask = this.tasks.get(dep);
        return depTask?.status === 'done';
      });
      if (depsComplete) ready.push(task);
      if (ready.length >= available) break;
    }
    return ready;
  }

  markRunning(id: string): void {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    task.status = 'running';
    this.runningCount++;
  }

  markDone(id: string): void {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    task.status = 'done';
    this.runningCount--;
  }

  markFailed(id: string): void {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    task.status = 'failed';
    this.runningCount--;
  }

  isComplete(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status !== 'done' && task.status !== 'failed') return false;
    }
    return true;
  }

  hasFailed(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status === 'failed') return true;
    }
    return false;
  }

  getTask(id: string): DagTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): DagTask[] {
    return Array.from(this.tasks.values());
  }

  private validateNoCycles(): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): void => {
      if (stack.has(id)) throw new Error(`Cycle detected involving task: ${id}`);
      if (visited.has(id)) return;
      stack.add(id);
      const task = this.tasks.get(id);
      if (task) {
        for (const dep of task.dependsOn) dfs(dep);
      }
      stack.delete(id);
      visited.add(id);
    };

    for (const id of this.tasks.keys()) dfs(id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/dag-scheduler.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/dag-scheduler.ts tests/dag-scheduler.test.ts
git commit -m "feat: implement DAG scheduler with cycle detection and concurrency control"
```

---

## Phase 5: Stage Agents

### Task 10: Implement PRD and Design agents

**Files:**
- Create: `cube-agent/src/agents/prd-agent.ts`
- Create: `cube-agent/src/agents/design-agent.ts`

- [ ] **Step 1: Implement PRD agent**

Create `cube-agent/src/agents/prd-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { buildSystemPrompt } from '../prompts/loader.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import { createUserInteractionTool, type UserInterface } from '../tools/user-interaction.js';
import type { AgentContext } from '../types/agent.js';

export function createPrdAgent(ctx: AgentContext, ui: UserInterface): BaseAgent {
  const systemPrompt = buildSystemPrompt(ctx.cubePluginDir, '01-prd', 'java', '');

  const tools = [
    ...filesystemTools,
    ...shellTools,
    ...gitTools,
    createUserInteractionTool(ui),
  ];

  return new BaseAgent({
    name: 'prd-agent',
    systemPrompt,
    model: ctx.config.model,
    tools,
    maxTokens: 8192,
  });
}
```

- [ ] **Step 2: Implement Design agent**

Create `cube-agent/src/agents/design-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { buildSystemPrompt } from '../prompts/loader.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import { createUserInteractionTool, type UserInterface } from '../tools/user-interaction.js';
import type { AgentContext } from '../types/agent.js';

export function createDesignAgent(ctx: AgentContext, ui: UserInterface): BaseAgent {
  const systemPrompt = buildSystemPrompt(ctx.cubePluginDir, '02-design', 'java', '');

  const tools = [
    ...filesystemTools,
    ...shellTools,
    ...gitTools,
    createUserInteractionTool(ui),
  ];

  return new BaseAgent({
    name: 'design-agent',
    systemPrompt,
    model: ctx.config.model,
    tools,
    maxTokens: 8192,
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd cube-agent
git add src/agents/prd-agent.ts src/agents/design-agent.ts
git commit -m "feat: implement PRD and Design agents with interactive support"
```

---

### Task 11: Implement TestCase, TDD, and Testing agents

**Files:**
- Create: `cube-agent/src/agents/testcase-agent.ts`
- Create: `cube-agent/src/agents/tdd-agent.ts`
- Create: `cube-agent/src/agents/testing-agent.ts`

- [ ] **Step 1: Implement TestCase agent**

Create `cube-agent/src/agents/testcase-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { buildSystemPrompt } from '../prompts/loader.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import { createCubeEngineTools } from '../tools/cube-engine.js';
import type { AgentContext } from '../types/agent.js';

export function createTestCaseAgent(ctx: AgentContext): BaseAgent {
  const dagInstruction = `
After writing all test cases, you MUST also produce a task-dag.yaml file at
${ctx.iterationDir}/task-dag.yaml with the following structure:

\`\`\`yaml
tasks:
  - id: task-001
    name: "description of task"
    depends_on: []
    test_files:
      - path/to/TestFile.java
    status: pending
\`\`\`

Analyze dependencies between tasks: if task B's implementation depends on task A's
classes/interfaces, add task A's id to task B's depends_on list.
`;

  const systemPrompt = buildSystemPrompt(ctx.cubePluginDir, '03-test-cases', 'java', dagInstruction);
  const engineTools = createCubeEngineTools(`${ctx.cubePluginDir}/bin`, ctx.projectRoot);

  return new BaseAgent({
    name: 'testcase-agent',
    systemPrompt,
    model: ctx.config.model,
    tools: [...filesystemTools, ...shellTools, ...gitTools, ...engineTools],
    maxTokens: 8192,
  });
}
```

- [ ] **Step 2: Implement TDD agent**

Create `cube-agent/src/agents/tdd-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import type { DagTask } from '../types/dag.js';

export function createTddAgent(
  task: DagTask,
  model: string,
  projectRoot: string,
  iterationDir: string,
): BaseAgent {
  const systemPrompt = `You are a TDD developer. Your job is to implement code that makes the
existing test(s) pass for one specific task.

## Your Task
- Task ID: ${task.id}
- Task Name: ${task.name}
- Test files: ${task.testFiles.join(', ')}

## Process
1. Read the test file(s) to understand what is expected.
2. Write the minimal implementation code to make the tests pass.
3. Run the tests. If they fail, read the error, fix the code, and re-run.
4. Once tests pass, commit the implementation.
5. Update the task status in ${iterationDir}/task-dag.yaml: set status to "done" for task ${task.id}.

## Rules
- NEVER modify test files — they are locked.
- NEVER modify test resource files — they are locked.
- Only write implementation code in the source directory.
- Commit after tests pass with message: "feat: implement ${task.name}"
`;

  return new BaseAgent({
    name: `tdd-agent-${task.id}`,
    systemPrompt,
    model,
    tools: [...filesystemTools, ...shellTools, ...gitTools],
    maxTokens: 8192,
    maxIterations: 30,
  });
}
```

- [ ] **Step 3: Implement Testing agent**

Create `cube-agent/src/agents/testing-agent.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { buildSystemPrompt } from '../prompts/loader.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import { createCubeEngineTools } from '../tools/cube-engine.js';
import type { AgentContext } from '../types/agent.js';

export function createTestingAgent(ctx: AgentContext): BaseAgent {
  const systemPrompt = buildSystemPrompt(ctx.cubePluginDir, '05-testing', 'java', '');
  const engineTools = createCubeEngineTools(`${ctx.cubePluginDir}/bin`, ctx.projectRoot);

  return new BaseAgent({
    name: 'testing-agent',
    systemPrompt,
    model: ctx.config.model,
    tools: [...filesystemTools, ...shellTools, ...gitTools, ...engineTools],
    maxTokens: 8192,
  });
}
```

- [ ] **Step 4: Commit**

```bash
cd cube-agent
git add src/agents/testcase-agent.ts src/agents/tdd-agent.ts src/agents/testing-agent.ts
git commit -m "feat: implement TestCase, TDD, and Testing agents"
```

---

## Phase 6: Review Agents

### Task 12: Implement Stage Reviewer

**Files:**
- Create: `cube-agent/src/agents/stage-reviewer.ts`
- Test: `cube-agent/tests/agents/stage-reviewer.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/agents/stage-reviewer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getStageChecklist } from '../../src/agents/stage-reviewer.js';

describe('getStageChecklist', () => {
  it('should return checklist for 01-prd', () => {
    const checklist = getStageChecklist('01-prd');
    expect(checklist.some((c) => c.includes('FR-'))).toBe(true);
    expect(checklist.length).toBeGreaterThan(0);
  });

  it('should return checklist for 03-test-cases with test resource check', () => {
    const checklist = getStageChecklist('03-test-cases');
    expect(checklist.some((c) => c.includes('测试资源文件'))).toBe(true);
  });

  it('should return checklist for 04-development with resource lock check', () => {
    const checklist = getStageChecklist('04-development');
    expect(checklist.some((c) => c.includes('测试资源文件') && c.includes('未被修改'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/agents/stage-reviewer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Stage Reviewer**

Create `cube-agent/src/agents/stage-reviewer.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';
import type { StageId } from '../types/config.js';

const STAGE_CHECKLISTS: Record<StageId, string[]> = {
  '01-prd': [
    '功能点是否有编号（FR-xxx）',
    '每个功能点是否有输入/输出/异常处理',
    '非功能需求是否与功能相关',
    '是否存在歧义或 TBD',
  ],
  '02-design': [
    '是否覆盖 PRD 全部功能点（FR 编号交叉比对）',
    '接口定义是否完整（入参/出参/异常码）',
    '表设计是否与接口匹配',
    '是否遵循架构规范',
  ],
  '03-test-cases': [
    '每个 FR 是否有对应测试',
    '是否包含边界用例和异常场景',
    '测试能否编译通过',
    'DAG 依赖关系是否有环',
    '测试资源文件是否已生成',
  ],
  '04-development': [
    '该 task 测试是否全部通过',
    '代码是否与 design 中的接口定义一致',
    '无硬编码/无调试代码',
    '测试资源文件自 Stage 03 锁定后未被修改（git diff 校验）',
  ],
  '05-testing': [
    '全量测试通过',
    '覆盖率达标',
    '无跳过的测试用例',
    '测试资源文件完整性校验',
  ],
};

export function getStageChecklist(stage: StageId): string[] {
  return STAGE_CHECKLISTS[stage] ?? [];
}

export function createStageReviewer(
  stage: StageId,
  model: string,
  iterationDir: string,
  projectRoot: string,
): BaseAgent {
  const checklist = getStageChecklist(stage);
  const checklistText = checklist.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const systemPrompt = `You are a stage reviewer. Your job is to verify the deliverables for stage ${stage}.

## Review Checklist
${checklistText}

## Process
1. Read all deliverables for this stage from ${iterationDir}/
2. Read project context from .cube/config/ if needed
3. Check each item in the checklist
4. For 04-development: run "git diff" to verify test resource files were not modified after lock
5. Write the review report to ${iterationDir}/reviews/${stage}-review.md

## Report Format
Write the review in this exact format:

# Stage Review: ${stage} (Round N)
Date: YYYY-MM-DD
Reviewer: stage-reviewer

## Result: PASS or FAIL

## Issues
1. [SEVERITY] Description

## Checklist
- [x] or - [ ] for each item

## Skills Used
- list any skills discovered and used

Return ONLY "PASS" or "FAIL" as your final message after writing the report.
`;

  return new BaseAgent({
    name: `stage-reviewer-${stage}`,
    systemPrompt,
    model,
    tools: [...filesystemTools, ...shellTools, ...gitTools],
    maxTokens: 4096,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/agents/stage-reviewer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/agents/stage-reviewer.ts tests/agents/stage-reviewer.test.ts
git commit -m "feat: implement stage reviewer with per-stage checklists"
```

---

### Task 13: Implement Final Reviewer

**Files:**
- Create: `cube-agent/src/agents/final-reviewer.ts`

- [ ] **Step 1: Implement Final Reviewer**

Create `cube-agent/src/agents/final-reviewer.ts`:

```typescript
import { BaseAgent } from './base-agent.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';
import { gitTools } from '../tools/git.js';

export function createFinalReviewer(
  model: string,
  iterationDir: string,
  projectRoot: string,
): BaseAgent {
  const systemPrompt = `You are the final reviewer. Your job is to perform a comprehensive
cross-stage validation of all deliverables after the full workflow completes.

## Input Files
- PRD: ${iterationDir}/prd.md
- Design: ${iterationDir}/design.md
- Task DAG: ${iterationDir}/task-dag.yaml
- Stage reviews: ${iterationDir}/reviews/
- Source code: read from project source directory
- Test code: read from project test directory

## Process

1. Build a scenario matrix mapping:
   PRD functional requirement -> Design interface -> Test cases -> Implementation code

2. For each row, verify:
   - Requirement coverage: the FR has a design, test(s), and implementation
   - Consistency: interface signatures, field names, error codes match across stages
   - Completeness: no design without implementation, no test without requirement

3. Security check: review implementation for common vulnerabilities

4. Test resource integrity: verify test resource files match their locked state (git diff)

5. Write the final review report to ${iterationDir}/reviews/final-review.md

## Report Format

# Final Review
Date: YYYY-MM-DD
Reviewer: final-reviewer

## Result: PASS or FAIL

## Scenario Matrix
| FR ID | Design | Tests | Code | Status |
|-------|--------|-------|------|--------|

## Cross-Stage Issues
1. [SEVERITY] Description — affects stage XX

## Security Issues
(list or "none found")

## Test Resource Integrity
PASS or FAIL with details

Return "PASS" or "FAIL:stage-id" as your final message.
"FAIL:03-test-cases" means the fix should happen in stage 03.
`;

  return new BaseAgent({
    name: 'final-reviewer',
    systemPrompt,
    model,
    tools: [...filesystemTools, ...shellTools, ...gitTools],
    maxTokens: 8192,
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd cube-agent
git add src/agents/final-reviewer.ts
git commit -m "feat: implement final reviewer with scenario matrix"
```

---

## Phase 7: Orchestrator

### Task 14: Implement Orchestrator

**Files:**
- Create: `cube-agent/src/orchestrator.ts`
- Test: `cube-agent/tests/orchestrator.test.ts`

- [ ] **Step 1: Write failing test**

Create `cube-agent/tests/orchestrator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { determineInteractionMode, resolveStartStage } from '../src/orchestrator.js';

describe('determineInteractionMode', () => {
  it('should return auto if skipInterview and doc provided', () => {
    const mode = determineInteractionMode(true, '/path/to/doc.md');
    expect(mode).toBe('auto');
  });

  it('should return interactive if no doc provided', () => {
    const mode = determineInteractionMode(false, undefined);
    expect(mode).toBe('interactive');
  });

  it('should return interactive if doc provided but no skip', () => {
    const mode = determineInteractionMode(false, '/path/to/doc.md');
    expect(mode).toBe('interactive');
  });
});

describe('resolveStartStage', () => {
  it('should return startFrom if specified', () => {
    const stage = resolveStartStage('03-test-cases', undefined);
    expect(stage).toBe('03-test-cases');
  });

  it('should return current stage from state if no startFrom', () => {
    const stage = resolveStartStage(undefined, '02-design');
    expect(stage).toBe('02-design');
  });

  it('should default to 01-prd', () => {
    const stage = resolveStartStage(undefined, undefined);
    expect(stage).toBe('01-prd');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cube-agent && npx vitest run tests/orchestrator.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Orchestrator**

Create `cube-agent/src/orchestrator.ts`:

```typescript
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { load as loadYaml } from 'js-yaml';
import type { CubeAgentConfig, StageId } from './types/config.js';
import type { AgentContext, AgentMode } from './types/agent.js';
import type { TaskDag } from './types/dag.js';
import { STAGE_ORDER } from './types/config.js';
import { DagScheduler } from './dag-scheduler.js';
import { createPrdAgent } from './agents/prd-agent.js';
import { createDesignAgent } from './agents/design-agent.js';
import { createTestCaseAgent } from './agents/testcase-agent.js';
import { createTddAgent } from './agents/tdd-agent.js';
import { createTestingAgent } from './agents/testing-agent.js';
import { createStageReviewer } from './agents/stage-reviewer.js';
import { createFinalReviewer } from './agents/final-reviewer.js';
import { CliInterface, type UserInterface } from './tools/user-interaction.js';

export function determineInteractionMode(
  skipInterview: boolean,
  doc: string | undefined,
): AgentMode {
  if (skipInterview && doc) return 'auto';
  return 'interactive';
}

export function resolveStartStage(
  startFrom: StageId | undefined,
  currentStage: StageId | undefined,
): StageId {
  return startFrom ?? currentStage ?? '01-prd';
}

export class Orchestrator {
  private config: CubeAgentConfig;
  private ui: UserInterface;
  private projectRoot: string;
  private iterationDir: string = '';
  private cubePluginDir: string;

  constructor(config: CubeAgentConfig) {
    this.config = config;
    this.projectRoot = config.project;
    this.ui = new CliInterface();
    this.cubePluginDir = this.findCubePlugin();
  }

  async run(): Promise<void> {
    this.ui.display('=== CUBE Agent Starting ===');

    if (!this.hasCubeConfig()) {
      this.ui.display('No .cube/ found. Running init...');
      await this.runInit();
    }

    const branch = this.setupBranch();
    this.iterationDir = this.getIterationDir(branch);

    const currentStage = this.loadCurrentStage();
    const startStage = resolveStartStage(this.config.startFrom, currentStage);
    const startIndex = STAGE_ORDER.indexOf(startStage);

    for (let i = startIndex; i < STAGE_ORDER.length; i++) {
      const stage = STAGE_ORDER[i];
      this.ui.display(`\n--- Stage: ${stage} ---`);

      if (stage === '04-development') {
        await this.runTddExecutor();
      } else {
        await this.runStageAgent(stage);
      }

      await this.runStageReview(stage);
      this.runCubeAdvance();
    }

    await this.runFinalReview();
    this.ui.display('\n=== CUBE Agent Complete ===');
  }

  private async runStageAgent(stage: StageId): Promise<void> {
    const ctx = this.buildContext(stage);
    const input = this.buildInput(stage);

    let agent;
    switch (stage) {
      case '01-prd':
        agent = createPrdAgent(ctx, this.ui);
        break;
      case '02-design':
        agent = createDesignAgent(ctx, this.ui);
        break;
      case '03-test-cases':
        agent = createTestCaseAgent(ctx);
        break;
      case '05-testing':
        agent = createTestingAgent(ctx);
        break;
      default:
        throw new Error(`No agent for stage: ${stage}`);
    }

    const mode = (stage === '01-prd' || stage === '02-design')
      ? determineInteractionMode(this.config.skipInterview, this.config.doc)
      : 'auto';

    if (mode === 'interactive') {
      await agent.runInteractive(input, (text) => this.ui.display(text));
    } else {
      const result = await agent.run(input);
      this.ui.display(result);
    }
  }

  private async runTddExecutor(): Promise<void> {
    const dagPath = join(this.iterationDir, 'task-dag.yaml');
    if (!existsSync(dagPath)) throw new Error('task-dag.yaml not found');

    const dagContent = readFileSync(dagPath, 'utf-8');
    const dag = loadYaml(dagContent) as TaskDag;
    const scheduler = new DagScheduler(dag, this.config.concurrency);

    while (!scheduler.isComplete()) {
      const readyTasks = scheduler.getReadyTasks();
      if (readyTasks.length === 0 && !scheduler.isComplete()) {
        if (scheduler.hasFailed()) {
          this.handleFailure('04-development', 'TDD tasks failed');
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const promises = readyTasks.map(async (task) => {
        scheduler.markRunning(task.id);
        this.ui.display(`  Starting: ${task.name}`);
        try {
          const agent = createTddAgent(task, this.config.model, this.projectRoot, this.iterationDir);
          await agent.run(
            `Implement task ${task.id}: ${task.name}. Test files: ${task.testFiles.join(', ')}. Project root: ${this.projectRoot}`,
          );
          scheduler.markDone(task.id);
          this.ui.display(`  Done: ${task.name}`);
        } catch (e: any) {
          scheduler.markFailed(task.id);
          this.ui.display(`  Failed: ${task.name} — ${e.message}`);
        }
      });

      await Promise.race(promises);
    }
  }

  private async runStageReview(stage: StageId): Promise<void> {
    const reviewConfig = this.config.review ?? { stageReview: true, finalReview: true, maxReviewRounds: 3 };
    if (!reviewConfig.stageReview) return;

    for (let round = 1; round <= reviewConfig.maxReviewRounds; round++) {
      this.ui.display(`  Review round ${round}...`);
      const reviewer = createStageReviewer(stage, this.config.model, this.iterationDir, this.projectRoot);
      const result = await reviewer.run(
        `Review stage ${stage} deliverables. Round ${round}. Iteration dir: ${this.iterationDir}. Project root: ${this.projectRoot}.`,
      );

      if (result.trim().toUpperCase() === 'PASS') {
        this.ui.display(`  Review: PASS`);
        return;
      }

      this.ui.display(`  Review: FAIL — re-running stage agent...`);
      if (stage !== '04-development') {
        await this.runStageAgent(stage);
      }
    }

    this.handleFailure(stage, 'Max review rounds exceeded');
  }

  private async runFinalReview(): Promise<void> {
    const reviewConfig = this.config.review ?? { stageReview: true, finalReview: true, maxReviewRounds: 3 };
    if (!reviewConfig.finalReview) return;

    for (let round = 1; round <= reviewConfig.maxReviewRounds; round++) {
      this.ui.display(`\n--- Final Review (Round ${round}) ---`);
      const reviewer = createFinalReviewer(this.config.model, this.iterationDir, this.projectRoot);
      const result = await reviewer.run(
        `Perform final review. Iteration dir: ${this.iterationDir}. Project root: ${this.projectRoot}.`,
      );

      if (result.trim().toUpperCase() === 'PASS') {
        this.ui.display('Final Review: PASS');
        return;
      }

      const failMatch = result.match(/FAIL:(\S+)/);
      if (failMatch) {
        const failStage = failMatch[1] as StageId;
        this.ui.display(`Final Review: FAIL — issue in ${failStage}, regressing...`);
        this.runCubeRegress(failStage);
        await this.runStageAgent(failStage);
        await this.runStageReview(failStage);
        this.runCubeAdvance();
      }
    }

    this.handleFailure('05-testing', 'Final review failed after max rounds');
  }

  private handleFailure(stage: StageId, reason: string): void {
    switch (this.config.onFail) {
      case 'stop':
        throw new Error(`Stage ${stage} failed: ${reason}`);
      case 'skip':
        this.ui.display(`  Skipping: ${reason}`);
        break;
      case 'retry':
      default:
        throw new Error(`Stage ${stage} failed after retries: ${reason}`);
    }
  }

  private buildContext(stage: StageId): AgentContext {
    return {
      config: this.config,
      projectRoot: this.projectRoot,
      iterationDir: this.iterationDir,
      cubePluginDir: this.cubePluginDir,
      stage,
      mode: 'auto',
    };
  }

  private buildInput(stage: StageId): string {
    const parts: string[] = [];
    if (this.config.input) parts.push(`User requirement: ${this.config.input}`);
    if (this.config.doc) parts.push(`Document path: ${this.config.doc}`);
    parts.push(`Project root: ${this.projectRoot}`);
    parts.push(`Iteration dir: ${this.iterationDir}`);
    return parts.join('\n');
  }

  private hasCubeConfig(): boolean {
    return existsSync(join(this.projectRoot, '.cube', 'config', 'workflow.yaml'));
  }

  private async runInit(): Promise<void> {
    execSync('cube-init', { cwd: this.projectRoot, stdio: 'inherit' });
  }

  private setupBranch(): string {
    if (this.config.branch) {
      try {
        execSync(`git checkout -b ${this.config.branch}`, { cwd: this.projectRoot, stdio: 'pipe' });
      } catch {
        execSync(`git checkout ${this.config.branch}`, { cwd: this.projectRoot, stdio: 'pipe' });
      }
      return this.config.branch;
    }
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectRoot, encoding: 'utf-8' }).trim();
  }

  private getIterationDir(branch: string): string {
    const sanitized = branch.replace(/\//g, '-');
    return join(this.projectRoot, '.cube', 'iterations', sanitized);
  }

  private loadCurrentStage(): StageId | undefined {
    const statePath = join(this.iterationDir, 'state.yaml');
    if (!existsSync(statePath)) return undefined;
    const content = readFileSync(statePath, 'utf-8');
    const state = loadYaml(content) as any;
    return state?.current_stage as StageId;
  }

  private runCubeAdvance(): void {
    try {
      execSync('cube-advance', { cwd: this.projectRoot, stdio: 'pipe' });
    } catch (e: any) {
      this.ui.display(`  cube-advance warning: ${e.message}`);
    }
  }

  private runCubeRegress(stage: StageId): void {
    try {
      execSync(`cube-regress ${stage}`, { cwd: this.projectRoot, stdio: 'pipe' });
    } catch (e: any) {
      this.ui.display(`  cube-regress warning: ${e.message}`);
    }
  }

  private findCubePlugin(): string {
    const candidates = [
      join(this.projectRoot, 'plugins', 'cube'),
      join(process.env.HOME || '', '.claude', 'plugins', 'cache', 'wf', 'cube'),
    ];
    for (const dir of candidates) {
      if (existsSync(join(dir, 'prompts'))) return dir;
    }
    throw new Error('CUBE plugin not found. Install via: /plugin marketplace add wangding75/wf');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cube-agent && npx vitest run tests/orchestrator.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd cube-agent
git add src/orchestrator.ts tests/orchestrator.test.ts
git commit -m "feat: implement orchestrator with stage dispatch, DAG execution, and review loop"
```

---

## Phase 8: CLI Entry Point & Finalization

### Task 15: Implement CLI entry point

**Files:**
- Create: `cube-agent/bin/cube-agent.ts`

- [ ] **Step 1: Implement CLI with commander**

Create `cube-agent/bin/cube-agent.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { load as loadYaml } from 'js-yaml';
import { Orchestrator } from '../src/orchestrator.js';
import type { CubeAgentConfig, FailStrategy, StageId } from '../src/types/config.js';

const program = new Command();

program
  .name('cube-agent')
  .description('Standalone CLI agent for CUBE stage-gate workflow')
  .version('0.1.0')
  .argument('[input]', 'Requirement description or prompt')
  .option('--doc <path>', 'Path to requirement document')
  .option('--resume', 'Resume from current state')
  .option('--project <path>', 'Project directory', '.')
  .option('--branch <name>', 'Branch name')
  .option('--model <model>', 'Claude model', 'claude-sonnet-4-5-20250929')
  .option('--on-fail <strategy>', 'Failure strategy: retry|stop|skip', 'retry')
  .option('--max-retry <n>', 'Max review retry rounds', '3')
  .option('--concurrency <n>', 'Max parallel TDD agents', '2')
  .option('--skip-interview', 'Skip interview when doc is provided')
  .option('--start-from <stage>', 'Start from specific stage')
  .option('--verbose', 'Verbose output')
  .action(async (input: string | undefined, options: any) => {
    const projectDir = resolve(options.project);
    const fileConfig = loadFileConfig(projectDir);

    const config: CubeAgentConfig = {
      project: projectDir,
      input,
      doc: options.doc ? resolve(options.doc) : undefined,
      branch: options.branch,
      model: options.model ?? fileConfig.model ?? 'claude-sonnet-4-5-20250929',
      onFail: (options.onFail ?? fileConfig.on_fail ?? 'retry') as FailStrategy,
      maxRetry: parseInt(options.maxRetry ?? fileConfig.max_retry ?? '3', 10),
      concurrency: parseInt(options.concurrency ?? fileConfig.concurrency ?? '2', 10),
      skipInterview: options.skipInterview ?? false,
      startFrom: options.startFrom as StageId | undefined,
      verbose: options.verbose ?? false,
      review: fileConfig.review ?? { stageReview: true, finalReview: true, maxReviewRounds: 3 },
    };

    if (!config.input && !config.doc && !options.resume) {
      console.error('Error: provide a requirement, --doc, or --resume');
      process.exit(1);
    }

    try {
      const orchestrator = new Orchestrator(config);
      await orchestrator.run();
    } catch (e: any) {
      console.error(`\nFatal: ${e.message}`);
      if (config.verbose) console.error(e.stack);
      process.exit(1);
    }
  });

function loadFileConfig(projectDir: string): any {
  const configPath = join(projectDir, 'cube-agent.yaml');
  if (!existsSync(configPath)) return {};
  try {
    return loadYaml(readFileSync(configPath, 'utf-8')) as any;
  } catch {
    return {};
  }
}

program.parse();
```

- [ ] **Step 2: Build and verify CLI help**

```bash
cd cube-agent && npm run build && node dist/bin/cube-agent.js --help
```

Expected: CLI help output showing all options

- [ ] **Step 3: Commit**

```bash
cd cube-agent
git add bin/cube-agent.ts
git commit -m "feat: implement CLI entry point with commander"
```

---

### Task 16: Barrel exports and full build verification

**Files:**
- Create: `cube-agent/src/index.ts`

- [ ] **Step 1: Create barrel export**

Create `cube-agent/src/index.ts`:

```typescript
export { Orchestrator } from './orchestrator.js';
export { DagScheduler } from './dag-scheduler.js';
export { BaseAgent } from './agents/base-agent.js';
export type { CubeAgentConfig, StageId, FailStrategy } from './types/config.js';
export type { TaskDag, DagTask } from './types/dag.js';
export type { UserInterface } from './tools/user-interaction.js';
export { CliInterface } from './tools/user-interaction.js';
```

- [ ] **Step 2: Verify full build**

```bash
cd cube-agent && npm run build
```

Expected: No TypeScript errors

- [ ] **Step 3: Run all tests**

```bash
cd cube-agent && npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Link and verify CLI**

```bash
cd cube-agent && npm link && cube-agent --version
```

Expected: `0.1.0`

- [ ] **Step 5: Final commit**

```bash
cd cube-agent
git add -A
git commit -m "chore: finalize cube-agent v0.1.0"
```
