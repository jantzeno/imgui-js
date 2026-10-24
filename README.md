# imgui-js

Dear ImGui for browser JavaScript and TypeScript, using SDL3 and WebGL2. This fork is a breaking rewrite of [flyover/imgui-js](https://github.com/flyover/imgui-js), shipping ESM, declarations, and a separate Wasm asset. Version 2 has not been published to npm.

| Component | Pinned version |
| --- | --- |
| Dear ImGui | 1.93.0, mainline submodule |
| Emscripten | 6.0.13 |
| SDL | 3.4.18, checksummed release archive |
| FreeType | 2.14.1, PNG bitmap support enabled |
| PlutoSVG / PlutoVG | 0.0.8 / 1.3.3, SVG font rendering |
| xmake | 3.1.2 |
| TypeScript | 7.0.2 |

SDL owns the canvas, WebGL2 context, and browser input. Rendering uses the unmodified upstream `imgui_impl_sdl3.cpp` and `imgui_impl_opengl3.cpp`. The demo calls the upstream C++ `ShowDemoWindow()`.

## Build and run

Install [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) 6.0.13 and [xmake](https://xmake.io/) 3.1.2. Development requires Node.js 22+, Python 3, CMake, and Ninja. xmake downloads and builds the pinned native dependencies, including SDL, FreeType, and PlutoSVG. Initial builds need network access for these dependencies and the package registry.

```sh
git clone --recurse-submodules https://github.com/jantzeno/imgui-js.git
cd imgui-js
source /path/to/emsdk/emsdk_env.sh
npm ci
npm run build
npm start
```

Open <http://127.0.0.1:8080>. On Windows, activate the SDK with `emsdk_env.bat` before the npm commands. xmake handles compilation on Linux, Windows, and macOS; CMake builds the SDL dependency.

`npm run build:debug` enables native assertions and stack checks. `npm run build` creates the optimized release. The build checks SDK/xmake versions, generates enum registrations from the preprocessed header, emits declarations through Embind, and reads enum values from compiled Wasm. Generated output is excluded from Git; run the full build before type checking a fresh checkout.

## Use

```ts
import * as ImGui from 'imgui-js';

const canvas = document.querySelector<HTMLCanvasElement>('#ui')!;
await ImGui.init({ canvas });
ImGui.GetIO().ConfigFlags |= ImGui.ConfigFlags.NavEnableKeyboard;
const checked: [boolean] = [false];
let animation: number;
function frame() {
  ImGui.newFrame();
  ImGui.Begin('Hello');
  ImGui.Text('Dear ImGui with SDL3');
  ImGui.Checkbox('Enabled', checked);
  ImGui.End();
  ImGui.render();
  animation = requestAnimationFrame(frame);
}
animation = requestAnimationFrame(frame);

function dispose() {
  cancelAnimationFrame(animation);
  ImGui.shutdown();
}
```

Give the canvas CSS dimensions, for example `width: 100%; height: 600px`. SDL handles framebuffer density; do not multiply ImGui coordinates or font sizes by `devicePixelRatio`. Supply an accessible canvas label and surrounding HTML controls. ImGui widgets do not expose an HTML accessibility tree.

Initialization creates the context and both backends. Await it before any ImGui call. One runtime and canvas are supported. Pair `newFrame()` with `render()`, or discard with `EndFrame()`. Stop your animation loop before shutdown. Shutdown is idempotent, releases resources/listeners, restores canvas attributes/styles, and permits a fresh initialization. After context loss, frames reject: shut down and initialize again after `webglcontextrestored`.

The capitalized API follows Dear ImGui. Scalars use one-element arrays or accessor functions; vectors/colors accept objects or tuples. Generated flag constants are `as const` objects with numeric flag types. Numeric keys use `ImGui.ImGuiKey['0']`. Current drawing order is `(rounding, thickness, flags)` for `AddRect`, and `(thickness, flags)` for `AddPolyline`/`PathStroke`. Image buttons require a string ID.

## Wasm and packaging

`npm pack` builds the runtime; install its `imgui-js-2.0.0.tgz` into a consuming project. There are no runtime npm dependencies. Declarations pass strict checks without `skipLibCheck` or ambient Emscripten types.

For direct ESM serving, keep `bind-imgui.wasm` beside `bind-imgui.js` and serve it as `application/wasm`. If a bundler does not copy Wasm, copy the asset explicitly and provide its URL:

```ts
await ImGui.init({
  canvas,
  locateFile: path => path.endsWith('.wasm') ? '/assets/bind-imgui.wasm' : path,
});
```

Bundlers can resolve the asset through `imgui-js/bind-imgui.wasm`; use their asset-copy or URL-import facility. UMD, CommonJS, SystemJS, embedded Wasm, and prebuilt files in Git are removed. `example/index.html` uses raw ESM.

## Fonts, textures, and ownership

```ts
// Before a frame:
const font = await ImGui.loadFont('/fonts/NotoSans-Regular.ttf', 18);
ImGui.GetIO().FontDefault = font;
// Inside a window:
ImGui.PushFont(font, 28);
ImGui.Text('Dynamic font size');
ImGui.PopFont();
```

`addFontFromMemory(Uint8Array, size, config?)` copies bytes into atlas-owned storage. Release the input buffer afterward. `loadFont` checks HTTP failures and delegates to it. Add fonts between frames. Use trusted TTF/OTF files. FreeType rasterizes fonts, with PlutoSVG handling SVG glyphs; WCHAR32 supports supplementary code points. Glyph coverage still requires a suitable font. The atlas rasterizes glyphs/sizes on demand; old glyph-range pointers and manual atlas build/upload steps are removed.

To merge SVG color emoji into a previously loaded font, run this between frames:

```ts
const config = new ImGui.ImFontConfig();
config.MergeMode = true;
config.FontLoaderFlags = ImGui.FreeTypeLoaderFlags.LoadColor;
try {
  await ImGui.loadFont('/fonts/NotoColorEmoji-Regular.ttf', 18, config);
} finally {
  config.delete();
}
```

`FreeTypeLoaderFlags` aliases the generated native `ImGuiFreeTypeLoaderFlags` constants. Font shaping, bidirectional layout, and stateful emoji sequences are not provided by this loader.

Bitmap-only fonts also need `FreeTypeLoaderFlags.Bitmap` and a supported fixed pixel size. The compared Noto bitmap emoji font renders at its 109-pixel strike at 1× density; it does not render at the tested 14/28/48-pixel sizes. Use the SVG font for dynamically sized color emoji.

Selected international test fonts are stored as Brotli files in [tests/fonts](tests/fonts/README.md), alongside their sources, licenses, and checksums. Browser tests automatically extract and verify them under `build/test-fonts` using Node's built-in compression support, including direct Playwright runs.

```ts
const texture = ImGui.createTextureRGBA(new Uint8Array([255, 0, 0, 255]), 1, 1);
// Inside a frame:
ImGui.Image(texture, { x: 32, y: 32 });
// After rendering the last frame using it:
ImGui.destroyTexture(texture);
```

Texture IDs are `bigint`. Uploads validate dimensions and byte counts; destruction rejects foreign/stale IDs. Shutdown releases remaining uploads. IDs expire on shutdown or context loss.

IO, style, fonts, draw data, and callback objects borrow native storage. Do not delete them or retain them after the owning context, callback, or frame expires. Owned configurations (`new ImFontConfig()`), filters, and splitters require `.delete()`. Clippers release allocations when iteration completes; delete an abandoned clipper explicitly.

Draw-list `VtxBuffer`/`IdxBuffer` getters return fresh `Uint8Array` views. Native allocations may grow Wasm memory and detach old views. Fetch the property again after native calls; use `.slice()` for data that must outlive the frame.

## Text, selection, and clipboard

Text capacity is **UTF-8 bytes including NUL**. `InputText('Name', value, 256)` reserves 256 bytes; existing text must fit. `CallbackResize` is rejected: increase capacity explicitly. Callback positions and byte counts follow ImGui's UTF-8 conventions. Selection methods call the native implementation.

`ImGuiTextFilter` uses the native parser. `ImDrawListSplitter` exposes split/channel/merge. Multi-selection exposes `BeginMultiSelect`, `EndMultiSelect`, request snapshots, and `SetNextItemSelectionUserData(bigint)`. Apply requests before submitting items and after ending the scope. Clipper inclusion/seek methods support virtual lists. Drag/drop retains one JavaScript payload with object identity until delivery, cancellation, or shutdown; type names contain 1–31 UTF-8 bytes.

Clicking focuses the canvas. Keyboard input and paste forwarding stay scoped to it. Tab can leave when ImGui does not capture keys; Escape releases focus when no text input is active. Blur clears keys/buttons.

Paste reads browser `paste` events without polling or requesting clipboard read permission. Copy/cut use `navigator.clipboard.writeText`, requiring HTTPS/localhost and potentially browser permission or user activation. Listen for `imgui-clipboard-error` on the canvas. Standard HTML clipboard handling continues outside it.

## Verification and scope

```sh
npm run build:debug
npm run typecheck
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

Tests use real Wasm, an isolated packed-package TypeScript consumer, rendered pixels, and browser input. Clipboard automation supplies a synthetic paste payload and verifies write denial; deployment still needs an actual OS clipboard check.

GitHub Actions builds debug/release on Linux, Windows, and macOS. Linux/macOS run Chromium, Firefox, and Playwright WebKit; Windows runs Chromium/Firefox. WebKit does not certify actual Safari, Retina hardware, or macOS clipboard permissions. These remain manual checks. Local development needs only Linux.

This release targets desktop WebGL2 browsers. Docking, WebGPU, Canvas2D, mobile keyboard/IME, native Node windows, shared renderer contexts, and third-party native widgets are outside this migration. See [the issue ledger](docs/issue-ledger.md) for fixes and deferred reports. No upstream issues were closed by this work.
