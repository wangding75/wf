# CUBE Agent — 独立 CLI Agent 设计规格

## 概述

基于 Anthropic Agent SDK (TypeScript) 构建的独立 CLI Agent，自动驱动 CUBE 5 阶段工作流（PRD → Design → Test Cases → Development → Testing），支持灵活输入、交互式访谈、DAG 并发任务调度和多层 Review 机制。

## 核心设计原则

1. **Agent 独立性**：每个 Stage Agent 独立启动/销毁，零 context 依赖
2. **文件系统通信**：Agent 之间只通过文件系统交互，读前序阶段产出物
3. **任务粒度 TDD**：每个开发任务是完整的 TDD 单元（写测试 → 实现 → 通过）
4. **DAG 并发**：根据任务依赖关系的 DAG 控制并发执行
5. **多层 Review**：轻量阶段 Review + 全局场景矩阵 Review

## 1. 整体架构

```
Orchestrator (流程控制器)
  │
  ├─ Init Agent (自动检测 .cube/ → 无则初始化)
  │
  ├─ PRD Agent (交互/自动)
  │     └─ Stage Reviewer → cube-advance
  │
  ├─ Design Agent (交互/自动)
  │     └─ Stage Reviewer → cube-advance
  │
  ├─ TestCase Agent (自动，生成任务 DAG + 测试代码)
  │     └─ Stage Reviewer → cube-advance
  │
  ├─ TDD Executor (DAG 并发调度)
  │     ├─ TDD Agent × N (并发，每 task 一个)
  │     ├─ 每个 task 完成后轻量 review
  │     └─ 全部完成 → cube-advance
  │
  ├─ Testing Agent (集成测试 + 覆盖率)
  │     └─ Stage Reviewer → cube-advance
  │
  └─ Final Reviewer (全局场景矩阵审核)
       ├─ PASS → 完成
       └─ FAIL → 回退到具体阶段重新执行
```

## 2. CLI 接口

```bash
# 基本用法
cube-agent "实现用户登录功能"
cube-agent --doc ./requirements.md
cube-agent --resume

# 完整参数
cube-agent <input> \
  --project <path>           # 项目目录（默认 .）
  --branch <name>            # 分支名（默认自动生成）
  --model <model>            # Claude 模型（默认 sonnet）
  --on-fail <strategy>       # retry|stop|skip（默认 retry）
  --max-retry <n>            # review 修改最大轮次（默认 3）
  --concurrency <n>          # TDD 任务最大并发（默认 2）
  --skip-interview           # 有文档时跳过访谈
  --start-from <stage>       # 从指定阶段开始
  --verbose                  # 详细日志输出
```

### 配置文件 `cube-agent.yaml`（项目级，可选）

```yaml
model: sonnet
on_fail: retry
max_retry: 3
concurrency: 2
review:
  stage_review: true
  final_review: true
  max_review_rounds: 3
skills:
  discover: true
```

## 3. Orchestrator 设计

### 核心逻辑

```
1. 解析输入和参数
2. 检测 .cube/ → 无则启动 Init Agent
3. 创建/切换分支
4. 读取 state.yaml 确定当前阶段（支持 --resume）
5. 循环执行:
   for each stage (从当前阶段开始):
     a. 构建 Stage Agent（加载对应 prompt + tools）
     b. 注入输入（需求文本/文档 or 前序产出物路径）
     c. 判断交互模式（有文档且 --skip-interview → 自动）
     d. 运行 Stage Agent
     e. 运行 Stage Reviewer
     f. 若 FAIL → 按 on-fail 策略处理
     g. cube-check → cube-advance
6. 运行 Final Reviewer
7. 输出最终报告
```

### --resume 恢复机制

- 读取 `state.yaml` 中的 `current_stage` 和状态
- 直接从该阶段继续，不重跑已完成阶段
- Stage Agent 从文件系统读前序产出，不需要历史 context

## 4. 交互模式

### PRD / Design 阶段的交互逻辑

```
用户提供了文档?
  ├─ 是 → 询问用户:
  │        ├─ "进行文档访谈剖析" → 交互模式（多轮 Q&A）
  │        └─ "直接开始任务" → 自动模式
  └─ 否 → 交互模式（brainstorm 式访谈）
```

### 交互层抽象（预留 Web/IM）

```typescript
interface UserInterface {
  ask(question: string, options?: string[]): Promise<string>;
  confirm(message: string): Promise<boolean>;
  display(message: string): void;
  progress(stage: string, percent: number): void;
}

// 三种实现
class CliInterface implements UserInterface { ... }   // stdin/stdout
class WebInterface implements UserInterface { ... }   // WebSocket API
class IMInterface implements UserInterface { ... }    // 消息平台 webhook
```

Agent 通过 `ask_user` tool 调用统一接口，Orchestrator 启动时根据运行模式注入具体实现。

## 5. TDD 执行模型（Stage 03+04）

### TestCase Agent (Stage 03)

```
1. 读取 prd.md + design.md
2. 拆分为开发任务列表
3. 分析任务间依赖，生成 DAG
4. 为每个任务编写测试用例
5. 产出:
     .cube/iterations/{branch}/task-dag.yaml
     测试代码文件
```

### task-dag.yaml 结构

```yaml
tasks:
  - id: task-001
    name: "实现用户注册接口"
    depends_on: []
    test_files:
      - src/test/java/com/xxx/UserRegisterTest.java
    status: pending   # pending → running → done → failed

  - id: task-002
    name: "实现用户登录接口"
    depends_on: []
    test_files:
      - src/test/java/com/xxx/UserLoginTest.java
    status: pending

  - id: task-003
    name: "实现登录态校验拦截器"
    depends_on: [task-001, task-002]
    test_files:
      - src/test/java/com/xxx/AuthInterceptorTest.java
    status: pending
```

### TDD Executor (Stage 04) — DAG 并发调度

```
读取 task-dag.yaml
按 DAG 拓扑排序，识别可并发任务
调度执行:
  ┌─ Task A (无依赖) ──→ TDD Agent ──→ 完成
  ├─ Task B (无依赖) ──→ TDD Agent ──→ 完成
  │                                      ↓
  └─ Task C (依赖 A+B) ─等待─→ TDD Agent ──→ 完成
```

### DAG 调度器逻辑

```typescript
interface ExecutorConfig {
  maxConcurrency: number;  // 最大并行 agent 数（默认 2，用户 --concurrency 指定）
}

while (有未完成任务) {
  可执行任务 = DAG 中 depends_on 全部 done 且状态为 pending 的任务
  取 min(可执行任务数, maxConcurrency - 运行中数量) 个
  为每个启动独立 TDD Agent
  等待任一完成 → 更新 DAG → 继续调度
}
```

### 单个 TDD Agent 内部循环

```
输入: 一个 task + 对应的测试文件

1. 读取测试代码，理解需求
2. 编写实现代码
3. 运行该任务的测试 → 失败 → 修改 → 重跑
4. 测试通过 → 轻量 review
5. git commit
6. 更新 task-dag.yaml 状态 → done
```

## 6. Agent 内部结构与 Tool 定义

### 共享 Tool 集

```typescript
// 文件系统
read_file(path): string
write_file(path, content): void
list_directory(path): string[]
glob(pattern): string[]

// Shell 执行
run_command(cmd, cwd?): {stdout, stderr, exitCode}

// Git
git(args): {stdout, stderr, exitCode}

// CUBE Engine
cube_check(stageId?): CheckResult
cube_advance(): AdvanceResult
cube_lock(): void
cube_unlock(reason): void
```

### 交互阶段专用 Tool

```typescript
// 仅 PRD Agent / Design Agent 可用
ask_user(question, options?): string
```

### Review Agent 专用 Tool

```typescript
discover_skills(category?): Skill[]
invoke_skill(name, args): SkillResult
```

### Agent 构建流程

```
Orchestrator 为每阶段:
  1. 读取 prompts/{stage}.md 作为 system prompt
  2. 读取 presets/{language}/rules/* 注入规则
  3. 读取 standards/* 注入标准
  4. 组装 tools（共享 + 阶段专用）
  5. 设置 inputs（前序产出物路径列表）
  6. 创建 Agent SDK 实例 → 运行
```

## 7. Review 设计

### 7.1 轻量 Stage Reviewer

```
触发: 每个 Stage Agent 产出完成后

流程:
  1. 探索已安装 skill → discover_skills("review")
  2. 读取本阶段产出物
  3. 按阶段检查清单逐项验证
  4. 若发现匹配的 review skill → 调用补充审核
  5. 输出 reviews/{stage}-review.md
  6. 返回 PASS / FAIL + 问题列表
```

FAIL 时循环：Stage Agent 修改 → Stage Reviewer 再审，最多 max_retry 轮。

### 各阶段检查清单

**01-prd**:
- 功能点是否有编号（FR-xxx）
- 每个功能点是否有输入/输出/异常处理
- 非功能需求是否与功能相关
- 是否存在歧义或 TBD

**02-design**:
- 是否覆盖 PRD 全部功能点（FR 编号交叉比对）
- 接口定义是否完整（入参/出参/异常码）
- 表设计是否与接口匹配
- 是否遵循 .cube/config/ 中的架构规范

**03-test-cases**:
- 每个 FR 是否有对应测试
- 是否包含边界用例和异常场景
- 测试能否编译通过（运行 compile 命令）
- DAG 依赖关系是否有环
- 测试资源文件是否已生成

**04-development (每个 task 完成后)**:
- 该 task 测试是否全部通过
- 代码是否与 design 中的接口定义一致
- 无硬编码/无调试代码
- 测试资源文件自 Stage 03 锁定后未被修改（git diff 校验）

**05-testing**:
- 全量测试通过
- 覆盖率达标（读取 preset 中的阈值）
- 无跳过的测试用例
- 测试资源文件完整性校验

### 7.2 全局 Final Reviewer

```
触发: 05-testing 通过后
目的: 跨阶段交叉验证

流程:
  1. 探索已安装 skill → 优先调用专业 review skill
  2. 构建场景矩阵:

     PRD 功能点 × Design 接口 × 测试用例 × 实现代码

     逐行验证:
     ┌──────────┬────────────┬────────────┬──────────┬────────┐
     │ FR-001   │ 设计接口   │ 测试用例   │ 实现代码 │ 状态   │
     ├──────────┼────────────┼────────────┼──────────┼────────┤
     │ 用户注册 │ POST /user │ 3 cases    │ UserCtrl │ ✅     │
     │ 用户登录 │ POST /login│ 5 cases    │ AuthCtrl │ ✅     │
     │ 权限校验 │ Interceptor│ 2 cases    │ AuthInt  │ ❌缺失 │
     └──────────┴────────────┴────────────┴──────────┴────────┘

  3. 检查维度:
     - 需求覆盖: 每个 FR 是否有完整链路（设计→测试→代码）
     - 一致性: 接口签名、字段名、错误码是否前后一致
     - 遗漏检测: 是否有设计了但没实现的、测试了但没需求的
     - 安全审查: 调用 security-review skill（若已安装）
     - 测试资源完整性: 锁定时间点 vs 当前内容

  4. 输出 reviews/final-review.md
  5. 返回 PASS / FAIL
```

### FAIL 时的回退机制

```
Final Reviewer FAIL
  │
  ├─ 定位到具体阶段和问题
  │    如: "FR-003 缺少测试用例" → 回退到 Stage 03
  │    如: "接口签名不一致" → 回退到 Stage 04
  │
  ├─ Orchestrator 回退:
  │    cube-regress → 重新执行该阶段 → Stage Reviewer → cube-advance
  │
  └─ 重新执行 Final Reviewer
      最多 max_retry 轮
```

### Review 报告格式

```markdown
# Stage Review: 01-prd (Round 1)
Date: 2026-04-22
Reviewer: stage-reviewer

## Result: FAIL

## Issues
1. [CRITICAL] FR-003 缺少异常场景描述
2. [HIGH] 非功能需求中性能指标未量化

## Checklist
- [x] 功能点有编号
- [x] 输入输出完整
- [ ] 异常处理完整
- [x] 无歧义

## Skills Used
- (none discovered)
```

## 8. 项目结构

```
cube-agent/
  ├─ package.json
  ├─ tsconfig.json
  ├─ bin/
  │    └─ cube-agent.ts            # CLI 入口
  ├─ src/
  │    ├─ orchestrator.ts           # 流程编排器
  │    ├─ dag-scheduler.ts          # DAG 并发调度器
  │    ├─ agents/
  │    │    ├─ base-agent.ts        # Agent 基类（SDK 封装）
  │    │    ├─ init-agent.ts        # 项目初始化
  │    │    ├─ prd-agent.ts         # PRD 阶段
  │    │    ├─ design-agent.ts      # Design 阶段
  │    │    ├─ testcase-agent.ts    # 测试用例 + DAG 生成
  │    │    ├─ tdd-agent.ts         # 单任务 TDD 执行
  │    │    ├─ testing-agent.ts     # 集成测试
  │    │    ├─ stage-reviewer.ts    # 轻量阶段 review
  │    │    └─ final-reviewer.ts    # 全局场景矩阵 review
  │    ├─ tools/
  │    │    ├─ filesystem.ts        # 文件系统 tools
  │    │    ├─ git.ts               # Git tools
  │    │    ├─ shell.ts             # 命令执行 tools
  │    │    ├─ cube-engine.ts       # CUBE 脚本调用
  │    │    ├─ user-interaction.ts  # 用户交互 tool
  │    │    └─ skill-discovery.ts   # review skill 发现
  │    ├─ prompts/
  │    │    └─ loader.ts            # 从 CUBE 插件加载 prompt
  │    └─ types/
  │         ├─ agent.ts
  │         ├─ dag.ts
  │         └─ config.ts
  └─ tests/
```

## 9. 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 与 CUBE engine (Node.js) 同栈，复用代码 |
| Agent 框架 | Anthropic Agent SDK (TS) | 官方 SDK，管理 tool use 循环 |
| CLI 框架 | commander.js | 轻量、成熟 |
| 配置解析 | yaml (js-yaml) | 与 CUBE 现有 yaml 格式一致 |
| 并发控制 | 自研 DAG Scheduler | 轻量，基于 Promise + 拓扑排序 |

## 10. 失败策略

由用户运行时通过 `--on-fail` 参数指定：

| 策略 | 行为 |
|------|------|
| `retry` | 自动重试 max_retry 次，失败后停止等待用户处理 |
| `stop` | 立即停止并报告错误详情 |
| `skip` | 跳过当前任务，记录问题，继续后续流程 |
