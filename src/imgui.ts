export interface XY { x: number, y: number; }
export interface XYZ extends XY { z: number; }
export interface XYZW extends XYZ { w: number; }

export interface RGB { r: number; g: number; b: number; }
export interface RGBA extends RGB { a: number; }

import createModule, { type MainModule } from './bind-imgui.js';
import type * as Bind from './bind-imgui.js';
import { attachBrowser, type BrowserBackend } from './browser.js';
import { ImGuiWindowFlags, ImGuiInputTextFlags, ImGuiTreeNodeFlags, ImGuiPopupFlags, ImGuiSelectableFlags, ImGuiComboFlags, ImGuiTabBarFlags, ImGuiTabItemFlags, ImGuiTableFlags, ImGuiTableColumnFlags, ImGuiTableRowFlags, ImGuiTableBgTarget, ImGuiFocusedFlags, ImGuiHoveredFlags, ImGuiDragDropFlags, ImGuiDataType, ImGuiDir, ImGuiSortDirection, ImGuiKey, ImGuiConfigFlags, ImGuiCol, ImGuiStyleVar, ImGuiBackendFlags, ImGuiButtonFlags, ImGuiColorEditFlags, ImGuiSliderFlags, ImGuiMouseButton, ImGuiMouseCursor, ImGuiCond, ImDrawFlags, ImFontAtlasFlags, ImGuiViewportFlags, ImGuiChildFlags, ImGuiInputFlags, ImGuiItemFlags, ImGuiMultiSelectFlags, ImGuiMod } from './enums.js';
export * from './enums.js';
export { ImGuiFreeTypeLoaderFlags as FreeTypeLoaderFlags } from './enums.js';

let bind: MainModule;
export { bind };
let backend: BrowserBackend | undefined;
let initializing = false;
let frameOpen = false;
let managedContext: ImGuiContext | null = null;

export interface InitOptions {
    canvas: HTMLCanvasElement;
    locateFile?: (path: string, prefix: string) => string;
}

export async function init(options: InitOptions): Promise<void> {
    if (backend || initializing) throw new Error('ImGui is already initialized or initializing');
    if (!options?.canvas || typeof HTMLCanvasElement === 'undefined' || !(options.canvas instanceof HTMLCanvasElement))
        throw new TypeError('init requires a browser HTMLCanvasElement');
    initializing = true;
    try {
        bind = await createModule({ canvas: options.canvas, locateFile: options.locateFile });
        managedContext = CreateContext();
        SetCurrentContext(managedContext);
        backend = attachBrowser(bind, options.canvas);
        IMGUI_VERSION = String(bind.IMGUI_VERSION);
        IMGUI_VERSION_NUM = bind.IMGUI_VERSION_NUM;
        ImFontConfig = bind.ImFontConfig;
    } catch (error) {
        if (managedContext) DestroyContext(managedContext);
        managedContext = null;
        throw error;
    } finally {
        initializing = false;
    }
}

export function newFrame(): void {
    if (!backend) throw new Error('Call and await init() before newFrame()');
    if (frameOpen) throw new Error('Call render() before starting another frame');
    backend.resize();
    bind.BrowserNewFrame();
    if (bind.GetDragDropPayload() === null) dragDropPayload = undefined;
    frameOpen = true;
}

export function render(): void {
    if (!backend || !frameOpen) throw new Error('Call newFrame() before render()');
    backend.assertContext();
    bind.BrowserRender();
    frameOpen = false;
    if (bind.GetDragDropPayload() === null) dragDropPayload = undefined;
}

export function shutdown(): void {
    if (initializing) throw new Error('Await init() before shutdown()');
    if (!backend) return;
    if (frameOpen) bind.EndFrame();
    frameOpen = false;
    backend.dispose();
    backend = undefined;
    DestroyContext(managedContext);
    managedContext = null;
    dragDropPayload = undefined;
}

export function createTextureRGBA(pixels: Uint8Array, width: number, height: number): ImTextureID {
    if (!backend) throw new Error('Call and await init() before creating textures');
    if (!(pixels instanceof Uint8Array) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 0x7fffffff || height > 0x7fffffff)
        throw new TypeError('Expected Uint8Array pixels and positive integer dimensions');
    return bind.BrowserCreateTexture(pixels, width, height);
}

export function destroyTexture(texture: ImTextureID): void {
    if (!backend) throw new Error('Call and await init() before destroying textures');
    bind.BrowserDestroyTexture(texture);
}

export function addFontFromMemory(data: Uint8Array, size = 0, config: ImFontConfig | null = null): ImFont {
    if (!backend) throw new Error('Call and await init() before adding fonts');
    if (frameOpen) throw new Error('Add fonts between frames');
    if (!(data instanceof Uint8Array)) throw new TypeError('Expected Uint8Array font bytes');
    return GetIO().Fonts!.AddFontFromMemoryTTF(data, size, config)!;
}

export async function loadFont(url: string | URL, size = 0, config: ImFontConfig | null = null): Promise<ImFont> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font request failed: ${response.status} ${response.statusText}`);
    return addFontFromMemory(new Uint8Array(await response.arrayBuffer()), size, config);
}

function import_Scalar(sca: XY | XYZ | XYZW | ImAccess<number> | ImScalar<number> | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | XYZW): ImScalar<number> {
    if (Array.isArray(sca)) { return [ sca[0] ]; }
    if (typeof sca === "function") { return [ sca() ]; }
    return [ sca.x ];
}

function export_Scalar(tuple: ImScalar<number>, sca: XY | XYZ | XYZW | ImAccess<number> | ImScalar<number> | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | XYZW): void {
    if (Array.isArray(sca)) { sca[0] = tuple[0]; return; }
    if (typeof sca === "function") { sca(tuple[0]); return; }
    sca.x = tuple[0];
}

function import_Vector2(vec: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | XYZW): ImTuple2<number> {
    if (Array.isArray(vec)) { return [ vec[0], vec[1] ]; }
    return [ vec.x, vec.y ];
}

function export_Vector2(tuple: ImTuple2<number>, vec: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | XYZW): void {
    if (Array.isArray(vec)) { vec[0] = tuple[0]; vec[1] = tuple[1]; return; }
    vec.x = tuple[0]; vec.y = tuple[1];
}

function import_Vector3(vec: XYZ | XYZW | ImTuple3<number> | ImTuple4<number> | XYZW): ImTuple3<number> {
    if (Array.isArray(vec)) { return [ vec[0], vec[1], vec[2] ]; }
    return [ vec.x, vec.y, vec.z ];
}

function export_Vector3(tuple: ImTuple3<number>, vec: XYZ | XYZW | ImTuple3<number> | ImTuple4<number> | XYZW): void {
    if (Array.isArray(vec)) { vec[0] = tuple[0]; vec[1] = tuple[1]; vec[2] = tuple[2]; return; }
    vec.x = tuple[0]; vec.y = tuple[1]; vec.z = tuple[2];
}

function import_Vector4(vec: XYZW | ImTuple3<number> | ImTuple4<number> | XYZW): ImTuple4<number> {
    if (Array.isArray(vec)) { return [ vec[0], vec[1], vec[2], vec[3] || 0 ]; }
    return [ vec.x, vec.y, vec.z, vec.w ];
}

function export_Vector4(tuple: ImTuple4<number>, vec: XYZW | ImTuple3<number> | ImTuple4<number> | XYZW): void {
    if (Array.isArray(vec)) { vec[0] = tuple[0]; vec[1] = tuple[1]; vec[2] = tuple[2]; vec[3] = tuple[3]; return; }
    vec.x = tuple[0]; vec.y = tuple[1]; vec.z = tuple[2]; vec.w = tuple[3];
}

function import_Color3(col: RGB | RGBA | ImTuple3<number> | ImTuple4<number> | XYZW): ImTuple3<number> {
    if (Array.isArray(col)) { return [ col[0], col[1], col[2] ]; }
    if ("r" in col) { return [ col.r, col.g, col.b ]; }
    return [ col.x, col.y, col.z ];
}

function export_Color3(tuple: ImTuple3<number>, col: RGB | RGBA | ImTuple3<number> | ImTuple4<number> | XYZW): void {
    if (Array.isArray(col)) { col[0] = tuple[0]; col[1] = tuple[1]; col[2] = tuple[2]; return; }
    if ("r" in col) { col.r = tuple[0]; col.g = tuple[1]; col.b = tuple[2]; return; }
    col.x = tuple[0]; col.y = tuple[1]; col.z = tuple[2];
}

function import_Color4(col: RGBA | ImTuple4<number> | XYZW | RGBA): ImTuple4<number> {
    if (Array.isArray(col)) { return [ col[0], col[1], col[2], col[3] ]; }
    if ("r" in col) { return [ col.r, col.g, col.b, col.a ]; }
    return [ col.x, col.y, col.z, col.w ];
}

function export_Color4(tuple: ImTuple4<number>, col: RGBA | ImTuple4<number> | XYZW | RGBA): void {
    if (Array.isArray(col)) { col[0] = tuple[0]; col[1] = tuple[1]; col[2] = tuple[2]; col[3] = tuple[3]; return; }
    if ("r" in col) { col.r = tuple[0]; col.g = tuple[1]; col.b = tuple[2]; col.a = tuple[3]; return; }
    col.x = tuple[0]; col.y = tuple[1]; col.z = tuple[2]; col.w = tuple[3];
}

import * as config from "./imconfig.js";

export { IMGUI_VERSION as VERSION }
export let IMGUI_VERSION = ""; // bind.IMGUI_VERSION;
export { IMGUI_VERSION_NUM as VERSION_NUM }
export let IMGUI_VERSION_NUM = 0; // bind.IMGUI_VERSION_NUM;
export { IMGUI_CHECKVERSION as CHECKVERSION }
export function IMGUI_CHECKVERSION(): boolean { return DebugCheckVersionAndDataLayout(IMGUI_VERSION, bind.ImGuiIOSize, bind.ImGuiStyleSize, bind.ImVec2Size, bind.ImVec4Size, bind.ImDrawVertSize, bind.ImDrawIdxSize); }

export const IMGUI_HAS_TABLE: boolean = true;

export function ASSERT(c: any): asserts c { if (!c) { throw new Error(); } }
export function IM_ASSERT(c: any): asserts c { if (!c) { throw new Error(); } }

export { IM_ARRAYSIZE as ARRAYSIZE }
export function IM_ARRAYSIZE(_ARR: ArrayLike<any> | ImStringBuffer): number {
    if (_ARR instanceof ImStringBuffer) {
        return _ARR.size;
    } else {
        return _ARR.length;
    }
}

export { ImStringBuffer as StringBuffer }
export class ImStringBuffer {
    constructor(public size: number, public buffer: string = "") {}
}

export type ImAccess<T> = (value?: T) => T; export { ImAccess as Access }
export type ImScalar<T> = [T]; export { ImScalar as Scalar }
export type ImTuple2<T> = [T, T]; export { ImTuple2 as Tuple2 }
export type ImTuple3<T> = [T, T, T]; export { ImTuple3 as Tuple3 }
export type ImTuple4<T> = [T, T, T, T]; export { ImTuple4 as Tuple4 }

export { ImTextureID as TextureID }
export type ImTextureID = bigint;
export { ImGuiID as ID }
export type ImGuiID = number;
export { ImGuiWindowFlags as WindowFlags };
export { ImGuiInputTextFlags as InputTextFlags };
export { ImGuiTreeNodeFlags as TreeNodeFlags };

export { ImGuiPopupFlags as PopupFlags };
export { ImGuiSelectableFlags as SelectableFlags };
export { ImGuiComboFlags as ComboFlags };
export { ImGuiTabBarFlags as TabBarFlags };

export { ImGuiTableFlags as TableFlags };
export { ImGuiTableColumnFlags as TableColumnFlags };
export { ImGuiTableRowFlags as TableRowFlags };
export { ImGuiTableBgTarget as TableBgTarget };
export { ImGuiFocusedFlags as FocusedFlags };
export { ImGuiHoveredFlags as HoveredFlags };
export { ImGuiDragDropFlags as DragDropFlags };
export const IMGUI_PAYLOAD_TYPE_COLOR_3F: string = "_COL3F";    // float[3]     // Standard type for colors, without alpha. User code may use this type.
export const IMGUI_PAYLOAD_TYPE_COLOR_4F: string = "_COL4F";    // float[4]     // Standard type for colors. User code may use this type.
export { ImGuiDataType as DataType };
export { ImGuiDir as Dir };
export { ImGuiSortDirection as SortDirection };
export { ImGuiKey as Key };
export { ImGuiConfigFlags as ConfigFlags };
export { ImGuiCol as Col };
export { ImGuiStyleVar as StyleVar };
export { ImGuiBackendFlags as BackendFlags };
export { ImGuiButtonFlags as ButtonFlags };
export { ImGuiColorEditFlags as ColorEditFlags };
export { ImGuiSliderFlags as SliderFlags };
export { ImGuiMouseButton as MouseButton };
export { ImGuiMouseCursor as MouseCursor };
export { ImGuiCond as Cond };

export { ImDrawFlags as DrawFlags };


export { ImU32 as U32 }
export type ImU32 = number;


export { ImVec2 as Vec2 }
export class ImVec2 implements XY {
    public static readonly ZERO: Readonly<ImVec2> = new ImVec2(0.0, 0.0);
    public static readonly UNIT: Readonly<ImVec2> = new ImVec2(1.0, 1.0);
    public static readonly UNIT_X: Readonly<ImVec2> = new ImVec2(1.0, 0.0);
    public static readonly UNIT_Y: Readonly<ImVec2> = new ImVec2(0.0, 1.0);

    constructor(public x: number = 0.0, public y: number = 0.0) {}

    public Set(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    public Copy(other: Readonly<XY>): this {
        this.x = other.x;
        this.y = other.y;
        return this;
    }

    public Equals(other: Readonly<XY>): boolean {
        if (this.x !== other.x) { return false; }
        if (this.y !== other.y) { return false; }
        return true;
    }
}


export { ImVec4 as Vec4 }
export class ImVec4 implements XYZW {
    public static readonly ZERO: Readonly<ImVec4> = new ImVec4(0.0, 0.0, 0.0, 0.0);
    public static readonly UNIT: Readonly<ImVec4> = new ImVec4(1.0, 1.0, 1.0, 1.0);
    public static readonly UNIT_X: Readonly<ImVec4> = new ImVec4(1.0, 0.0, 0.0, 0.0);
    public static readonly UNIT_Y: Readonly<ImVec4> = new ImVec4(0.0, 1.0, 0.0, 0.0);
    public static readonly UNIT_Z: Readonly<ImVec4> = new ImVec4(0.0, 0.0, 1.0, 0.0);
    public static readonly UNIT_W: Readonly<ImVec4> = new ImVec4(0.0, 0.0, 0.0, 1.0);
    public static readonly BLACK: Readonly<ImVec4> = new ImVec4(0.0, 0.0, 0.0, 1.0);
    public static readonly WHITE: Readonly<ImVec4> = new ImVec4(1.0, 1.0, 1.0, 1.0);

    constructor(public x: number = 0.0, public y: number = 0.0, public z: number = 0.0, public w: number = 1.0) {}

    public Set(x: number, y: number, z: number, w: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    }

    public Copy(other: Readonly<XYZW>): this {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        this.w = other.w;
        return this;
    }

    public Equals(other: Readonly<XYZW>): boolean {
        if (this.x !== other.x) { return false; }
        if (this.y !== other.y) { return false; }
        if (this.z !== other.z) { return false; }
        if (this.w !== other.w) { return false; }
        return true;
    }
}
export { ImVector as Vector }
export class ImVector<T> extends Array<T>
{
    public get Size(): number { return this.length; }
    public Data: T[] = this;
    public empty(): boolean { return this.length === 0; }
    public clear(): void { this.length = 0; }
    public pop_back(): T | undefined { return this.pop(); }
    public push_back(value: T): void { this.push(value); }
    public front(): T { IM_ASSERT(this.Size > 0);  return this.Data[0]; }
    public back(): T { IM_ASSERT(this.Size > 0);  return this.Data[this.Size - 1]; }
    public size(): number { return this.Size; }
    public resize(new_size: number, v?: (index: number) => T): void {
        if (v) {
            for (let index = this.length; index < new_size; ++index) {
                this[index] = v(index);
            }
        }
        else {
            this.length = new_size;
        }
    }
    public contains(value: T): boolean {
        return this.includes(value);
    }
    public find_erase_unsorted(value: T): void {
        const index = this.indexOf(value);
        if (index !== -1) {
            this.splice(index, 1);
        }
    }
}
export { IM_UNICODE_CODEPOINT_MAX as UNICODE_CODEPOINT_MAX }
export const IM_UNICODE_CODEPOINT_MAX = 0x10FFFF; // Maximum Unicode code point supported by this build.
export { ImGuiTextFilter as TextFilter }
export class ImGuiTextFilter {
    readonly native: Bind.ImGuiTextFilter;
    constructor(filter = '') { this.native = new bind.ImGuiTextFilter(filter); }
    SetFilter(filter: string): void { this.native.SetFilter(filter); }
    PassFilter(text: string): boolean { return this.native.PassFilter(text); }
    Draw(label = 'Filter (inc,-exc)', width = 0): boolean {
        if (width) SetNextItemWidth(width);
        return this.native.Draw(label);
    }
    Clear(): void { this.native.Clear(); }
    IsActive(): boolean { return this.native.IsActive(); }
    delete(): void { this.native.delete(); }
}
export { ImGuiTextBuffer as TextBuffer }
export class ImGuiTextBuffer
{
    public Buf: string = "";
    public begin(): string { return this.Buf; }
    public size(): number { return this.Buf.length; }
    public clear(): void { this.Buf = ""; }
    public append(text: string): void { this.Buf += text; }
}
export { ImGuiPayload as Payload }
export interface ImGuiPayload<T>
{
    Data: T;
}
export const IM_COL32_R_SHIFT: number = config.IMGUI_USE_BGRA_PACKED_COLOR ? 16 : 0;
export const IM_COL32_G_SHIFT: number = 8;
export const IM_COL32_B_SHIFT: number = config.IMGUI_USE_BGRA_PACKED_COLOR ? 0 : 16;
export const IM_COL32_A_SHIFT: number = 24;
export const IM_COL32_A_MASK: number = 0xFF000000;
export { IM_COL32 as COL32 }
export function IM_COL32(R: number, G: number, B: number, A: number = 255): number {
    return ((A << IM_COL32_A_SHIFT) | (B << IM_COL32_B_SHIFT) | (G << IM_COL32_G_SHIFT) | (R << IM_COL32_R_SHIFT)) >>> 0;
}
export const IM_COL32_WHITE: number = IM_COL32(255, 255, 255, 255); export { IM_COL32_WHITE as COL32_WHITE }  // Opaque white = 0xFFFFFFFF
export const IM_COL32_BLACK: number = IM_COL32(0, 0, 0, 255); export { IM_COL32_BLACK as COL32_BLACK }        // Opaque black
export const IM_COL32_BLACK_TRANS: number = IM_COL32(0, 0, 0, 0); export { IM_COL32_BLACK_TRANS as COL32_BLACK_TRANS }    // Transparent black = 0x00000000
export { ImColor as Color }
export class ImColor
{
    public Value: ImVec4 = new ImVec4();
    constructor();
    constructor(r: number, g: number, b: number);
    constructor(r: number, g: number, b: number, a: number);
    constructor(rgba: number);
    constructor(col: Readonly<XYZW>);
    constructor(r: number | number | Readonly<XYZW> = 0.0, g: number = 0.0, b: number = 0.0, a: number = 1.0) {
        if (typeof(r) === "number") {
            if (r > 255 && g === 0.0 && b === 0.0 && a === 1.0) {
                this.Value.x = Math.max(0.0, Math.min(1.0, ((r >> IM_COL32_R_SHIFT) & 0xFF) / 255));
                this.Value.y = Math.max(0.0, Math.min(1.0, ((r >> IM_COL32_G_SHIFT) & 0xFF) / 255));
                this.Value.z = Math.max(0.0, Math.min(1.0, ((r >> IM_COL32_B_SHIFT) & 0xFF) / 255));
                this.Value.w = Math.max(0.0, Math.min(1.0, ((r >> IM_COL32_A_SHIFT) & 0xFF) / 255));
            } else if (r <= 1.0 && g <= 1.0 && b <= 1.0 && a <= 1.0) {
                this.Value.x = Math.max(0.0, r);
                this.Value.y = Math.max(0.0, g);
                this.Value.z = Math.max(0.0, b);
                this.Value.w = Math.max(0.0, a);
            } else {
                this.Value.x = Math.max(0.0, Math.min(1.0, r / 255));
                this.Value.y = Math.max(0.0, Math.min(1.0, g / 255));
                this.Value.z = Math.max(0.0, Math.min(1.0, b / 255));
                if (a <= 1.0) {
                    this.Value.w = Math.max(0.0, a);
                } else {
                    this.Value.w = Math.max(0.0, Math.min(1.0, a / 255));
                }
            }
        } else {
            this.Value.Copy(r);
        }
    }
    public toImU32(): number { return ColorConvertFloat4ToU32(this.Value); }
    public toImVec4(): ImVec4 { return this.Value; }
    public SetHSV(h: number, s: number, v: number, a: number = 1.0): void {
        const ref_r: ImScalar<number> = [ this.Value.x ];
        const ref_g: ImScalar<number> = [ this.Value.y ];
        const ref_b: ImScalar<number> = [ this.Value.z ];
        ColorConvertHSVtoRGB(h, s, v, ref_r, ref_g, ref_b);
        this.Value.x = ref_r[0];
        this.Value.y = ref_g[0];
        this.Value.z = ref_b[0];
        this.Value.w = a;
    }
    public static HSV(h: number, s: number, v: number, a: number = 1.0): ImColor {
        const color = new ImColor();
        color.SetHSV(h, s, v, a);
        return color;
    }
}

export { ImGuiInputTextDefaultSize as InputTextDefaultSize }
export const ImGuiInputTextDefaultSize: number = 128;

export { ImGuiInputTextCallback as InputTextCallback }
export type ImGuiInputTextCallback<T> = (data: ImGuiInputTextCallbackData<T>) => number;
export { ImGuiInputTextCallbackData as InputTextCallbackData }
export class ImGuiInputTextCallbackData<T> {
    constructor(public readonly native: Bind.ImGuiInputTextCallbackData, public readonly UserData: T | null = null) {}
    public get EventFlag(): ImGuiInputTextFlags { return this.native.EventFlag; }
    public get Flags(): ImGuiInputTextFlags { return this.native.Flags; }
    public get EventChar(): number { return this.native.EventChar; }
    public set EventChar(value: number) { this.native.EventChar = value; }
    public get EventKey(): ImGuiKey { return this.native.EventKey; }
    public get Buf(): string { return this.native.Buf; }
    public set Buf(value: string) { this.native.Buf = value; }
    public get BufTextLen(): number { return this.native.BufTextLen; }
    public set BufTextLen(value: number) { this.native.BufTextLen = value; }
    public get BufSize(): number { return this.native.BufSize; }
    public set BufDirty(value: boolean) { this.native.BufDirty = value; }
    public get CursorPos(): number { return this.native.CursorPos; }
    public set CursorPos(value: number) { this.native.CursorPos = value; }
    public get SelectionStart(): number { return this.native.SelectionStart; }
    public set SelectionStart(value: number) { this.native.SelectionStart = value; }
    public get SelectionEnd(): number { return this.native.SelectionEnd; }
    public set SelectionEnd(value: number) { this.native.SelectionEnd = value; }
    public DeleteChars(pos: number, bytes_count: number): void { return this.native.DeleteChars(pos, bytes_count); }
    public InsertChars(pos: number, text: string, text_end: number | null = null): void { return this.native.InsertChars(pos, text_end !== null ? text.substring(0, text_end) : text); }
    public SelectAll(): void { this.native.SelectAll(); }
    public ClearSelection(): void { this.native.ClearSelection(); }
    public HasSelection(): boolean { return this.native.HasSelection(); }
}

export { ImGuiSizeCallback as SizeCallback }
export type ImGuiSizeCallback<T> = (data: ImGuiSizeCallbackData<T>) => void;
export { ImGuiSizeCallbackData as SizeCallbackData }
export class ImGuiSizeCallbackData<T> {
    constructor(public readonly native: Bind.ImGuiSizeCallbackData, public readonly UserData: T) {}

    get Pos(): Readonly<XY> { return this.native.Pos; }
    get CurrentSize(): Readonly<XY> { return this.native.CurrentSize; }
    get DesiredSize(): XY { return this.native.DesiredSize; }
}
export { ImGuiTableColumnSortSpecs as TableColumnSortSpecs }
export class ImGuiTableColumnSortSpecs
{
    constructor(public readonly native: Bind.ImGuiTableColumnSortSpecs) {}
    get ColumnUserID(): ImGuiID { return this.native.ColumnUserID; }
    get ColumnIndex(): number { return this.native.ColumnIndex; }
    get SortOrder(): number { return this.native.SortOrder; }
    get SortDirection(): ImGuiSortDirection { return this.native.SortDirection; }
}
export { ImGuiTableSortSpecs as TableSortSpecs }
export class ImGuiTableSortSpecs
{
    constructor(public readonly native: Bind.ImGuiTableSortSpecs) {
        this._Specs = Array.from({length: this.SpecsCount}).map((_, i) => {
            return new ImGuiTableColumnSortSpecs(this.native.GetSpec(i));
        })
    }

    private _Specs: Readonly<ImGuiTableColumnSortSpecs[]>;
    get Specs(): Readonly<ImGuiTableColumnSortSpecs[]> { return this._Specs; }
    get SpecsCount(): number { return this.native.SpecsCount; }
    get SpecsDirty(): boolean { return this.native.SpecsDirty; }
    set SpecsDirty(value: boolean) { this.native.SpecsDirty = value; }
}

export { ImGuiListClipper as ListClipper }
export class ImGuiListClipper
{
    private _native: Bind.ImGuiListClipper | null = null;
    private get native(): Bind.ImGuiListClipper {
        return this._native || (this._native = new bind.ImGuiListClipper());
    }

    public get DisplayStart(): number { return this.native.DisplayStart; }
    public get DisplayEnd(): number { return this.native.DisplayEnd; }

    public get ItemsCount(): number { return this.native.ItemsCount; }
    public get ItemsHeight(): number { return this.native.ItemsHeight; }
    public get StartPosY(): number { return this.native.StartPosY; }
    public delete(): void {
        if (this._native !== null) {
            this._native.delete();
            this._native = null;
        }
    }
    public Begin(items_count: number, items_height: number = -1.0): void {
        this.native.Begin(items_count, items_height);
    }
    public IncludeItemByIndex(index: number): void { this.native.IncludeItemByIndex(index); }
    public IncludeItemsByIndex(begin: number, end: number): void { this.native.IncludeItemsByIndex(begin, end); }
    public SeekCursorForItem(index: number): void { this.native.SeekCursorForItem(index); }
    public End(): void {
        this.native.End();
        this.delete();
    }
    public Step(): boolean {
        const busy: boolean = this.native.Step();
        if (!busy) {
            this.delete();
        }
        return busy;
    }
}
export { ImDrawCmd as DrawCmd }
export class ImDrawCmd
{
    constructor(public readonly native: Bind.ImDrawCmd) {}
    get ElemCount(): number { return this.native.ElemCount; }
    get ClipRect(): Readonly<Bind.ImVec4> { return this.native.ClipRect; }
    get TextureId(): ImTextureID {
        return this.native.GetTexID();
    }
    get VtxOffset(): number { return this.native.VtxOffset; }
    get IdxOffset(): number { return this.native.IdxOffset; }
}
export { ImDrawIdxSize as DrawIdxSize }
export const ImDrawIdxSize: number = 2; // bind.ImDrawIdxSize;
export { ImDrawIdx as DrawIdx }
export type ImDrawIdx = number;
export { ImDrawVertSize as DrawVertSize }
export const ImDrawVertSize: number = 20; // bind.ImDrawVertSize;
export { ImDrawVertPosOffset as DrawVertPosOffset }
export const ImDrawVertPosOffset: number = 0; // bind.ImDrawVertPosOffset;
export { ImDrawVertUVOffset as DrawVertUVOffset }
export const ImDrawVertUVOffset: number = 8; // bind.ImDrawVertUVOffset;
export { ImDrawVertColOffset as DrawVertColOffset }
export const ImDrawVertColOffset: number = 16; // bind.ImDrawVertColOffset;
export { ImDrawVert as DrawVert }
export class ImDrawVert
{
    public pos: Float32Array;
    public uv: Float32Array;
    public col: Uint32Array;

    constructor(buffer: ArrayBuffer, byteOffset: number = 0) {
        this.pos = new Float32Array(buffer, byteOffset + bind.ImDrawVertPosOffset, 2);
        this.uv = new Float32Array(buffer, byteOffset + bind.ImDrawVertUVOffset, 2);
        this.col = new Uint32Array(buffer, byteOffset + bind.ImDrawVertColOffset, 1);
    }
}

export { ImDrawList as DrawList }
export class ImDrawListSplitter {
    readonly native = new bind.ImDrawListSplitter();
    Clear(): void { this.native.Clear(); }
    Split(list: ImDrawList, count: number): void { this.native.Split(list.native, count); }
    Merge(list: ImDrawList): void { this.native.Merge(list.native); }
    SetCurrentChannel(list: ImDrawList, index: number): void { this.native.SetCurrentChannel(list.native, index); }
    delete(): void { this.native.delete(); }
}
export { ImDrawListSplitter as DrawListSplitter };
export class ImDrawList
{
    constructor(public readonly native: Bind.ImDrawList) {}

    public IterateDrawCmds(callback: (draw_cmd: ImDrawCmd, ElemStart: number) => void): void {
        this.native.IterateDrawCmds((draw_cmd: Bind.ImDrawCmd, ElemStart: number): void => {
            callback(new ImDrawCmd(draw_cmd), ElemStart);
        });
    }
    get IdxBuffer(): Uint8Array { return this.native.IdxBuffer; }
    get VtxBuffer(): Uint8Array { return this.native.VtxBuffer; }
    get Flags(): ImDrawFlags { return this.native.Flags; }
    set Flags(value: ImDrawFlags) { this.native.Flags = value; }
    public PushClipRect(clip_rect_min: Readonly<XY>, clip_rect_max: Readonly<XY>, intersect_with_current_clip_rect: boolean = false): void {
        this.native.PushClipRect(clip_rect_min, clip_rect_max, intersect_with_current_clip_rect);
    }
    public PushClipRectFullScreen(): void { this.native.PushClipRectFullScreen(); }
    public PopClipRect(): void { this.native.PopClipRect(); }
    public PushTexture(texture_id: ImTextureID): void {
        this.native.PushTexture(texture_id);
    }
    public PopTexture(): void { this.native.PopTexture(); }
    public GetClipRectMin(out: XY = new ImVec2()): XY {
        return this.native.GetClipRectMin(out);
    }
    public GetClipRectMax(out: XY = new ImVec2()): XY {
        return this.native.GetClipRectMax(out);
    }
    public AddLine(a: Readonly<XY>, b: Readonly<XY>, col: number, thickness: number = 1.0, flags: ImDrawFlags = 0): void {
        this.native.AddLine(a, b, col, thickness, flags);
    }
    public AddRect(a: Readonly<XY>, b: Readonly<XY>, col: number, rounding: number = 0.0, thickness: number = 1.0, flags: ImDrawFlags = ImDrawFlags.None): void {
        this.native.AddRect(a, b, col, rounding, thickness, flags);
    }
    public AddRectFilled(a: Readonly<XY>, b: Readonly<XY>, col: number, rounding: number = 0.0, flags: ImDrawFlags = ImDrawFlags.None): void {
        this.native.AddRectFilled(a, b, col, rounding, flags);
    }
    public AddRectFilledMultiColor(a: Readonly<XY>, b: Readonly<XY>, col_upr_left: number, col_upr_right: number, col_bot_right: number, col_bot_left: number): void {
        this.native.AddRectFilledMultiColor(a, b, col_upr_left, col_upr_right, col_bot_right, col_bot_left);
    }
    public AddQuad(a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, d: Readonly<XY>, col: number, thickness: number = 1.0, flags: ImDrawFlags = 0): void {
        this.native.AddQuad(a, b, c, d, col, thickness, flags);
    }
    public AddQuadFilled(a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, d: Readonly<XY>, col: number): void {
        this.native.AddQuadFilled(a, b, c, d, col);
    }
    public AddTriangle(a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, col: number, thickness: number = 1.0, flags: ImDrawFlags = 0): void {
        this.native.AddTriangle(a, b, c, col, thickness, flags);
    }
    public AddTriangleFilled(a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, col: number): void {
        this.native.AddTriangleFilled(a, b, c, col);
    }
    public AddCircle(centre: Readonly<XY>, radius: number, col: number, num_segments: number = 0, thickness: number = 1.0, flags: ImDrawFlags = 0): void {
        this.native.AddCircle(centre, radius, col, num_segments, thickness, flags);
    }
    public AddCircleFilled(centre: Readonly<XY>, radius: number, col: number, num_segments: number = 0): void {
        this.native.AddCircleFilled(centre, radius, col, num_segments);
    }
    public AddNgon(centre: Readonly<XY>, radius: number, col: number, num_segments: number, thickness: number = 1.0, flags: ImDrawFlags = 0): void {
        this.native.AddNgon(centre, radius, col, num_segments, thickness, flags);
    }
    public AddNgonFilled(centre: Readonly<XY>, radius: number, col: number, num_segments: number): void {
        this.native.AddNgonFilled(centre, radius, col, num_segments);
    }
    public AddText(pos: Readonly<XY>, col: number, text_begin: string, text_end?: number | null): void;
    public AddText(font: ImFont, font_size: number, pos: Readonly<XY>, col: number, text_begin: string, text_end?: number | null, wrap_width?: number, cpu_fine_clip_rect?: Readonly<XYZW> | null): void;
    public AddText(...args: any[]): void {
        if (args.length >= 5) {
            const font: ImFont = args[0];
            const font_size: number = args[1];
            const pos: Readonly<XY> = args[2];
            const col: number = args[3];
            const text_begin: string = args[4];
            const text_end: number | null = args[5] ?? null;
            const wrap_width: number = args[6] ?? 0.0;
            const cpu_fine_clip_rect: Readonly<XYZW> | null = args[7] || null;
            this.native.AddText_B(font, font_size, pos, col, text_end !== null ? text_begin.substring(0, text_end) : text_begin, wrap_width, cpu_fine_clip_rect);
        } else {
            const pos: Readonly<XY> = args[0];
            const col: number = args[1];
            const text_begin: string = args[2];
            const text_end: number | null = args[3] ?? null;
            this.native.AddText_A(pos, col, text_end !== null ? text_begin.substring(0, text_end) : text_begin);
        }
    }
    public AddPolyline(points: Array<Readonly<XY>>, num_points: number, col: number, thickness: number = 1, flags: ImDrawFlags = 0): void {
        this.native.AddPolyline(points, num_points, col, thickness, flags);
    }
    public AddConvexPolyFilled(points: Array<Readonly<XY>>, num_points: number, col: number, flags: ImDrawFlags = 0): void {
        this.native.AddConvexPolyFilled(points, num_points, col, flags);
    }
    public AddBezierCubic(p1: Readonly<XY>, p2: Readonly<XY>, p3: Readonly<XY>, p4: Readonly<XY>, col: number, thickness: number = 1.0, num_segments: number = 0, flags: ImDrawFlags = 0): void {
        this.native.AddBezierCubic(p1, p2, p3, p4, col, thickness, num_segments, flags);
    }
    public AddBezierQuadratic(p1: Readonly<XY>, p2: Readonly<XY>, p3: Readonly<XY>, col: number, thickness: number = 1.0, num_segments: number = 0, flags: ImDrawFlags = 0): void {
        this.native.AddBezierQuadratic(p1, p2, p3, col, thickness, num_segments, flags);
    }
    public AddImage(user_texture_id: ImTextureID | null, a: Readonly<XY>, b: Readonly<XY>, uv_a: Readonly<XY> = ImVec2.ZERO, uv_b: Readonly<XY> = ImVec2.UNIT, col: number = 0xFFFFFFFF): void {
        this.native.AddImage(user_texture_id ?? 0n, a, b, uv_a, uv_b, col);
    }
    public AddImageQuad(user_texture_id: ImTextureID | null, a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, d: Readonly<XY>, uv_a: Readonly<XY> = ImVec2.ZERO, uv_b: Readonly<XY> = ImVec2.UNIT_X, uv_c: Readonly<XY> = ImVec2.UNIT, uv_d: Readonly<XY> = ImVec2.UNIT_Y, col: number = 0xFFFFFFFF): void {
        this.native.AddImageQuad(user_texture_id ?? 0n, a, b, c, d, uv_a, uv_b, uv_c, uv_d, col);
    }
    public AddImageRounded(user_texture_id: ImTextureID | null, a: Readonly<XY>, b: Readonly<XY>, uv_a: Readonly<XY>, uv_b: Readonly<XY>, col: number, rounding: number, flags: ImDrawFlags = ImDrawFlags.None): void {
        this.native.AddImageRounded(user_texture_id ?? 0n, a, b, uv_a, uv_b, col, rounding, flags);
    }
    public PathClear(): void { this.native.PathClear(); }
    public PathLineTo(pos: Readonly<XY>): void { this.native.PathLineTo(pos); }
    public PathLineToMergeDuplicate(pos: Readonly<XY>): void { this.native.PathLineToMergeDuplicate(pos); }
    public PathFillConvex(col: number, flags: ImDrawFlags = 0): void { this.native.PathFillConvex(col, flags); }
    public PathStroke(col: number, thickness: number = 1.0, flags: ImDrawFlags = ImDrawFlags.None): void { this.native.PathStroke(col, thickness, flags); }
    public PathArcTo(centre: Readonly<XY>, radius: number, a_min: number, a_max: number, num_segments: number = 0): void { this.native.PathArcTo(centre, radius, a_min, a_max, num_segments); }
    public PathArcToFast(centre: Readonly<XY>, radius: number, a_min_of_12: number, a_max_of_12: number): void { this.native.PathArcToFast(centre, radius, a_min_of_12, a_max_of_12); }
    public PathBezierCubicCurveTo(p2: Readonly<XY>, p3: Readonly<XY>, p4: Readonly<XY>, num_segments: number = 0): void { this.native.PathBezierCubicCurveTo(p2, p3, p4, num_segments); }
    public PathBezierQuadraticCurveTo(p2: Readonly<XY>, p3: Readonly<XY>, num_segments: number = 0): void { this.native.PathBezierQuadraticCurveTo(p2, p3, num_segments); }
    public PathRect(rect_min: Readonly<XY>, rect_max: Readonly<XY>, rounding: number = 0.0, flags: ImDrawFlags = ImDrawFlags.None): void { this.native.PathRect(rect_min, rect_max, rounding, flags); }
    public ChannelsSplit(channels_count: number): void { this.native.ChannelsSplit(channels_count); }
    public ChannelsMerge(): void { this.native.ChannelsMerge(); }
    public ChannelsSetCurrent(channel_index: number): void { this.native.ChannelsSetCurrent(channel_index); }
    public AddDrawCmd(): void { this.native.AddDrawCmd(); }
    public PrimReserve(idx_count: number, vtx_count: number): void { this.native.PrimReserve(idx_count, vtx_count); }
    public PrimUnreserve(idx_count: number, vtx_count: number): void { this.native.PrimUnreserve(idx_count, vtx_count); }
    public PrimRect(a: Readonly<XY>, b: Readonly<XY>, col: number): void { this.native.PrimRect(a, b, col); }
    public PrimRectUV(a: Readonly<XY>, b: Readonly<XY>, uv_a: Readonly<XY>, uv_b: Readonly<XY>, col: number): void { this.native.PrimRectUV(a, b, uv_a, uv_b, col); }
    public PrimQuadUV(a: Readonly<XY>, b: Readonly<XY>, c: Readonly<XY>, d: Readonly<XY>, uv_a: Readonly<XY>, uv_b: Readonly<XY>, uv_c: Readonly<XY>, uv_d: Readonly<XY>, col: number): void { this.native.PrimQuadUV(a, b, c, d, uv_a, uv_b, uv_c, uv_d, col); }
    public PrimWriteVtx(pos: Readonly<XY>, uv: Readonly<XY>, col: number): void { this.native.PrimWriteVtx(pos, uv, col); }
    public PrimWriteIdx(idx: ImDrawIdx): void { this.native.PrimWriteIdx(idx); }
    public PrimVtx(pos: Readonly<XY>, uv: Readonly<XY>, col: number): void { this.native.PrimVtx(pos, uv, col); }
    public _CalcCircleAutoSegmentCount(radius: number): number { return this.native._CalcCircleAutoSegmentCount(radius); }
}
export { ImDrawData as DrawData }
export class ImDrawData
{
    constructor(public readonly native: Bind.ImDrawData) {}

    public IterateDrawLists(callback: (draw_list: ImDrawList) => void): void {
        this.native.IterateDrawLists((draw_list: Bind.ImDrawList): void => {
            callback(new ImDrawList(draw_list));
        });
    }
    get Valid(): boolean { return this.native.Valid; }
    get CmdListsCount(): number { return this.native.CmdListsCount; }
    get TotalIdxCount(): number { return this.native.TotalIdxCount; }
    get TotalVtxCount(): number { return this.native.TotalVtxCount; }
    get DisplayPos(): Readonly<Bind.ImVec2> { return this.native.DisplayPos; }
    get DisplaySize(): Readonly<Bind.ImVec2> { return this.native.DisplaySize; }
    get FramebufferScale(): Readonly<Bind.ImVec2> { return this.native.FramebufferScale; }
    public DeIndexAllBuffers(): void { this.native.DeIndexAllBuffers(); }
    public ScaleClipRects(fb_scale: Readonly<XY>): void {
        this.native.ScaleClipRects(fb_scale);
    }
}

export { ImFontConfig as FontConfig }
export type ImFontConfig = Bind.ImFontConfig;
export let ImFontConfig: MainModule['ImFontConfig'];

export { ImFontGlyph as FontGlyph }
export type ImFontGlyph = Bind.ImFontGlyph;

export { ImFontAtlasFlags as FontAtlasFlags }
export { ImFontAtlas as FontAtlas }
export type ImFontAtlas = Bind.ImFontAtlas;
export { ImFont as Font }
export type ImFont = Bind.ImFont;
export { ImGuiViewportFlags as ViewportFlags }

export { ImGuiStyle as Style }
export type ImGuiStyle = Bind.ImGuiStyle;
export { ImGuiIO as IO }
export type ImGuiIO = Bind.ImGuiIO;
export class ImGuiContext {
    static current_ctx: ImGuiContext | null = null;
    constructor(public readonly native: Bind.WrapImGuiContext) {}
}
export function CreateContext(shared_font_atlas: ImFontAtlas | null = null): ImGuiContext | null {
    const ctx: ImGuiContext = new ImGuiContext(bind.CreateContext(shared_font_atlas)!);
    ImGuiContext.current_ctx = ctx;
    return ctx;
}
export function DestroyContext(ctx: ImGuiContext | null = null): void {
    if (ctx === null) {
        ctx = ImGuiContext.current_ctx;
        ImGuiContext.current_ctx = null;
    }
    if (ctx === ImGuiContext.current_ctx) ImGuiContext.current_ctx = null;
    bind.DestroyContext((ctx === null) ? null : ctx.native);
}
export function GetCurrentContext(): ImGuiContext | null {
    return ImGuiContext.current_ctx;
}
export function SetCurrentContext(ctx: ImGuiContext | null): void {
    bind.SetCurrentContext((ctx === null) ? null : ctx.native);
    ImGuiContext.current_ctx = ctx;
}
export function GetIO(): ImGuiIO { return bind.GetIO()!; }
export function GetStyle(): ImGuiStyle { return bind.GetStyle()!; }
export function NewFrame(): void { newFrame(); }
export function EndFrame(): void {
    if (!frameOpen) throw new Error('Call newFrame() before EndFrame()');
    bind.EndFrame();
    frameOpen = false;
}
export function Render(): void { render(); }
export function GetDrawData(): ImDrawData | null {
    const draw_data: Bind.ImDrawData | null = bind.GetDrawData();
    return (draw_data === null) ? null : new ImDrawData(draw_data);
}
export function ShowDemoWindow(p_open: ImScalar<boolean> | null = null): void { bind.ShowDemoWindow(p_open); }
export function ShowMetricsWindow(p_open: ImScalar<boolean> | ImAccess<boolean> | null = null): void {
    if (p_open === null) {
        bind.ShowMetricsWindow(null);
    } else if (Array.isArray(p_open)) {
        bind.ShowMetricsWindow(p_open);
    } else {
        const ref_open: ImScalar<boolean> = [ p_open() ];
        bind.ShowMetricsWindow(ref_open);
        p_open(ref_open[0]);
    }
}
export function ShowIDStackToolWindow(p_open: ImScalar<boolean> | ImAccess<boolean> | null = null): void {
    if (p_open === null) {
        bind.ShowIDStackToolWindow(null);
    } else if (Array.isArray(p_open)) {
        bind.ShowIDStackToolWindow(p_open);
    } else {
        const ref_open: ImScalar<boolean> = [ p_open() ];
        bind.ShowIDStackToolWindow(ref_open);
        p_open(ref_open[0]);
    }
}
export function ShowAboutWindow(p_open: ImScalar<boolean> | ImAccess<boolean> | null = null): void {
    if (p_open === null) {
        bind.ShowAboutWindow(null);
    } else if (Array.isArray(p_open)) {
        bind.ShowAboutWindow(p_open);
    } else {
        const ref_open: ImScalar<boolean> = [ p_open() ];
        bind.ShowAboutWindow(ref_open);
        p_open(ref_open[0]);
    }
}
export function ShowStyleEditor(ref: ImGuiStyle | null = null): void { bind.ShowStyleEditor(ref); }
export function ShowStyleSelector(label: string): boolean { return bind.ShowStyleSelector(label); }
export function ShowFontSelector(label: string): void { bind.ShowFontSelector(label); }
export function ShowUserGuide(): void { bind.ShowUserGuide(); }
export function GetVersion(): string { return bind.GetVersion(); }
export function StyleColorsDark(dst: ImGuiStyle | null = null): void { bind.StyleColorsDark(dst); }
export function StyleColorsLight(dst: ImGuiStyle | null = null): void { bind.StyleColorsLight(dst); }
export function StyleColorsClassic(dst: ImGuiStyle | null = null): void { bind.StyleColorsClassic(dst); }
export function Begin(name: string, open: ImScalar<boolean> | ImAccess<boolean> | null = null, flags: ImGuiWindowFlags = 0): boolean {
    if (open === null) {
        return bind.Begin(name, null, flags);
    } else if (Array.isArray(open)) {
        return bind.Begin(name, open, flags);
    } else {
        const ref_open: ImScalar<boolean> = [ open() ];
        const opened: boolean = bind.Begin(name, ref_open, flags);
        open(ref_open[0]);
        return opened;
    }
}
export function End(): void { bind.End(); }
export function BeginChild(id: string | ImGuiID, size: Readonly<XY> = ImVec2.ZERO, child_flags: ImGuiChildFlags = 0, flags: ImGuiWindowFlags = 0): boolean {
    return bind.BeginChild(id, size, child_flags, flags);
}
export function EndChild(): void { bind.EndChild(); }
export function IsWindowAppearing(): boolean { return bind.IsWindowAppearing(); }
export function IsWindowCollapsed(): boolean { return bind.IsWindowCollapsed(); }
export function IsWindowFocused(flags: ImGuiFocusedFlags = 0): boolean { return bind.IsWindowFocused(flags); }
export function IsWindowHovered(flags: ImGuiHoveredFlags = 0): boolean { return bind.IsWindowHovered(flags); }
export function GetWindowDrawList(): ImDrawList { return new ImDrawList(bind.GetWindowDrawList()); }
export function GetWindowPos(out: XY = new ImVec2()): XY { return bind.GetWindowPos(out); }
export function GetWindowSize(out: XY = new ImVec2()): XY { return bind.GetWindowSize(out); }
export function GetWindowWidth(): number { return bind.GetWindowWidth(); }
export function GetWindowHeight(): number { return bind.GetWindowHeight(); }
export function SetNextWindowPos(pos: Readonly<XY>, cond: ImGuiCond = 0, pivot: Readonly<XY> = ImVec2.ZERO): void { bind.SetNextWindowPos(pos, cond, pivot); }
export function SetNextWindowSize(pos: Readonly<XY>, cond: ImGuiCond = 0): void { bind.SetNextWindowSize(pos, cond); }
export function SetNextWindowSizeConstraints(size_min: Readonly<XY>, size_max: Readonly<XY>): void;
export function SetNextWindowSizeConstraints<T>(size_min: Readonly<XY>, size_max: Readonly<XY>, custom_callback: ImGuiSizeCallback<T>, custom_callback_data?: T): void;
export function SetNextWindowSizeConstraints<T>(size_min: Readonly<XY>, size_max: Readonly<XY>, custom_callback: ImGuiSizeCallback<T | null> | null = null, custom_callback_data: T | null = null): void {
    if (custom_callback) {
        bind.SetNextWindowSizeConstraints(size_min, size_max, (data: Bind.ImGuiSizeCallbackData): void => {
            custom_callback(new ImGuiSizeCallbackData(data, custom_callback_data));
        }, null);
    } else {
        bind.SetNextWindowSizeConstraints(size_min, size_max, null, null);
    }
}
export function SetNextWindowContentSize(size: Readonly<XY>): void { bind.SetNextWindowContentSize(size); }
export function SetNextWindowCollapsed(collapsed: boolean, cond: ImGuiCond = 0): void { bind.SetNextWindowCollapsed(collapsed, cond); }
export function SetNextWindowFocus(): void { bind.SetNextWindowFocus(); }
export function SetNextWindowBgAlpha(alpha: number): void { bind.SetNextWindowBgAlpha(alpha); }
export function SetWindowPos(name_or_pos: string | Readonly<XY>, pos_or_cond: Readonly<XY> | ImGuiCond = 0, cond: ImGuiCond = 0): void {
    if (typeof(name_or_pos) === "string") {
        bind.SetWindowNamePos(name_or_pos, pos_or_cond as Readonly<XY>, cond);
        return;
    } else {
        bind.SetWindowPos(name_or_pos, pos_or_cond as ImGuiCond);
    }
}
export function SetWindowSize(name_or_size: string | Readonly<XY>, size_or_cond: Readonly<XY> | ImGuiCond = 0, cond: ImGuiCond = 0): void {
    if (typeof(name_or_size) === "string") {
        bind.SetWindowNamePos(name_or_size, size_or_cond as Readonly<XY>, cond);
    } else {
        bind.SetWindowSize(name_or_size, size_or_cond as ImGuiCond);
    }
}
export function SetWindowCollapsed(name_or_collapsed: string | boolean, collapsed_or_cond: boolean | ImGuiCond = 0, cond: ImGuiCond = 0): void {
    if (typeof(name_or_collapsed) === "string") {
        bind.SetWindowNameCollapsed(name_or_collapsed, collapsed_or_cond as boolean, cond);
    } else {
        bind.SetWindowCollapsed(name_or_collapsed, collapsed_or_cond as ImGuiCond);
    }
}
export function SetWindowFocus(name?: string): void {
    if (typeof(name) === "string") {
        bind.SetWindowNameFocus(name);
    } else {
        bind.SetWindowFocus();
    }
}

export function GetContentRegionAvail(out: XY = new ImVec2()): XY { return bind.GetContentRegionAvail(out); }

export function GetScrollX(): number { return bind.GetScrollX(); }
export function GetScrollY(): number { return bind.GetScrollY(); }
export function SetScrollX(scroll_x: number): void { bind.SetScrollX(scroll_x); }
export function SetScrollY(scroll_y: number): void { bind.SetScrollY(scroll_y); }
export function GetScrollMaxX(): number { return bind.GetScrollMaxX(); }
export function GetScrollMaxY(): number { return bind.GetScrollMaxY(); }
export function SetScrollHereX(center_x_ratio: number = 0.5): void { bind.SetScrollHereX(center_x_ratio); }
export function SetScrollHereY(center_y_ratio: number = 0.5): void { bind.SetScrollHereY(center_y_ratio); }
export function SetScrollFromPosX(pos_x: number, center_x_ratio: number = 0.5): void { bind.SetScrollFromPosX(pos_x, center_x_ratio); }
export function SetScrollFromPosY(pos_y: number, center_y_ratio: number = 0.5): void { bind.SetScrollFromPosY(pos_y, center_y_ratio); }
export function PushFont(font: ImFont | null, size = 0): void { bind.PushFont(font, size); }
export function PopFont(): void { bind.PopFont(); }
export function PushStyleColor(idx: ImGuiCol, col: number | Readonly<XYZW> | Readonly<ImColor>): void {
    if (col instanceof ImColor) {
        bind.PushStyleColor(idx, col.Value);
    } else {
        bind.PushStyleColor(idx, col as (number | Readonly<XYZW>));
    }
}
export function PopStyleColor(count: number = 1): void { bind.PopStyleColor(count); }
export function PushStyleVar(idx: ImGuiStyleVar, val: number | Readonly<XY>): void { bind.PushStyleVar(idx, val); }
export function PopStyleVar(count: number = 1): void { bind.PopStyleVar(count); }

export function PushItemWidth(item_width: number): void { bind.PushItemWidth(item_width); }
export function PopItemWidth(): void { bind.PopItemWidth(); }
export function SetNextItemWidth(item_width: number): void { bind.SetNextItemWidth(item_width); } // set width of the _next_ common large "item+label" widget. >0.0f: width in pixels, <0.0f align xx pixels to the right of window (so -1.0f always align width to the right side)
export function CalcItemWidth(): number { return bind.CalcItemWidth(); }
export function PushTextWrapPos(wrap_pos_x: number = 0.0): void { bind.PushTextWrapPos(wrap_pos_x); }
export function PopTextWrapPos(): void { bind.PopTextWrapPos(); }
export function GetFont(): ImFont { return bind.GetFont(); }
export function GetFontSize(): number { return bind.GetFontSize(); }
export function GetFontBaked(): Bind.ImFontBaked { return bind.GetFontBaked()!; }
export function PushItemFlag(flag: ImGuiItemFlags, enabled: boolean): void { bind.PushItemFlag(flag, enabled); }
export function PopItemFlag(): void { bind.PopItemFlag(); }
export function SetNextFrameWantCaptureKeyboard(capture: boolean): void { bind.SetNextFrameWantCaptureKeyboard(capture); }
export function SetNextFrameWantCaptureMouse(capture: boolean): void { bind.SetNextFrameWantCaptureMouse(capture); }
export function GetFontTexUvWhitePixel(out: XY = new ImVec2()): XY { return bind.GetFontTexUvWhitePixel(out); }
export function GetColorU32(idx: ImGuiCol, alpha_mul?: number): number;
export function GetColorU32(col: Readonly<XYZW>): number;
export function GetColorU32(col: number): number;
export function GetColorU32(...args: any[]): number {
    if (args.length === 1) {
        if (typeof(args[0]) === "number") {
            if (0 <= args[0] && args[0] < ImGuiCol.COUNT) {
                const idx: ImGuiCol = args[0];
                return bind.GetColorU32_A(idx, 1.0);
            }
            else {
                const col: number = args[0];
                return bind.GetColorU32_C(col);
            }
        } else {
            const col: Readonly<XYZW> = args[0];
            return bind.GetColorU32_B(col);
        }
    } else {
        const idx: ImGuiCol = args[0];
        const alpha_mul: number = args[1];
        return bind.GetColorU32_A(idx, alpha_mul);
    }
}
export function GetStyleColorVec4(idx: ImGuiCol): Readonly<Bind.ImVec4> { return bind.GetStyleColorVec4(idx); }
export function Separator(): void { bind.Separator(); }
export function SameLine(pos_x: number = 0.0, spacing_w: number = -1.0): void { bind.SameLine(pos_x, spacing_w); }
export function NewLine(): void { bind.NewLine(); }
export function Spacing(): void { bind.Spacing(); }
export function Dummy(size: Readonly<XY>): void { bind.Dummy(size); }
export function Indent(indent_w: number = 0.0) { bind.Indent(indent_w); }
export function Unindent(indent_w: number = 0.0) { bind.Unindent(indent_w); }
export function BeginGroup(): void { bind.BeginGroup(); }
export function EndGroup(): void { bind.EndGroup(); }
export function GetCursorPos(out: XY = new ImVec2()): XY { return bind.GetCursorPos(out); }
export function GetCursorPosX(): number { return bind.GetCursorPosX(); }
export function GetCursorPosY(): number { return bind.GetCursorPosY(); }
export function SetCursorPos(local_pos: Readonly<XY>): void { bind.SetCursorPos(local_pos); }
export function SetCursorPosX(x: number): void { bind.SetCursorPosX(x); }
export function SetCursorPosY(y: number): void { bind.SetCursorPosY(y); }
export function GetCursorStartPos(out: XY = new ImVec2()): XY { return bind.GetCursorStartPos(out); }
export function GetCursorScreenPos(out: XY = new ImVec2()): XY { return bind.GetCursorScreenPos(out); }
export function SetCursorScreenPos(pos: Readonly<XY>): void { bind.SetCursorScreenPos(pos); }
export function AlignTextToFramePadding(): void { bind.AlignTextToFramePadding(); }
export function GetTextLineHeight(): number { return bind.GetTextLineHeight(); }
export function GetTextLineHeightWithSpacing(): number { return bind.GetTextLineHeightWithSpacing(); }
export function GetFrameHeight(): number { return bind.GetFrameHeight(); }
export function GetFrameHeightWithSpacing(): number { return bind.GetFrameHeightWithSpacing(); }
export function PushID(id: string | number): void { bind.PushID(id); }
export function PopID(): void { bind.PopID(); }
export function GetID(id: string | number): ImGuiID { return bind.GetID(id); }
export function TextUnformatted(text: string, text_end: number | null = null): void { bind.TextUnformatted(text_end !== null ? text.substring(0, text_end) : text); }
export function Text(text: string): void { bind.Text(text); }
export function TextColored(col: Readonly<XYZW> | Readonly<ImColor>, text: string): void { bind.TextColored((col instanceof ImColor) ? col.Value : col as Readonly<XYZW>, text); }
export function TextDisabled(text: string): void { bind.TextDisabled(text); }
export function TextWrapped(text: string): void { bind.TextWrapped(text); }
export function LabelText(label: string, text: string): void { bind.LabelText(label, text); }
export function BulletText(text: string): void { bind.BulletText(text); }
export function Button(label: string, size: Readonly<XY> = ImVec2.ZERO): boolean { return bind.Button(label, size); }
export function SmallButton(label: string): boolean { return bind.SmallButton(label); }
export function ArrowButton(str_id: string, dir: ImGuiDir): boolean { return bind.ArrowButton(str_id, dir); }
export function InvisibleButton(str_id: string, size: Readonly<XY>, flags: ImGuiButtonFlags = 0): boolean { return bind.InvisibleButton(str_id, size, flags); }
export function Image(texture: ImTextureID, size: Readonly<XY>, uv0: Readonly<XY> = ImVec2.ZERO, uv1: Readonly<XY> = ImVec2.UNIT): void {
    bind.Image(texture, size, uv0, uv1);
}
export function ImageWithBg(texture: ImTextureID, size: Readonly<XY>, uv0: Readonly<XY> = ImVec2.ZERO, uv1: Readonly<XY> = ImVec2.UNIT, bg: Readonly<XYZW> = ImVec4.ZERO, tint: Readonly<XYZW> = ImVec4.UNIT): void {
    bind.ImageWithBg(texture, size, uv0, uv1, bg, tint);
}
export function ImageButton(id: string, texture: ImTextureID, size: Readonly<XY>, uv0: Readonly<XY> = ImVec2.ZERO, uv1: Readonly<XY> = ImVec2.UNIT, bg: Readonly<XYZW> = ImVec4.ZERO, tint: Readonly<XYZW> = ImVec4.UNIT): boolean {
    return bind.ImageButton(id, texture, size, uv0, uv1, bg, tint);
}
export function Checkbox(label: string, v: ImScalar<boolean> | ImAccess<boolean>): boolean {
    if (Array.isArray(v)) {
        return bind.Checkbox(label, v);
    } else {
        const ref_v: ImScalar<boolean> = [ v() ];
        const ret = bind.Checkbox(label, ref_v);
        v(ref_v[0]);
        return ret;
    }
}
export function CheckboxFlags(label: string, flags: ImAccess<number> | ImScalar<number>, flags_value: number): boolean {
    if (Array.isArray(flags)) {
        return bind.CheckboxFlags(label, flags, flags_value);
    } else {
        const ref_flags: ImScalar<number> = [ flags() ];
        const ret = bind.CheckboxFlags(label, ref_flags, flags_value);
        flags(ref_flags[0]);
        return ret;
    }
}
export function RadioButton(label: string, active: boolean): boolean;
export function RadioButton(label: string, v: ImAccess<number> | ImScalar<number>, v_button: number): boolean;
export function RadioButton(label: string, ...args: any[]): boolean {
    if (typeof(args[0]) === "boolean") {
        const active: boolean = args[0];
        return bind.RadioButton_A(label, active);
    } else {
        const v: ImAccess<number> | ImScalar<number> = args[0];
        const v_button: number = args[1];
        const _v: ImScalar<number> = Array.isArray(v) ? v : [ v() ];
        const ret = bind.RadioButton_B(label, _v, v_button);
        if (!Array.isArray(v)) { v(_v[0]); }
        return ret;
    }
}
export function ProgressBar(fraction: number, size_arg: Readonly<XY> = new ImVec2(-1, 0), overlay: string | null = null): void {
    bind.ProgressBar(fraction, size_arg, overlay);
}
export function Bullet(): void { bind.Bullet(); }
export function BeginCombo(label: string, preview_value: string | null = null, flags: ImGuiComboFlags = 0): boolean { return bind.BeginCombo(label, preview_value, flags); }
export function EndCombo(): void { bind.EndCombo(); }
export type ComboValueGetter<T> = (data: T, idx: number) => string;
export function Combo(label: string, current_item: ImAccess<number> | ImScalar<number>, items: string[], items_count?: number, popup_max_height_in_items?: number): boolean;
export function Combo(label: string, current_item: ImAccess<number> | ImScalar<number>, items_separated_by_zeros: string, popup_max_height_in_items?: number): boolean;
export function Combo<T>(label: string, current_item: ImAccess<number> | ImScalar<number>, items_getter: ComboValueGetter<T>, data: T, items_count: number, popup_max_height_in_items?: number): boolean;
export function Combo<T>(label: string, current_item: ImAccess<number> | ImScalar<number>, ...args: any[]): boolean {
    let ret = false;
    const _current_item: ImScalar<number> = Array.isArray(current_item) ? current_item : [ current_item() ];
    if (Array.isArray(args[0])) {
        const items: string[] = args[0];
        const items_count = typeof(args[1]) === "number" ? args[1] : items.length;
        const popup_max_height_in_items: number = typeof(args[2]) === "number" ? args[2] : -1;
        const items_getter = (_data: null, idx: number): string => items[idx];
        ret = bind.Combo(label, _current_item, items_getter, null, items_count, popup_max_height_in_items);
    } else if (typeof(args[0]) === "string") {
        const items_separated_by_zeros: string = args[0]
        const popup_max_height_in_items: number = typeof(args[1]) === "number" ? args[1] : -1;
        const items: string[] = items_separated_by_zeros.replace(/^\0+|\0+$/g, "").split("\0");
        const items_count: number = items.length;
        const items_getter = (_data: null, idx: number): string => items[idx];
        ret = bind.Combo(label, _current_item, items_getter, null, items_count, popup_max_height_in_items);
    } else {
        const items_getter: ComboValueGetter<T> = args[0];
        const data: T = args[1];
        const items_count = args[2];
        const popup_max_height_in_items: number = typeof(args[3]) === "number" ? args[3] : -1;
        ret = bind.Combo(label, _current_item, items_getter, data, items_count, popup_max_height_in_items);
    }
    if (!Array.isArray(current_item)) { current_item(_current_item[0]); }
    return ret;
}
export function DragFloat(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0.0, v_max: number = 0.0, display_format: string | null = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.DragFloat(label, _v, v_speed, v_min, v_max, display_format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function DragFloat2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | ImVec2, v_speed: number = 1.0, v_min: number = 0.0, v_max: number = 0.0, display_format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.DragFloat2(label, _v, v_speed, v_min, v_max, display_format, flags);
    export_Vector2(_v, v);
    return ret;
}
export function DragFloat3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0.0, v_max: number = 0.0, display_format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.DragFloat3(label, _v, v_speed, v_min, v_max, display_format, flags);
    export_Vector3(_v, v);
    return ret;
}
export function DragFloat4(label: string, v: XYZW | ImTuple4<number> | ImVec4, v_speed: number = 1.0, v_min: number = 0.0, v_max: number = 0.0, display_format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.DragFloat4(label, _v, v_speed, v_min, v_max, display_format, flags);
    export_Vector4(_v, v);
    return ret;
}
export function DragFloatRange2(label: string, v_current_min: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_current_max: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0.0, v_max: number = 0.0, display_format: string = "%.3f", display_format_max: string | null = null, flags: ImGuiSliderFlags = 0): boolean {
    const _v_current_min = import_Scalar(v_current_min);
    const _v_current_max = import_Scalar(v_current_max);
    const ret = bind.DragFloatRange2(label, _v_current_min, _v_current_max, v_speed, v_min, v_max, display_format, display_format_max, flags);
    export_Scalar(_v_current_min, v_current_min);
    export_Scalar(_v_current_max, v_current_max);
    return ret;
}
export function DragInt(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0, v_max: number = 0, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.DragInt(label, _v, v_speed, v_min, v_max, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function DragInt2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0, v_max: number = 0, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.DragInt2(label, _v, v_speed, v_min, v_max, format, flags);
    export_Vector2(_v, v);
    return ret;
}
export function DragInt3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0, v_max: number = 0, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.DragInt3(label, _v, v_speed, v_min, v_max, format, flags);
    export_Vector3(_v, v);
    return ret;
}
export function DragInt4(label: string, v: XYZW | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0, v_max: number = 0, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.DragInt4(label, _v, v_speed, v_min, v_max, format, flags);
    export_Vector4(_v, v);
    return ret;
}
export function DragIntRange2(label: string, v_current_min: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_current_max: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_speed: number = 1.0, v_min: number = 0, v_max: number = 0, format: string = "%d", format_max: string | null = null, flags: ImGuiSliderFlags = 0): boolean {
    const _v_current_min = import_Scalar(v_current_min);
    const _v_current_max = import_Scalar(v_current_max);
    const ret = bind.DragIntRange2(label, _v_current_min, _v_current_max, v_speed, v_min, v_max, format, format_max, flags);
    export_Scalar(_v_current_min, v_current_min);
    export_Scalar(_v_current_max, v_current_max);
    return ret;
}
export function DragScalar(label: string, v: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array, v_speed: number = 1.0, v_min: number | null = null, v_max: number | null = null, format: string | null = null, flags: ImGuiSliderFlags = 0): boolean {
    if (v instanceof Int8Array) { return bind.DragScalar(label, ImGuiDataType.S8, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Uint8Array) { return bind.DragScalar(label, ImGuiDataType.U8, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Int16Array) { return bind.DragScalar(label, ImGuiDataType.S16, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Uint16Array) { return bind.DragScalar(label, ImGuiDataType.U16, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Int32Array) { return bind.DragScalar(label, ImGuiDataType.S32, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Uint32Array) { return bind.DragScalar(label, ImGuiDataType.U32, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Float32Array) { return bind.DragScalar(label, ImGuiDataType.Float, v, v_speed, v_min, v_max, format, flags); }
    if (v instanceof Float64Array) { return bind.DragScalar(label, ImGuiDataType.Double, v, v_speed, v_min, v_max, format, flags); }
    throw new Error();
}
export function SliderFloat(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.SliderFloat(label, _v, v_min, v_max, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function SliderFloat2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number> | XY, v_min: number, v_max: number, format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.SliderFloat2(label, _v, v_min, v_max, format, flags);
    export_Vector2(_v, v);
    return ret;
}
export function SliderFloat3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.SliderFloat3(label, _v, v_min, v_max, format, flags);
    export_Vector3(_v, v);
    return ret;
}
export function SliderFloat4(label: string, v: XYZW | ImTuple4<number> | XYZW, v_min: number, v_max: number, format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.SliderFloat4(label, _v, v_min, v_max, format, flags);
    export_Vector4(_v, v);
    return ret;
}
export function SliderAngle(label: string, v_rad: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_degrees_min: number = -360.0, v_degrees_max: number = +360.0, format: string = "%.0f deg", flags: ImGuiSliderFlags = 0): boolean {
    const _v_rad = import_Scalar(v_rad);
    const ret = bind.SliderAngle(label, _v_rad, v_degrees_min, v_degrees_max, format, flags);
    export_Scalar(_v_rad, v_rad);
    return ret;
}
export function SliderAngle3(label: string, v_rad: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, v_degrees_min: number = -360.0, v_degrees_max: number = +360.0, format: string = "%.0f deg", flags: ImGuiSliderFlags = 0): boolean {
    const _v_rad = import_Vector3(v_rad);
    _v_rad[0] = Math.floor(_v_rad[0] * 180 / Math.PI);
    _v_rad[1] = Math.floor(_v_rad[1] * 180 / Math.PI);
    _v_rad[2] = Math.floor(_v_rad[2] * 180 / Math.PI);
    const ret = bind.SliderInt3(label, _v_rad, v_degrees_min, v_degrees_max, format, flags);
    _v_rad[0] = _v_rad[0] * Math.PI / 180;
    _v_rad[1] = _v_rad[1] * Math.PI / 180;
    _v_rad[2] = _v_rad[2] * Math.PI / 180;
    export_Vector3(_v_rad, v_rad);
    return ret;
}
export function SliderInt(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.SliderInt(label, _v, v_min, v_max, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function SliderInt2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.SliderInt2(label, _v, v_min, v_max, format, flags);
    export_Vector2(_v, v);
    return ret;
}
export function SliderInt3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.SliderInt3(label, _v, v_min, v_max, format, flags);
    export_Vector3(_v, v);
    return ret;
}
export function SliderInt4(label: string, v: XYZW | ImTuple4<number>, v_min: number, v_max: number, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.SliderInt4(label, _v, v_min, v_max, format, flags);
    export_Vector4(_v, v);
    return ret;
}
export function SliderScalar(label: string, v: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array, v_min: number, v_max: number, format: string | null = null, flags: ImGuiSliderFlags = 0): boolean {
    if (v instanceof Int8Array) { return bind.SliderScalar(label, ImGuiDataType.S8, v, v_min, v_max, format, flags); }
    if (v instanceof Uint8Array) { return bind.SliderScalar(label, ImGuiDataType.U8, v, v_min, v_max, format, flags); }
    if (v instanceof Int16Array) { return bind.SliderScalar(label, ImGuiDataType.S16, v, v_min, v_max, format, flags); }
    if (v instanceof Uint16Array) { return bind.SliderScalar(label, ImGuiDataType.U16, v, v_min, v_max, format, flags); }
    if (v instanceof Int32Array) { return bind.SliderScalar(label, ImGuiDataType.S32, v, v_min, v_max, format, flags); }
    if (v instanceof Uint32Array) { return bind.SliderScalar(label, ImGuiDataType.U32, v, v_min, v_max, format, flags); }
    if (v instanceof Float32Array) { return bind.SliderScalar(label, ImGuiDataType.Float, v, v_min, v_max, format, flags); }
    if (v instanceof Float64Array) { return bind.SliderScalar(label, ImGuiDataType.Double, v, v_min, v_max, format, flags); }
    throw new Error();
}
export function VSliderFloat(label: string, size: Readonly<XY>, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%.3f", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.VSliderFloat(label, size, _v, v_min, v_max, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function VSliderInt(label: string, size: Readonly<XY>, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, v_min: number, v_max: number, format: string = "%d", flags: ImGuiSliderFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.VSliderInt(label, size, _v, v_min, v_max, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function VSliderScalar(label: string, size: Readonly<XY>, data_type: ImGuiDataType, v: ImAccess<number> | ImScalar<number>, v_min: number, v_max: number, format: string | null = null, flags: ImGuiSliderFlags = 0): boolean {
    if (v instanceof Int8Array) { return bind.VSliderScalar(label, size, ImGuiDataType.S8, v, v_min, v_max, format, flags); }
    if (v instanceof Uint8Array) { return bind.VSliderScalar(label, size, ImGuiDataType.U8, v, v_min, v_max, format, flags); }
    if (v instanceof Int16Array) { return bind.VSliderScalar(label, size, ImGuiDataType.S16, v, v_min, v_max, format, flags); }
    if (v instanceof Uint16Array) { return bind.VSliderScalar(label, size, ImGuiDataType.U16, v, v_min, v_max, format, flags); }
    if (v instanceof Int32Array) { return bind.VSliderScalar(label, size, ImGuiDataType.S32, v, v_min, v_max, format, flags); }
    if (v instanceof Uint32Array) { return bind.VSliderScalar(label, size, ImGuiDataType.U32, v, v_min, v_max, format, flags); }
    if (v instanceof Float32Array) { return bind.VSliderScalar(label, size, ImGuiDataType.Float, v, v_min, v_max, format, flags); }
    if (v instanceof Float64Array) { return bind.VSliderScalar(label, size, ImGuiDataType.Double, v, v_min, v_max, format, flags); }
    throw new Error();
}
export function InputText<T>(label: string, buf: ImStringBuffer | ImAccess<string> | ImScalar<string>, buf_size: number = buf instanceof ImStringBuffer ? buf.size : ImGuiInputTextDefaultSize, flags: ImGuiInputTextFlags = 0, callback: ImGuiInputTextCallback<T> | null = null, user_data: T | null = null): boolean {
    const _callback = callback && ((data: Bind.ImGuiInputTextCallbackData): number => callback(new ImGuiInputTextCallbackData<T>(data, user_data))) || null;
    if (Array.isArray(buf)) {
        return bind.InputText(label, buf, buf_size, flags, _callback);
    } else if (buf instanceof ImStringBuffer) {
        const ref_buf: ImScalar<string> = [ buf.buffer ];
        const _buf_size: number = Math.min(buf_size, buf.size);
        const ret: boolean = bind.InputText(label, ref_buf, _buf_size, flags, _callback);
        buf.buffer = ref_buf[0];
        return ret;
    } else {
        const ref_buf: ImScalar<string> = [ buf() ];
        const ret: boolean = bind.InputText(label, ref_buf, buf_size, flags, _callback);
        buf(ref_buf[0]);
        return ret;
    }
}
export function InputTextMultiline<T>(label: string, buf: ImStringBuffer | ImAccess<string> | ImScalar<string>, buf_size: number = buf instanceof ImStringBuffer ? buf.size : ImGuiInputTextDefaultSize, size: Readonly<XY> = ImVec2.ZERO, flags: ImGuiInputTextFlags = 0, callback: ImGuiInputTextCallback<T> | null = null, user_data: T | null = null): boolean {
    const _callback = callback && ((data: Bind.ImGuiInputTextCallbackData): number => callback(new ImGuiInputTextCallbackData<T>(data, user_data))) || null;
    if (Array.isArray(buf)) {
        return bind.InputTextMultiline(label, buf, buf_size, size, flags, _callback);
    } else if (buf instanceof ImStringBuffer) {
        const ref_buf: ImScalar<string> = [ buf.buffer ];
        const _buf_size: number = Math.min(buf_size, buf.size);
        const ret: boolean = bind.InputTextMultiline(label, ref_buf, _buf_size, size, flags, _callback);
        buf.buffer = ref_buf[0];
        return ret;
    } else {
        const ref_buf: ImScalar<string> = [ buf() ];
        const ret: boolean = bind.InputTextMultiline(label, ref_buf, buf_size, size, flags, _callback);
        buf(ref_buf[0]);
        return ret;
    }
}
export function InputTextWithHint<T>(label: string, hint: string, buf: ImStringBuffer | ImAccess<string> | ImScalar<string>, buf_size: number = buf instanceof ImStringBuffer ? buf.size : ImGuiInputTextDefaultSize, flags: ImGuiInputTextFlags = 0, callback: ImGuiInputTextCallback<T> | null = null, user_data: T | null = null): boolean {
    const _callback = callback && ((data: Bind.ImGuiInputTextCallbackData): number => callback(new ImGuiInputTextCallbackData<T>(data, user_data))) || null;
    if (Array.isArray(buf)) {
        return bind.InputTextWithHint(label, hint, buf, buf_size, flags, _callback);
    } else if (buf instanceof ImStringBuffer) {
        const ref_buf: ImScalar<string> = [ buf.buffer ];
        const _buf_size: number = Math.min(buf_size, buf.size);
        const ret: boolean = bind.InputTextWithHint(label, hint, ref_buf, _buf_size, flags, _callback);
        buf.buffer = ref_buf[0];
        return ret;
    } else {
        const ref_buf: ImScalar<string> = [ buf() ];
        const ret: boolean = bind.InputTextWithHint(label, hint, ref_buf, buf_size, flags, _callback);
        buf(ref_buf[0]);
        return ret;
    }
}
export function InputFloat(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, step: number = 0.0, step_fast: number = 0.0, format: string = "%.3f", flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.InputFloat(label, _v, step, step_fast, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function InputFloat2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, format: string = "%.3f", flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.InputFloat2(label, _v, format, flags);
    export_Vector2(_v, v);
    return ret;
}
export function InputFloat3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, format: string = "%.3f", flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.InputFloat3(label, _v, format, flags);
    export_Vector3(_v, v);
    return ret;
}
export function InputFloat4(label: string, v: XYZW | ImTuple4<number>, format: string = "%.3f", flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.InputFloat4(label, _v, format, flags);
    export_Vector4(_v, v);
    return ret;
}
export function InputInt(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, step: number = 1, step_fast: number = 100, flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.InputInt(label, _v, step, step_fast, flags);
    export_Scalar(_v, v);
    return ret;
}
export function InputInt2(label: string, v: XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector2(v);
    const ret = bind.InputInt2(label, _v, flags);
    export_Vector2(_v, v);
    return ret;
}
export function InputInt3(label: string, v: XYZ | XYZW | ImTuple3<number> | ImTuple4<number>, flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector3(v);
    const ret = bind.InputInt3(label, _v, flags);
    export_Vector3(_v, v);
    return ret;
}
export function InputInt4(label: string, v: XYZW | ImTuple4<number>, flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Vector4(v);
    const ret = bind.InputInt4(label, _v, flags);
    export_Vector4(_v, v);
    return ret;
}
export function InputDouble(label: string, v: ImAccess<number> | ImScalar<number> | XY | XYZ | XYZW | ImTuple2<number> | ImTuple3<number> | ImTuple4<number>, step: number = 0.0, step_fast: number = 0.0, format: string = "%.6f", flags: ImGuiInputTextFlags = 0): boolean {
    const _v = import_Scalar(v);
    const ret = bind.InputDouble(label, _v, step, step_fast, format, flags);
    export_Scalar(_v, v);
    return ret;
}
export function InputScalar(label: string, v: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array, step: number | null = null, step_fast: number | null = null, format: string | null = null, flags: ImGuiInputTextFlags = 0): boolean {
    if (v instanceof Int8Array) { return bind.InputScalar(label, ImGuiDataType.S8, v, step, step_fast, format, flags); }
    if (v instanceof Uint8Array) { return bind.InputScalar(label, ImGuiDataType.U8, v, step, step_fast, format, flags); }
    if (v instanceof Int16Array) { return bind.InputScalar(label, ImGuiDataType.S16, v, step, step_fast, format, flags); }
    if (v instanceof Uint16Array) { return bind.InputScalar(label, ImGuiDataType.U16, v, step, step_fast, format, flags); }
    if (v instanceof Int32Array) { return bind.InputScalar(label, ImGuiDataType.S32, v, step, step_fast, format, flags); }
    if (v instanceof Uint32Array) { return bind.InputScalar(label, ImGuiDataType.U32, v, step, step_fast, format, flags); }
    if (v instanceof Float32Array) { return bind.InputScalar(label, ImGuiDataType.Float, v, step, step_fast, format, flags); }
    if (v instanceof Float64Array) { return bind.InputScalar(label, ImGuiDataType.Double, v, step, step_fast, format, flags); }
    throw new Error();
}
export function ColorEdit3(label: string, col: RGB | RGBA | ImTuple3<number> | ImTuple4<number> | XYZW, flags: ImGuiColorEditFlags = 0): boolean {
    const _col = import_Color3(col);
    const ret = bind.ColorEdit3(label, _col, flags);
    export_Color3(_col, col);
    return ret;
}
export function ColorEdit4(label: string, col: RGBA | ImTuple4<number> | XYZW, flags: ImGuiColorEditFlags = 0): boolean {
    const _col = import_Color4(col);
    const ret = bind.ColorEdit4(label, _col, flags);
    export_Color4(_col, col);
    return ret;
}
export function ColorPicker3(label: string, col: RGB | RGBA | ImTuple3<number> | ImTuple4<number> | XYZW, flags: ImGuiColorEditFlags = 0): boolean {
    const _col = import_Color3(col);
    const ret = bind.ColorPicker3(label, _col, flags);
    export_Color3(_col, col);
    return ret;
}
export function ColorPicker4(label: string, col: RGBA | ImTuple4<number> | XYZW, flags: ImGuiColorEditFlags = 0, ref_col: ImTuple4<number> | XYZW | null = null): boolean {
    const _col = import_Color4(col);
    const _ref_col = ref_col ? import_Color4(ref_col) : null;
    const ret = bind.ColorPicker4(label, _col, flags, _ref_col);
    export_Color4(_col, col);
    if (_ref_col && ref_col) { export_Color4(_ref_col, ref_col); }
    return ret;
}
export function ColorButton(desc_id: string, col: Readonly<XYZW>, flags: ImGuiColorEditFlags = 0, size: Readonly<XY> = ImVec2.ZERO): boolean {
    return bind.ColorButton(desc_id, col, flags, size);
}

export function TreeNode(label: string): boolean;
export function TreeNode(label: string, fmt: string): boolean;
export function TreeNode(label: number, fmt: string): boolean;
export function TreeNode(...args: any[]): boolean {
    if (typeof(args[0]) === "string") {
        if (args.length === 1) {
            const label: string = args[0];
            return bind.TreeNode_A(label);
        } else {
            const str_id: string = args[0];
            const fmt: string = args[1];
            return bind.TreeNode_B(str_id, fmt);
        }
    } else {
        const ptr_id: number = args[0];
        const fmt: string = args[1];
        return bind.TreeNode_C(ptr_id, fmt);
    }
}
export function TreeNodeEx(label: string, flags?: ImGuiTreeNodeFlags): boolean;
export function TreeNodeEx(str_id: string, flags: ImGuiTreeNodeFlags, fmt: string): boolean;
export function TreeNodeEx(ptr_id: number, flags: ImGuiTreeNodeFlags, fmt: string): boolean;
export function TreeNodeEx(...args: any[]): boolean {
    if (typeof(args[0]) === "string") {
        if (args.length < 3) {
            const label: string = args[0];
            const flags: ImGuiTreeNodeFlags = args[1] || 0;
            return bind.TreeNodeEx_A(label, flags);
        } else {
            const str_id: string = args[0];
            const flags: ImGuiTreeNodeFlags = args[1];
            const fmt: string = args[2];
            return bind.TreeNodeEx_B(str_id, flags, fmt);
        }
    } else {
        const ptr_id: number = args[0];
        const flags: ImGuiTreeNodeFlags = args[1];
        const fmt: string = args[2];
        return bind.TreeNodeEx_C(ptr_id, flags, fmt);
    }
}
export function TreePush(str_id: string): void;
export function TreePush(ptr_id: number): void;
export function TreePush(...args: any[]): void {
    if (typeof(args[0]) === "string") {
        const str_id: string = args[0];
        bind.TreePush_A(str_id);
    } else {
        const ptr_id: number = args[0];
        bind.TreePush_B(ptr_id);
    }
}
export function TreePop(): void { bind.TreePop(); }
export function GetTreeNodeToLabelSpacing(): number { return bind.GetTreeNodeToLabelSpacing(); }
export function CollapsingHeader(label: string, flags?: ImGuiTreeNodeFlags): boolean;
export function CollapsingHeader(label: string, p_open: ImScalar<boolean> | ImAccess<boolean>, flags?: ImGuiTreeNodeFlags): boolean;
export function CollapsingHeader(label: string, ...args: any[]): boolean {
    if (args.length === 0) {
        return bind.CollapsingHeader_A(label, 0);
    } else {
        if (typeof(args[0]) === "number") {
            const flags: ImGuiTreeNodeFlags = args[0];
            return bind.CollapsingHeader_A(label, flags);
        } else {
            const p_open: ImScalar<boolean> | ImAccess<boolean> = args[0];
            const flags: ImGuiTreeNodeFlags = args[1] || 0;
            const ref_open: ImScalar<boolean> = Array.isArray(p_open) ? p_open : [ p_open() ];
            const ret = bind.CollapsingHeader_B(label, ref_open, flags);
            if (!Array.isArray(p_open)) { p_open(ref_open[0]); }
            return ret;
        }
    }
}
export function SetNextItemOpen(is_open: boolean, cond: ImGuiCond = 0): void {
    bind.SetNextItemOpen(is_open, cond);
}
export function Selectable(label: string, selected?: boolean, flags?: ImGuiSelectableFlags, size?: Readonly<XY>): boolean;
export function Selectable(label: string, p_selected: ImScalar<boolean> | ImAccess<boolean>, flags?: ImGuiSelectableFlags, size?: Readonly<XY>): boolean;
export function Selectable(label: string, ...args: any[]): boolean {
    if (args.length === 0) {
        return bind.Selectable_A(label, false, 0, ImVec2.ZERO);
    } else {
        if (typeof(args[0]) === "boolean") {
            const selected: boolean = args[0];
            const flags: ImGuiSelectableFlags = args[1] || 0;
            const size: Readonly<XY> = args[2] || ImVec2.ZERO;
            return bind.Selectable_A(label, selected, flags, size);
        } else {
            const p_selected: ImScalar<boolean> | ImAccess<boolean> = args[0];
            const flags: ImGuiSelectableFlags = args[1] || 0;
            const size: Readonly<XY> = args[2] || ImVec2.ZERO;
            const ref_selected: ImScalar<boolean> = Array.isArray(p_selected) ? p_selected : [ p_selected() ];
            const ret = bind.Selectable_B(label, ref_selected, flags, size);
            if (!Array.isArray(p_selected)) { p_selected(ref_selected[0]); }
            return ret;
        }
    }
}
export function BeginListBox(label: string, size: Readonly<XY> = new ImVec2(0, 0)): boolean {
    return bind.BeginListBox(label, size);
}
export type ImGuiSelectionRequest = Bind.ImGuiSelectionRequest;
export class ImGuiMultiSelectIO {
    constructor(readonly native: Bind.ImGuiMultiSelectIO) {}
    get Requests(): ImGuiSelectionRequest[] { return this.native.GetRequests(); }
    get RangeSrcItem(): bigint { return this.native.RangeSrcItem; }
    get NavIdItem(): bigint { return this.native.NavIdItem; }
    get NavIdSelected(): boolean { return this.native.NavIdSelected; }
    get ItemsCount(): number { return this.native.ItemsCount; }
    get RangeSrcReset(): boolean { return this.native.RangeSrcReset; }
    set RangeSrcReset(reset: boolean) { this.native.RangeSrcReset = reset; }
}
export function BeginMultiSelect(flags: ImGuiMultiSelectFlags = 0, selection_size = -1, items_count = -1): ImGuiMultiSelectIO {
    return new ImGuiMultiSelectIO(bind.BeginMultiSelect(flags, selection_size, items_count)!);
}
export function EndMultiSelect(): ImGuiMultiSelectIO { return new ImGuiMultiSelectIO(bind.EndMultiSelect()!); }
export function SetNextItemSelectionUserData(id: bigint): void { bind.SetNextItemSelectionUserData(id); }
export function IsItemToggledSelection(): boolean { return bind.IsItemToggledSelection(); }
export function EndListBox(): void { bind.EndListBox(); }
export type ListBoxItemGetter<T> = (data: T, idx: number) => string;
export function ListBox(label: string, current_item: ImAccess<number> | ImScalar<number>, items: string[], items_count?: number, height_in_items?: number): boolean;
export function ListBox<T>(label: string, current_item: ImAccess<number> | ImScalar<number>, items_getter: ListBoxItemGetter<T>, data: T, items_count: number, height_in_items?: number): boolean;
export function ListBox<T>(label: string, current_item: ImAccess<number> | ImScalar<number>, ...args: any[]): boolean {
    let ret: boolean = false;
    const _current_item: ImScalar<number> = Array.isArray(current_item) ? current_item : [ current_item() ];
    if (Array.isArray(args[0])) {
        const items: string[] = args[0];
        const items_count: number = typeof(args[1]) === "number" ? args[1] : items.length;
        const height_in_items: number = typeof(args[2]) === "number" ? args[2] : -1;
        ret = bind.ListBox_A(label, _current_item, items, items_count, height_in_items);
    } else {
        const items_getter: ListBoxItemGetter<T> = args[0];
        const data: any = args[1];
        const items_count: number = args[2];
        const height_in_items: number = typeof(args[3]) === "number" ? args[3] : -1;
        ret = bind.ListBox_B(label, _current_item, items_getter, data, items_count, height_in_items);
    }
    if (!Array.isArray(current_item)) { current_item(_current_item[0]); }
    return ret;
}
export type PlotLinesValueGetter<T> = (data: T, idx: number) => number;
export function PlotLines(label: string, values: ArrayLike<number>, values_count?: number, value_offset?: number, overlay_text?: string | null, scale_min?: number, scale_max?: number, graph_size?: Readonly<XY>, stride?: number): void;
export function PlotLines<T>(label: string, values_getter: PlotLinesValueGetter<T>, data: T, values_count?: number, value_offset?: number, overlay_text?: string | null, scale_min?: number, scale_max?: number, graph_size?: Readonly<XY>): void;
export function PlotLines<T>(label: string, ...args: any[]): void {
    if (Array.isArray(args[0])) {
        const values: ArrayLike<number> = args[0];
        const values_getter: PlotLinesValueGetter<null> = (data: null, idx: number): number => values[idx * stride];
        const values_count: number = typeof(args[1]) === "number" ? args[1] : values.length;
        const values_offset: number = typeof(args[2]) === "number" ? args[2] : 0;
        const overlay_text: string | null = typeof(args[3]) === "string" ? args[3] : null;
        const scale_min: number = typeof(args[4]) === "number" ? args[4] : Number.MAX_VALUE;
        const scale_max: number = typeof(args[5]) === "number" ? args[5] : Number.MAX_VALUE;
        const graph_size: Readonly<XY> = args[6] || ImVec2.ZERO;
        const stride: number = typeof(args[7]) === "number" ? args[7] : 1;
        bind.PlotLines(label, values_getter, null, values_count, values_offset, overlay_text, scale_min, scale_max, graph_size);
    } else {
        const values_getter: PlotLinesValueGetter<T> = args[0];
        const data: any = args[1];
        const values_count: number = args[2];
        const values_offset: number = typeof(args[3]) === "number" ? args[3] : 0;
        const overlay_text: string | null = typeof(args[4]) === "string" ? args[4] : null;
        const scale_min: number = typeof(args[5]) === "number" ? args[5] : Number.MAX_VALUE;
        const scale_max: number = typeof(args[6]) === "number" ? args[6] : Number.MAX_VALUE;
        const graph_size: Readonly<XY> = args[7] || ImVec2.ZERO;
        bind.PlotLines(label, values_getter, data, values_count, values_offset, overlay_text, scale_min, scale_max, graph_size);
    }
}
export type PlotHistogramValueGetter<T> = (data: T, idx: number) => number;
export function PlotHistogram(label: string, values: ArrayLike<number>, values_count?: number, value_offset?: number, overlay_text?: string | null, scale_min?: number, scale_max?: number, graph_size?: Readonly<XY>, stride?: number): void;
export function PlotHistogram<T>(label: string, values_getter: PlotHistogramValueGetter<T>, data: T, values_count?: number, value_offset?: number, overlay_text?: string | null, scale_min?: number, scale_max?: number, graph_size?: Readonly<XY>): void;
export function PlotHistogram<T>(label: string, ...args: any[]): void {
    if (Array.isArray(args[0])) {
        const values: ArrayLike<number> = args[0];
        const values_getter: PlotHistogramValueGetter<null> = (data: null, idx: number): number => values[idx * stride];
        const values_count: number = typeof(args[1]) === "number" ? args[1] : values.length;
        const values_offset: number = typeof(args[2]) === "number" ? args[2] : 0;
        const overlay_text: string | null = typeof(args[3]) === "string" ? args[3] : null;
        const scale_min: number = typeof(args[4]) === "number" ? args[4] : Number.MAX_VALUE;
        const scale_max: number = typeof(args[5]) === "number" ? args[5] : Number.MAX_VALUE;
        const graph_size: Readonly<XY> = args[6] || ImVec2.ZERO;
        const stride: number = typeof(args[7]) === "number" ? args[7] : 1;
        bind.PlotHistogram(label, values_getter, null, values_count, values_offset, overlay_text, scale_min, scale_max, graph_size);
    } else {
        const values_getter: PlotHistogramValueGetter<T> = args[0];
        const data: T = args[1];
        const values_count: number = args[2];
        const values_offset: number = typeof(args[3]) === "number" ? args[3] : 0;
        const overlay_text: string | null = typeof(args[4]) === "string" ? args[4] : null;
        const scale_min: number = typeof(args[5]) === "number" ? args[5] : Number.MAX_VALUE;
        const scale_max: number = typeof(args[6]) === "number" ? args[6] : Number.MAX_VALUE;
        const graph_size: Readonly<XY> = args[7] || ImVec2.ZERO;
        bind.PlotHistogram(label, values_getter, data, values_count, values_offset, overlay_text, scale_min, scale_max, graph_size);
    }
}
export function Value(prefix: string, b: boolean): void;
export function Value(prefix: string, v: number): void;
export function Value(prefix: string, v: number, float_format?: string | null): void;
export function Value(prefix: string, v: any): void;
export function Value(prefix: string, ...args: any[]): void {
    if (typeof(args[0]) === "boolean") {
        bind.Value_A(prefix, args[0]);
    } else if (typeof(args[0]) === "number") {
        if (Number.isInteger(args[0])) {
            bind.Value_B(prefix, args[0]);
        } else {
            bind.Value_D(prefix, args[0], typeof(args[1]) === "string" ? args[1] : null);
        }
    } else {
        bind.Text(prefix + String(args[0]));
    }
}
export function BeginMenuBar(): boolean { return bind.BeginMenuBar(); }
export function EndMenuBar(): void { bind.EndMenuBar(); }
export function BeginMainMenuBar(): boolean { return bind.BeginMainMenuBar(); }
export function EndMainMenuBar(): void { bind.EndMainMenuBar(); }
export function BeginMenu(label: string, enabled: boolean = true): boolean { return bind.BeginMenu(label, enabled); }
export function EndMenu(): void { bind.EndMenu(); }
export function MenuItem(label: string, shortcut?: string | null, selected?: boolean, enabled?: boolean): boolean;
export function MenuItem(label: string, shortcut: string | null, p_selected: ImScalar<boolean> | ImAccess<boolean> | null, enabled?: boolean): boolean;
export function MenuItem(label: string, ...args: any[]): boolean {
    if (args.length === 0) {
        return bind.MenuItem_A(label, null, false, true);
    } else if (args.length === 1) {
        const shortcut: string | null = args[0];
        return bind.MenuItem_A(label, shortcut, false, true);
    } else {
        const shortcut: string | null = args[0];
        if (typeof(args[1]) === "boolean") {
            const selected: boolean = args[1];
            const enabled: boolean = typeof(args[2]) === "boolean" ? args[2] : true;
            return bind.MenuItem_A(label, shortcut, selected, enabled);
        } else {
            const p_selected: ImScalar<boolean> | ImAccess<boolean> = args[1];
            const enabled: boolean = typeof(args[2]) === "boolean" ? args[2] : true;
            const ref_selected: ImScalar<boolean> = Array.isArray(p_selected) ? p_selected : [ p_selected() ];
            const ret = bind.MenuItem_B(label, shortcut, ref_selected, enabled);
            if (!Array.isArray(p_selected)) { p_selected(ref_selected[0]); }
            return ret;
        }
    }
}
export function BeginTooltip(): boolean { return bind.BeginTooltip(); }
export function BeginItemTooltip(): boolean { return bind.BeginItemTooltip(); }
export function SetItemTooltip(text: string): void { bind.SetItemTooltip(text); }
export function Shortcut(chord: number, flags: ImGuiInputFlags = 0): boolean { return bind.Shortcut(chord, flags); }
export function SetNextItemShortcut(chord: number, flags: ImGuiInputFlags = 0): void { bind.SetNextItemShortcut(chord, flags); }
export function IsKeyChordPressed(chord: number): boolean { return bind.IsKeyChordPressed(chord); }
export function EndTooltip(): void { bind.EndTooltip(); }
export function SetTooltip(fmt: string): void { bind.SetTooltip(fmt); }
export function BeginPopup(str_id: string, flags: ImGuiWindowFlags = 0): boolean { return bind.BeginPopup(str_id, flags); }
export function BeginPopupModal(str_id: string, p_open: ImScalar<boolean> | ImAccess<boolean> | null = null, flags: ImGuiWindowFlags = 0): boolean {
    if (Array.isArray(p_open)) {
        return bind.BeginPopupModal(str_id, p_open, flags);
    } else if (typeof(p_open) === "function") {
        const _p_open: ImScalar<boolean> = [ p_open() ];
        const ret = bind.BeginPopupModal(str_id, _p_open, flags);
        p_open(_p_open[0]);
        return ret;
    } else {
        return bind.BeginPopupModal(str_id, null, flags);
    }
}
export function EndPopup(): void { bind.EndPopup(); }
export function OpenPopup(str_id: string, popup_flags: ImGuiPopupFlags = 0): void { bind.OpenPopup(str_id, popup_flags); }
export function OpenPopupOnItemClick(str_id: string | null = null, popup_flags: ImGuiPopupFlags = ImGuiPopupFlags.MouseButtonRight): void { bind.OpenPopupOnItemClick(str_id, popup_flags); }
export function CloseCurrentPopup(): void { bind.CloseCurrentPopup(); }
export function BeginPopupContextItem(str_id: string | null = null, popup_flags: ImGuiPopupFlags = ImGuiPopupFlags.MouseButtonRight): boolean { return bind.BeginPopupContextItem(str_id, popup_flags); }
export function BeginPopupContextWindow(str_id: string | null = null, popup_flags: ImGuiPopupFlags = ImGuiPopupFlags.MouseButtonRight): boolean { return bind.BeginPopupContextWindow(str_id, popup_flags); }
export function BeginPopupContextVoid(str_id: string | null = null, popup_flags: ImGuiPopupFlags = ImGuiPopupFlags.MouseButtonRight): boolean { return bind.BeginPopupContextVoid(str_id, popup_flags); }
export function IsPopupOpen(str_id: string, flags: ImGuiPopupFlags = 0): boolean { return bind.IsPopupOpen(str_id, flags); }
export function BeginTable(str_id: string, column: number, flags: ImGuiTableFlags = 0, outer_size: XY = ImVec2.ZERO, inner_width: number = 0.0): boolean { return bind.BeginTable(str_id, column, flags, outer_size, inner_width); }
export function EndTable(): void { bind.EndTable(); }
export function TableNextRow(row_flags: ImGuiTableRowFlags = 0, min_row_height: number = 0.0): void { bind.TableNextRow(row_flags, min_row_height); }
export function TableNextColumn(): boolean { return bind.TableNextColumn(); }
export function TableSetColumnIndex(column_n: number): boolean { return bind.TableSetColumnIndex(column_n); }
export function TableSetupColumn(label: string, flags: ImGuiTableColumnFlags = 0, init_width_or_weight: number = 0.0, user_id: number = 0): void { bind.TableSetupColumn(label, flags, init_width_or_weight, user_id); }
export function TableSetupScrollFreeze(cols: number, rows: number): void { bind.TableSetupScrollFreeze(cols, rows); }
export function TableHeadersRow(): void { bind.TableHeadersRow(); }
export function TableHeader(label: string): void { bind.TableHeader(label); }
export function TableGetSortSpecs(): ImGuiTableSortSpecs | null {
    const sort_specs: Bind.ImGuiTableSortSpecs | null = bind.TableGetSortSpecs();
    return (sort_specs === null) ? null : new ImGuiTableSortSpecs(sort_specs);
}
export function TableGetColumnCount(): number { return bind.TableGetColumnCount(); }
export function TableGetColumnIndex(): number { return bind.TableGetColumnIndex(); }
export function TableGetRowIndex(): number { return bind.TableGetRowIndex(); }
export function TableGetColumnName(column_n: number = -1): string { return bind.TableGetColumnName(column_n); }
export function TableGetColumnFlags(column_n: number = -1): ImGuiTableColumnFlags { return bind.TableGetColumnFlags(column_n); }
export function TableSetColumnEnabled(column_n: number, v: boolean): void { bind.TableSetColumnEnabled(column_n, v); }
export function TableSetBgColor(target: ImGuiTableBgTarget, color: number, column_n: number = -1) { bind.TableSetBgColor(target, color, column_n); }
export function Columns(count: number = 1, id: string | null = null, border: boolean = true): void { bind.Columns(count, id, border); }
export function NextColumn(): void { bind.NextColumn(); }
export function GetColumnIndex(): number { return bind.GetColumnIndex(); }
export function GetColumnWidth(column_index: number = -1): number { return bind.GetColumnWidth(column_index); }
export function SetColumnWidth(column_index: number, width: number): void { bind.SetColumnWidth(column_index, width); }
export function GetColumnOffset(column_index: number = -1): number { return bind.GetColumnOffset(column_index); }
export function SetColumnOffset(column_index: number, offset_x: number): void { bind.SetColumnOffset(column_index, offset_x); }
export function GetColumnsCount(): number { return bind.GetColumnsCount(); }
export function BeginTabBar(str_id: string, flags: ImGuiTabBarFlags = 0): boolean { return bind.BeginTabBar(str_id, flags); }
export function EndTabBar(): void { bind.EndTabBar(); }
export function BeginTabItem(label: string, p_open: ImScalar<boolean> | ImAccess<boolean> | null = null, flags: ImGuiTabItemFlags = 0): boolean {
    if (p_open === null) {
        return bind.BeginTabItem(label, null, flags);
    } else if (Array.isArray(p_open)) {
        return bind.BeginTabItem(label, p_open, flags);
    } else {
        const ref_open: ImScalar<boolean> = [ p_open() ];
        const ret = bind.BeginTabItem(label, ref_open, flags);
        p_open(ref_open[0]);
        return ret;
    }
}
export function EndTabItem(): void { bind.EndTabItem(); }
export function TabItemButton(label: string, flags: ImGuiTabItemFlags = 0): boolean { return bind.TabItemButton(label, flags); }
export function SetTabItemClosed(tab_or_docked_window_label: string): void { bind.SetTabItemClosed(tab_or_docked_window_label); }
export function LogToTTY(max_depth: number = -1): void { bind.LogToTTY(max_depth); }

export function LogToClipboard(max_depth: number = -1): void { bind.LogToClipboard(max_depth); }
export function LogFinish(): void { bind.LogFinish(); }
export function LogButtons(): void { bind.LogButtons(); }
export function LogText(fmt: string): void { bind.LogText(fmt); }
let dragDropPayload: { type: string; data: unknown } | undefined;
export function BeginDragDropSource(flags: ImGuiDragDropFlags = 0): boolean {
    return bind.BeginDragDropSource(flags);
}
export function SetDragDropPayload<T>(type: string, data: T, cond: ImGuiCond = 0): boolean {
    const accepted = bind.SetDragDropPayload(type, cond);
    if (cond !== ImGuiCond.Once || !dragDropPayload) dragDropPayload = { type, data };
    return accepted;
}
export function EndDragDropSource(): void {
    bind.EndDragDropSource();
}
export function BeginDragDropTarget(): boolean {
    return bind.BeginDragDropTarget();
}
export function AcceptDragDropPayload<T>(type: string, flags: ImGuiDragDropFlags = 0): ImGuiPayload<T> | null {
    return bind.AcceptDragDropPayload(type, flags) && dragDropPayload?.type === type ? { Data: dragDropPayload.data as T } : null;
}
export function EndDragDropTarget(): void {
    bind.EndDragDropTarget();
}
export function GetDragDropPayload<T>(): ImGuiPayload<T> | null {
    const type = bind.GetDragDropPayload();
    return type !== null && dragDropPayload && dragDropPayload.type === type ? { Data: dragDropPayload.data as T } : null;
}
export function BeginDisabled(disabled: boolean = true): void { bind.BeginDisabled(disabled); }
export function EndDisabled(): void { bind.EndDisabled(); }
export function PushClipRect(clip_rect_min: Readonly<XY>, clip_rect_max: Readonly<XY>, intersect_with_current_clip_rect: boolean): void {
    bind.PushClipRect(clip_rect_min, clip_rect_max, intersect_with_current_clip_rect);
}
export function PopClipRect(): void {
    bind.PopClipRect();
}
export function SetItemDefaultFocus(): void { bind.SetItemDefaultFocus(); }
export function SetKeyboardFocusHere(offset: number = 0): void { bind.SetKeyboardFocusHere(offset); }
export function IsItemHovered(flags: ImGuiHoveredFlags = 0): boolean { return bind.IsItemHovered(flags); }
export function IsItemActive(): boolean { return bind.IsItemActive(); }
export function IsItemFocused(): boolean { return bind.IsItemFocused(); }
export function IsItemClicked(mouse_button: ImGuiMouseButton = 0): boolean { return bind.IsItemClicked(mouse_button); }
export function IsItemVisible(): boolean { return bind.IsItemVisible(); }
export function IsItemEdited(): boolean { return bind.IsItemEdited(); }
export function IsItemActivated(): boolean { return bind.IsItemActivated(); }
export function IsItemDeactivated(): boolean { return bind.IsItemDeactivated(); }
export function IsItemDeactivatedAfterEdit(): boolean { return bind.IsItemDeactivatedAfterEdit(); }
export function IsItemToggledOpen(): boolean { return bind.IsItemToggledOpen(); }
export function IsAnyItemHovered(): boolean { return bind.IsAnyItemHovered(); }
export function IsAnyItemActive(): boolean { return bind.IsAnyItemActive(); }
export function IsAnyItemFocused(): boolean { return bind.IsAnyItemFocused(); }
export function GetItemRectMin(out: XY = new ImVec2()): XY { return bind.GetItemRectMin(out); }
export function GetItemRectMax(out: XY = new ImVec2()): XY { return bind.GetItemRectMax(out); }
export function GetItemRectSize(out: XY = new ImVec2()): XY { return bind.GetItemRectSize(out); }
export function SetNextItemAllowOverlap(): void { bind.SetNextItemAllowOverlap(); }
export type ImGuiViewport = Bind.ImGuiViewport;
export function GetMainViewport(): ImGuiViewport { return bind.GetMainViewport(); }
export function IsRectVisible(size: Readonly<XY>): boolean;
export function IsRectVisible(rect_min: Readonly<XY>, rect_max: Readonly<XY>): boolean;
export function IsRectVisible(...args: any[]): boolean {
    if (args.length === 1) {
        const size: Readonly<XY> = args[0];
        return bind.IsRectVisible_A(size);
    } else {
        const rect_min: Readonly<XY> = args[0];
        const rect_max: Readonly<XY> = args[1];
        return bind.IsRectVisible_B(rect_min, rect_max);
    }
}
export function GetTime(): number { return bind.GetTime(); }
export function GetFrameCount(): number { return bind.GetFrameCount(); }
export function GetBackgroundDrawList(): ImDrawList {
    return new ImDrawList(bind.GetBackgroundDrawList());
}
export function GetForegroundDrawList(): ImDrawList {
    return new ImDrawList(bind.GetForegroundDrawList());
}
export function GetStyleColorName(idx: ImGuiCol): string { return bind.GetStyleColorName(idx); }

export function CalcTextSize(text: string, text_end: number | null = null, hide_text_after_double_hash: boolean = false, wrap_width: number = -1, out: XY = new ImVec2()): XY {
    return bind.CalcTextSize(text_end !== null ? text.substring(0, text_end) : text, hide_text_after_double_hash, wrap_width, out);
}
export function ColorConvertU32ToFloat4(in_: number, out: XYZW = new ImVec4()): XYZW { return bind.ColorConvertU32ToFloat4(in_, out); }
export function ColorConvertFloat4ToU32(in_: Readonly<XYZW>): number { return bind.ColorConvertFloat4ToU32(in_); }
export function ColorConvertRGBtoHSV(r: number, g: number, b: number, out_h: ImScalar<number>, out_s: ImScalar<number>, out_v: ImScalar<number>): void { bind.ColorConvertRGBtoHSV(r, g, b, out_h, out_s, out_v); }
export function ColorConvertHSVtoRGB(h: number, s: number, v: number, out_r: ImScalar<number>, out_g: ImScalar<number>, out_b: ImScalar<number>): void { bind.ColorConvertHSVtoRGB(h, s, v, out_r, out_g, out_b); }

export function IsKeyDown(user_key_index: ImGuiKey): boolean { return bind.IsKeyDown(user_key_index); }
export function IsKeyPressed(user_key_index: ImGuiKey, repeat: boolean = true): boolean { return bind.IsKeyPressed(user_key_index, repeat); }
export function IsKeyReleased(user_key_index: ImGuiKey): boolean { return bind.IsKeyReleased(user_key_index); }
export function GetKeyPressedAmount(user_key_index: ImGuiKey, repeat_delay: number, rate: number): number { return bind.GetKeyPressedAmount(user_key_index, repeat_delay, rate); }

export function IsMouseDown(button: number): boolean { return bind.IsMouseDown(button); }
export function IsMouseClicked(button: number, repeat: boolean = false): boolean { return bind.IsMouseClicked(button, repeat); }
export function IsMouseDoubleClicked(button: number): boolean { return bind.IsMouseDoubleClicked(button); }
export function GetMouseClickedCount(button: number): number { return bind.GetMouseClickedCount(button); }
export function IsMouseReleased(button: number): boolean { return bind.IsMouseReleased(button); }
export function IsMouseHoveringRect(r_min: Readonly<XY>, r_max: Readonly<XY>, clip: boolean = true): boolean { return bind.IsMouseHoveringRect(r_min, r_max, clip); }
export function IsMousePosValid(mouse_pos: Readonly<XY> | null = null): boolean { return bind.IsMousePosValid(mouse_pos); }
export function IsAnyMouseDown(): boolean { return bind.IsAnyMouseDown(); }
export function GetMousePos(out: XY = new ImVec2()): XY { return bind.GetMousePos(out); }
export function GetMousePosOnOpeningCurrentPopup(out: XY = new ImVec2()): XY { return bind.GetMousePosOnOpeningCurrentPopup(out); }
export function IsMouseDragging(button: number = 0, lock_threshold: number = -1.0): boolean { return bind.IsMouseDragging(button, lock_threshold); }
export function GetMouseDragDelta(button: number = 0, lock_threshold: number = -1.0, out: XY = new ImVec2()): XY { return bind.GetMouseDragDelta(button, lock_threshold, out); }
export function ResetMouseDragDelta(button: number = 0): void { bind.ResetMouseDragDelta(button); }
export function GetMouseCursor(): ImGuiMouseCursor { return bind.GetMouseCursor(); }
export function SetMouseCursor(type: ImGuiMouseCursor): void { bind.SetMouseCursor(type); }

export function GetClipboardText(): string { return bind.GetClipboardText(); }
export function SetClipboardText(text: string): void { bind.SetClipboardText(text); }
export function LoadIniSettingsFromMemory(ini_data: string): void { bind.LoadIniSettingsFromMemory(ini_data); }
export function SaveIniSettingsToMemory(): string { return bind.SaveIniSettingsToMemory(); }
export function DebugCheckVersionAndDataLayout(version_str: string, sz_io: number, sz_style: number, sz_vec2: number, sz_vec4: number, sz_draw_vert: number, sz_draw_idx: number): boolean {
    return bind.DebugCheckVersionAndDataLayout(version_str, sz_io, sz_style, sz_vec2, sz_vec4, sz_draw_vert, sz_draw_idx);
}
