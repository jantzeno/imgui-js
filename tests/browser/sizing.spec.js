import { test, expect } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });

test('SDL keeps CSS sizes separate from high-density framebuffer sizes', async ({ page }) => {
  await page.goto('/tests/browser.html');
  const initial = await page.evaluate(async () => {
    await window.ready;
    const I = window.ImGui; I.newFrame(); I.render();
    const canvas = document.querySelector('canvas'), io = I.GetIO();
    return { canvas: [canvas.width, canvas.height], display: [io.DisplaySize.x, io.DisplaySize.y], scale: [io.DisplayFramebufferScale.x, io.DisplayFramebufferScale.y] };
  });
  expect(initial).toEqual({ canvas: [1600, 1200], display: [800, 600], scale: [2, 2] });
  const resized = await page.evaluate(() => {
    const I = window.ImGui, canvas = document.querySelector('canvas');
    canvas.style.width = '400px'; canvas.style.height = '300px';
    I.newFrame(); I.render();
    return { canvas: [canvas.width, canvas.height], display: [I.GetIO().DisplaySize.x, I.GetIO().DisplaySize.y] };
  });
  expect(resized).toEqual({ canvas: [800, 600], display: [400, 300] });
  const densityChanged = await page.evaluate(() => {
    const I = window.ImGui, canvas = document.querySelector('canvas');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    window.dispatchEvent(new Event('resize'));
    I.newFrame(); I.render();
    return { canvas: [canvas.width, canvas.height], display: [I.GetIO().DisplaySize.x, I.GetIO().DisplaySize.y], scale: I.GetIO().DisplayFramebufferScale.x };
  });
  expect(densityChanged).toEqual({ canvas: [1200, 900], display: [400, 300], scale: 3 });
});

test('context loss stops frames and permits shutdown and restoration', async ({ page }) => {
  await page.goto('/tests/browser.html');
  await page.evaluate(() => window.ready);
  const lost = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), I = window.ImGui;
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context is unavailable');
    window.lossExtension = extension;
    const event = new Promise(resolve => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    extension.loseContext(); await event;
    try { I.newFrame(); } catch (error) { return error.message; }
    throw new Error('Frame unexpectedly succeeded');
  });
  expect(lost).toBe('WebGL2 context lost; shut down and initialize again after restoration');
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), I = window.ImGui;
    const extension = window.lossExtension;
    const restored = new Promise(resolve => canvas.addEventListener('webglcontextrestored', resolve, { once: true }));
    I.shutdown();
    extension.restoreContext(); await restored;
    await I.init({ canvas });
    for (let i = 0; i < 3; i++) { I.newFrame(); I.ShowDemoWindow(); I.render(); }
  });
  expect(await page.evaluate(() => window.ImGui.GetDrawData().TotalVtxCount)).toBeGreaterThan(100);
});

test('context loss after newFrame rejects render and permits shutdown and restoration', async ({ page }) => {
  await page.goto('/tests/browser.html');
  await page.evaluate(() => window.ready);
  const errors = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), I = window.ImGui;
    I.newFrame(); I.ShowDemoWindow();
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context is unavailable');
    window.lossExtension = extension;
    const event = new Promise(resolve => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    extension.loseContext(); await event;
    const errors = [];
    for (let i = 0; i < 2; i++) {
      try { I.render(); errors.push('Render unexpectedly succeeded'); }
      catch (error) { errors.push(error.message); }
    }
    return errors;
  });
  expect(errors).toEqual(Array(2).fill('WebGL2 context lost; shut down and initialize again after restoration'));
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), I = window.ImGui;
    const extension = window.lossExtension;
    const restored = new Promise(resolve => canvas.addEventListener('webglcontextrestored', resolve, { once: true }));
    I.shutdown(); I.shutdown();
    extension.restoreContext(); await restored;
    await I.init({ canvas });
    for (let i = 0; i < 3; i++) { I.newFrame(); I.ShowDemoWindow(); I.render(); }
  });
  expect(await page.evaluate(() => window.ImGui.GetDrawData().TotalVtxCount)).toBeGreaterThan(100);
});
