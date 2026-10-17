# VibeMap UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Project Map edge routing, horizontal layout, zoom controls, and API key setup UX in 4 TDD slices.

**Architecture:** Keep existing `diagram.js` (dagre LR) + `dashboard.js` `renderMap` manual placement + jsPlumb 2.15.6 Flowchart connectors; extend settings UI in place, no new deps, no data-model break.

**Tech Stack:** Electron 33, jsPlumb Community 2.15.6, dagre 0.8.5, Playwright + Electron for tests.

**Spec:** This TASK text (4 numbered fixes) — pin exact values per task below; executors read both.

## Global Constraints

- jsPlumb Community 2.15.6 API only — no new dependencies.
- `diagram.js` keeps exporting `{ generateDiagram, MAX_NODES, MAX_PER_FOLDER, resolveImport }` with same shapes.
- Provider IPC shape `{ type: 'cloud'|'ollama', endpoint, apiKey, model }` unchanged (extend UI only, map to it).
- Never log raw API key value anywhere; mask as `<redacted>` in any debug output.
- Keep pan via mouse-drag on empty background unchanged in all map slices.
- Each slice: RED→GREEN→regression, APP-ALIVE-NO-CRASH launch check, test count before/after; slices 1/2/3 require screenshot visual confirm.
- Test runner: `npx playwright test <file> -v` (testDir `./tests`, timeout 60000).

## Review Focus

- Connector still cuts through a tall group box when source/target are far apart — expect it to route around outer box edge, not through.
- Single-row horizontal layout overflows narrow window — expect horizontal scroll in `#mapArea`, no vertical pile-up, no clipped cards.
- `zoomFit` on empty diagram (no groups/rootFiles) — expect no throw, zoom stays 100%, pan 0,0.
- Custom endpoint provider with fetch-models failure — expect freeform `modelInput` stays editable, save still works.
- API key with special chars (`"`, `\n`, unicode) — expect round-trip save/load intact, never appears in logs, masked input still toggles.

---

### Task 0: Baseline + harness

**Files:**
- Modify: none (read-only)
- Test: all in `tests/`

**Interfaces:**
- Consumes: none
- Produces: baseline counts + launch proof for Tasks 1-4

- [ ] **Step 1: Record baseline test count**

Run: `npx playwright test --list 2>&1 | tail -5`
Expected: list of spec files; note total test count as BEFORE (e.g. ~60). Save number for slice reports.

- [ ] **Step 2: APP-ALIVE-NO-CRASH launch check**

Run: `npx playwright test tests/dashboard.spec.js -v`
Expected: PASS (app launches, pick→dashboard works).

- [ ] **Step 3: Commit nothing (read-only task)**

```bash
git status --short
```

---

### Task 1: Connector lines route around cards

**Files:**
- Modify: `dashboard.js:262` (jsPlumb getInstance Connector opts), `index.html:8-13` (`<style>` block — add z-index rules)
- Test: `tests/map-interactive.spec.js` (extend), new `tests/map-routing.spec.js`

**Interfaces:**
- Consumes: `renderMap(diagram, changes, summaries)` in `dashboard.js:229`
- Produces: connectors with `stub>0`, `cornerRadius 8`, CSS `.jtk-connector{z-index:0}` below `.map-file,.map-group{z-index:1+}`

- [ ] **Step 1: Write failing test `tests/map-routing.spec.js::connectors sit below cards and use flowchart stub`**

```js
// open GROUPED fixture (copy from map-interactive.spec.js GROUPED), then:
const opts = await win.locator('.jtk-connector').first().evaluate((el) => getComputedStyle(el).zIndex);
const cardZ = await win.locator('.map-file').first().evaluate((el) => getComputedStyle(el).zIndex);
expect(parseInt(opts)).toBeLessThan(parseInt(cardZ));
// jsPlumb instance check:
const conn = await win.evaluate(() => window.__mapConnectorOpts || null); // set by renderMap for testability
expect(conn.name).toBe('Flowchart');
expect(conn.stub).toBeGreaterThan(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/map-routing.spec.js -v`
Expected: FAIL (no `__mapConnectorOpts`, z-index equal/unset).

- [ ] **Step 3: Implement in `dashboard.js` — add `stub: 28` to Flowchart opts + expose opts for test**

Exact signature: `window.jsPlumb.getInstance({ Container: canvas, Connector: ['Flowchart', { stub: 28, cornerRadius: 8 }], PaintStyle: { stroke: '#9aa0ff', strokeWidth: 2 }, Endpoint: 'Blank', Anchors: ['Right', 'Left'] })` plus after creation `window.__mapConnectorOpts = { name: 'Flowchart', stub: 28, cornerRadius: 8 };`
One line approach: keep Anchors `['Right','Left']`, only add `stub`.

- [ ] **Step 4: Implement in `index.html` `<style>` — add z-index rules**

```css
.jtk-connector{z-index:0}
.map-file,.map-group{position:absolute;z-index:1}
#mapTip{z-index:50}
```

Keep existing `#mapTip` inline `z-index:50`; do not change tooltip behavior.

- [ ] **Step 5: Run new test to verify it passes**

Run: `npx playwright test tests/map-routing.spec.js -v`
Expected: PASS

- [ ] **Step 6: Regression + launch check**

Run: `npx playwright test tests/map-interactive.spec.js tests/dashboard.spec.js -v`
Expected: PASS (connectors still render, counts unchanged).

- [ ] **Step 7: Screenshot visual confirm (real multi-file project)**

Run app, scan repo root (or stub 6+ files across 3 groups), screenshot `#mapArea`, confirm no line crosses through a `.map-file` rectangle. Save to `test-results/map-routing.png`.

- [ ] **Step 8: Report test count after slice + commit**

```bash
npx playwright test --list 2>&1 | tail -3
git add dashboard.js index.html tests/map-routing.spec.js
git commit -m "fix(map): route connectors around cards via flowchart stub + z-index"
```

---

### Task 2: Horizontal left-to-right layout (single-row pipeline)

**Files:**
- Modify: `dashboard.js:263-296` (`renderMap` group/root placement loop)
- Test: new `tests/map-layout.spec.js`

**Interfaces:**
- Consumes: `diagram.groups[]`, `diagram.rootFiles[]` with `files[]` (each `{id,name,kind,badge}`)
- Produces: group boxes in one row: `left = 20 + i*260`, `top = 20` constant; root cards continue same row

- [ ] **Step 1: Write failing test `tests/map-layout.spec.js::groups lay out left-to-right single row`**

```js
// open GROUPED fixture with 3 groups + 2 rootFiles, then:
const boxes = await win.locator('.map-group').evaluateAll((els) => els.map((e) => ({ l: e.offsetLeft, t: e.offsetTop })));
expect(boxes.length).toBeGreaterThanOrEqual(2);
for (let i = 1; i < boxes.length; i++) expect(boxes[i].l).toBeGreaterThan(boxes[i-1].l);
expect(new Set(boxes.map((b) => b.t)).size).toBe(1); // single row, same top
const roots = await win.locator('#mapCanvas > .map-file').evaluateAll((els) => els.map((e) => e.offsetLeft));
expect(Math.min(...roots)).toBeGreaterThan(boxes[boxes.length-1].l);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/map-layout.spec.js -v`
Expected: FAIL (current code wraps `if (col > 2) { col = 0; rowY += 320; }` → second row different top).

- [ ] **Step 3: Implement in `dashboard.js` `renderMap` — remove wrap, single row**

Replace:
```js
col++;
if (col > 2) { col = 0; rowY += 320; }
```
with single-row increment (no `rowY` change, `rowY = 20` const). Root files: `let rx = 20 + col * 260` unchanged (continues rightward). Keep `CARD_W/CARD_H/GAP`, `FILE_CARD_H/GAP`, group width `214px` as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/map-layout.spec.js -v`
Expected: PASS

- [ ] **Step 5: Regression + launch check**

Run: `npx playwright test tests/map-interactive.spec.js tests/map-grouped.spec.js tests/diagram.spec.js -v`
Expected: PASS (`diagram.js` untouched; `rankdir:'LR'` already correct).

- [ ] **Step 6: Screenshot visual confirm**

Same project as Task 1, screenshot `#mapArea`, confirm groups read left→right pipeline, children stacked vertically only inside narrow column.

- [ ] **Step 7: Report test count after slice + commit**

```bash
npx playwright test --list 2>&1 | tail -3
git add dashboard.js tests/map-layout.spec.js
git commit -m "fix(map): horizontal single-row group layout"
```

---

### Task 3: Zoom controls — remove wheel, keep +/-, restore Fit

**Files:**
- Modify: `dashboard.js:105-111` (add `zoomFit()`), `dashboard.js:325-368` (`zoomAt` + `wireMapPan`), `index.html:76-80` (add `#zoomFit` button)
- Test: modify `tests/map-ux.spec.js` (wheel test), modify `tests/map-interactive.spec.js:202-211` (zoom test), new `tests/map-zoom.spec.js`

**Interfaces:**
- Consumes: `setZoom(z)` in `dashboard.js:105`, `mapPanX/mapPanY`, `applyMapPan()`
- Produces: `function zoomFit()` — reset pan to 0 first, measure `.map-group` + `#mapCanvas > .map-file` only, fit into `#mapArea`; `#zoomFit` button wired to it; no `wheel` listener

- [ ] **Step 1: Write failing test `tests/map-zoom.spec.js::wheel does not zoom, fit resets and fits`**

```js
// open GROUPED fixture:
await win.locator('#mapArea').hover();
await win.evaluate(() => { const a = document.getElementById('mapArea'); const r = a.getBoundingClientRect(); a.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.x+100, clientY: r.y+100, bubbles: true, cancelable: true })); });
await expect(win.locator('#zoomLabel')).toContainText('100%');
await expect(win.locator('#zoomFit')).toBeVisible();
await win.locator('#zoomIn').click();
await expect(win.locator('#zoomLabel')).not.toContainText('100%');
await win.locator('#zoomFit').click();
const pan = await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'));
expect(pan).toBe('0,0');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/map-zoom.spec.js -v`
Expected: FAIL (wheel zooms; `#zoomFit` missing).

- [ ] **Step 3: Implement in `index.html` — add Fit button after `#zoomIn`**

```html
<button id="zoomFit" style="...same as zoomIn but width:auto;padding:0 8px">Fit</button>
```

- [ ] **Step 4: Implement in `dashboard.js` — delete `wheel` listener + `zoomAt`, add `zoomFit()`**

Delete entire `area.addEventListener('wheel', ...)` block in `wireMapPan()` and delete `function zoomAt(clientX, clientY, dir)` (dead after removal). Add:

```js
function zoomFit() {
  mapPanX = 0; mapPanY = 0; applyMapPan();
  const area = document.getElementById('mapArea');
  const canvas = document.getElementById('mapCanvas');
  if (!area || !canvas) return;
  const boxes = [...canvas.querySelectorAll('.map-group'), ...canvas.querySelectorAll(':scope > .map-file')];
  if (!boxes.length) { setZoom(1); return; }
  // measure boxes + root cards only, not nested cards — ponytail: ignores collapsed (display:none) groups, fit uses expanded size
  let r = boxes[0].offsetLeft, b = boxes[0].offsetTop, l = boxes[0].offsetLeft, t = boxes[0].offsetTop;
  for (const el of boxes) { l = Math.min(l, el.offsetLeft); t = Math.min(t, el.offsetTop); r = Math.max(r, el.offsetLeft + el.offsetWidth); b = Math.max(b, el.offsetTop + el.offsetHeight); }
  const needW = (r - l) + 40, needH = (b - t) + 40;
  setZoom(Math.min(2, Math.max(0.25, Math.min((area.clientWidth - 48) / needW, (area.clientHeight - 48) / needH))));
}
```

Wire in `DOMContentLoaded`: `document.getElementById('zoomFit').addEventListener('click', zoomFit);` Keep `zoomIn`/`zoomOut`/`zoomLabel` wiring and drag-pan `mousedown` block unchanged.

- [ ] **Step 5: Update broken existing tests (same commit)**

In `tests/map-ux.spec.js`: replace `'wheel up zooms in...'` test with `'wheel does not zoom (buttons only)'` asserting label stays `100%`. In `tests/map-interactive.spec.js:209`: change `await expect(win.locator('#zoomFit')).toHaveCount(0)` → `toBeVisible()` + click → `data-pan` is `0,0`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test tests/map-zoom.spec.js tests/map-ux.spec.js tests/map-interactive.spec.js -v`
Expected: PASS

- [ ] **Step 7: Screenshot visual confirm (zoom + Fit)**

Screenshot `#mapArea` at 100%, after `+` twice, after Fit; confirm Fit shows all groups without scroll-cut.

- [ ] **Step 8: Report test count after slice + commit**

```bash
npx playwright test --list 2>&1 | tail -3
git add dashboard.js index.html tests/map-zoom.spec.js tests/map-ux.spec.js tests/map-interactive.spec.js
git commit -m "feat(map): remove wheel zoom, restore Fit button"
```

---

### Task 4: Easier API key setup (provider dropdown + presets + show/hide, no key logs)

**Files:**
- Modify: `index.html:109-153` (settings screen), `dashboard.js:489-667` (settings logic), `main.js:50-56` (audit log redaction — keep)
- Test: modify `tests/settings.spec.js` (extend), new `tests/settings-providers.spec.js`

**Interfaces:**
- Consumes: existing `window.vibemap.{getProviderConfig,saveProviderConfig,fetchModels}`, `suggestModel(endpoint, type)`
- Produces: `#providerSelect` (OpenAI/Anthropic/Gemini/Ollama/Custom), `#endpointInput` prefilled per provider, `#modelSelect`+`#modelInput` freeform fallback, `#apiKeyInput[type=password]` + `#apiKeyToggle`, save maps to `{type,endpoint,apiKey,model}`

- [ ] **Step 1: Write failing test `tests/settings-providers.spec.js::provider dropdown prefills, toggle masks, no key leak`**

```js
await win.locator('#settingsLink').click();
await expect(win.locator('#providerSelect')).toBeVisible();
await win.locator('#providerSelect').selectOption('openai');
await expect(win.locator('#endpointInput')).toHaveValue('https://api.openai.com/v1');
await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'password');
await win.locator('#apiKeyToggle').click();
await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'text');
await win.locator('#apiKeyToggle').click();
// no raw key in logs: save then check main log has <redacted>
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/settings-providers.spec.js -v`
Expected: FAIL (`#providerSelect` missing).

- [ ] **Step 3: Implement in `index.html` — add dropdown + toggle (extend, don't rebuild)**

Insert before `#endpointInput` block:
```html
<select id="providerSelect">OpenAI / Anthropic / Gemini / Ollama / Custom</select>
```
Wrap `#apiKeyInput` with toggle button `#apiKeyToggle` (text `Show`). Keep `type="password"`, all existing IDs (`endpointInput,modelInput,modelSelect,fetchModelsBtn,apiKeyInput,saveProviderBtn`) unchanged so `provider-config.js` shape and `persist.spec.js` keep passing.

- [ ] **Step 4: Implement in `dashboard.js` — `PROVIDER_PRESETS` + wiring**

```js
const PROVIDER_PRESETS = {
  openai: { endpoint: 'https://api.openai.com/v1', models: ['gpt-4o-mini','gpt-4o'], type: 'cloud' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1', models: ['claude-haiku-5-5','claude-sonnet-4'], type: 'cloud' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.8-flash'], type: 'cloud' },
  ollama: { endpoint: 'http://localhost:11434', models: ['llama3'], type: 'ollama' },
  custom: { endpoint: '', models: [], type: 'cloud' },
}; // ponytail: static model lists are fallback only; Fetch models button remains source of truth
```

On `#providerSelect` change: prefill `endpointInput` (unless custom), populate `modelSelect` with preset models, call existing `maybeSuggest`. On save: map `providerSelect` → `type` via preset, keep `{type,endpoint,apiKey,model}` shape. Toggle: flip `apiKeyInput.type` password↔text. Never `console.log` key value.

- [ ] **Step 5: Audit `main.js:50-56` + `summarizer.js:75` — confirm redaction, no change unless leak**

Keep `apiKey: '<redacted>'` log; `summarizer.js` logs only target+model. If any raw-key log found, replace with redacted.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test tests/settings-providers.spec.js tests/settings.spec.js tests/models-ui.spec.js tests/provider.spec.js tests/persist.spec.js -v`
Expected: PASS

- [ ] **Step 7: APP-ALIVE-NO-CRASH launch check**

Run: `npx playwright test tests/dashboard.spec.js -v`
Expected: PASS

- [ ] **Step 8: Report test count after slice + commit**

```bash
npx playwright test --list 2>&1 | tail -3
git add index.html dashboard.js tests/settings-providers.spec.js tests/settings.spec.js
git commit -m "feat(settings): provider presets + endpoint/model defaults + key visibility toggle"
```

---

## Self-Review

- Spec coverage: (1) stub+z-index ✓, (2) single-row LR ✓ (dagre already LR, fix is dashboard grid), (3) wheel removal + Fit with pan-reset + root-only measure ✓, (4) dropdown+endpoint+model+masked toggle + no-log ✓.
- Step scan: each step one action with checkable output; no TBDs.
- Type consistency: `zoomFit()` name used in HTML+JS+tests; `PROVIDER_PRESETS` keys `openai|anthropic|gemini|ollama|custom`; `__mapConnectorOpts` test hook consistent.
- Proportion: plan shorter than code it describes; bodies only where signature+test leave choice (zoomFit measure loop, presets table).
