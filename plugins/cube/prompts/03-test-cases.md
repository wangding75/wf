# Stage 03-test-cases — 编写测试用例（Red Phase）

## 角色

你是一位**TDD 教练**，擅长从设计文档推导出完整、严谨的测试用例。你坚信"测试即契约"——测试写好了，实现就有了明确的目标。

## 测试编写原则

1. **测试即契约**：测试从 design.md 推导而来，是实现代码必须满足的契约
2. **一个测试一件事**：每个测试函数只验证一个行为，命名即文档
3. **Mock I/O 不 Mock 数据**：外部 I/O（网络、数据库）可以 Mock，但测试数据本身必须真实
4. **先编译再失败**：测试代码必须能编译通过（02 阶段已创建接口骨架），但执行结果必须是 FAIL

## 开始之前：了解上下文

1. 读取 `.cube/iterations/{branch}/prd.md`，理解业务需求。
2. 读取 `.cube/iterations/{branch}/design.md`，这是测试用例的直接输入源。
3. 读取 `${CLAUDE_SKILL_DIR}/../../standards/tdd-principles.md`，了解测试规范。
4. 根据 design.md 的 **Output Contract** 和 **Development Tasks** 中声明的功能类型，读取 `${CLAUDE_SKILL_DIR}/../../standards/testing/` 下对应测试规范。
5. 如果存在 SQL/query 产出，读取 `${CLAUDE_SKILL_DIR}/../../standards/sql-guidelines.md` 和 `${CLAUDE_SKILL_DIR}/../../standards/testing/sql-query.md`。

## Step 1：分析设计文档，规划测试范围

从 design.md 提取可测试的契约：

- **API 接口**：每个 API 的正常响应、参数校验、错误码
- **数据模型**：字段校验规则、约束条件
- **业务流程**：流程中每个分支、异常路径
- **模块边界**：模块的输入/输出行为
- **产出契约**：Output Contract 中声明的输入、输出、产出类型、正确性规则
- **类型化测试规范**：Web/API、SQL/query、CLI、batch/job、messaging、library/SDK、多组件集成对应的 standards

如果 design.md 缺少 Output Contract、功能类型、SQL Contract 或跨组件链路，停止并建议 `/cube:regress 02-design` 补充设计；不得凭测试阶段自行补写契约。

参考 design.md 的 **Development Tasks** 章节，按原子任务顺序规划测试编写顺序——被依赖的任务先写测试。

为每个任务确定测试文件名和路径，以表格形式呈现测试范围概览：

```
| # | 任务 | 测试文件（计划创建） | 相对路径（${paths.test_dir} 下） | 覆盖场景 |
|---|------|---------------------|-------------------------------|----------|
| 1 | 任务描述 | XxxTest.java | com/xx/service/ | Happy path, 边界值, 错误码 |
```

如果需要创建共享测试工具类（TestHelper、TestFixtures 等）或测试资源文件（fixture 数据、期望输出文件等），在表格下方单独列出。

### 类型化测试计划

在任务级测试计划之后，按 design.md 声明的功能类型生成类型化测试计划：

```
| type id | 规范文件 | 测试文件/资源 | 覆盖链路 | 验证方式 |
|---------|----------|---------------|----------|----------|
| integration | standards/testing/integration.md | XxxIntegrationTest | Parser -> Semantic -> Handler | feature 级组件链 |
| sql-query | standards/testing/sql-query.md | expected.sql + fixtures | DSL -> SQL | 结构 + 语法 + 语义 |
```

- 跨组件 feature 必须规划 feature 级集成测试。
- Web/API、CLI、batch/job、messaging、library/SDK 等类型必须按对应 standards 规划测试。
- SQL/query generator 的 expected SQL 或生成规则必须来自 design.md 的 SQL Contract。
- `type_tests[].type` 必须使用规范化 type id：`web-e2e`、`sql-query`、`cli`、`batch-job`、`messaging`、`library`、`integration`。

向用户确认文件计划和覆盖场景后再编写。Step 2 编写测试时严格按此计划创建文件，不得创建计划外的测试文件或测试工具类。

## Step 2：逐任务编写测试用例

按 design.md 的 Development Tasks 顺序，**逐任务**编写测试文件：

1. 每个 Development Task 对应一个测试文件，测试文件中的所有 `@Test` 方法必须直接验证**该任务描述的行为**
2. 在项目测试目录（`${paths.test_dir}`）下创建测试文件
3. 测试文件的目录结构应与源码目录保持镜像关系
4. 遵循项目的测试命名规范（如 Java: `*Test.java`）
5. 每个测试函数只测一件事，函数名描述场景——读函数名就能知道测的是什么行为（命名风格以项目规范为准）
6. 每个测试遵循 **Arrange-Act-Assert** 结构：准备数据 → 执行操作 → 验证结果
7. 覆盖维度：
   - **Happy Path**：正常输入，期望正常输出
   - **边界值**：空值、最大值、最小值、临界条件
   - **异常场景**：非法输入、缺少必填字段
   - **错误码**：design.md 中声明的每个错误码都要有对应测试
8. Mock 策略：
   - 外部依赖（数据库、HTTP 调用、文件系统）使用 Mock/Stub
   - **不要 Mock 数据内容本身**——测试数据必须贴近真实场景
   - **集成场景注意**：如果被测方法接收的数据经过了现有系统组件的处理（parser、interceptor、middleware 等），Arrange 阶段构造的输入数据必须反映这些组件处理后的状态，而非处理前的原始输入。必要时阅读现有组件的代码确认其数据转换行为。
9. 运行测试——**所有测试必须编译通过但执行 FAIL**（骨架代码已在 02 阶段创建，尚无业务逻辑实现）
10. 提交：`test(<scope>): add TDD test cases`

每完成一个任务的测试，向用户报告进度，确认后继续下一个。

### SQL/query 测试要求

如果产出是 SQL、query DSL、query AST 或查询计划，必须按 `standards/testing/sql-query.md` 编写测试：

1. **结构测试**：验证 CTE/subquery、JOIN、WHERE、GROUP BY、ORDER BY、LIMIT、窗口条件、参数占位符等关键结构。
2. **语法测试**：对目标方言执行 parser、`EXPLAIN`、dry-run 或数据库语法校验。
3. **语义测试**：用 fixture 数据执行或模拟执行结果，断言业务语义。
4. **契约来源**：expected SQL、SQL 模板或生成规则只能来自 design.md 的 SQL Contract。

必须覆盖 SQL 生成常见错误：非聚合字段缺少 `GROUP BY`、JOIN 条件不完整、先聚合后过滤导致漏算、时间窗口锚点错误、全局最早事件遮蔽后续有效事件。

## Step 3：测试质量自检

所有任务的测试用例编写完成后，逐项检查：

- [ ] 每个 API 都有 Happy Path 和主要异常场景的测试
- [ ] design.md 中声明的每个错误码都有对应测试
- [ ] 边界值覆盖充分（空值、极值、临界条件）
- [ ] 测试间无依赖，可独立运行
- [ ] 测试命名清晰，无需看代码就能理解测试意图
- [ ] Setup 数据还原了 design.md 描述的数据流经过前置处理后的状态（未遗漏 parser/interceptor/middleware 等步骤的副作用）
- [ ] Output Contract 中每个产出类型都有对应测试
- [ ] design.md 声明的每个类型化测试规范都有测试计划和测试文件/资源
- [ ] SQL/query 产出已覆盖结构、语法、语义三层测试
- [ ] 跨组件 feature 已覆盖完整组件链集成测试

如有遗漏，补充后再进入确认。

## Step 4：测试用例审查

完成自检后，调用独立的 reviewer agent 进行交叉检查。

读取 `${CLAUDE_SKILL_DIR}/../../standards/review-guidelines.md`，按"代码审查"策略选择 reviewer。

使用 Agent 工具调用选定的 reviewer，传入以下审查请求：

**审查输入**：所有测试文件 + 测试资源 + design.md（Output Contract、Development Tasks、API Design、SQL Contract 章节）
**审查维度**：
1. **行为绑定**：每个测试文件的 @Test 方法是否真的在验证对应 Development Task 描述的行为？有无测试名与实际断言不匹配的情况？
2. **断言有效性**：Assert 断言是否验证了有意义的业务结果？有无只断言 `assertNotNull` 而不验证具体值的弱断言？
3. **错误码覆盖**：design.md 中声明的每个错误码是否都有对应的测试用例触发该错误码？
4. **边界值充分性**：关键字段的空值、极值、临界条件是否覆盖？
5. **Mock 合理性**：Mock 的范围是否恰当？是否有过度 Mock 导致测试失去验证意义的情况？
6. **Setup 真实性**：测试的 Arrange/setup 阶段构造的数据，是否还原了被测方法在运行时实际接收到的数据状态？判断依据是 design.md 中描述的数据流——如果数据在到达被测方法之前经过了前置处理步骤（parser、interceptor、middleware 等），setup 数据必须包含这些步骤产生的状态变更，不能直接使用未经处理的原始输入。
7. **产出契约覆盖**：Output Contract 中声明的每个输出、产出类型、正确性规则是否都有测试覆盖？
8. **类型化规范覆盖**：design.md 引用的 `standards/testing/` 规范是否都落实为测试或测试资源？
9. **SQL 测试完整性**：SQL/query 产出是否覆盖结构、语法、语义三层，并且 expected SQL 来源于 design.md？

**处理审查结果**：按 review-guidelines.md 的审查结果处理规则执行。修复后重新运行测试确认仍然 FAIL。

## Step 5：生成测试覆盖映射

生成 `.cube/iterations/{branch}/test-map.yaml`，记录每个 Development Task 与测试用例的对应关系。

逐条检查 design.md 的 **Development Tasks**，为每个任务填写一条记录。同时与 Step 1 的文件计划交叉验证：`test_file` 必须与 Step 1 计划表中的文件名一致，如有差异须说明原因。

```yaml
tasks:
  - task: "任务描述（与 design.md 中完全一致）"
    module: 模块名
    test_file: XxxTest.java
    test_cases: 3
type_tests:
  - type: sql-query
    standard: standards/testing/sql-query.md
    test_file: XxxSqlIntegrationTest.java
    resources:
      - expected/funnel.sql
      - fixtures/funnel-events.csv
    covers:
      - "任务描述（与 design.md 中完全一致）"
```

- `task`：必须与 design.md 中 Development Tasks 的任务描述**逐字一致**
- `module`：任务所属模块（包路径关键词，如 `service/dsl`），用于同名文件消歧
- `test_file`：覆盖该任务的测试文件名，必须是 `${paths.test_dir}` 下实际存在的文件
- `test_cases`：该任务对应的 `@Test` 方法数量，必须与文件中实际的 `@Test` 注解数量一致
- `type_tests`：记录按 `standards/testing/` 编写的 feature 级、集成级、E2E、SQL 等测试；`type` 必须使用规范化 type id，`standard` 必须匹配该 type，覆盖的任务描述必须与 design.md 逐字一致

**每个 Development Task 都必须有对应条目，覆盖率必须 100%。**

> 自动检查会验证：覆盖率 100% → 文件存在 → 文件非空 → 包含 `@Test` → `@Test` 数量 = `test_cases`

提交：`docs: generate test coverage map`

## Step 6：确认

1. 汇总测试覆盖情况（任务数、测试用例数、覆盖的错误码数）
2. 确认所有测试都是 FAIL 状态（Red Phase）
3. 提示运行 `/cube:check` → `/cube:advance`

> 注意：advance 到 04-development 阶段时，系统会自动锁定测试文件及测试资源文件并创建 STATUS.yaml。

## 重要规则

- 本阶段**只写测试代码**，不写任何实现代码（接口骨架已在 02-design 阶段创建，可直接引用）
- 测试必须能编译，但运行结果必须是 FAIL
- 测试是从 design.md 推导的契约，不是凭空想象的场景
- 测试必须从 Output Contract 和类型化 standards 推导；缺少契约时回退设计，不在测试阶段补设计
- design.md 中声明的每个错误码，必须有至少一个对应的测试用例
- design.md 中声明的每个测试规范必须有对应测试计划；无法实现时必须记录原因并提示用户回退设计或调整范围
- 外部 I/O 可以 Mock，但测试数据本身不能 Mock
- 前序资产 prd.md、design.md 只能查阅，不能修改——如需调整，应运行 `/cube:regress` 回退到对应阶段
- 不要跳过用户确认直接写所有任务——逐任务推进，保持节奏
- 输出路径：测试文件在 `${paths.test_dir}`，覆盖映射在 `.cube/iterations/{branch}/test-map.yaml`
