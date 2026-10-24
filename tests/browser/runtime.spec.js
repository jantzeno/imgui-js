import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser.html');
  await page.evaluate(() => window.ready);
});

test('renders the upstream demo with SDL3 and WebGL2', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async () => {
    await window.ready;
    const I = window.ImGui;
    for (let i = 0; i < 3; i++) {
      I.newFrame(); I.ShowDemoWindow();
      I.GetForegroundDrawList().AddRectFilled({ x: 10, y: 10 }, { x: 40, y: 40 }, 0xff0000ff);
      I.render();
    }
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    const pixel = new Uint8Array(4);
    gl.readPixels(20, canvas.height - 20, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return { version: I.VERSION, vertices: I.GetDrawData().TotalVtxCount, renderer: I.GetIO().BackendRendererName, platform: I.GetIO().BackendPlatformName, pixel: [...pixel] };
  });
  expect(result.version).toBe('1.93.0');
  expect(result.vertices).toBeGreaterThan(100);
  expect(result.renderer).toBe('imgui_impl_opengl3');
  expect(result.platform).toBe('imgui_impl_sdl3 (3.4.18; 3.4.18) (emscripten)');
  expect(result.pixel).toEqual([255, 0, 0, 255]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('demo.png') });
});

test('lifecycle rejects misuse and restores the canvas before reinitialization', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const I = window.ImGui, canvas = document.querySelector('canvas');
    const errors = [];
    try { I.render(); } catch (error) { errors.push(error.message); }
    I.newFrame();
    try { I.newFrame(); } catch (error) { errors.push(error.message); }
    I.EndFrame();
    I.newFrame(); I.ShowDemoWindow(); I.render();
    I.shutdown(); I.shutdown();
    const restored = { width: canvas.width, height: canvas.height, style: canvas.getAttribute('style'), tab: canvas.getAttribute('tabindex') };
    try { I.newFrame(); } catch (error) { errors.push(error.message); }
    const pending = I.init({ canvas });
    try { await I.init({ canvas }); } catch (error) { errors.push(error.message); }
    try { I.shutdown(); } catch (error) { errors.push(error.message); }
    await pending;
    for (let i = 0; i < 3; i++) { I.newFrame(); I.ShowDemoWindow(); I.render(); }
    const vertices = I.GetDrawData().TotalVtxCount;
    I.shutdown();
    canvas.id = 'invalid:id';
    try { await I.init({ canvas }); } catch (error) { errors.push(error.message); }
    canvas.id = '';
    await I.init({ canvas, locateFile: path => `/dist/${path}?relocated=1` });
    const generatedID = canvas.id.startsWith('imgui-');
    I.shutdown();
    return { errors, restored, vertices, generatedID, id: canvas.id };
  });
  expect(result.errors).toEqual([
    'Call newFrame() before render()', 'Call render() before starting another frame',
    'Call and await init() before newFrame()', 'ImGui is already initialized or initializing',
    'Await init() before shutdown()', 'Canvas ID must contain letters, digits, underscores, or hyphens',
  ]);
  expect({ ...result.restored, style: result.restored.style ?? '' }).toEqual({ width: 300, height: 150, style: '', tab: null });
  expect(result.vertices).toBeGreaterThan(100);
  expect(result.generatedID).toBe(true);
  expect(result.id).toBe('');
});

test('initialization recovers after failed Wasm fetch and unavailable WebGL2', async ({ page }) => {
  await page.evaluate(() => window.ImGui.shutdown());
  await page.route('**/bind-imgui.wasm', route => route.fulfill({ status: 404, body: 'missing' }));
  const fetchError = await page.evaluate(async () => {
    try { await window.ImGui.init({ canvas: document.querySelector('canvas') }); }
    catch (error) { return error.message; }
  });
  expect(fetchError).toMatch(/Aborted|failed|fetch/i);
  await page.unroute('**/bind-imgui.wasm');
  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), I = window.ImGui;
    const getContext = canvas.getContext;
    canvas.getContext = () => null;
    let glError;
    try { await I.init({ canvas }); } catch (error) { glError = error.message; }
    canvas.getContext = getContext;
    await I.init({ canvas });
    for (let i = 0; i < 3; i++) { I.newFrame(); I.ShowDemoWindow(); I.render(); }
    return { glError, vertices: I.GetDrawData().TotalVtxCount };
  });
  expect(result.glError).toContain('SDL3/WebGL2 initialization failed');
  expect(result.vertices).toBeGreaterThan(100);
});

test('payload validation follows UTF-8 boundaries and native Once semantics', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, errors = [];
    I.newFrame(); I.Begin('Payload validation');
    if (!I.BeginDragDropSource(I.ImGuiDragDropFlags.SourceExtern)) throw new Error('External source did not begin');
    for (const type of ['', 'a'.repeat(32), 'é'.repeat(16), 'a\0b']) {
      try { I.SetDragDropPayload(type, {}); } catch (error) { errors.push(error.message); }
    }
    try { I.SetDragDropPayload('VALID', {}, I.Cond.Appearing); } catch (error) { errors.push(error.message); }
    const first = { value: 1 }, second = { value: 2 }, type = 'é'.repeat(15) + 'a';
    I.SetDragDropPayload(type, first, I.Cond.Once);
    I.SetDragDropPayload('OTHER', second, I.Cond.Once);
    const once = I.GetDragDropPayload()?.Data === first;
    I.SetDragDropPayload('OTHER', second, I.Cond.Always);
    const always = I.GetDragDropPayload()?.Data === second;
    I.EndDragDropSource(); I.End(); I.render();
    return { errors, once, always };
  });
  expect(result.errors).toEqual([
    ...Array(4).fill('Payload type must contain 1 to 31 UTF-8 bytes without NUL'), 'Payload condition must be Always or Once',
  ]);
  expect(result.once).toBe(true);
  expect(result.always).toBe(true);
});

test('font loading owns bytes and the dynamic atlas renders multiple sizes', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const I = window.ImGui;
    const loaded = await I.loadFont('/build/test-fonts/NotoSans-Regular.ttf', 18);
    const bytes = new Uint8Array(await (await fetch('/build/test-fonts/NotoSans-Regular.ttf')).arrayBuffer());
    const font = I.addFontFromMemory(bytes, 18);
    bytes.fill(0);
    I.GetIO().FontDefault = font;
    const failures = [];
    try { await I.loadFont('/missing-font.ttf'); } catch (error) { failures.push(error.message); }
    try { I.addFontFromMemory(new Uint8Array(100)); } catch (error) { failures.push(error.message); }
    try { I.addFontFromMemory(new Uint8Array(101)); } catch (error) { failures.push(error.message); }
    let sizes = [];
    for (let frame = 0; frame < 3; frame++) {
      I.newFrame(); I.Begin('Fonts');
      sizes = [];
      for (const size of [14, 28, 48]) {
        I.PushFont(font, size); I.Text('Dynamic font: café Ω Ж');
        sizes.push(I.GetFontBaked().Size); I.PopFont();
      }
      try { I.addFontFromMemory(new Uint8Array(101)); } catch (error) { if (frame === 0) failures.push(error.message); }
      I.End(); I.render();
    }
    const texture = I.GetIO().Fonts.TexData;
    return { failures, sizes, loaded: font.IsLoaded() && loaded.IsLoaded(), glyphs: ['é', 'Ω', 'Ж'].map(char => font.IsGlyphInFont(char.codePointAt(0))), atlas: [texture.Width, texture.Height], texture: String(texture.GetTexID()), vertices: I.GetDrawData().TotalVtxCount };
  });
  expect(result.failures[0]).toContain('Font request failed: 404');
  expect(result.failures.slice(1)).toEqual(['Invalid font data or size', 'Font could not be loaded', 'Add fonts between frames']);
  expect(result.sizes).toEqual([14, 28, 48]);
  expect(result.loaded).toBe(true);
  expect(result.glyphs).toEqual([true, true, true]);
  expect(result.atlas.every(value => value > 0)).toBe(true);
  expect(result.texture).not.toBe('0');
  expect(result.vertices).toBeGreaterThan(100);
});

test('FreeType renders supplementary SVG glyphs in color', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const I = window.ImGui;
    await I.loadFont('/build/test-fonts/NotoSans-Regular.ttf', 32);
    const config = new I.ImFontConfig();
    config.MergeMode = true;
    config.FontLoaderFlags = I.FreeTypeLoaderFlags.LoadColor;
    let font;
    try { font = await I.loadFont('/build/test-fonts/color-svg.ttf', 32, config); }
    finally { config.delete(); }
    let glyph, bounds, latinGlyph;
    for (let frame = 0; frame < 3; frame++) {
      I.newFrame();
      I.PushFont(font, 32);
      const draw = I.GetForegroundDrawList();
      draw.AddText({ x: 16, y: 16 }, 0xffffffff, '😀');
      draw.AddText({ x: 80, y: 16 }, 0xffffffff, 'A');
      const native = I.GetFontBaked().FindGlyphNoFallback(0x1f600);
      glyph = native && { codepoint: native.Codepoint, colored: native.Colored, visible: native.Visible };
      bounds = native && { x0: native.X0, y0: native.Y0, x1: native.X1, y1: native.Y1 };
      latinGlyph = I.GetFontBaked().FindGlyphNoFallback(0x41)?.Codepoint;
      I.PopFont(); I.render();
    }
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const sample = fraction => {
      const pixel = new Uint8Array(4);
      const x = 16 + bounds.x0 + (bounds.x1 - bounds.x0) * fraction;
      const y = 16 + (bounds.y0 + bounds.y1) / 2;
      gl.readPixels(Math.floor(x), canvas.height - 1 - Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    };
    const red = sample(0.25), blue = sample(0.75);
    return { glyph, latinGlyph, fontCount: I.GetIO().Fonts.GetFontCount(), red, blue };
  });
  expect(result.glyph).toEqual({ codepoint: 0x1f600, colored: true, visible: true });
  expect(result.latinGlyph).toBe(0x41);
  expect(result.fontCount).toBe(1);
  expect(result.red).toEqual([255, 0, 0, 255]);
  expect(result.blue).toEqual([0, 0, 255, 255]);
});

test('owned textures render pixels and reject invalid or stale handles', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, errors = [];
    const texture = I.createTextureRGBA(new Uint8Array([0, 255, 0, 255]), 1, 1);
    for (const create of [() => I.createTextureRGBA(new Uint8Array(3), 1, 1), () => I.createTextureRGBA(new Uint8Array(4), 1.5, 1), () => I.createTextureRGBA(new Uint8Array(), 0x7fffffff, 1)]) {
      try { create(); } catch (error) { errors.push(error.message); }
    }
    I.newFrame();
    I.GetForegroundDrawList().AddImage(texture, { x: 10, y: 10 }, { x: 50, y: 50 });
    I.render();
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), pixel = new Uint8Array(4);
    gl.readPixels(20, canvas.height - 20, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    I.destroyTexture(texture);
    try { I.destroyTexture(texture); } catch (error) { errors.push(error.message); }
    try { I.destroyTexture(0x100000000n + texture); } catch (error) { errors.push(error.message); }
    return { pixel: [...pixel], errors, type: typeof texture };
  });
  expect(result.pixel).toEqual([0, 255, 0, 255]);
  expect(result.type).toBe('bigint');
  expect(result.errors).toEqual([
    'Expected width * height * 4 RGBA bytes', 'Expected Uint8Array pixels and positive integer dimensions', 'Texture dimensions exceed WebGL2 limits',
    'Texture is not owned by this runtime, or was already destroyed', 'Texture is not owned by this runtime, or was already destroyed',
  ]);
});

test('fresh draw buffer views survive Wasm memory growth', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui;
    for (let i = 0; i < 3; i++) { I.newFrame(); I.ShowDemoWindow(); I.render(); }
    let list;
    I.GetDrawData().IterateDrawLists(value => { list ??= value; });
    const old = list.VtxBuffer;
    const first = [...old.subarray(0, 20)];
    const before = old.buffer.byteLength;
    const allocation = I.bind._malloc(before + 1024 * 1024);
    const fresh = list.VtxBuffer;
    const result = { detached: old.buffer.byteLength, before, after: fresh.buffer.byteLength, first, next: [...fresh.subarray(0, 20)], bytes: fresh.length, unsigned: fresh instanceof Uint8Array };
    I.bind._free(allocation);
    return result;
  });
  expect(result.detached).toBe(0);
  expect(result.after).toBeGreaterThan(result.before);
  expect(result.next).toEqual(result.first);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.unsigned).toBe(true);
});

test('native splitters reorder drawing and tables expose sort specifications', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, splitter = new I.ImDrawListSplitter();
    let spec;
    for (let i = 0; i < 3; i++) {
      I.newFrame();
      const draw = I.GetForegroundDrawList();
      splitter.Split(draw, 2);
      splitter.SetCurrentChannel(draw, 1);
      draw.AddRectFilled({ x: 10, y: 10 }, { x: 40, y: 40 }, 0xff0000ff);
      splitter.SetCurrentChannel(draw, 0);
      draw.AddRectFilled({ x: 10, y: 10 }, { x: 40, y: 40 }, 0xff00ff00);
      splitter.Merge(draw);
      I.SetNextWindowSize({ x: 400, y: 350 }); I.Begin('Table');
      if (I.BeginTable('Sort', 2, I.TableFlags.Sortable | I.TableFlags.Borders)) {
        I.TableSetupColumn('First', I.TableColumnFlags.DefaultSort, 0, 42);
        I.TableSetupColumn('Second', 0, 0, 43); I.TableHeadersRow();
        I.TableNextRow(); I.TableNextColumn(); I.Text('one'); I.TableNextColumn(); I.Text('two');
        const sort = I.TableGetSortSpecs();
        if (sort?.SpecsCount) spec = { userID: sort.Specs[0].ColumnUserID, direction: sort.Specs[0].SortDirection };
        I.EndTable();
      }
      I.End(); I.render();
    }
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), pixel = new Uint8Array(4);
    gl.readPixels(20, canvas.height - 20, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    splitter.delete();
    return { pixel: [...pixel], spec };
  });
  expect(result.pixel).toEqual([255, 0, 0, 255]);
  expect(result.spec).toEqual({ userID: 42, direction: 1 });
});

test('combo and list getters use current string-returning callbacks', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, items = ['zero', 'one', 'two'], calls = [], current = [1];
    const getter = (data, index) => { calls.push([data === items, index]); return data[index]; };
    for (let i = 0; i < 3; i++) {
      I.newFrame(); I.SetNextWindowSize({ x: 500, y: 500 }); I.Begin('Getters');
      I.Combo('Array', current, items);
      I.Combo('Callback', current, getter, items, items.length);
      I.Combo('Separated', current, 'zero\0one\0two\0');
      I.ListBox('List array', current, items);
      I.ListBox('List callback', current, getter, items, items.length);
      I.End(); I.render();
    }
    return { current: current[0], calls, vertices: I.GetDrawData().TotalVtxCount, versionLayout: I.CHECKVERSION() };
  });
  expect(result.current).toBe(1);
  for (const index of [0, 1, 2]) expect(result.calls).toContainEqual([true, index]);
  expect(result.calls.every(([same]) => same)).toBe(true);
  expect(result.vertices).toBeGreaterThan(100);
  expect(result.versionLayout).toBe(true);
});

test('current drawing signatures honor thickness before flags', async ({ page }) => {
  const result = await page.evaluate(() => {
    const I = window.ImGui, errors = [];
    I.newFrame();
    const draw = I.GetForegroundDrawList(), red = 0xff0000ff;
    draw.AddRect({ x: 10, y: 10 }, { x: 50, y: 50 }, red, 0, 8, I.DrawFlags.None);
    draw.AddPolyline([{ x: 80, y: 10 }, { x: 120, y: 10 }, { x: 100, y: 50 }], 3, red, 3, I.DrawFlags.Closed);
    draw.PathLineTo({ x: 140, y: 10 }); draw.PathLineTo({ x: 180, y: 50 }); draw.PathStroke(red, 3, I.DrawFlags.None);
    for (const operation of [() => draw.AddPolyline([], -1, red, 1), () => draw.AddConvexPolyFilled([], 1, red)]) {
      try { operation(); } catch (error) { errors.push(error.message); }
    }
    I.render();
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), edge = new Uint8Array(4), inside = new Uint8Array(4);
    gl.readPixels(11, canvas.height - 30, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, edge);
    gl.readPixels(30, canvas.height - 30, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, inside);
    return { edge: [...edge], inside: [...inside], errors };
  });
  expect(result.edge).toEqual([255, 0, 0, 255]);
  expect(result.inside[3]).toBe(255);
  expect(result.inside.slice(0, 3)).toEqual(Array(3).fill(result.inside[0]));
  expect(result.inside[0]).toBeGreaterThanOrEqual(25);
  expect(result.inside[0]).toBeLessThanOrEqual(26);
  expect(result.errors).toHaveLength(2);
  expect(result.errors.every(message => message.includes('point count'))).toBe(true);
});

test('the served example starts with a visible native demo window', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => {
    const I = await import('/dist/imgui.js');
    return I.VERSION && I.GetFrameCount();
  })).toBeGreaterThan(2);
  const result = await page.evaluate(async () => {
    const I = await import('/dist/imgui.js');
    return { vertices: I.GetDrawData().TotalVtxCount, settings: I.SaveIniSettingsToMemory() };
  });
  expect(result.vertices).toBeGreaterThan(100);
  expect(result.settings).toContain('[Window][Dear ImGui Demo]\nPos=20,20\n');
  await page.screenshot({ path: test.info().outputPath('example.png') });
});
