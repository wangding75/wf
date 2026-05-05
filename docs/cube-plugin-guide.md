# Cube 插件库完整指南

> Cube 是一款面向 Claude Code / Codex 的 **Stage-Gate 开发工作流插件**，将软件开发过程拆分为 5 个严格有序的阶段，每个阶段配备质量门禁（Gate），只有通过门禁验证才能进入下一阶段。核心理念是通过流程约束、TDD 和机械化验证来保障交付质量。

---

## 目录

- [1. 整体架构](#1-整体架构)
- [2. 目录结构](#2-目录结构)
- [3. 五阶段流程详解](#3-五阶段流程详解)
  - [Stage 01-prd：产品需求文档](#stage-01-prd产品需求文档)
  - [Stage 02-design：技术设计](#stage-02-design技术设计)
  - [Stage 03-test-cases：编写测试用例（Red Phase）](#stage-03-test-cases编写测试用例red-phase)
  - [Stage 04-development：实现代码（Green Phase）](#stage-04-development实现代码green-phase)
  - [Stage 05-testing：测试验收](#stage-05-testing测试验收)
- [4. Skill 命令手册](#4-skill-命令手册)
- [5. 引擎脚本](#5-引擎脚本)
- [6. 质量保障机制](#6-质量保障机制)
  - [TDD 三层保护](#tdd-三层保护)
  - [门禁验证系统](#门禁验证系统)
  - [代码审查体系](#代码审查体系)
  - [文件变更管控](#文件变更管控)
- [7. 关键约束与规则](#7-关键约束与规则)
- [8. 状态管理与数据流](#8-状态管理与数据流)
- [9. Preset 与语言支持](#9-preset-与语言支持)
- [10. 流程控制：回退与解锁](#10-流程控制回退与解锁)
- [11. Git 工作流](#11-git-工作流)
- [12. 典型使用流程](#12-典型使用流程)

---

## 1. 整体架构

```text
用户指令 → Skill 命令 → 阶段提示词（Prompt） → AI 执行 → 引擎脚本验证 → 门禁通过 → 下一阶段
              │                                         │
              │                                         ├── Standards（通用标准）
              │                                         ├── Testing Standards（类型化测试标准）
              │                                         └── Preset Rules（语言规则）
              │
              └── Engine Scripts（Node.js 引擎）
                   ├── check-stage.mjs         ← 门禁验证
                   ├── advance-stage.mjs       ← 阶段推进
                   ├── regress-stage.mjs       ← 阶段回退
                   ├── lock-tests.mjs          ← 测试锁定
                   ├── unlock-tests.mjs        ← 测试解锁
                   ├── check-test-map.mjs      ← test-map 结构/覆盖率校验
                   ├── check-skeleton-map.mjs  ← skeleton-map 与骨架编译校验
                   ├── check-status.mjs        ← STATUS.yaml 完成度校验
                   ├── check-schema-coverage.mjs ← schema / error 常量测试覆盖校验
                   └── update-progress.mjs     ← 进度展示
```

### 设计哲学

- **AI 执行，引擎验证**
  - AI 按 Prompt 指令生成 PRD、设计、测试、实现和报告；Engine 脚本负责机械化校验，避免“主观完成”。
- **契约驱动**
  - 每个阶段输出都是下一阶段的输入契约。前序契约不成立，后续阶段不能继续消费。
- **状态驱动**
  - `state.yaml` 记录全局阶段状态，`STATUS.yaml` 记录 04 阶段逐任务 TDD 进度。
- **TDD 锁定**
  - 测试先写，再锁定，之后实现必须适配测试。
- **可回退**
  - 发现需求、设计或测试契约有问题时，不是硬改实现，而是通过 `regress` 或 `unlock` 回到正确位置修复。

---

## 2. 目录结构

### 插件源码结构

```text
plugins/cube/
├── .claude-plugin/
│   └── plugin.json                 # Claude Code 插件元数据（名称、描述、版本）
├── .codex-plugin/
│   └── plugin.json                 # Codex 插件元数据（skills 入口、展示信息）
├── package.json                    # Node.js 包描述，postinstall 时为 bin/* 加可执行权限
│
├── skills/                         # Skill 命令定义（用户通过 /cube:xxx 或 $xxx 调用）
│   ├── init/SKILL.md               # /cube:init — 初始化或激活工作流
│   ├── dev/SKILL.md                # /cube:dev — 执行当前阶段工作
│   ├── status/SKILL.md             # /cube:status — 查看进度
│   ├── check/SKILL.md              # /cube:check — 验证阶段交付物
│   ├── advance/SKILL.md            # /cube:advance — 推进到下一阶段
│   ├── regress/SKILL.md            # /cube:regress — 回退到早期阶段
│   ├── unlock/SKILL.md             # /cube:unlock — 解锁测试文件和测试资源
│   └── iterate/SKILL.md            # /cube:iterate — 在新分支开始新迭代
│
├── prompts/                        # 阶段提示词（AI 的行为指令）
│   ├── 01-prd.md                   # 产品需求文档阶段
│   ├── 02-design.md                # 技术设计阶段
│   ├── 03-test-cases.md            # 测试用例编写阶段（Red）
│   ├── 04-development.md           # 开发实现阶段（Green/Refactor）
│   └── 05-testing.md               # 测试验收阶段
│
├── standards/                      # 通用工作流与质量标准（跨阶段引用）
│   ├── workflow-principles.md      # 阶段流转、03/04/05 工作流原则
│   ├── tdd-principles.md           # TDD 原则、三层保护、Interface Change Flow
│   ├── review-guidelines.md        # reviewer 选择、审查级别和处理规则
│   ├── execution-principles.md     # 通用执行原则、避免越界和重复
│   ├── git-workflow.md             # Git 分支策略、提交约定、变更粒度
│   ├── api-contract-template.md    # API 五大生产契约模板
│   ├── sql-guidelines.md           # SQL/query 生成规则与设计约束
│   └── testing/                    # 类型化测试标准（与语言无关）
│       ├── integration.md          # 跨组件 feature 级集成测试标准
│       ├── web-e2e.md              # Web/API 端到端测试标准
│       ├── sql-query.md            # SQL/query 结构、语法、语义测试标准
│       ├── cli.md                  # CLI 命令测试标准
│       ├── batch-job.md            # batch/job 测试标准
│       ├── messaging.md            # 消息生产/消费测试标准
│       └── library.md              # SDK / 公共库测试标准
│
├── engine/                         # Node.js 引擎脚本（机械化验证与状态管理）
│   ├── package.json                # engine 包元数据，声明 Node 18+ / ESM
│   ├── lib/
│   │   └── workflow-config.mjs     # YAML 解析、路径解析、分支/迭代定位、命令展开
│   ├── advance-stage.mjs           # 阶段推进逻辑，进入 04 时创建 STATUS 并锁测试
│   ├── check-stage.mjs             # 按 deliverables 清单验证当前阶段
│   ├── check-status.mjs            # 检查 STATUS.yaml 是否所有任务都 done
│   ├── check-test-map.mjs          # 验证 test-map.yaml 结构、任务覆盖率、type_tests
│   ├── check-test-map.test.mjs     # check-test-map.mjs 的自测文件
│   ├── check-skeleton-map.mjs      # 验证 skeleton-map.yaml 覆盖率和骨架编译结果
│   ├── check-schema-coverage.mjs   # 检查 schema / error 常量是否被测试覆盖
│   ├── lock-tests.mjs              # 测试文件和测试资源上锁
│   ├── unlock-tests.mjs            # 测试文件和测试资源解锁并写审计日志
│   ├── regress-stage.mjs           # 阶段回退逻辑，必要时自动解锁
│   └── update-progress.mjs         # 展示跨阶段进度和建议命令
│
├── bin/                            # CLI 入口脚本（对 engine 的薄包装）
│   ├── cube-advance                # → advance-stage.mjs
│   ├── cube-check                  # → check-stage.mjs
│   ├── cube-check-coverage         # → check-schema-coverage.mjs
│   ├── cube-lock                   # → lock-tests.mjs
│   ├── cube-progress               # → update-progress.mjs
│   ├── cube-regress                # → regress-stage.mjs
│   └── cube-unlock                 # → unlock-tests.mjs
│
├── templates/                      # 初始化目标项目时写入的模板
│   ├── workflow.yaml.tmpl          # .cube/config/workflow.yaml 模板
│   ├── state.yaml.tmpl             # .cube/iterations/{branch}/state.yaml 模板
│   ├── pre-commit.tmpl             # .githooks/pre-commit 模板
│   └── settings.local.json.tmpl    # Claude Code deny rules 模板
│
└── presets/                        # 语言预设
    ├── java/
    ├── python/
    └── typescript/                 # 每种语言均包含 preset.yaml、deliverables/、rules/
```

### 项目运行时目录结构

初始化后，目标项目根目录下会生成 `.cube/` 目录：

```text
.cube/
├── config/                              # 项目级配置（一次生成，跨分支共享）
│   ├── workflow.yaml                    # 工作流配置（项目名、语言、路径、命令、阶段）
│   ├── system-design.md                 # 系统设计概览
│   ├── module-design.md                 # 模块结构说明
│   ├── api-spec.md                      # 公共 API 约定
│   ├── deployment.md                    # 部署文档（如有Dockerfile/CI 配置）
│   └── operations.md                    # 运维文档（如有监控配置）
│
└── iterations/                          # 迭代目录（每个分支一个子目录）
    └── feature-user-auth/               # 分支名 sanitize 后的目录
        ├── state.yaml                   # 全局阶段状态（当前阶段 + 历史）
        ├── prd.md                       # 01 阶段输出：产品需求文档
        ├── design.md                    # 02 阶段输出：技术设计文档
        ├── skeleton-map.yaml            # 02 阶段输出：骨架文件与 Development Tasks 映射
        ├── test-map.yaml                # 03 阶段输出：测试覆盖映射
        ├── STATUS.yaml                  # 04 阶段输出：逐任务 TDD 进度
        ├── dev-log.md                   # 04 阶段输出：开发日志
        ├── test-output.log              # 04/05 阶段输出：测试运行日志
        └── test-report.md               # 05 阶段输出：测试报告
```

---

## 3. 五阶段流程详解

### Stage 01-prd：产品需求文档

| 项目 | 说明 |
|------|------|
| **角色** | 资深产品经理 |
| **输入** | 用户口述或文档 + 项目上下文（system-design.md、module-design.md、api-spec.md） |
| **输出** | `.cube/iterations/{branch}/prd.md` |
| **门禁** | 文件存在 + ≥500 字节 + 包含 `Functional Requirements` 和 `Non-Functional Requirements` |

#### 执行步骤

1. **了解项目上下文**
   - 读取 `.cube/config/system-design.md`
   - 读取 `.cube/config/module-design.md`
   - 读取 `.cube/config/api-spec.md`
2. **获取需求输入**
   - 用户口述则先复述确认
   - 用户给文档则读取并提炼关键信息
3. **需求深挖**
   - 逐个功能点追问：边界、输入输出、异常场景、非功能要求
4. **生成 PRD**
   - 写入 `.cube/iterations/{branch}/prd.md`
5. **用户确认**
   - 确认后运行 `/cube:check` → `/cube:advance`

#### PRD 必选章节

| 章节 | 内容 |
|------|------|
| **功能概述** | 本次迭代要做什么，包含哪些功能点 |
| **Functional Requirements** | 按功能点分组编号（FR-001, FR-002...），含描述 + 输入输出 + 异常处理 + 优先级 |
| **Non-Functional Requirements** | 性能、安全、兼容性等与本功能相关的非功能要求 |
| **验收标准** | 每条功能需求对应的可测试条件 |
| **Out of Scope** | 明确不做的事项 |

#### 关键约束

- 章节标题保持英文，内容用中文
- 不确定的地方必须问，不能擅自假设
- PRD 只关注“做什么”，不讨论“怎么做”

#### 本阶段会读取哪些规则 / 脚本

| 类型 | 具体内容 | 作用 |
|------|----------|------|
| **Skill** | `skills/dev/SKILL.md` | 根据 `state.yaml.current_stage` 分发到 `01-prd.md` |
| **Prompt** | `prompts/01-prd.md` | 定义 PRD 阶段的角色、访谈方式、输出格式 |
| **Project Context** | `.cube/config/system-design.md` / `module-design.md` / `api-spec.md` | 提供项目背景，避免需求脱离现有系统 |
| **Preset Deliverables** | `presets/java/deliverables/01-prd.yaml` | 定义 01 阶段门禁：文件大小、章节要求 |
| **Engine** | `check-stage.mjs` | 在 `/cube:check 01-prd` 时验证 `prd.md` 是否达标 |

---

### Stage 02-design：技术设计

| 项目 | 说明 |
|------|------|
| **角色** | 资深系统架构师 |
| **输入** | `prd.md` + 项目上下文 + 现有代码 |
| **输出** | `.cube/iterations/{branch}/design.md` + 骨架代码 + `skeleton-map.yaml` |
| **门禁** | `design.md` 结构完整 + `check-skeleton-map.mjs` 通过 |

#### 设计原则

1. **最小改动优先**
2. **面向接口设计**
3. **适配现有风格**
4. **影响面可控**
5. **变更可追溯**

#### 执行步骤

1. **读取上下文**
   - `prd.md`
   - `.cube/config/*`
   - 相关 `standards/testing/*`
   - 相关现有代码
2. **影响面分析**
   - 模块影响、数据影响、接口影响、复用 vs 新建
3. **与用户对齐方案**
   - 关键设计决策、风险点、兼容性
4. **生成设计文档**
   - 写入 `design.md`
5. **设计审查**
   - 使用 reviewer agent 交叉检查需求覆盖、任务完整性、契约完整性
6. **生成骨架代码**
   - 基于 `API Design` / `Module Design` / `Table Design`
   - 生成 `skeleton-map.yaml`
   - 骨架代码必须可编译
7. **用户确认**

#### design.md 必选章节

| 章节 | 内容 |
|------|------|
| **概述** | 问题描述、方案思路、约束 |
| **Impact Analysis** | 受影响模块、兼容性分析 |
| **Flow Design** | 核心业务流程、异常流程 |
| **Table Design** | 表结构、字段、索引、关联 |
| **API Design** | API 列表、请求参数、响应格式、错误码 |
| **Module Design** | 模块职责、接口定义、依赖关系 |
| **Output Contract** | 输入输出、产出类型、正确性规则、type id |
| **Change Log** | 变更项与原因 |
| **Development Tasks** | 原子任务拆解，直接指导 03/04 阶段 |

#### 关键约束

- 设计必须细到开发可直接编码
- `Output Contract` 是 03/05 阶段的重要输入
- `Development Tasks` 必须可测试、可排序、可追踪
- 前序 `prd.md` 只读，需求变更应走 `/cube:regress 01-prd`

#### 本阶段会读取哪些规则 / 脚本

| 类型 | 具体内容 | 作用 |
|------|----------|------|
| **Skill** | `skills/dev/SKILL.md` | 将当前阶段分发到 `02-design.md` |
| **Prompt** | `prompts/02-design.md` | 定义设计章节、审查要求、骨架生成要求 |
| **Standards** | `standards/review-guidelines.md` / `standards/api-contract-template.md` / `standards/sql-guidelines.md` | 约束审查维度、接口契约、SQL 设计 |
| **Testing Standards** | `standards/testing/*.md` | 根据功能类型约束后续 03/05 阶段应测什么 |
| **Preset Deliverables** | `presets/java/deliverables/02-design.yaml` | 定义 02 阶段门禁和骨架编译检查 |
| **Engine** | `check-skeleton-map.mjs` / `check-stage.mjs` | 验证 `design.md` 必选章节、`skeleton-map.yaml` 覆盖率和骨架编译结果 |

---

### Stage 03-test-cases：编写测试用例（Red Phase）

| 项目 | 说明 |
|------|------|
| **角色** | TDD 教练 |
| **输入** | `prd.md` + `design.md` + TDD 原则 + 类型化测试标准 |
| **输出** | 测试文件 + `.cube/iterations/{branch}/test-map.yaml` |
| **门禁** | 全量测试执行退出码 = 1（FAIL） + `check-test-map.mjs` 通过 |

#### 测试编写原则

1. **测试即契约**
2. **一个测试一件事**
3. **Mock I/O，不 Mock 数据**
4. **先编译，再失败**

#### 执行步骤

1. **分析设计文档**
   - 提取 API、数据模型、业务流程、Output Contract、Development Tasks
2. **规划测试范围**
   - 每个 Development Task 对应一个测试文件
   - 规划 type_tests（integration / web-e2e / sql-query / cli / batch-job / messaging / library）
3. **逐任务编写测试**
   - 生成测试文件
   - 覆盖 Happy Path、边界值、异常场景、错误码
4. **运行测试**
   - 必须编译通过但执行 FAIL
5. **生成 `test-map.yaml`**
   - 记录任务与测试文件映射
   - 记录 `type_tests`
6. **提交与确认**

#### `test-map.yaml` 的核心作用

- 建立 `Development Tasks` → 测试文件的一一映射
- 校验覆盖率必须 100%
- 记录 feature 级类型化测试入口

#### 关键约束

- 测试只能从 `design.md` 推导，不能凭实现猜
- 测试一旦锁定，04 阶段默认禁止修改
- type id 必须规范化：
  - `web-e2e`
  - `sql-query`
  - `cli`
  - `batch-job`
  - `messaging`
  - `library`
  - `integration`

#### 本阶段会读取哪些规则 / 脚本

| 类型 | 具体内容 | 作用 |
|------|----------|------|
| **Skill** | `skills/dev/SKILL.md` | 将当前阶段分发到 `03-test-cases.md` |
| **Prompt** | `prompts/03-test-cases.md` | 定义测试编写流程、`test-map.yaml` 结构、Red 目标 |
| **Standards** | `standards/tdd-principles.md` / `standards/workflow-principles.md` | 约束测试即契约、Red 阶段工作流 |
| **Testing Standards** | `standards/testing/integration.md` / `web-e2e.md` / `sql-query.md` / `cli.md` / `batch-job.md` / `messaging.md` / `library.md` | 按功能类型定义测试范围 |
| **Preset Deliverables** | `presets/java/deliverables/03-test-cases.yaml` | 要求全量测试处于 FAIL，且 `test-map` 校验通过 |
| **Engine** | `check-test-map.mjs` / `check-stage.mjs` | 校验任务映射、测试用例数量、`type_tests` 结构和覆盖率 |

---

### Stage 04-development：实现代码（Green Phase）

| 项目 | 说明 |
|------|------|
| **角色** | 研发 / AI 执行者 |
| **输入** | 锁定测试 + `STATUS.yaml` + `design.md` |
| **输出** | 实现代码 + 更新后的 `STATUS.yaml` + `dev-log.md` + `test-output.log` |
| **门禁** | 全量测试通过 + `STATUS.yaml` 所有任务都为 `done` |

#### 执行模型

```text
locked → green → done
```

一次只推进一个任务：

1. 找到第一个未完成任务
2. 读对应测试文件
3. 最小实现让测试通过
4. 更新 `STATUS.yaml`
5. 重构并保持通过
6. 写 `dev-log.md`
7. 等用户确认后再继续下一个任务

#### 关键产物

| 文件 | 作用 |
|------|------|
| `STATUS.yaml` | 每个 Development Task 的 phase、测试通过数、开始/完成时间 |
| `dev-log.md` | 每个任务的执行计划和完成记录 |
| `test-output.log` | 测试运行原始日志 |

#### 关键约束

- **绝不主动修改测试文件和测试资源**
- 测试缺陷应走 `/cube:unlock`
- 设计缺陷应走 `/cube:regress`
- 同一任务失败 3 轮应熔断，停止继续猜修

#### 本阶段会读取哪些规则 / 脚本

| 类型 | 具体内容 | 作用 |
|------|----------|------|
| **Skill** | `skills/dev/SKILL.md` | 将当前阶段分发到 `04-development.md` |
| **Prompt** | `prompts/04-development.md` | 定义逐任务执行、调试、日志、白名单校验和停顿点 |
| **Standards** | `standards/tdd-principles.md` / `standards/workflow-principles.md` / `standards/execution-principles.md` | 约束锁测后实现、Green/Refactor 循环、执行边界 |
| **Preset Deliverables** | `presets/java/deliverables/04-development.yaml` | 要求全量测试通过且 `STATUS.yaml` 全部完成 |
| **Engine** | `advance-stage.mjs` / `lock-tests.mjs` / `check-status.mjs` / `unlock-tests.mjs` / `regress-stage.mjs` | 进入 04 时锁测试，退出 04 时检查任务完成度，返工时解锁或回退 |

---

### Stage 05-testing：测试验收

| 项目 | 说明 |
|------|------|
| **角色** | QA 工程师 |
| **输入** | 完整实现 + `prd.md` + `design.md` + `test-map.yaml` + `STATUS.yaml` |
| **输出** | `.cube/iterations/{branch}/test-report.md` |
| **门禁** | 文件存在 + ≥500 字节 + 包含 `Test Scope`、`Pass Criteria`、`Standards Evidence` |

#### 执行步骤

1. **运行完整测试套件**
   - 使用 `language_config.test_command`
2. **按类型标准执行全链路测试**
   - 读取 `Output Contract` 和 `type_tests`
   - 执行 integration / web-e2e / sql-query / cli / batch-job / messaging / library 对应验证
3. **对照验收标准检查**
   - PRD 每条验收标准是否被覆盖并通过
4. **全量代码审查**
   - reviewer agent 检查跨阶段一致性
5. **生成测试报告**
   - 写入 `test-report.md`

#### `test-report.md` 必选章节

| 章节 | 内容 |
|------|------|
| **Test Scope** | 测试范围、模块、功能类型 |
| **Test Results** | 通过/失败/跳过统计、类型化测试结果 |
| **Pass Criteria** | PRD 验收标准逐条对照 |
| **Coverage** | 覆盖率和覆盖缺口 |
| **Standards Evidence** | 命中的 testing standards、执行证据、风险结论 |

#### 关键约束

- 所有测试必须真实运行
- 05 阶段不能只靠代码阅读替代测试执行
- 核心链路缺失验证时，默认阻塞验收

#### 本阶段会读取哪些规则 / 脚本

| 类型 | 具体内容 | 作用 |
|------|----------|------|
| **Skill** | `skills/dev/SKILL.md` | 将当前阶段分发到 `05-testing.md` |
| **Prompt** | `prompts/05-testing.md` | 定义全量测试、验收、审查和报告生成流程 |
| **Standards** | `standards/review-guidelines.md` / `standards/sql-guidelines.md` | 约束代码审查和 SQL/Query 类输出的验收方法 |
| **Testing Standards** | `standards/testing/*.md` | 决定端到端链路、集成链路、类型化测试应该如何验收 |
| **Preset Deliverables** | `presets/java/deliverables/05-testing.yaml` | 要求 `test-report.md` 结构完整 |
| **Engine** | `check-stage.mjs` / `update-progress.mjs` | 验证测试报告结构，并通过 `/cube:status` 展示迭代收尾状态 |

---

## 4. Skill 命令手册

### `/cube:init`

**作用**：

- 初始化或激活工作流

**主要读取**：

- 当前项目构建文件
- `plugins/cube/templates/*`
- `plugins/cube/presets/{language}/preset.yaml`

**主要写入**：

- `.cube/config/workflow.yaml`
- `.cube/config/*`
- `.cube/iterations/{branch}/state.yaml`
- `.githooks/pre-commit`

**关键副作用**：

- 设置 Git hook
- 生成项目级和分支级运行时目录

### `/cube:dev`

**作用**：

- 执行当前阶段工作

**主要读取**：

- `.cube/config/workflow.yaml`
- `.cube/iterations/{branch}/state.yaml`
- `plugins/cube/prompts/<stage>.md`
- `plugins/cube/standards/*`
- `plugins/cube/presets/{language}/*`

**关键逻辑**：

- 根据 `current_stage` 分发到不同 prompt

### `/cube:check`

**作用**：

- 校验当前或指定阶段交付物

**主要调用**：

- `bin/cube-check`
- `engine/check-stage.mjs`

**特点**：

- 严格只读，不修复任何问题

### `/cube:advance`

**作用**：

- 当前阶段通过后推进到下一阶段

**主要调用**：

- `bin/cube-advance`
- `engine/advance-stage.mjs`

**关键副作用**：

- 更新 `state.yaml`
- 进入 04 阶段时创建 `STATUS.yaml`
- 进入 04 阶段时自动锁测试和测试资源

### `/cube:status`

**作用**：

- 展示跨阶段进度

**主要调用**：

- `bin/cube-progress`
- `engine/update-progress.mjs`

### `/cube:regress`

**作用**：

- 回退到早期阶段

**主要调用**：

- `bin/cube-regress`
- `engine/regress-stage.mjs`

**关键副作用**：

- 更新 `state.yaml`
- 必要时自动解锁测试

### `/cube:unlock`

**作用**：

- 临时解锁测试文件和测试资源

**主要调用**：

- `bin/cube-unlock`
- `engine/unlock-tests.mjs`

**关键约束**：

- 必须提供充分理由
- 会写审计日志

### `/cube:iterate`

**作用**：

- 在新分支创建新迭代

**主要写入**：

- `.cube/iterations/{branch}/state.yaml`

---

## 5. 引擎脚本

### 引擎调用关系图

```text
/cube:check
  └── bin/cube-check
      └── engine/check-stage.mjs
          ├── engine/lib/workflow-config.mjs
          ├── presets/java/deliverables/<stage>.yaml
          ├── engine/check-test-map.mjs          # 03 阶段
          ├── engine/check-skeleton-map.mjs      # 02 阶段
          ├── engine/check-status.mjs            # 04 阶段
          └── engine/check-schema-coverage.mjs   # 手工 / 独立覆盖率检查

/cube:advance
  └── bin/cube-advance
      └── engine/advance-stage.mjs
          ├── engine/check-stage.mjs
          ├── engine/lib/workflow-config.mjs
          ├── 生成 STATUS.yaml                  # 进入 04 阶段
          └── engine/lock-tests.mjs             # 进入 04 阶段自动锁定

/cube:regress
  └── bin/cube-regress
      └── engine/regress-stage.mjs
          ├── engine/lib/workflow-config.mjs
          └── engine/unlock-tests.mjs           # 从 04+ 回退时自动解锁

/cube:unlock
  └── bin/cube-unlock
      └── engine/unlock-tests.mjs
          └── .git/locks/audit.log              # 写审计日志

/cube:status
  └── bin/cube-progress
      └── engine/update-progress.mjs
          ├── engine/lib/workflow-config.mjs
          └── engine/check-stage.mjs            # 逐阶段汇总状态
```

#### 调用关系说明

- `workflow-config.mjs` 是所有引擎脚本的公共底座。
- `check-stage.mjs` 是阶段门禁总入口，各阶段的专用检查器通过它被间接调用。
- `advance-stage.mjs` 不是单纯改状态，它还会在进入 04 阶段时创建 `STATUS.yaml` 并锁测试。
- `regress-stage.mjs` 和 `unlock-tests.mjs` 共同构成返工通道。
- `update-progress.mjs` 会反复调用 `check-stage.mjs`，因此状态页显示的不是静态记录，而是“当前真实校验结果”。

### `engine/lib/workflow-config.mjs`

**作用**：

- 引擎公共底座

**负责**：

- YAML 解析
- Git 根定位
- 当前分支识别
- branch sanitize
- `workflow.yaml` 加载
- `state.yaml` / iteration 目录定位
- 路径变量和命令变量展开
- `source_dir` / `test_dir` / `test_resource_dir` 解析

### `engine/check-stage.mjs`

**作用**：

- 阶段门禁总校验器

**输入**：

- `workflow.yaml`
- 阶段 deliverables YAML
- 阶段交付物文件 / 目录 / 命令

**输出**：

- PASS / FAIL / EMPTY / NO_MANIFEST 报告

### `engine/advance-stage.mjs`

**作用**：

- 推进阶段

**输入**：

- 当前阶段状态
- 当前阶段 check 结果

**输出**：

- 更新后的 `state.yaml`
- 如进入 04 阶段，生成 `STATUS.yaml`

### `engine/regress-stage.mjs`

**作用**：

- 回退阶段

**关键行为**：

- 验证目标阶段早于当前阶段
- 更新 `state.yaml`
- 从 04 及以后回退时自动解锁测试与测试资源
- 不删除已有交付物

### `engine/check-test-map.mjs`

**作用**：

- 校验 `test-map.yaml`

**检查点**：

- `Development Tasks` 覆盖率
- `test_file` 存在性
- 测试用例数量与 `test_cases` 一致
- `type_tests` 类型、标准路径、资源文件合法

### `engine/check-test-map.test.mjs`

**作用**：

- `check-test-map.mjs` 的插件自测

**覆盖点**：

- 声明测试数和真实测试用例数量一致 / 不一致

### `engine/check-skeleton-map.mjs`

**作用**：

- 校验 `skeleton-map.yaml`

**检查点**：

- `design.md` 中 `Development Tasks` 是否被覆盖
- 骨架文件是否存在、非空
- 骨架代码是否能编译

### `engine/check-status.mjs`

**作用**：

- 校验 `STATUS.yaml` 是否所有任务都完成

### `engine/check-schema-coverage.mjs`

**作用**：

- 校验 schema / model / error 常量是否在测试中被引用

**目的**：

- 防止公共契约定义无人测试覆盖

### `engine/lock-tests.mjs`

**作用**：

- 锁定测试文件和测试资源

**方式**：

- POSIX: `chmod 444`
- Windows: `attrib +R`
- 写 `.git/locks/*.lock`

### `engine/unlock-tests.mjs`

**作用**：

- 解锁测试文件和测试资源

**方式**：

- 恢复写权限
- 删除 lock marker
- 追加 `.git/locks/audit.log`

### `engine/update-progress.mjs`

**作用**：

- 展示进度总览

**特点**：

- 对每个阶段执行 `checkStage`
- 给出当前状态和建议命令

---

## 6. 质量保障机制

### TDD 三层保护

测试不可随意修改，由三层独立保护共同保证：

| 层 | 机制 | 文件 |
|---|---|---|
| **1** | Claude Code deny rules | `templates/settings.local.json.tmpl` |
| **2** | Git pre-commit hook | `templates/pre-commit.tmpl` |
| **3** | OS 文件只读权限 | `engine/lock-tests.mjs` / `engine/unlock-tests.mjs` |

锁定范围包括：

- `test_dir`
- `test_resource_dir`

### 门禁验证系统

门禁由两部分组成：

1. `presets/java/deliverables/*.yaml`
2. `engine/check-stage.mjs` 及相关专用检查器

只有全部 deliverables PASS，阶段才允许推进。

### 代码审查体系

设计、开发、测试阶段都可调用 reviewer agent。

主要规则来源：

- `standards/review-guidelines.md`

审查类型包括：

- 设计审查
- 代码审查
- 安全审查

### 文件变更管控

04 阶段强调白名单式变更控制：

- 任务执行前先声明计划改哪些文件
- 测试通过后检查 `git status --short`
- 出现计划外文件必须向用户说明

---

## 7. 关键约束与规则

1. **阶段顺序不能跳过**
2. **前序契约默认只读**
3. **测试先写，再锁定**
4. **实现必须适配测试，不得反向扭曲测试**
5. **发现设计缺陷走 `regress`**
6. **发现测试缺陷走 `unlock`**
7. **每个任务都必须留下状态与日志**
8. **语言 preset 决定怎么跑，testing standards 决定应该测什么**

---

## 8. 状态管理与数据流

### 状态文件

| 文件 | 作用 |
|---|---|
| `workflow.yaml` | 项目级工作流定义 |
| `state.yaml` | 当前分支的阶段状态和历史动作 |
| `test-map.yaml` | Development Tasks 与测试映射 |
| `STATUS.yaml` | 04 阶段逐任务 phase 状态 |
| `dev-log.md` | 任务级开发日志 |
| `test-output.log` | 测试原始输出 |
| `test-report.md` | 最终验收证据 |

### 数据流

```text
prd.md
  ↓
design.md
  ↓
skeleton-map.yaml + 骨架代码
  ↓
test-map.yaml + 失败测试
  ↓
STATUS.yaml + 实现代码 + dev-log.md
  ↓
test-report.md
```

这条链路体现的是：

- 前一阶段的输出是后一阶段的输入
- 每一步都可检查、可回退、可留痕

---

## 9. Preset 与语言支持

当前仓库内置 Java、Python、TypeScript preset，并接受别名 `py` / `ts`，运行时统一归一化为 `python` / `typescript`。

### `presets/{language}/preset.yaml`

定义：

- 构建工具与编译命令
- 测试命令、单文件测试命令、测试文件匹配规则
- 测试用例计数规则（供 `check-test-map.mjs` 使用）
- 覆盖率命令
- schema 提取规则
- lint 工具和命令

### `presets/{language}/deliverables/*.yaml`

定义每个阶段门禁规则：

- `01-prd.yaml`
- `02-design.yaml`
- `03-test-cases.yaml`
- `04-development.yaml`
- `05-testing.yaml`

### `presets/{language}/rules/*.md`

定义对应语言的编码规则：

- `coding-style.md`
- `hooks.md`
- `patterns.md`
- `security.md`
- `testing.md`

---

## 10. 流程控制：回退与解锁

### 回退：`/cube:regress`

适用场景：

- PRD 不清晰
- 设计契约不完整
- 输出契约需要调整

行为：

- 更新 `state.yaml`
- 必要时自动解锁测试
- 不删除已有交付物

### 解锁：`/cube:unlock`

适用场景：

- 接口变更导致测试契约必须重建
- fixture / 期望文件需要合法调整

行为：

- 解锁测试与测试资源
- 写 `.git/locks/audit.log`
- 要求用户走 Interface Change Flow

---

## 11. Git 工作流

主要规则来源：

- `standards/git-workflow.md`
- `templates/pre-commit.tmpl`

核心约束：

- 每个分支对应一个独立迭代目录
- 测试锁定后不能直接提交修改过的测试文件
- 每个阶段、每个任务都应有清晰提交边界

常见提交类型：

- `test(<scope>): add TDD test cases`
- `feat(<scope>): implement <task>`
- `refactor(<scope>): refactor after green`
- `fix(<scope>): fix <issue>`
- `stage: advance from XX to YY`

---

## 12. 典型使用流程

### 新项目初始化

```bash
/cube:init java
```

结果：

- 生成 `.cube/config/`
- 创建当前分支迭代目录
- 安装 `.githooks/pre-commit`

### 一个完整迭代

```text
/cube:dev         # 做当前阶段
/cube:check       # 检查阶段交付物
/cube:advance     # 推进到下一阶段
```

重复直到进入 05 阶段并完成测试报告。

### 需要返工时

```text
/cube:regress 02-design
```

或：

```text
/cube:unlock "interface change: add new field to response schema"
```

### 查看进度

```text
/cube:status
```

### 新分支开启新迭代

```text
/cube:iterate feature/20260429_user_auth
```

---

## 维护建议

如果你要维护这个插件，建议阅读顺序：

1. `skills/dev/SKILL.md`
2. `prompts/02-design.md`
3. `prompts/04-development.md`
4. `engine/lib/workflow-config.mjs`
5. `engine/check-stage.mjs`
6. `engine/advance-stage.mjs`
7. `engine/check-test-map.mjs`
8. `engine/regress-stage.mjs`
9. `presets/java/deliverables/*.yaml`
10. `standards/tdd-principles.md`

这样可以最快建立对“命令入口 → 阶段执行 → 门禁校验 → 状态流转”的完整心智模型。
