# Code Review Guidelines

> 本文件定义了 cube 工作流中 Review Step 的公共规范：如何选择 reviewer、如何处理审查结果。
> 各阶段提示词通过 `${CLAUDE_SKILL_DIR}/../../standards/review-guidelines.md` 引用本文件。

## Reviewer 选择策略

在调用审查之前，确定当前环境中可用的 reviewer agent。检查 Agent 工具可用的 `subagent_type`，按以下优先级选择最佳 reviewer。

**探测方法**：查看系统提示中列出的可用 agent 类型。如果列表中包含某个 subagent_type，即可使用。

### 设计审查

用于 02-design 阶段，审查设计文档的完整性和一致性。

| 优先级 | subagent_type | 来源 |
|--------|--------------|------|
| 1 | `superpowers:code-reviewer` | Superpowers 插件 |
| 2 | `everything-claude-code:architect` | ECC 插件 |
| 3 | 通用 Agent（不指定 subagent_type） | 内置 |

### 代码审查

用于 03-test-cases、04-development、05-testing 阶段，审查代码质量和逻辑正确性。

| 优先级 | subagent_type | 来源 |
|--------|--------------|------|
| 1 | `superpowers:code-reviewer` | Superpowers 插件 |
| 2 | `everything-claude-code:code-reviewer` | ECC 插件 |
| 3 | `everything-claude-code:{language}-reviewer` | ECC 插件（按项目语言选择，如 `java-reviewer`） |
| 4 | 通用 Agent（不指定 subagent_type） | 内置 |

`{language}` 取自 `workflow.yaml` 的 `project.language` 字段，转小写。

### 安全审查

用于 04-development 阶段，审查安全漏洞。

| 优先级 | subagent_type | 来源 |
|--------|--------------|------|
| 1 | `everything-claude-code:security-reviewer` | ECC 插件 |
| 2 | 通用 Agent（不指定 subagent_type） | 内置 |

### 选择规则

- 选择可用的最高优先级 reviewer
- 如果所有外部 reviewer 都不可用，**必须使用通用 Agent**——将审查维度作为 prompt 传入，不能跳过审查
- 向用户报告选择了哪个 reviewer（如："使用 superpowers:code-reviewer 进行代码审查"）

## 审查请求格式

调用 Agent 工具时，prompt 必须包含：

1. **审查输入**：明确列出需要审查的文件（路径或内容）
2. **审查维度**：从阶段提示词复制具体的检查项
3. **输出要求**：要求 reviewer 按问题严重程度分类输出

## 审查结果处理

| 严重程度 | 定义 | 处理方式 |
|---------|------|---------|
| CRITICAL | 安全漏洞、数据丢失风险、核心逻辑错误 | **必须修复**，修复后重新审查 |
| HIGH | 功能缺陷、设计偏离、重要质量问题 | **必须修复**，修复后重新审查 |
| MEDIUM | 可维护性问题、次要质量问题 | 与用户讨论是否修复 |
| LOW | 风格建议、微小改进 | 记录但不阻塞 |

### 修复后重新审查

修复 CRITICAL/HIGH 问题后，必须重新调用同一个 reviewer 验证修复效果，直到无 CRITICAL/HIGH 问题。

### 审查通过条件

无 CRITICAL 和 HIGH 问题 → 审查通过，可进入下一步。
