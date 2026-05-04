# CUBE PPT Two Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two presentation variants from `docs/cube-project-intro.pptx`: a management-facing version and a management-plus-development version, both with five new stage-introduction slides and lighter, more visual storytelling.

**Architecture:** Use `python-pptx` to clone the source deck into two output decks, then modify slides in-place: revise agenda/narrative text where needed, insert five consistently designed stage slides, remove or keep technical slides depending on audience, and verify the resulting `.pptx` files by reopening them with `python-pptx`.

**Tech Stack:** Python 3, `python-pptx`, existing source PPTX assets in `docs/`

---

### Task 1: Inspect source deck and define target structures

**Files:**
- Read: `docs/cube-project-intro.pptx`
- Create: `docs/cube-project-intro-mgmt.pptx`
- Create: `docs/cube-project-intro-mgmt-dev.pptx`

- [ ] **Step 1: Inspect source deck slide count and text anchors**

```python
from pptx import Presentation

prs = Presentation("docs/cube-project-intro.pptx")
print(len(prs.slides))
for i, slide in enumerate(prs.slides, 1):
    texts = []
    for shape in slide.shapes:
        if hasattr(shape, "text") and shape.text.strip():
            texts.append(shape.text.strip().splitlines()[0])
    print(i, texts[:5])
```

- [ ] **Step 2: Define the two target outlines**

```text
Management version:
1 cover
2 agenda
3 positioning/value
4 stage-gate contract
5 five new stage slides
6 quality control
7 roadmap
8 summary

Management+dev version:
keep the source deck narrative
insert five new stage slides after the contract slide
revise agenda and summary wording for dual audience
lightly tune detailed slides instead of removing them
```

- [ ] **Step 3: Reopen the source deck before editing**

Run: `python3 -c "from pptx import Presentation; Presentation('docs/cube-project-intro.pptx'); print('ok')"`
Expected: `ok`

### Task 2: Create the management version

**Files:**
- Modify: `docs/cube-project-intro-mgmt.pptx`

- [ ] **Step 1: Copy the source deck to the management output path**

```bash
cp docs/cube-project-intro.pptx docs/cube-project-intro-mgmt.pptx
```

- [ ] **Step 2: Insert five new stage slides with a shared visual template**

```python
stage_specs = [
    ("01 PRD", "明确业务目标与范围", "产品/需求方", "需求访谈, 边界澄清, 验收标准", "prd.md"),
    ("02 Design", "把需求变成技术方案", "架构/研发", "影响分析, 接口设计, 任务拆解", "design.md"),
    ("03 Test Cases", "先固化测试契约", "测试/TDD负责人", "编写失败测试, 规划覆盖, 锁定契约", "test-map.yaml"),
    ("04 Development", "按任务逐步实现", "研发/AI执行者", "读取测试, 最小实现, 通过后重构", "STATUS.yaml"),
    ("05 Testing", "形成验收证据", "QA/交付负责人", "全量测试, 集成验证, 输出报告", "test-report.md"),
]
```

- [ ] **Step 3: Remove or compress overly technical slides for management readability**

Run logic:
- keep cover, agenda, positioning, contract, quality, roadmap, summary
- remove detailed repository-structure and standards-detail slides if they distract from the executive story

- [ ] **Step 4: Rewrite agenda and closing text for management**

```text
Agenda should emphasize:
- why CUBE exists
- how the five stages reduce risk
- what managers can inspect
- what value and rollout path this enables
```

- [ ] **Step 5: Save and reopen the deck**

Run: `python3 -c "from pptx import Presentation; Presentation('docs/cube-project-intro-mgmt.pptx'); print('mgmt ok')"`
Expected: `mgmt ok`

### Task 3: Create the management+development version

**Files:**
- Modify: `docs/cube-project-intro-mgmt-dev.pptx`

- [ ] **Step 1: Copy the source deck to the mixed-audience output path**

```bash
cp docs/cube-project-intro.pptx docs/cube-project-intro-mgmt-dev.pptx
```

- [ ] **Step 2: Insert the same five stage slides, but add a light development panel**

```text
Each stage slide keeps the visual summary for management, plus a small block:
- Role
- Key actions
- Deliverable file
```

- [ ] **Step 3: Revise agenda and transition text so the later technical slides feel intentional**

```text
Agenda should split the deck into:
- management view: value, control, stages
- development view: plugin structure, runtime artifacts, execution loop
```

- [ ] **Step 4: Keep technical slides but reduce noise where possible**

```text
Shorten dense paragraphs and keep the actionable labels:
- skills/prompts/engine/templates
- .cube runtime artifacts
- testing and development loop
```

- [ ] **Step 5: Save and reopen the deck**

Run: `python3 -c "from pptx import Presentation; Presentation('docs/cube-project-intro-mgmt-dev.pptx'); print('mgmt-dev ok')"`
Expected: `mgmt-dev ok`

### Task 4: Verify structural integrity and summarize outputs

**Files:**
- Verify: `docs/cube-project-intro-mgmt.pptx`
- Verify: `docs/cube-project-intro-mgmt-dev.pptx`

- [ ] **Step 1: Check slide counts and first-page titles**

```python
from pptx import Presentation

for path in [
    "docs/cube-project-intro-mgmt.pptx",
    "docs/cube-project-intro-mgmt-dev.pptx",
]:
    prs = Presentation(path)
    print(path, len(prs.slides))
    for idx in [0, 1]:
        texts = [s.text for s in prs.slides[idx].shapes if hasattr(s, "text") and s.text.strip()]
        print(idx + 1, texts[:3])
```

- [ ] **Step 2: Confirm stage slides exist in both decks**

Run a script that searches for `01 PRD`, `02 Design`, `03 Test Cases`, `04 Development`, `05 Testing` in each output deck.
Expected: all five labels found in both files.

- [ ] **Step 3: Commit if needed**

```bash
git add docs/cube-project-intro-mgmt.pptx docs/cube-project-intro-mgmt-dev.pptx docs/superpowers/plans/2026-04-29-cube-ppt-two-versions.md
git commit -m "docs(cube): add presentation variants for management and mixed audiences"
```
