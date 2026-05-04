---
name: init
description: "Initialize or activate stage-gate development workflow. For new projects: scans code, creates .cube/ structure, generates project-level docs. For existing iterations: shows status and suggests next command."
argument-hint: "[language: java|python]"
allowed-tools: Read Write Bash Glob Grep
---

# /cube:init — Initialize Stage-Gate Workflow

You are the cube workflow initializer. Your job is to set up the `.cube/` directory structure and activate the workflow for the current project and branch.

## Step 1: Detect Mode

Check which scenario applies:

1. Check if `.cube/config/workflow.yaml` exists.
2. If config exists, check if `.cube/iterations/{current-branch}/state.yaml` exists.

Get the current git branch name:
```bash
git rev-parse --abbrev-ref HEAD
```
Sanitize the branch name by replacing `/` with `-` for directory naming (e.g., `feature/auth` → `feature-auth`).

### Scenario A: `.cube/` does not exist → Full Initialization

Proceed to **Step 2** (environment detection), then **Step 3** (config creation), then **Step 4** (code scan), then **Step 5** (iteration creation), then **Step 6** (output).

### Scenario B: `.cube/config/` exists but no iteration for current branch → New Iteration

If current branch is `master` or `main`:
- Inform user: "Project already initialized. Run `/cube:iterate feature/xxx` (Codex: `$iterate feature/xxx`) to start a new iteration."
- Do NOT proceed to Step 5. Stop here.

Otherwise, proceed to **Step 5** (iteration creation), then **Step 6** (output).

### Scenario C: Both config and iteration exist → Activation

Proceed to **Step 7** (show status).

---

## Step 2: Environment Detection (Scenario A only)

Scan the project directory to detect:

### 2a. Language and Build Tool

| File | Language | Build Tool |
|------|----------|-----------|
| `build.gradle` or `build.gradle.kts` | Java | Gradle |
| `pom.xml` | Java | Maven |
| `package.json` | JavaScript/TypeScript | npm/yarn |
| `requirements.txt` or `pyproject.toml` | Python | pip/poetry |

If no build file found, parse `$ARGUMENTS` for language hint or ask the user.

### 2b. Project Structure (single vs multi-module)

For Gradle, read `settings.gradle` or `settings.gradle.kts`:
- Contains `include` statements → **multi-module**
- Only `rootProject.name` → **single-module**

For Maven, read root `pom.xml`:
- Contains `<modules>` section → **multi-module**
- No modules → **single-module**

### 2c. Source Paths

**Single-module:**
```yaml
paths:
  source_dir: src/main/java
  test_dir: src/test/java
  test_resource_dir: src/test/resources
```

**Multi-module:** Parse module names from build file, construct module list:
```yaml
modules:
  - name: module-api
    source_dir: module-api/src/main/java
    test_dir: module-api/src/test/java
    test_resource_dir: module-api/src/test/resources
  - name: module-service
    source_dir: module-service/src/main/java
    test_dir: module-service/src/test/java
    test_resource_dir: module-service/src/test/resources
```

Verify paths actually exist by listing directories. If a standard path doesn't exist, search for actual source directories.

### 2d. Build Commands

| Build Tool | compile_command | test_command | test_command_single |
|-----------|----------------|-------------|-------------------|
| Gradle | `./gradlew compileJava -q` | `./gradlew test -q` | `./gradlew test --tests '{{class}}' -q` |
| Maven | `mvn compile -q` | `mvn test -q` | `mvn test -Dtest={{class}} -q` |
| npm | `npm run build` | `npm test` | `npm test -- {{file}}` |

---

## Step 3: Create Config (Scenario A only)

### 3a. Create directories
```bash
mkdir -p .cube/config
mkdir -p .cube/iterations
```

### 3b. Generate workflow.yaml

Read `plugins/cube/templates/workflow.yaml.tmpl` and replace placeholders:

- `{{project_name}}` → from build file or directory name
- `{{language}}` → detected language
- `{{structure}}` → `single-module` or `multi-module`
- `{{path_config}}` → generated top-level path config block:
  - Single-module: emit a `paths:` mapping with `source_dir`, `test_dir`, and `test_resource_dir`.
  - Multi-module: emit a top-level `modules:` list. Do not nest `modules:` under `paths:`.
- `{{language_config}}` → generated from detected build tool, **flattened** to top-level keys:

```yaml
language_config:
  build_tool: gradle       # or maven, npm
  compile_command: "./gradlew compileJava -q"
  test_command: "./gradlew test -q"
  test_command_single: "./gradlew test --tests '{{class}}' -q"
  test_file_pattern: "*Test.java"
```

| Build Tool | build_tool | compile_command | test_command | test_command_single | test_file_pattern |
|-----------|-----------|----------------|-------------|-------------------|-------------------|
| Gradle | `gradle` | `./gradlew compileJava -q` | `./gradlew test -q` | `./gradlew test --tests '{{class}}' -q` | `*Test.java` |
| Maven | `maven` | `mvn compile -q` | `mvn test -q` | `mvn test -Dtest={{class}} -q` | `*Test.java` |
| npm | `npm` | `npm run build` | `npm test` | `npm test -- {{file}}` | `*.test.js` |

Write to `.cube/config/workflow.yaml`.

### 3c. Install git hooks

Read the pre-commit template from `plugins/cube/templates/pre-commit.tmpl` and write it to `.githooks/pre-commit`:
```bash
mkdir -p .githooks
```
Then:
```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

### 3d. Ensure line ending normalization

Check if `.gitattributes` exists in the project root:
- **Not found**: Create `.gitattributes` with `* text=auto eol=lf` to prevent CRLF issues on WSL/Windows.
- **Found but missing `eol=lf`**: Warn the user that line ending normalization is not configured, suggest adding `* text=auto eol=lf`.

Then run `git add --renormalize .` to normalize existing files (skip if `.gitattributes` was already correct).

### 3e. Set up deny rules

**Claude Code:**
Read `plugins/cube/templates/settings.local.json.tmpl`, **resolve `${paths.test_dir}` and `${paths.test_resource_dir}` to actual directory paths** (e.g., `src/test/java` and `src/test/resources`), then write to `.claude/settings.local.json` (create `.claude/` dir if needed). Do NOT overwrite if it already exists — merge the deny rules instead.

**Codex:**
Codex does not support deny rules. Skip this step. Test file protection relies on the git pre-commit hook (Step 3c) and SKILL.md instruction constraints (2-layer protection).

---

## Step 4: Code Scan and Project-Level Docs (Scenario A only)

Scan the existing codebase to generate project-level documentation in `.cube/config/`.

### 4a. Scan Strategy

1. **Read build file** (build.gradle / pom.xml) → extract dependencies, framework, versions
2. **Read project entry class** (search for `@SpringBootApplication`, `main()` method, etc.) → understand startup
3. **Scan for base classes** → search for `abstract class`, `class Base`, classes extended by many others
4. **Scan public utilities** → classes in `common/`, `util/`, `utils/` packages
5. **Scan configuration files** → `application.yml`, `application.properties`, database config
6. **Scan existing modules/services** → list all Service/Controller/Repository classes
7. **Scan API style** → REST paths, response format patterns

### 4b. Generate system-design.md

Write `.cube/config/system-design.md` with this structure:

```markdown
# {Project Name} — System Design

## Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Java | {detected} |
| Framework | {detected} | {version} |
| Build | {Gradle/Maven} | {version} |
| Database | {detected from config/deps} | {version} |

## Architecture Pattern
{Detected: layered / MVC / DDD / etc., with brief description}

## Layer Structure
{Diagram showing Controller → Service → Repository flow or equivalent}

## Key Base Classes
| Class | Package | Purpose | Subclasses Must |
|-------|---------|---------|----------------|
| {BaseService} | {package} | {purpose} | {what to implement/override} |

## Public Components
| Component | Package | Purpose |
|-----------|---------|---------|
| {Result<T>} | {package} | {unified response wrapper} |

## Configuration
- Config location: {path}
- Profiles: {detected profiles}
- Database: {connection info pattern}
```

### 4c. Generate module-design.md

Write `.cube/config/module-design.md`:

```markdown
# {Project Name} — Module Design

## Module List
| Module | Package | Purpose | Key Classes |
|--------|---------|---------|-------------|
| {user} | {com.xxx.user} | {User management} | {UserService, UserController} |

## Module Dependencies
{Describe which modules call which}

## Data Model
| Entity | Table | Key Fields |
|--------|-------|------------|
| {UserEntity} | {t_user} | {id, name, email, status} |
```

### 4d. Generate api-spec.md

Write `.cube/config/api-spec.md`:

```markdown
# {Project Name} — API Specification

## API Style
{RESTful / RPC, detected from existing controllers}

## Base URL Pattern
{e.g., /api/v1/{module}/{action}}

## Response Format
{Detected from existing code or common response wrapper}

## Error Code Convention
{Detected from existing error handling}

## Authentication
{Detected from security config / filters}
```

### 4e. Generate deployment.md and operations.md

- If `Dockerfile` exists → read it and document in `.cube/config/deployment.md`
- If CI config exists (`.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml`) → document
- If monitoring config exists → document in `.cube/config/operations.md`
- If not found → create minimal template with "TBD" sections

### 4f. Present scan results to user

After generating all docs, show the user a summary:
```
📋 Project scan results:
   Language: Java 21 (Gradle)
   Framework: Spring Boot 3.2
   Architecture: Layered (Controller → Service → Repository)
   Modules: 5 (user, order, payment, notification, common)
   Base classes: BaseService, BaseEntity, BaseController
   Database: MySQL (MyBatis-Plus)
   Tests: 42 test files found
   Dockerfile: Found
   CI: GitHub Actions

   Project-level docs generated in .cube/config/
   Please review and correct if needed.
```

---

## Step 5: Create Iteration Directory

1. Get current branch name and sanitize it (replace `/` with `-`).
2. **Main branch check**: If branch is `master` or `main`:
   - Do NOT create iteration directory.
   - Skip to Step 6 with `skip_iteration = true`.
3. Create the iteration directory:
```bash
mkdir -p .cube/iterations/{sanitized-branch}
```
4. Read `plugins/cube/templates/state.yaml.tmpl`, replace placeholders:
   - `{{branch}}` → current branch name (original, not sanitized)
   - `{{date}}` → today's date (YYYY-MM-DD)
5. Write to `.cube/iterations/{sanitized-branch}/state.yaml`.

---

## Step 6: Output (Scenario A and B)

### If `skip_iteration` is true (main branch):

```
✅ cube workflow initialized

Project: {project_name}
Language: {language} ({build_tool})

Project config created in .cube/config/

⚠️  Current branch is {branch} — iteration not created on main branch.

Next step: Run /cube:iterate feature/xxx (Codex: $iterate feature/xxx) to start your first iteration
```

### If iteration was created (feature branch):

```
✅ cube workflow initialized

Project: {project_name}
Language: {language} ({build_tool})
Branch: {branch}
Iteration: .cube/iterations/{sanitized-branch}/

Stages:
  01-prd          PRD                    ⏳ Pending
  02-design       Design                 ⏳ Pending
  03-test-cases   Test Cases             ⏳ Pending
  04-development  Development            ⏳ Pending
  05-testing      Testing                ⏳ Pending

Available commands:
  /cube:dev       — Execute current stage work          (Codex: $dev)
  /cube:check     — Check current stage deliverables    (Codex: $check)
  /cube:advance   — Advance to next stage               (Codex: $advance)
  /cube:status    — Show overall progress                (Codex: $status)

Next step: Run /cube:dev (Codex: $dev) to start PRD
```

---

## Step 7: Show Status (Scenario C)

1. Read `.cube/iterations/{sanitized-branch}/state.yaml`.
2. Read `.cube/config/workflow.yaml` for project info.
3. Display current state:

```
✅ cube workflow active

Project: {project_name}
Branch: {branch}
Current Stage: {current_stage}

Stages:
  01-prd          PRD                    ✅ Done
  02-design       Design                 🔄 In Progress
  03-test-cases   Test Cases             ⏳ Pending
  04-development  Development            ⏳ Pending
  05-testing      Testing                ⏳ Pending
```

4. Based on current stage, recommend next command:

| Current Stage Status | Recommendation |
|---------------------|----------------|
| PENDING | "Run `/cube:dev` (Codex: `$dev`) to start {stage name}" |
| IN_PROGRESS | "Run `/cube:dev` (Codex: `$dev`) to continue {stage name}" |
| PASS | "Run `/cube:advance` (Codex: `$advance`) to proceed to {next stage}" |

5. Always show available commands:
```
Available commands:
  /cube:dev       — Execute current stage work          (Codex: $dev)
  /cube:check     — Check current stage deliverables    (Codex: $check)
  /cube:advance   — Advance to next stage               (Codex: $advance)
  /cube:status    — Show overall progress                (Codex: $status)
```

---

## Important Rules

- Never overwrite existing files without asking the user
- The preset files are at `plugins/cube/presets/{language}/`
- The template files are at `plugins/cube/templates/`
- Do NOT generate or modify CLAUDE.md — all state is in `.cube/`
- Branch name sanitization: replace `/` with `-` for directory names, keep original in state.yaml
- For Scenario A, always present scan results and ask user to review before proceeding
