import { test, expect } from '@playwright/test';

async function frames(page, count = 3) {
  await page.evaluate(count => { for (let i = 0; i < count; i++) window.frame(); }, count);
}

async function clickItem(page, name) {
  const point = await page.evaluate(name => {
    const rect = document.querySelector('canvas').getBoundingClientRect(), item = window.points[name];
    return { x: rect.x + item.x, y: rect.y + item.y };
  }, name);
  await page.mouse.click(point.x, point.y);
  await frames(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser.html');
  await page.evaluate(async () => {
    await window.ready;
    const I = window.ImGui;
    window.state = { text: [''], clicks: 0, callback: '', selection: null, selected: new Set(), requests: [], drag: false, payload: { answer: 42 }, delivered: null };
    window.points = {};
    window.state.color = { r: 0.1, g: 0.2, b: 0.3, a: 0.9 };
    window.liveIO = I.GetIO();
    const point = name => {
      const min = I.GetItemRectMin(), max = I.GetItemRectMax();
      window.points[name] = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
    };
    window.frame = () => {
      const s = window.state;
      I.newFrame();
      I.SetNextWindowPos({ x: 10, y: 10 }, I.Cond.Always);
      I.SetNextWindowSize({ x: 500, y: 550 }, I.Cond.Always);
      I.Begin('Controls', null, I.WindowFlags.NoMove | I.WindowFlags.NoResize | I.WindowFlags.NoSavedSettings);
      if (I.Button('Press')) s.clicks++;
      point('button');
      I.InputText('Edit', s.text, 256, I.InputTextFlags.CallbackAlways, data => {
        if (s.callback === 'select') {
          data.SelectAll();
          s.selection = [data.SelectionStart, data.SelectionEnd, data.HasSelection()];
          s.callback = '';
        } else if (s.callback === 'replace') {
          data.Buf = 'café 🦊';
          data.SelectAll();
          s.selection = [data.SelectionStart, data.SelectionEnd, data.BufTextLen];
          s.callback = '';
        } else if (s.callback === 'clear') {
          data.ClearSelection(); s.selection = data.HasSelection(); s.callback = '';
        }
        return 0;
      });
      point('text');
      I.SetNextItemWidth(320);
      I.ColorEdit4('Color', s.color, I.ColorEditFlags.Float | I.ColorEditFlags.NoLabel | I.ColorEditFlags.NoSmallPreview | I.ColorEditFlags.NoPicker | I.ColorEditFlags.NoOptions);
      const alpha = I.GetItemRectMax(), alphaMin = I.GetItemRectMin();
      window.points.alpha = { x: alpha.x - 30, y: (alpha.y + alphaMin.y) / 2 };
      const apply = io => {
        for (const request of io.Requests) {
          s.requests.push({ type: request.Type, first: String(request.RangeFirstItem), last: String(request.RangeLastItem) });
          if (request.Type === I.ImGuiSelectionRequestType.SetAll) {
            s.selected.clear(); if (request.Selected) for (let i = 0; i < 5; i++) s.selected.add(i);
          } else if (request.Type === I.ImGuiSelectionRequestType.SetRange) {
            const first = Number(request.RangeFirstItem), last = Number(request.RangeLastItem);
            for (let i = Math.min(first, last); i <= Math.max(first, last); i++) request.Selected ? s.selected.add(i) : s.selected.delete(i);
          }
        }
      };
      apply(I.BeginMultiSelect(0, s.selected.size, 5));
      for (let i = 0; i < 5; i++) { I.SetNextItemSelectionUserData(BigInt(i)); I.Selectable(`Item ${i}`, s.selected.has(i)); point(`item${i}`); }
      apply(I.EndMultiSelect());
      I.Button('Drag source'); point('source');
      if (I.BeginDragDropSource()) {
        s.drag = true;
        I.SetDragDropPayload('TEST', s.payload, I.Cond.Once);
        I.Text('Dragging'); I.EndDragDropSource();
      }
      I.Button('Drop target'); point('target');
      if (I.BeginDragDropTarget()) {
        const payload = I.AcceptDragDropPayload('TEST');
        if (payload) s.delivered = payload.Data;
        I.EndDragDropTarget();
      }
      if (I.BeginChild('Scroll area', { x: 0, y: 100 })) {
        const pos = I.GetWindowPos(), size = I.GetWindowSize();
        window.points.scroll = { x: pos.x + size.x / 2, y: pos.y + size.y / 2 };
        for (let i = 0; i < 40; i++) I.Text(`Scrollable row ${i}`);
        s.scrollY = I.GetScrollY();
        s.wheel = Math.max(s.wheel ?? 0, Math.abs(I.GetIO().MouseWheel));
      }
      I.EndChild();
      I.End(); I.render();
    };
    for (let i = 0; i < 3; i++) window.frame();
  });
});

test('SDL forwards wheel input to child-window scrolling', async ({ page }) => {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    return { x: canvas.x + window.points.scroll.x, y: canvas.y + window.points.scroll.y };
  });
  await page.mouse.move(point.x, point.y); await frames(page);
  await page.mouse.wheel(0, 200);
  await frames(page);
  const result = await page.evaluate(() => ({ scroll: window.state.scrollY, wheel: window.state.wheel }));
  expect(result.scroll).toBeGreaterThan(0);
  expect(result.wheel).toBeGreaterThan(0);
});

test('SDL forwards pointer and keyboard input and native text selection callbacks', async ({ page }) => {
  await clickItem(page, 'button');
  expect(await page.evaluate(() => window.state.clicks)).toBe(1);
  expect(await page.evaluate(() => window.liveIO.WantCaptureMouse)).toBe(true);
  expect(await page.evaluate(() => window.liveIO.Framerate)).toBeGreaterThan(0);
  await clickItem(page, 'text');
  await page.keyboard.type('hello');
  await frames(page, 12);
  expect(await page.evaluate(() => window.state.text[0])).toBe('hello');
  await page.evaluate(() => { window.state.callback = 'select'; window.frame(); });
  expect(await page.evaluate(() => window.state.selection)).toEqual([0, 5, true]);
  await page.evaluate(() => { window.state.callback = 'replace'; window.frame(); });
  expect(await page.evaluate(() => window.state.text[0])).toBe('café 🦊');
  expect(await page.evaluate(() => window.state.selection)).toEqual([0, 10, 10]);
  await page.evaluate(() => { window.state.callback = 'clear'; window.frame(); });
  expect(await page.evaluate(() => window.state.selection)).toBe(false);
});

test('color editing writes alpha back to objects, vectors, and tuples', async ({ page }) => {
  for (const shape of ['rgba', 'vector', 'tuple']) {
    await clickItem(page, 'button');
    await page.evaluate(shape => {
      window.state.color = shape === 'rgba' ? { r: 0.1, g: 0.2, b: 0.3, a: 0.9 } : shape === 'vector' ? { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } : [0.1, 0.2, 0.3, 0.9];
    }, shape);
    await frames(page);
    const point = await page.evaluate(() => {
      const canvas = document.querySelector('canvas').getBoundingClientRect();
      return { x: canvas.x + window.points.alpha.x, y: canvas.y + window.points.alpha.y };
    });
    await page.mouse.move(point.x, point.y); await frames(page);
    await page.mouse.down(); await frames(page);
    await page.mouse.move(point.x - 80, point.y, { steps: 8 }); await frames(page);
    await page.mouse.up(); await frames(page);
    const values = await page.evaluate(() => {
      const color = window.state.color;
      return Array.isArray(color) ? color : 'r' in color ? [color.r, color.g, color.b, color.a] : [color.x, color.y, color.z, color.w];
    });
    expect(values[0], shape).toBeCloseTo(0.1, 5);
    expect(values[1], shape).toBeCloseTo(0.2, 5);
    expect(values[2], shape).toBeCloseTo(0.3, 5);
    expect(values[3], shape).toBeGreaterThan(0.1);
    expect(values[3], shape).toBeLessThan(0.8);
  }
});

test('text capacities count UTF-8 bytes and reject unsafe resize callbacks', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, errors = [];
    I.newFrame(); I.Begin('Boundaries');
    const exact = ['é'];
    I.InputText('exact', exact, 3);
    for (const operation of [() => I.InputText('small', ['é'], 2), () => I.InputText('empty', [''], 0), () => I.InputText('resize', [''], 16, I.InputTextFlags.CallbackResize), () => I.InputTextMultiline('multi', ['hello'], 5), () => I.InputTextWithHint('hint', 'placeholder', ['hello'], 5)]) {
      try { operation(); } catch (error) { errors.push(error.message); }
    }
    I.End(); I.render();
    return { exact: exact[0], errors };
  });
  expect(result.exact).toBe('é');
  expect(result.errors).toEqual([
    'Text exceeds UTF-8 buffer capacity', 'Text capacity must be 1 to 16777216 UTF-8 bytes, including NUL',
    'CallbackResize is not supported; supply a larger text capacity', 'Text exceeds UTF-8 buffer capacity', 'Text exceeds UTF-8 buffer capacity',
  ]);
});

test('multi-select emits bigint range requests for shift selection', async ({ page }) => {
  await clickItem(page, 'item1');
  expect(await page.evaluate(() => [...window.state.selected])).toEqual([1]);
  await page.keyboard.down('Shift');
  await clickItem(page, 'item3');
  await page.keyboard.up('Shift');
  await frames(page);
  expect(await page.evaluate(() => [...window.state.selected].sort())).toEqual([1, 2, 3]);
  expect(await page.evaluate(() => window.state.requests)).toContainEqual({ type: 2, first: '1', last: '3' });
});

test('drag payloads preserve object identity and clear after delivery or cancellation', async ({ page }) => {
  const points = await page.evaluate(() => {
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return Object.fromEntries(['source', 'target'].map(key => [key, { x: window.points[key].x + rect.x, y: window.points[key].y + rect.y }]));
  });
  await page.mouse.move(points.source.x, points.source.y); await frames(page);
  await page.mouse.down(); await frames(page);
  await page.mouse.move(points.source.x + 15, points.source.y + 5); await frames(page);
  expect(await page.evaluate(() => window.ImGui.GetDragDropPayload()?.Data === window.state.payload)).toBe(true);
  await page.mouse.move(points.target.x, points.target.y); await frames(page);
  await page.mouse.up(); await frames(page);
  expect(await page.evaluate(() => window.state.delivered === window.state.payload)).toBe(true);
  await frames(page);
  expect(await page.evaluate(() => window.ImGui.GetDragDropPayload())).toBeNull();
  await page.mouse.move(points.source.x, points.source.y); await frames(page);
  await page.mouse.down(); await frames(page);
  await page.mouse.move(points.source.x + 15, points.source.y + 5); await frames(page);
  await page.mouse.move(750, 580); await frames(page);
  await page.mouse.up(); await frames(page, 5);
  expect(await page.evaluate(() => window.ImGui.GetDragDropPayload())).toBeNull();
});

test('clipboard paste stays on the canvas and copy denial is observable', async ({ page }) => {
  await clickItem(page, 'text');
  const mac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform));
  const modifier = mac ? 'Meta' : 'Control';
  await page.keyboard.down(modifier); await frames(page);
  const prevented = await page.evaluate(mac => {
    const canvas = document.querySelector('canvas');
    const key = new KeyboardEvent('keydown', { code: 'KeyV', key: 'v', ctrlKey: !mac, metaKey: mac, bubbles: true, cancelable: true });
    canvas.dispatchEvent(key);
    return key.defaultPrevented;
  }, mac);
  expect(prevented).toBe(false);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const data = new DataTransfer(); data.setData('text/plain', 'paste café');
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    // Firefox strips data supplied to an untrusted ClipboardEvent constructor.
    Object.defineProperty(event, 'clipboardData', { value: data });
    canvas.dispatchEvent(event);
  });
  await frames(page, 6);
  expect(await page.evaluate(() => window.state.text[0])).toBe('paste café');
  expect(await page.evaluate(mac => mac ? window.ImGui.GetIO().KeySuper : window.ImGui.GetIO().KeyCtrl, mac)).toBe(true);
  await page.keyboard.up(modifier); await frames(page);
  await page.locator('#after').focus();
  await page.evaluate(() => {
    const data = new DataTransfer(); data.setData('text/plain', 'outside');
    document.querySelector('#after').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await frames(page);
  expect(await page.evaluate(() => window.state.text[0])).toBe('paste café');
  const error = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const result = new Promise(resolve => canvas.addEventListener('imgui-clipboard-error', event => resolve(event.detail.message), { once: true }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('permission denied')) } });
    window.ImGui.SetClipboardText('copy');
    return result;
  });
  expect(error).toBe('permission denied');
});

test('blur clears stuck keys and keyboard focus can leave the canvas', async ({ page }) => {
  await clickItem(page, 'text');
  await page.keyboard.down('Control'); await frames(page);
  expect(await page.evaluate(() => window.ImGui.GetIO().KeyCtrl)).toBe(true);
  await page.locator('#after').focus(); await frames(page);
  expect(await page.evaluate(() => window.ImGui.GetIO().KeyCtrl)).toBe(false);
  await page.keyboard.up('Control');
  await page.evaluate(() => { window.ImGui.SetNextFrameWantCaptureKeyboard(false); window.frame(); });
  await page.locator('canvas').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#after')).toBeFocused();
  await clickItem(page, 'button');
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).not.toBeFocused();
});

test('reinitialization keeps one copy of each input listener', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => {
      const I = window.ImGui;
      I.shutdown(); await I.init({ canvas: document.querySelector('canvas') });
      window.state.text[0] = ''; window.state.clicks = 0;
      window.frame(); window.frame(); window.frame();
    });
    await clickItem(page, 'button');
    expect(await page.evaluate(() => window.state.clicks)).toBe(1);
    await clickItem(page, 'text');
    await page.keyboard.type('once'); await frames(page, 10);
    expect(await page.evaluate(() => window.state.text[0])).toBe('once');
  }
});
