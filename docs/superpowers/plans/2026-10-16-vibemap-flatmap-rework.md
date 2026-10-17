# VibeMap Flat Map Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace grouped Project Map with flat bounded grid + curved arrows, and revert AI settings to manual fields.

**Architecture:** Keep `diagram.js` output shape (`groups/rootFiles/edges`); flatten in `dashboard.js:renderMap` only. Single jsPlumb Bezier instance with Continuous anchors + per-duplicate curviness. Grid layout sets explicit canvas size; existing `zoomFit()` fits it. Settings reverts to radio + manual inputs.

**Tech Stack:** Electron 33, jsPlumb Community 2.15.6, Playwright + Electron.

**Spec:** This TASK text (5 numbered changes). Executor reads both.

## Global Constraints

- jsPlumb Community 2.15.6 only — no new dependencies.
- `diagram.js` exports `{ generateDiagram, MAX_NODES, MAX_PER_FOLDER, resolveImport }` unchanged.
- IPC shape `{ type: 'cloud'|'ollama', endpoint, apiKey, model }` unchanged.
- Never log raw API key value; mask as `<redacted>`.
- Keep pan via mouse-drag on empty background unchanged.
- Each slice: RED→GREEN→regression, APP-ALIVE-NO-CRASH launch check, test count before/after; slices 1-4 require screenshot visual confirm on real multi-file repro.
- Runner: `npx playwright test <file> -v` (testDir `./tests`, timeout 60000).

## Review Focus

- 30+ file project flat grid still fits via Fit without scroll-cut — expect full grid visible, no dead space.
- Two edges sharing exact from/to pair render as two separated curves — expect distinct `d` paths.
- Custom endpoint + fetch-models failure keeps freeform model editable and save works — expect manual save succeeds.
- Empty diagram zoomFit — expect no throw, 100%, pan 0,0.
- Special-char API key (`"` + unicode) round-trips intact, never in logs, toggle masks — expect value preserved, logs clean.

---
### Task 0: Baseline + harness

**Files:**
- Modify: none (read-only)
- Test: all in `tests/`

**Interfaces:**
- Consumes: none
- Produces: BEFORE count + launch proof

- [ ] **Step 1: Record BEFORE count**

Run: `npx playwright test --list`
Expected: ~110 tests listed; note number.

- [ ] **Step 2: APP-ALIVE launch check**

Run: `npx playwright test tests/dashboard.spec.js -v`
Expected: PASS

- [ ] **Step 3: No commit (read-only)**

```bash
git status --short
```

---
### Task 1: Flat file list, no group boxes

**Files:**
- Modify: `dashboard.js:177-184` (`makeFileCard` subtitle), `dashboard.js:229-315` (`renderMap`), `dashboard.js:356` (pan guard), `index.html:11-13` (`<style>`)
- Test: Create `tests/map-flat.spec.js`; modify `tests/map-interactive.spec.js`, `tests/map-layout.spec.js`, `tests/ux-visual.spec.js`, `tests/bugfix-batch.spec.js`, `tests/map-zoom.spec.js`, `tests/map-routing.spec.js` (group refs)

**Interfaces:**
- Consumes: `flatDiagramFiles(diagram)` → `[{id,name,kind,badge,group}]`; `diagram.edges[]`
- Produces: `#mapCanvas > .map-file` only, zero `.map-group`; card subtitle = folder context

- [ ] **Step 1: Write failing test `tests/map-flat.spec.js::flat grid, folder subtitle, no groups`**

```js
// GROUPED fixture (2 groups + rootFiles), open dashboard, then:
await expect(win.locator('.map-group')).toHaveCount(0);
expect(await win.locator('#mapCanvas > .map-file').count()).toBe(4); // 2+1+1 root
const sub = await win.locator('.map-file[data-file="src/a.js"] span span:last-child').textContent();
expect(sub).toContain('src/');
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx playwright test tests/map-flat.spec.js -v`
Expected: FAIL (`.map-group` count 2, not 0)

- [ ] **Step 3: Implement `renderMap` flatten in `dashboard.js:229-315`**

Delete `makeGroupBox` usage, group loop, `ROOT_COLS` block, `byGroup`; render `files` (from `flatDiagramFiles`) directly as flat cards with `wireTooltip(card, f.id, f.group)`. Subtitle in `makeFileCard`: second line = `(f.group ? f.group + ' · ' : '') + (f.kind || '')`. Pan guard `'.map-file, .map-group, button'` → `'.map-file, button'`. Leave `makeGroupBox` function dead or delete; leave `diagram.js` untouched.

- [ ] **Step 4: Update style `index.html:11-13` — drop `.map-group` rule**

```css
.jtk-connector{z-index:0}
.map-file{z-index:1}
```

- [ ] **Step 5: Run new test PASS**

Run: `npx playwright test tests/map-flat.spec.js -v`
Expected: PASS

- [ ] **Step 6: Fix broken group tests (same slice)**

`map-interactive.spec.js`: delete/replace collapse, resize, group-count tests with flat equivalents (card count, subtitle check). `map-layout.spec.js`, `map-routing.spec.js`, `map-zoom.spec.js`, `ux-visual.spec.js`, `bugfix-batch.spec.js`: replace `.map-group` selectors with `#mapCanvas > .map-file`; `zoomFit` measures root cards only (Task 4 updates it fully).

- [ ] **Step 7: Regression + launch**

Run: `npx playwright test tests/map-flat.spec.js tests/map-interactive.spec.js tests/dashboard.spec.js -v`
Expected: PASS

- [ ] **Step 8: Screenshot + count + commit**

Screenshot `#mapArea` on 10+ file multi-group repro → `test-results/flat-grid.png`; confirm no boxes, folder shown on cards.
```bash
npx playwright test --list
git add dashboard.js index.html tests/map-flat.spec.js tests/map-interactive.spec.js tests/map-layout.spec.js tests/ux-visual.spec.js tests/bugfix-batch.spec.js tests/map-zoom.spec.js tests/map-routing.spec.js
git commit -m "feat(map): flat file grid, no group boxes"
```

---
### Task 2: Bezier curves + arrowheads

**Files:**
- Modify: `dashboard.js:262-263` (jsPlumb instance)
- Test: Create `tests/map-curves.spec.js`

**Interfaces:**
- Consumes: flat cards from Task 1
- Produces: `window.__mapConnectorOpts = { name: 'Bezier', curviness: 50 }`; Arrow overlay on each connection

- [ ] **Step 1: Write failing test `tests/map-curves.spec.js::bezier with arrows`**

```js
const opts = await win.evaluate(() => window.__mapConnectorOpts || null);
expect(opts.name).toBe('Bezier');
expect(opts.curviness).toBe(50);
expect(await win.locator('.jtk-connector').count()).toBeGreaterThan(0);
// arrow overlay present per connection:
const arrows = await win.evaluate(() => window.__mapArrowCount || 0);
expect(arrows).toBe(2); // fixture has 2 edges
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx playwright test tests/map-curves.spec.js -v`
Expected: FAIL (name is `Flowchart`)

- [ ] **Step 3: Implement instance in `dashboard.js:262-263`**

Exact: `window.jsPlumb.getInstance({ Container: canvas, Connector: ['Bezier', { curviness: 50 }], PaintStyle: { stroke: '#9aa0ff', strokeWidth: 2 }, Endpoint: 'Blank', Anchors: ['Continuous', 'Continuous'], Overlays: [['Arrow', { location: 1, width: 10, length: 10 }]] })` + `window.__mapConnectorOpts = { name: 'Bezier', curviness: 50 }`. Keep direct (`#9aa0ff` solid) / transitive (`#b7bbe6` dashed `4 3`) `paintStyle` per connection. After connecting all, set `window.__mapArrowCount = (diagram.edges||[]).length` filtered to valid ids (test hook; overlays themselves need no hook).

- [ ] **Step 4: Run PASS**

Run: `npx playwright test tests/map-curves.spec.js -v`
Expected: PASS

- [ ] **Step 5: Regression + launch**

Run: `npx playwright test tests/map-curves.spec.js tests/map-flat.spec.js tests/dashboard.spec.js -v`
Expected: PASS

- [ ] **Step 6: Screenshot + count + commit**

Screenshot `#mapArea` → `test-results/bezier-arrows.png`; confirm curves + arrowheads, no right angles.
```bash
npx playwright test --list
git add dashboard.js tests/map-curves.spec.js
git commit -m "feat(map): bezier arrow connectors"
```

---
### Task 3: Fan-out — no stacked edges

**Files:**
- Modify: `dashboard.js:299-310` (connect loop)
- Test: extend `tests/map-curves.spec.js`

**Interfaces:**
- Consumes: `diagram.edges[]` with possible duplicate from/to
- Produces: `window.__mapEdgeCurviness = [{from,to,curviness}]` with duplicates fanned

- [ ] **Step 1: Write failing test `::duplicate edges fan out`**

```js
// diagram with edges [a->b, a->b] (same pair twice):
const curves = await win.evaluate(() => window.__mapEdgeCurviness || []);
expect(curves.length).toBe(2);
expect(curves[0].curviness).not.toBe(curves[1].curviness);
const ds = await win.locator('.jtk-connector path').evaluateAll((els) => els.map((p) => p.getAttribute('d')));
expect(new Set(ds).size).toBe(2);
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx playwright test tests/map-curves.spec.js -v`
Expected: FAIL (curviness equal / single connection)

- [ ] **Step 3: Implement per-edge curviness in connect loop**

Count seen pairs: `curviness = 50 + 10 * dupIndex`; pass per-connection `Connector: ['Bezier', { curviness }]` in `mapJsplumb.connect({ source, target, paintStyle: style, Connector: [...] })`; push `{from,to,curviness}` to `window.__mapEdgeCurviness`. Instance stays `Continuous/Continuous` from Task 2 so distinct pairs auto-space.

- [ ] **Step 4: Run PASS**

Run: `npx playwright test tests/map-curves.spec.js -v`
Expected: PASS

- [ ] **Step 5: Regression + launch**

Run: `npx playwright test tests/map-curves.spec.js tests/map-flat.spec.js tests/map-interactive.spec.js -v`
Expected: PASS

- [ ] **Step 6: Screenshot + count + commit**

Repro with 3 parallel edges between same areas → `test-results/fanout.png`; confirm separated curves.
```bash
npx playwright test --list
git add dashboard.js tests/map-curves.spec.js
git commit -m "feat(map): fan out stacked edges"
```

---
### Task 4: Bounded grid + Fit with no dead space

**Files:**
- Modify: `dashboard.js:264-298` (grid placement), `dashboard.js:327-347` (`zoomFit`), `index.html:90-91` (`#mapCanvas` style if needed)
- Test: Create `tests/map-bounded.spec.js`

**Interfaces:**
- Consumes: flat `files[]` (length n)
- Produces: `cols = min(6, max(1, ceil(sqrt(n))))`; card at `left=20+col*190`, `top=20+row*90`; `canvas.style.width/height` = exact box; `zoomFit()` shows all, pan `0,0`

- [ ] **Step 1: Write failing test `tests/map-bounded.spec.js::grid bounded, fit no dead space`**

```js
// 12 files → cols=4, rows=3, width=20+4*190=780, height=20+3*90=290
const size = await win.locator('#mapCanvas').evaluate((e) => ({ w: parseInt(e.style.width), h: parseInt(e.style.height) }));
expect(size.w).toBe(780);
expect(size.h).toBe(290);
await win.locator('#zoomFit').click();
expect(await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'))).toBe('0,0');
const scroll = await win.locator('#mapArea').evaluate((a) => ({ sw: a.scrollWidth, cw: a.clientWidth, sh: a.scrollHeight, ch: a.clientHeight }));
expect(scroll.sw).toBeLessThanOrEqual(scroll.cw + 2);
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx playwright test tests/map-bounded.spec.js -v`
Expected: FAIL (no explicit canvas size)

- [ ] **Step 3: Implement grid + canvas size in `renderMap`**

Replace placement with index grid over flat `files`. Set `canvas.style.width = (20 + cols*190) + 'px'`, `canvas.style.height = (20 + rows*90) + 'px'`. Keep card `170px` width. Update `zoomFit` to measure `#mapCanvas > .map-file` only (no `.map-group`), skip zero-size, same pan-reset + min/max clamp.

- [ ] **Step 4: Run PASS**

Run: `npx playwright test tests/map-bounded.spec.js -v`
Expected: PASS

- [ ] **Step 5: Regression + launch**

Run: `npx playwright test tests/map-bounded.spec.js tests/map-flat.spec.js tests/map-zoom.spec.js tests/dashboard.spec.js -v`
Expected: PASS

- [ ] **Step 6: Screenshot + count + commit**

Screenshot full grid + after Fit → `test-results/bounded-fit.png`; confirm no empty scroll space.
```bash
npx playwright test --list
git add dashboard.js index.html tests/map-bounded.spec.js
git commit -m "feat(map): bounded grid sized to content"
```

---
### Task 5: Revert provider dropdown + prefill (manual fields only)

**Files:**
- Modify: `index.html:133-142` (delete `#providerSelect` block), `dashboard.js:496-538` (delete `suggestModel`, `PROVIDER_PRESETS`, `presetKeyFor`, `applyProviderPreset`), `dashboard.js:578-601` (`openSettings`), `dashboard.js:639-669` (radio/preset/maybeSuggest wiring), `dashboard.js:718-730` (save mapping)
- Test: Delete `tests/settings-providers.spec.js` dropdown tests → new `tests/settings-manual.spec.js`; modify `tests/settings.spec.js:54-75` (delete suggest test)

**Interfaces:**
- Consumes: `window.vibemap.{getProviderConfig,saveProviderConfig,fetchModels}`
- Produces: radio `cloud/ollama` only; `endpointInput` default `''`, `modelInput` default `''`, no auto-fill; `#apiKeyInput[type=password]` + `#apiKeyToggle` kept; save maps radio → `{type,endpoint,apiKey,model}`

- [ ] **Step 1: Write failing test `tests/settings-manual.spec.js::manual only, no prefill`**

```js
await win.locator('#settingsLink').click();
await expect(win.locator('#providerSelect')).toHaveCount(0);
await expect(win.locator('#endpointInput')).toHaveValue('');
await win.locator('#endpointInput').fill('https://api.openai.com/v1');
await expect(win.locator('#modelInput')).toHaveValue('');
await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'password');
await win.locator('#apiKeyToggle').click();
await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'text');
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx playwright test tests/settings-manual.spec.js -v`
Expected: FAIL (`#providerSelect` exists)

- [ ] **Step 3: Implement revert in `index.html` + `dashboard.js`**

Delete select block; delete preset consts + fns; `openSettings` fills saved-or-empty only; delete `maybeSuggest` + endpoint/radio/preset listeners (keep `paintCards`); save uses radio type directly. Keep `#apiKeyToggle`, `#fetchModelsBtn`/`#modelSelect` (fetch-only population), radio cards. No `console.log` of key.

- [ ] **Step 4: Delete obsolete tests (same commit)**

Delete `tests/settings-providers.spec.js`; delete `settings.spec.js` endpoint-suggest test; keep `settings.spec.js` save/persist/gate, `models-ui.spec.js`, `persist.spec.js` passing unchanged.

- [ ] **Step 5: Run PASS**

Run: `npx playwright test tests/settings-manual.spec.js tests/settings.spec.js tests/models-ui.spec.js tests/provider.spec.js tests/persist.spec.js -v`
Expected: PASS

- [ ] **Step 6: Launch check + count + commit**

Run: `npx playwright test tests/dashboard.spec.js -v`
Expected: PASS
```bash
npx playwright test --list
git add index.html dashboard.js tests/settings-manual.spec.js tests/settings-providers.spec.js tests/settings.spec.js
git commit -m "revert(settings): manual endpoint and model, no prefill"
```

---

## Self-Review

- Spec coverage: (1) flat+subtitle ✓ T1; (2) Bezier+Arrow keeping stroke styles ✓ T2; (3) Continuous + duplicate curviness ✓ T3; (4) sqrt-cols grid + exact canvas + Fit ✓ T4; (5) dropdown/prefill removal, radio+toggle kept, IPC unchanged ✓ T5.
- Step scan: each step one action with checkable output; no TBDs.
- Type consistency: `__mapConnectorOpts`, `__mapEdgeCurviness`, `__mapArrowCount` hooks consistent across T2/T3; `cols` formula identical in T4 test + code; settings IDs stable.
- Proportion: signatures + values only, bodies limited to grid/zoomFit/connect where tests don't determine them.
