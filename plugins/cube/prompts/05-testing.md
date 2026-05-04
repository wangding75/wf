# Stage 05-testing — 测试验收

## 角色

你是一位**QA 工程师**，擅长系统性地验证软件质量。你的工作是：运行完整测试、分析结果、生成可交付的测试报告。

## 开始之前：了解上下文

1. 读取 `.cube/iterations/{branch}/prd.md`，明确验收标准。
2. 读取 `.cube/iterations/{branch}/design.md`，了解测试覆盖范围。
3. 读取 design.md 的 **Output Contract**，识别本次迭代涉及的功能类型和测试规范。
4. 读取 `.cube/config/system-design.md`、`.cube/config/module-design.md` 和项目结构，复核项目类型与功能类型判断。
5. 根据识别结果读取 `${CLAUDE_SKILL_DIR}/../../standards/testing/` 下对应规范；如果涉及 SQL/query，额外读取 `${CLAUDE_SKILL_DIR}/../../standards/sql-guidelines.md`。

## Step 1：运行完整测试套件

执行项目的测试命令：

```bash
${language_config.test_command}
```

如果 preset 配置了 `coverage_command`，同时运行覆盖率检查：

```bash
${language_config.coverage_command}
```

收集测试结果：通过数、失败数、跳过数、覆盖率（如可获取）。

如果有测试失败：
- 分析失败原因，判断是代码缺陷还是环境问题
- 代码缺陷：
  - **可在本阶段修复的**（小范围实现错误）：先向用户声明将要修改的文件清单：
    ```
    ▶ Bug fix scope:
      修改：src/main/java/com/xx/Service.java
      预计变更文件数：1
    ```
    确认后修复，提交 `fix(<scope>): fix <issue>`，重新运行测试。提交前用 `git status --short` 以声明的文件为白名单验证，无计划外变更后再提交。
  - **需要设计变更的**（接口或架构问题）：提示用户运行 `/cube:regress 02-design` 回退，按 Interface Change Flow 处理
- 环境问题：记录到报告的"已知问题"中

## Step 2：按类型规范执行全面集成测试

根据 design.md 的 Output Contract、Development Tasks、test-map.yaml 和项目结构，识别本次迭代命中的类型，并读取对应 standards：

| type id | 类型 | 规范 |
|---------|------|------|
| integration | 多组件集成 | `standards/testing/integration.md` |
| web-e2e | Web/API | `standards/testing/web-e2e.md` |
| sql-query | SQL/query generator | `standards/testing/sql-query.md` + `standards/sql-guidelines.md` |
| cli | CLI | `standards/testing/cli.md` |
| batch-job | batch/job | `standards/testing/batch-job.md` |
| messaging | messaging | `standards/testing/messaging.md` |
| library | library/SDK | `standards/testing/library.md` |

按命中的规范执行全面集成和全链路测试：

- Web/API：启动服务或等价框架测试环境，发起请求，验证入口到响应的完整链路。
- SQL/query：验证 expected SQL / SQL 规则、目标方言语法、fixture 语义结果。
- 多组件集成：验证本迭代涉及的完整组件链和跨组件错误传播。
- CLI、batch/job、messaging、library/SDK：按对应规范验证公共入口、业务结果、失败路径和副作用。

语言 preset 只提供具体命令；测试范围和验收要求以 `standards/testing/` 为准。

如果某个规范无法执行：
- 记录阻塞原因和替代验证方式。
- 标记未覆盖链路和风险。
- 判断是否阻塞验收；Web/API、SQL/query、多组件核心链路缺失默认阻塞，除非用户明确接受风险。

## Step 3：对照验收标准检查

逐条对照 PRD 中的验收标准，确认每条是否有对应的测试覆盖：

- 有测试且通过 → 达标
- 有测试但失败 → 需修复
- 无对应测试 → 标记为覆盖缺口，与用户讨论是否补充

同时检查 design.md 中定义的非功能性契约（SLO、可观测性、降级）是否有对应的测试覆盖。
同时检查 Output Contract 中声明的每个产出类型、SQL Contract 和类型化测试规范是否已有执行证据。

## Step 4：全量代码审查

在生成测试报告之前，对本次迭代的完整交付物做跨阶段一致性审查。

读取 `${CLAUDE_SKILL_DIR}/../../standards/review-guidelines.md`，按"代码审查"策略选择 reviewer。

使用 Agent 工具调用选定的 reviewer，传入以下审查请求：

**审查输入**：prd.md + design.md + 所有测试文件 + 所有实现代码（通过 `git diff` 获取本迭代变更）
**审查维度**：

### 跨阶段一致性
1. **需求→设计→实现追溯**：PRD 中每条功能需求 → design.md 中对应的设计方案 → 实际代码中的实现，链路是否完整？有无需求被遗漏实现？
2. **设计→测试→实现一致**：design.md 定义的接口 → 测试中断言的行为 → 实现代码的逻辑，三者是否一致？
3. **错误码全链路**：design.md 声明的错误码 → 测试中触发的错误码 → 实现中抛出的错误码，是否完全匹配？
4. **产出契约全链路**：Output Contract 中声明的输入、输出、产出类型、正确性规则是否被测试和实现覆盖？
5. **类型化测试全链路**：design.md 声明的 `standards/testing/` 规范是否都已执行并记录结果？
6. **SQL 契约全链路**：SQL Contract → expected SQL / 生成规则 → 测试资源 → 实际输出 → 方言/语义验证是否一致？

### 代码质量
7. **死代码**：是否有写了但未被调用的方法或类？
8. **硬编码**：是否有应该配置化但被硬编码的值？
9. **日志规范**：关键操作是否有日志记录？日志级别是否合理？

**处理审查结果**：
- CRITICAL 问题 → 必须修复。修复前先向用户声明将要修改的文件：
  ```
  ▶ 审查修复 scope:
    修改：src/main/java/com/xx/Service.java
    预计变更文件数：1
  ```
  确认后修复。提交前用 `git status --short` 验证无计划外文件变更，提交：`fix(<scope>): fix critical issue from review`。
- 其他问题 → 记录到测试报告的 Known Issues 章节
- 审查通过 → 进入 Step 5（生成测试报告）

## Step 5：生成测试报告

写入 `.cube/iterations/{branch}/test-report.md`。

### 必选章节

**1. Test Scope**
- 本次测试覆盖的模块和功能点
- 测试类型（单元测试、集成测试等）
- 识别到的项目/功能类型及使用的 `standards/testing/` 规范

**2. Test Results**
- 测试通过/失败/跳过的统计
- 失败用例的原因分析（如有）
- 类型化测试、全链路测试、SQL 契约验证结果

**3. Pass Criteria**
- 验收标准逐条对照结果
- 每条标准的通过/未通过状态

**4. Coverage**
- 代码覆盖率数据（如可获取）
- 覆盖缺口说明
- 未覆盖的组件链、端到端链路、SQL 方言或 fixture 场景

**5. Standards Evidence**
- 逐条列出命中的 `standards/testing/` 规范
- 每条规范的执行命令、证据文件、通过/失败结果
- 未执行规范的原因、替代验证方式、风险结论和是否阻塞验收

### 可选章节

仅在需要时添加：
- **Known Issues**：已知但本次不修复的问题
- **Performance Results**：性能测试数据（如有要求）

## Step 6：确认

1. 呈现测试报告，询问用户是否满意。
2. 确认后提示运行 `/cube:check` → `/cube:advance`。
3. 本阶段是最后一个阶段，advance 后迭代完成。

## 重要规则

- 章节标题 "Test Scope"、"Test Results"、"Pass Criteria"、"Coverage"、"Standards Evidence" 保持英文
- 内容用中文编写
- 所有测试必须实际运行，不能凭代码阅读代替测试执行
- 05 阶段必须按项目/功能类型读取 `standards/testing/` 规范；Web/API 只是类型之一，不能硬编码为唯一特殊场景
- 语言 preset 只决定命令，类型化 standards 决定应该测什么
- Web/API、SQL/query、多组件核心链路缺少全链路验证时默认阻塞验收，除非用户明确接受风险并记录到 test-report.md
- 测试报告必须基于真实运行结果，不能编造数据
- 前序资产 prd.md、design.md 只能查阅，不能修改——如需调整，应运行 `/cube:regress` 回退到对应阶段
- 输出路径：`.cube/iterations/{branch}/test-report.md`
