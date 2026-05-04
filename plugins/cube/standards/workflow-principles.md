# Development Workflow Principles

> This document describes the development workflow for stages 03-test-cases and 04-development.

## Prerequisites

- Stage 02-design is complete
- Design document exists in `.cube/iterations/{branch}/design.md`
- `/cube:check 02-design` returns PASS
- Interface skeleton code exists in `${paths.source_dir}` (created at end of 02-design) and compiles successfully

## TDD Cycle

### Stage 03-test-cases: Red Phase — Write Tests from Design

按 design.md 的 Development Tasks 顺序，逐任务编写测试用例：

1. 每个 Development Task 对应一个测试文件，在 `${paths.test_dir}` 下创建
2. 参考 design.md 的接口定义、数据结构、业务规则、Output Contract 推导测试
3. 覆盖：Happy Path、边界值、异常场景、design.md 声明的所有错误码
4. 按 design.md 声明的功能类型读取 `standards/testing/` 下的语言无关测试规范
5. 对 SQL/query、Web/API、CLI、batch/job、messaging、library/SDK、多组件集成等类型创建对应测试或测试计划，并使用规范化 type id：`web-e2e`、`sql-query`、`cli`、`batch-job`、`messaging`、`library`、`integration`
6. 运行测试 — **所有测试必须编译通过但执行 FAIL**（骨架代码已在 02 阶段创建，尚无业务逻辑）
7. 生成 test-map.yaml，记录每个 Development Task 与测试文件的映射，以及 feature 级类型化测试映射
8. 提交：`test(<scope>): add TDD test cases`

完成后运行 `/cube:check` → `/cube:advance`。advancing 到 04 阶段时自动锁定测试文件及测试资源文件并从 test-map.yaml 生成 STATUS.yaml。

### Stage 04-development: Green Phase — Implement to Pass

按 STATUS.yaml 的任务顺序，逐任务实现：

1. 从 STATUS.yaml 找到第一个 phase 不是 `done` 的任务
2. 读取该任务的 test_file，分析每个测试用例函数/方法的期望行为
3. 在 `${paths.source_dir}` 编写实现代码，目标：让该 test_file 中所有测试用例通过
4. **绝不修改测试文件及测试资源文件** — 测试是锁定的契约，实现必须适配测试
5. 测试通过后更新 STATUS.yaml：phase → `green`，提交：`feat(<scope>): implement <task>`
6. 在所有测试保持通过的前提下重构，更新 STATUS.yaml：phase → `done`，提交：`refactor(<scope>): refactor after green`
7. 继续下一个任务，直到所有任务 phase 都是 `done`

### Coverage Verification

运行 `/cube:check` 验证：
- 全量测试通过
- STATUS.yaml 所有任务 phase = done
- 当前 feature 的组件链测试通过
- design.md 声明的类型化测试规范已有执行证据

### Stage 05-testing: Full Integration and Acceptance

05 阶段按项目/功能类型执行全面集成和全链路验收：

1. 读取 design.md 的 Output Contract 和测试规范声明
2. 复核项目结构，识别 Web/API、SQL/query、CLI、batch/job、messaging、library/SDK、多组件集成等类型
3. 读取 `standards/testing/` 下对应规范
4. 结合语言 preset 的命令执行完整测试
5. 在 test-report.md 中记录 Standards Evidence、未覆盖链路和是否阻塞验收

语言 preset 只定义怎么运行；类型化 standards 定义应该测什么。

## Interface Change Flow

If interfaces must change after tests are locked:

1. Update the design doc in `.cube/iterations/{branch}/design.md`
2. Run `/cube:check 02-design` — must PASS
3. Run `cube-unlock "interface change: <reason>"`
4. Delete old test files and test resource files for the affected task
5. Re-derive tests from new design (back to Red Phase)
6. Implement until tests pass
7. Run `cube-lock`

## Task Progress Tracking

STATUS.yaml tracks each Development Task's phase:

```
locked → green → done
```

When all tasks reach `done`, run `/cube:advance` to proceed to stage 05.
