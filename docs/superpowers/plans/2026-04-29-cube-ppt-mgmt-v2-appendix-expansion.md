# CUBE MGMT V2 Appendix Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `docs/cube-project-intro-mgmt-v2.pptx` so the five stage introduction slides include concise deliverable explanations, and replace the single appendix overview slide with five detailed appendix slides, one per stage.

**Architecture:** Use `python-pptx` to load the existing management v2 deck, rewrite the deliverable-description text on slides 5-9, remove the current appendix overview slide, append five detailed appendix slides in the same visual style, and verify the resulting slide titles and count.

**Tech Stack:** Python 3, `python-pptx`

---

### Task 1: Update front-stage slides

**Files:**
- Modify: `docs/cube-project-intro-mgmt-v2.pptx`

- [ ] **Step 1: Load the deck and target slides 5-9**

Run: `python3 -c "from pptx import Presentation; prs=Presentation('docs/cube-project-intro-mgmt-v2.pptx'); print(len(prs.slides))"`
Expected: deck opens successfully.

- [ ] **Step 2: Rewrite the one-line deliverable explanation on each stage slide**

```text
01 PRD: 明确功能范围、优先级、验收标准和不做事项
02 Design: 沉淀影响分析、接口方案、任务拆解和关键设计决策
03 Test Cases: 固定功能测试、组件链路测试和类型化测试映射
04 Development: 记录任务状态、测试结果、代码变更和开发轨迹
05 Testing: 汇总端到端集成链路测试、验收结论、覆盖缺口和剩余风险
```

### Task 2: Expand the appendix

**Files:**
- Modify: `docs/cube-project-intro-mgmt-v2.pptx`

- [ ] **Step 1: Remove the current one-page appendix overview**

Expected: existing appendix title `附录：五阶段核心产出一览` disappears.

- [ ] **Step 2: Append five appendix slides**

```text
Appendix titles:
- 附录：01 PRD 核心产出
- 附录：02 Design 核心产出
- 附录：03 Test Cases 核心产出
- 附录：04 Development 核心产出
- 附录：05 Testing 核心产出
```

- [ ] **Step 3: Make 03 and 05 explicitly detailed**

```text
03 should mention:
- 功能测试用例
- 组件链路测试
- 类型化测试映射
- 失败测试基线

05 should mention:
- 全量测试结果
- 端到端集成链路测试
- 验收报告
- 覆盖缺口
- 剩余风险
```

### Task 3: Verify

**Files:**
- Verify: `docs/cube-project-intro-mgmt-v2.pptx`

- [ ] **Step 1: Reopen the deck and print titles**

Run a script to print slide count and each slide title.

- [ ] **Step 2: Confirm the appendix is now five slides**

Expected: the last five slide titles match the appendix titles above.
