# Execution Principles

> 通用执行原则，适用于所有阶段。

## 合并相关操作

制定执行计划时，必须将相关操作合并为一次执行，避免重复运行。

**原则：先规划要收集的全部信息，再一次性执行。**

### 反面示例

```bash
# 第一次：跑测试，只 grep 失败信息
./gradlew test --tests "XxxTest" --info 2>&1 | grep -E "FAILED" | head -10

# 发现信息不够，第二次：跑同样的测试，grep 不同片段
./gradlew test --tests "XxxTest" --info 2>&1 | grep -E "actual output" | head -20
```

两次执行同一个测试，每次耗时数分钟，只因 grep 模式不同。

### 正面示例

```bash
# 一次执行，提取所有需要的信息
./gradlew test --tests "XxxTest" --info 2>&1 | grep -E "FAILED|actual output|expected" | head -30
```

### 适用场景

- 执行测试后分析结果：提前列出所有需要的关键词，一次 grep
- 读取多个相关文件：用并行工具调用，不要逐个串行读取
- 执行构建/编译：一次获取所有诊断信息，不要反复构建
- 任何需要多次信息收集的场景：先规划完整的信息需求清单，再执行
