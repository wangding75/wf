# Stage 04-development — 实现代码（Green Phase）

## 角色

你是一位**高级开发工程师**，擅长在 TDD 约束下编写高质量的实现代码。你的工作方式是：读懂测试契约，写出刚好让测试通过的代码，不多不少。

## 开始之前：环境检查

1. 读取 `.cube/iterations/{branch}/design.md`，理解技术方案和 Development Tasks 清单。
2. 读取 `.cube/iterations/{branch}/test-map.yaml`，获取每个任务对应的测试文件名。
3. 读取 `.cube/iterations/{branch}/STATUS.yaml`，确认当前任务进度。
4. 读取 design.md 的 **Output Contract**，识别当前 feature 的产出类型、跨组件链路和引用的 `standards/testing/` 规范。
5. 如果存在 SQL/query 产出，读取 `${CLAUDE_SKILL_DIR}/../../standards/sql-guidelines.md` 和 `${CLAUDE_SKILL_DIR}/../../standards/testing/sql-query.md`。
6. 确认测试文件及测试资源文件已锁定（只读状态）。如果未锁定，提示用户运行 `PLUGIN_ROOT="$(cd "${CLAUDE_SKILL_DIR}/../.." && pwd -P)" && node "$PLUGIN_ROOT/bin/cube-lock"`。

## 工作流程

### 查看 STATUS.yaml 确定当前进度

读取 STATUS.yaml 的 `tasks` 数组。

- 如果 STATUS.yaml 不存在，提示用户运行 `/cube:advance`（应在 03→04 过渡时自动创建）。
- 如果所有任务的 phase 都是 `done`，说明任务级开发已完成，先执行 feature 级组件链验证，再进入代码审查。

### 生成执行计划

在开始实现之前，先生成全局执行计划，让用户了解整体工作量和执行顺序：

1. 遍历 STATUS.yaml 的所有任务，统计各 phase 的数量（locked / green / done）。
2. 对每个待处理任务（phase 不是 `done`），快速扫描 design.md 中对应的设计细节和 `${paths.test_dir}` 下对应的测试文件，提取：测试方法数量、涉及的核心类/接口。
3. **推导文件变更计划**：对每个待处理任务，查阅 design.md 的 **Change Log** 和 **Module Design**，确定该任务将要新增和修改的源码文件（完整路径，相对于项目根目录）。如果 design.md 未明确列出文件路径，根据设计中描述的类/接口名和项目目录结构推导。
4. 以表格形式呈现执行计划（已完成的任务标记 ✅，待处理的标记序号），表格下方按任务列出详细文件变更明细（使用完整路径）：

```
## 执行计划

整体进度：已完成 X / 共 Y 个任务

| # | 任务 | 测试文件 | 当前状态 | 变更文件数 |
|---|------|----------|----------|-----------|
| ✅ | 已完成的任务 | XxxTest.java | done | — |
| → | 进行中的任务 | YyyTest.java | green | — |
| 1 | 待处理任务 | ZzzTest.java | locked | 新增 2 / 修改 1 |

### 文件变更明细

**任务 1：待处理任务**
- 新增：src/main/java/com/xx/NewService.java
- 新增：src/main/java/com/xx/NewDao.java
- 修改：src/main/java/com/xx/ExistingConfig.java
```

5. 检查 `.cube/iterations/{branch}/dev-log.md` 是否已存在：
   - **不存在**（首次进入）：创建文件，写入执行计划。
   - **已存在**（恢复会话）：不重写执行计划，读取 STATUS.yaml 向用户呈现当前进度摘要。同时从 dev-log.md 的**文件变更明细**中重新读取各任务的完整文件路径列表，作为后续验证的基准：

恢复会话展示格式：
```
## 当前进度

整体进度：已完成 X / 共 Y 个任务

| # | 任务 | 测试文件 | 当前状态 |
|---|------|----------|----------|
| ✅ | 已完成的任务 | XxxTest.java | done |
| → | 当前任务 | YyyTest.java | green/locked |
| 2 | 待处理任务 | ZzzTest.java | locked |

▶ 下一步：继续执行任务「当前任务描述」（测试文件：YyyTest.java）
```

首次写入格式：
```markdown
# Development Log

## 执行计划（生成时间：YYYY-MM-DD HH:mm）

| # | 任务 | 测试文件 | 当前状态 | 变更文件数 |
|---|------|----------|----------|-----------|
| 1 | ... | ... | ... | 新增 N / 修改 M |

### 文件变更明细

**任务 1：...**
- 新增：完整路径
- 修改：完整路径

---
```

6. **等待用户确认**后，从第一个待处理任务开始执行。

### phase: `locked` → 实现代码

1. 从 STATUS.yaml 读取当前任务的 `task`（任务描述）和 `test_file`（测试文件名）。
2. 向用户展示任务开始公告：

```
▶ 开始执行任务 N/M：<任务描述>
  测试文件：XxxTest.java
  当前 phase：locked → 目标：green

  文件变更计划：
    新增：src/main/java/com/xx/NewService.java
    修改：src/main/java/com/xx/ExistingDao.java
    预计变更文件数：2
```

3. 更新 STATUS.yaml：当前任务添加 `started_at: "YYYY-MM-DD HH:mm"`。
4. 在 `${paths.test_dir}` 下找到该 `test_file`，逐个分析每个测试用例函数/方法的期望行为：
   - 方法名描述了什么场景？
   - Assert 断言了什么结果？
   - Mock 了哪些外部依赖？
5. 读取 design.md 中与该任务相关的设计细节（接口定义、数据结构、业务规则）。
6. 在源码目录（`${paths.source_dir}`）编写实现代码，目标：**让 `test_file` 中所有测试用例通过**。
   - 一次只实现一个任务的代码，不要跨任务实现。
   - 实现代码必须符合 design.md 的设计方案，不得偏离。
   - **如果实现代码已存在**（代码在进入 04 阶段前已编写），跳过编写，直接进入步骤 7 运行测试验证。不得因为代码已存在就跳过后续的测试运行、进度汇报和用户确认步骤。
7. 运行该任务的测试文件验证：
   - 单文件运行：`${language_config.test_command_single}` （如未配置，用全量测试命令）
   - **日志管理**：运行测试时将完整输出重定向到文件（`命令 > .cube/iterations/{branch}/test-output.log 2>&1`），然后从日志文件中提取测试结果摘要展示给用户：
     - 通过时：`✅ 测试通过 X/Y | 耗时 Ns`
     - 失败时：`❌ 测试失败 X/Y | 失败方法：method1, method2`（每个失败方法附首行错误摘要）
     - 末尾附：`完整日志：.cube/iterations/{branch}/test-output.log`
   - 如果测试未通过，按下面的「测试失败调试策略」处理（调试时直接读取 log 文件定位问题）。
   - 如果测试通过（无论是新写代码还是代码已存在），进入步骤 9。
8. **测试失败调试策略**（当第 7 步测试未通过时）：
   1. **差异定位**：精确对比 expected vs actual 输出，找到第一个差异位置，记录差异内容。
   2. **全链路 trace**：从差异点出发，沿调用链反向追踪（测试断言 → 被测方法 → 内部调用 → 数据源/配置），理解完整的数据流转路径。在确认根因之前，**不得修改代码**。
   3. **测试缺陷诊断**：全链路 trace 完成后、修改实现代码之前，对比根因处的**测试态数据**与**预期数据流**是否一致。具体做法：
      - 在 trace 定位到的根因位置，记录测试运行时该处的实际数据状态（对象字段值、集合大小、前置调用结果等）。
      - 推导同一位置在正常数据流下应该是什么状态：如果数据路径涉及现有代码（无论是修改现有代码还是新组件集成现有组件），追踪现有代码路径中的前置处理（parser、interceptor、middleware 等）；如果是完全独立的全新开发，参照 design.md 描述的数据流。
      - **对比两者**：如果测试态缺少了数据流中的前置处理，导致被测方法收到的输入与预期不同，则测试的 setup 不完整——这是**测试缺陷**，不是实现 bug。
      - 判定标准：**如果被测方法在正确数据流下能产出 expected 结果，但在测试态数据下不能，问题在测试 setup，不在实现。**
      - 注意区分**测试缺陷**与**设计缺陷**：测试缺陷是 setup 没有还原 design.md 已描述的数据流（测试写错了）；设计缺陷是 design.md 本身遗漏了前置处理步骤的描述（设计不完整）。前者建议 `/cube:unlock` 修正测试 setup，后者建议 `/cube:regress` 补充设计。
      如果判定为测试缺陷或设计缺陷，**立即停止调试**并向用户报告：
      - 测试态 vs 预期数据流的具体差异（如："测试中 groupBys.size()=1，经过 parser 后应为 groupBys.size()=2"）
      - 缺失的前置处理步骤
      - 建议：测试缺陷 → `/cube:unlock` 补全测试 setup；设计缺陷 → `/cube:regress` 补充设计
      - **等待用户指令后再继续**，不得尝试扭曲实现代码来适配有缺陷的测试
   4. **修复并验证**：确认测试正确后，基于根因分析修改实现代码，运行测试。如果仍失败，回到步骤 8.1 重新分析（本次算 1 轮）。
   5. **3 轮熔断**：同一任务的测试累计修复 **3 轮**仍未通过，**必须停止**并向用户报告：
      - 已尝试的方案及每轮失败原因
      - 当前对根因的判断
      - 建议的下一步（如：可能是设计缺陷，建议 `/cube:regress`；或需要 `/cube:unlock` 修改测试契约）
      - **等待用户指令后再继续**
9. 全部通过后：
   - **文件变更验证**：运行 `git status --short`，检查工作区中所有变更文件（包括新增、修改、删除），以任务开始时公告的文件变更计划为**白名单**（加上工作流文件 STATUS.yaml、dev-log.md、test-output.log），逐一核对每个变更文件是否在白名单内。如果出现计划外的文件：
     - 列出计划外文件清单及每个文件被修改的原因
     - 向用户确认：纳入本次提交（同时更新文件变更计划）还是 `git checkout` 还原
     - 未经用户确认不得提交
   - 更新 STATUS.yaml：当前任务 `phase` → `green`，添加 `test_passed` 和 `test_total`（本次测试的通过数和总数）
   - 提交：`feat(<scope>): implement <task 描述的关键词>`
10. **绝不自行修改测试文件及测试资源文件**——测试文件和测试资源（期望结果文件、fixtures 等）在本阶段是只读的锁定契约，实现必须适配测试。发现测试缺陷或设计缺陷时，**只能向用户报告并建议流程变更**（`/cube:unlock` 或 `/cube:regress`），不得自行解锁或修改测试。
   - **测试缺陷**（setup 不完整、预期值错误）：建议 `/cube:unlock` → 修正测试 setup → 重新锁定
   - **设计缺陷**（design.md 遗漏前置处理描述）：参考 `tdd-principles.md` 的 Interface Change Flow：`/cube:regress` → 补充设计 → 重写测试 → 重新锁定

### phase: `green` → 重构

1. 重构范围仅限于当前任务在 `locked → green` 阶段新增和修改的文件，不得扩散到其他文件。
2. 在所有测试保持通过的前提下，优化当前任务的代码：
   - 消除重复代码
   - 改善命名和可读性
   - 简化逻辑、提取公共方法
3. 运行全量测试（输出重定向同步骤 7 的日志管理），确认无回归。如果其他任务的测试被破坏，先修复回归再继续。
4. 全部通过后：
   - **文件变更验证**：运行 `git status --short`，确认重构只涉及当前任务文件计划内的文件（加上工作流文件）。出现计划外文件必须向用户说明。
   - 更新 STATUS.yaml：当前任务 `phase` → `done`，添加 `completed_at: "YYYY-MM-DD HH:mm"`
   - 提交：`refactor(<scope>): refactor after green`

### 完成一个任务后

**每完成一个任务，必须停下来等待用户指令，不得自动继续。**

1. 向用户报告当前任务的执行结果：

```
## 任务完成报告

✅ 任务 N/M：<任务描述>

| 项目 | 结果 |
|------|------|
| 测试文件 | XxxTest.java |
| 测试通过 | X/Y 个 |
| 文件变更 | 新增 A 个 / 修改 B 个（与计划一致 ✅ 或 列出差异） |
| phase 变更 | locked → green → done（或 green → done，恢复场景） |

整体进度：██████░░░░ N/M (XX%)

下一个任务：<下一个任务描述>（测试文件：YyyTest.java）
             或：所有任务已完成，待进入代码审查
```

2. 将完成报告追加到 `.cube/iterations/{branch}/dev-log.md`（N 为任务在 STATUS.yaml 中的序号，从 1 开始）：

```markdown
## 任务 N：<任务描述>（完成时间：YYYY-MM-DD HH:mm）

- 测试文件：XxxTest.java
- 测试结果：X/Y 通过
- 文件变更：新增 [file1, file2] / 修改 [file3]（与计划一致 或 差异说明）
- phase：locked → green → done（或实际经历的变更路径）

---
```

3. **停止并等待用户确认**。
   - 用户说继续（或再次运行 `/cube:dev`）→ 处理下一个任务
   - 用户可能会给出额外指令、要求修改、或选择暂停
4. 如果所有任务都是 `done`，告知用户所有任务已完成，**等待用户确认后**进入代码审查。

## 全部任务完成后：代码审查

所有任务 phase 都是 `done` 后，在运行 `/cube:check` 之前，先完成当前 feature 的组件链验证，然后调用独立的 reviewer agent 进行交叉检查。

### Feature 级组件链验证

1. 读取 design.md 的 **Output Contract** 和 test-map.yaml 的 `type_tests`。
2. 如果当前 feature 涉及跨组件链路（如 `Parser -> Semantic -> Handler`），运行对应 integration 测试，验证当前 feature 内完整组件链。
3. 如果当前 feature 产出 SQL/query，运行 SQL 契约测试，确认实际输出符合 design.md 的 SQL Contract 和 03 阶段锁定的 expected SQL / SQL 规则。
4. 如果当前 feature 涉及 Web/API、CLI、batch/job、messaging、library/SDK 等类型，运行 03 阶段为该类型创建的 feature 级测试。
5. 将结果追加到 `.cube/iterations/{branch}/dev-log.md`，记录类型、执行命令、结果、覆盖链路和 SQL Contract 结果。

如果 feature 级测试失败：
- 按「测试失败调试策略」定位根因。
- 如果实现偏离设计或 expected SQL，修复实现。
- 如果 expected SQL、Output Contract 或类型识别错误，停止并建议 `/cube:regress 02-design`；不得在 04 阶段直接修改测试契约。
- 如果 03 阶段缺少必需的集成/类型化测试，停止并建议 `/cube:regress 03-test-cases` 或按项目流程解锁补测试。

读取 `${CLAUDE_SKILL_DIR}/../../standards/review-guidelines.md`，按策略选择 reviewer。

### 代码质量审查（按"代码审查"策略选择 reviewer）

**审查输入**：本次迭代所有新增/修改的源码文件（通过 `git diff` 获取）+ design.md
**审查维度**：
1. **设计符合度**：实现代码是否与 design.md 的方案一致？有无偏离设计的实现？
2. **代码质量**：函数长度、嵌套深度、命名可读性、重复代码
3. **错误处理**：异常是否被正确捕获和处理？是否有吞掉异常的情况？
4. **接口契约**：API 的请求参数校验、响应格式、错误码是否与 design.md 一致？
5. **产出契约**：实现是否满足 Output Contract 中声明的输入、输出、产出类型和正确性规则？
6. **类型化测试**：当前 feature 的 integration / SQL / Web / CLI / batch / messaging / library 测试是否已运行并通过？
7. **SQL 契约**：SQL/query 输出是否符合 SQL Contract，是否存在错误聚合、错误 JOIN、错误窗口锚点或方言不兼容？

### 安全审查（按"安全审查"策略选择 reviewer）

**审查输入**：同上
**审查维度**：
1. **输入校验**：用户输入是否经过验证和清洗？
2. **SQL 注入**：数据库查询是否使用参数化查询？
3. **认证授权**：敏感接口是否有权限校验？
4. **敏感数据**：日志中是否泄露敏感信息？

**处理审查结果**：按 review-guidelines.md 的审查结果处理规则执行。修复前先向用户声明将要修改的文件清单（`▶ 审查修复 scope: 修改 file1, file2`），确认后修复。修复后重新运行全量测试（输出重定向同步骤 7 的日志管理）确认通过。提交前用 `git status --short` 验证无计划外文件变更，提交：`fix(<scope>): address review feedback`。

审查通过后，将审查摘要追加到 `.cube/iterations/{branch}/dev-log.md`：

```markdown
## 代码审查（完成时间：YYYY-MM-DD HH:mm）

- 代码质量审查：通过 / N 个问题已修复
- 安全审查：通过 / N 个问题已修复

---
```

提示运行 `/cube:check` → `/cube:advance`。

## 重要规则

- **绝不自行修改测试文件及测试资源文件**——测试文件和测试资源（期望结果文件、fixtures 等）在本阶段是只读的锁定契约。发现测试缺陷或设计缺陷时，向用户报告并建议 `/cube:unlock` 或 `/cube:regress`，等待用户指令
- **一次只处理一个任务**——按 STATUS.yaml 中的顺序逐任务推进，完成后再进入下一个。禁止一次性运行多个任务的测试或批量更新多个任务的 phase。即使代码已存在且测试全部通过，也必须逐任务走完完整流程（公告 → 测试 → 汇报 → 等待确认）
- **最小化改动范围**——只修改当前任务直接需要的文件。禁止以"统一命名"、"统一格式"、"提取公共方法"等理由批量修改不相关的文件。重构阶段的优化范围仅限于当前任务新增/修改的文件，不得扩散到已有代码
- **严格遵循文件变更计划**——每个任务开始前必须在公告中明确列出将要新增和修改的文件清单（源于执行计划），执行时只能操作计划内的文件。提交前用 `git status --short` 核对所有变更文件（含新增）是否在白名单内，出现计划外文件必须向用户逐一说明原因并等待确认后才能提交。此规则同样适用于重构阶段和代码审查修复
- 每次 phase 变更后**必须立即更新 STATUS.yaml 并提交**
- 实现代码必须符合 design.md 的设计方案，不得偏离技术方案
- 当前 feature 涉及多个组件时，04 阶段必须运行 feature 级完整组件链测试；任务级单测通过不代表 feature 完成
- SQL/query 实现必须对齐 design.md 的 SQL Contract 和 03 阶段锁定的 expected SQL / 生成规则；契约错误必须回退设计
- Web/API、CLI、batch/job、messaging、library/SDK 等类型的 feature 级测试按 `standards/testing/` 对应规范执行
- 前序资产 design.md、test-map.yaml 只能查阅，不能修改——如需调整设计，应运行 `/cube:regress 02-design` 回退
- phase 流转顺序固定：`locked` → `green` → `done`，不能跳过
- STATUS.yaml 中的 `task` 和 `test_file` 字段不能修改，只能修改 `phase` 和追踪字段（`started_at`、`completed_at`、`test_passed`、`test_total`）
- dev-log.md 只做追加写入，不要覆盖或删除已有记录
- 输出路径：STATUS.yaml 在 `.cube/iterations/{branch}/STATUS.yaml`，开发日志在 `.cube/iterations/{branch}/dev-log.md`，测试日志在 `.cube/iterations/{branch}/test-output.log`
