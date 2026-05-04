# CUBE Developer-Focused PPT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `docs/cube-project-intro-dev.pptx`, a developer-focused presentation that keeps the visual style of `docs/cube-project-intro-mgmt.pptx` while shifting the narrative toward Contract, TDD, Gate, regress/unlock, and day-to-day execution.

**Architecture:** Build the new deck with `python-pptx` using the same light-background card layout language as the management deck. Reuse the five stage-summary slides pattern, then add developer-specific slides for plugin structure, `.cube` runtime artifacts, execution loop, and command flow.

**Tech Stack:** Python 3, `python-pptx`, existing `docs/cube-project-intro-mgmt.pptx` as visual reference

---

### Task 1: Define the developer deck structure

**Files:**
- Read: `docs/cube-project-intro-mgmt.pptx`
- Create: `docs/cube-project-intro-dev.pptx`

- [ ] **Step 1: Confirm the management deck section pattern**

Run: `python3 -c "from pptx import Presentation; prs=Presentation('docs/cube-project-intro-mgmt.pptx'); print(len(prs.slides))"`
Expected: slide count prints successfully.

- [ ] **Step 2: Lock the developer deck outline**

```text
1 cover
2 agenda
3 positioning
4 core mechanism
5-9 five stage slides
10 plugin structure
11 .cube runtime artifacts
12 execution loop
13 command flow
14 summary
```

### Task 2: Generate the deck

**Files:**
- Create: `docs/cube-project-intro-dev.pptx`

- [ ] **Step 1: Build a new deck using the same visual system**

Use:
- light gray background
- dark CUBE tag in the top-right
- rounded cards
- stage progress strip on stage slides

- [ ] **Step 2: Emphasize method before mechanics**

```text
Front half priorities:
- why Contract matters
- why tests must come before implementation
- how Gate blocks fake progress
- when regress/unlock should be used
```

- [ ] **Step 3: Add execution support slides**

```text
Back half priorities:
- repository/plugin structure
- .cube iteration artifacts
- locked -> green -> done loop
- init/dev/check/advance/status/regress/unlock command flow
```

### Task 3: Verify and hand off

**Files:**
- Verify: `docs/cube-project-intro-dev.pptx`

- [ ] **Step 1: Reopen the generated deck**

Run: `python3 -c "from pptx import Presentation; Presentation('docs/cube-project-intro-dev.pptx'); print('dev ok')"`
Expected: `dev ok`

- [ ] **Step 2: Check slide titles**

Run a quick script to print the first text element from each slide and confirm the expected 14-slide outline.

- [ ] **Step 3: Record output**

```bash
git add docs/cube-project-intro-dev.pptx docs/superpowers/plans/2026-04-29-cube-ppt-dev-version.md
```
