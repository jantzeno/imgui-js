import type { MainModule } from './bind-imgui.js';

export interface BrowserBackend {
    assertContext(): void;
    resize(): void;
    dispose(): void;
}

let nextCanvasID = 0;

export function attachBrowser(native: MainModule, canvas: HTMLCanvasElement): BrowserBackend {
    const original = {
        id: canvas.id, tabIndex: canvas.getAttribute('tabindex'),
        width: canvas.width, height: canvas.height,
        style: canvas.getAttribute('style'),
    };
    if (!canvas.id) {
        let id: string;
        do { id = `imgui-${++nextCanvasID}`; } while (canvas.ownerDocument.getElementById(id));
        canvas.id = id;
    }
    if (!/^[A-Za-z][\w-]*$/.test(canvas.id)) throw new Error('Canvas ID must contain letters, digits, underscores, or hyphens');
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    const io = native.GetIO()!;
    io.ConfigMacOSXBehaviors = /Mac|iPhone|iPad/.test(navigator.platform);
    const rect = canvas.getBoundingClientRect();
    const restore = () => {
        canvas.width = original.width;
        canvas.height = original.height;
        if (original.style === null) canvas.removeAttribute('style');
        else canvas.setAttribute('style', original.style);
        canvas.id = original.id;
        if (original.tabIndex === null) canvas.removeAttribute('tabindex');
        else canvas.setAttribute('tabindex', original.tabIndex);
    };
    try {
        const error = native.BrowserInit(`#${canvas.id}`, Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
        if (error) throw new Error(error);
    } catch (error) {
        native.BrowserShutdown();
        restore();
        throw error;
    }

    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    let modifierDown = false;
    let disposed = false;
    let contextLost = false;
    let lastWidth = 0, lastHeight = 0, lastDpr = 0;
    const focused = () => canvas.ownerDocument.activeElement === canvas;

    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost = true;
    }, options);

    native.BrowserSetClipboardWriter((text: string) => {
        try {
            if (!navigator.clipboard) throw new Error('System clipboard requires HTTPS or localhost');
            void navigator.clipboard.writeText(text).catch(reportClipboardError);
        } catch (error) { reportClipboardError(error); }
    });
    function reportClipboardError(error: unknown): void {
        if (!disposed) canvas.dispatchEvent(new CustomEvent('imgui-clipboard-error', { detail: error }));
    }

    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }), options);
    canvas.addEventListener('focus', () => native.BrowserFocus(true), options);
    canvas.addEventListener('blur', () => {
        modifierDown = false;
        native.BrowserFocus(false);
    }, options);
    canvas.addEventListener('keydown', event => {
        modifierDown = io.ConfigMacOSXBehaviors ? event.metaKey : event.ctrlKey;
        // SDL cancels Ctrl/Cmd+V; let the browser deliver its paste event first.
        if (modifierDown && !event.altKey && event.code === 'KeyV') event.stopImmediatePropagation();
        if (event.code === 'Tab' && !io.WantCaptureKeyboard) event.stopImmediatePropagation();
        if (event.code === 'Escape' && !io.WantTextInput) {
            event.stopImmediatePropagation();
            canvas.blur();
        }
    }, options);
    canvas.addEventListener('keyup', event => {
        modifierDown = io.ConfigMacOSXBehaviors ? event.metaKey : event.ctrlKey;
    }, options);
    canvas.addEventListener('paste', event => {
        if (!focused() || !io.WantTextInput || !event.clipboardData) return;
        native.BrowserPaste(event.clipboardData.getData('text/plain'), modifierDown);
        event.preventDefault();
    }, options);

    function assertContext(): void {
        if (contextLost) throw new Error('WebGL2 context lost; shut down and initialize again after restoration');
    }

    return {
        assertContext,
        resize() {
            assertContext();
            const { width, height } = canvas.getBoundingClientRect();
            const w = Math.round(width), h = Math.round(height), dpr = devicePixelRatio;
            if (w > 0 && h > 0 && (w !== lastWidth || h !== lastHeight || dpr !== lastDpr)) {
                native.BrowserResize(w, h);
                lastWidth = w; lastHeight = h; lastDpr = dpr;
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            listeners.abort();
            native.BrowserShutdown();
            restore();
        },
    };
}
