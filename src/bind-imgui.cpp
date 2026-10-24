#include "imgui.h"
#include "misc/freetype/imgui_freetype.h"
#include <cfloat>
#include <algorithm>
#include <cstddef>
#include <cmath>
#include <limits>
#include <vector>


#ifndef __FLT_MAX__
#define __FLT_MAX__ 3.40282346638528859812e+38F
#endif

#include <emscripten/bind.h>

EMSCRIPTEN_BINDINGS(enums) {
#include "enums.inc"
}


template<class T>
emscripten::val borrow(T* pointer) {
    return pointer ? emscripten::val(pointer, emscripten::return_value_policy::reference()) : emscripten::val::null();
}

[[noreturn]] void binding_error(const char* message) {
    emscripten::val::global("Error").new_(std::string(message)).throw_();
}

#define FUNCTION(RET, ARGS, CODE...) \
    emscripten::optional_override([] ARGS -> RET { CODE })

#define CLASS_MEMBER(CLASS, MEMBER) \
    .property(#MEMBER, &CLASS::MEMBER)

#define CLASS_MEMBER_GET(CLASS, MEMBER, GET) \
    .property(#MEMBER, FUNCTION(emscripten::val, (const CLASS& that), GET))

#define CLASS_MEMBER_SET(CLASS, MEMBER, SET) \
    .property(#MEMBER, NULL, FUNCTION(void, (CLASS& that, emscripten::val value), SET))

#define CLASS_MEMBER_GET_SET(CLASS, MEMBER, GET, SET) \
    .property(#MEMBER, \
        FUNCTION(emscripten::val, (const CLASS& that), GET), \
        FUNCTION(void, (CLASS& that, emscripten::val value), SET))

#define CLASS_MEMBER_GET_RAW_POINTER(CLASS, MEMBER) \
    .property(#MEMBER, emscripten::optional_override([](const CLASS& that) { return that.MEMBER; }), emscripten::return_value_policy::reference())

#define CLASS_MEMBER_GET_SET_RAW_POINTER(CLASS, MEMBER) \
    .property(#MEMBER, &CLASS::MEMBER, emscripten::return_value_policy::reference())

#define CLASS_MEMBER_GET_RAW_REFERENCE(CLASS, MEMBER) \
    .property(#MEMBER, &CLASS::MEMBER, emscripten::return_value_policy::reference())

#define CLASS_METHOD(CLASS, METHOD) \
    .function(#METHOD, &CLASS::METHOD)

#include <malloc.h>

emscripten::val get_mallinfo() {
    const auto& i = mallinfo();
    emscripten::val rv(emscripten::val::object());
    rv.set("arena", emscripten::val(i.arena));
    rv.set("ordblks", emscripten::val(i.ordblks));
    rv.set("smblks", emscripten::val(i.smblks));
    rv.set("hblks", emscripten::val(i.hblks));
    rv.set("hblkhd", emscripten::val(i.hblkhd));
    rv.set("usmblks", emscripten::val(i.usmblks));
    rv.set("fsmblks", emscripten::val(i.fsmblks));
    rv.set("uordblks", emscripten::val(i.uordblks));
    rv.set("fordblks", emscripten::val(i.fordblks));
    rv.set("keepcost", emscripten::val(i.keepcost));
    return rv;
}

EMSCRIPTEN_BINDINGS(mallinfo) {
    emscripten::function("mallinfo", &get_mallinfo);
}

class WrapImGuiContext {
private:
    static WrapImGuiContext* _current_wrap;
public:
    static WrapImGuiContext* CreateContext(ImFontAtlas* shared_font_atlas = NULL) {
        auto* wrap = new WrapImGuiContext(shared_font_atlas);
        SetCurrentContext(wrap);
        return wrap;
    }
    static void DestroyContext(WrapImGuiContext* wrap) {
        delete wrap;
    }
    static void SetCurrentContext(WrapImGuiContext* wrap) {
        _current_wrap = wrap;
        ImGui::SetCurrentContext(wrap == NULL ? NULL : wrap->ctx);
    }
    static WrapImGuiContext* GetCurrentContext() {
        return _current_wrap;
    }
private:
    ImGuiContext* ctx;
public:

    emscripten::val _ImGui_SetNextWindowSizeConstraints_custom_callback = emscripten::val::undefined();

    emscripten::val _ImGui_PlotLines_values_getter = emscripten::val::undefined();
    emscripten::val _ImGui_PlotLines_data = emscripten::val::undefined();

    emscripten::val _ImGui_PlotHistogram_values_getter = emscripten::val::undefined();
    emscripten::val _ImGui_PlotHistogram_data = emscripten::val::undefined();







public:
    WrapImGuiContext(ImFontAtlas* shared_font_atlas = NULL): ctx(ImGui::CreateContext(shared_font_atlas)) {
        ImGuiContext* prev_ctx = ImGui::GetCurrentContext();
        ImGui::SetCurrentContext(ctx);
        ImGuiIO& io = ImGui::GetIO();
        io.IniFilename = NULL;
        io.LogFilename = NULL;
        ImGui::SetCurrentContext(prev_ctx);
    }
    ~WrapImGuiContext() {
        if (_current_wrap == this) _current_wrap = nullptr;
        ImGui::DestroyContext(ctx);
        ctx = NULL;
    }
};

WrapImGuiContext* WrapImGuiContext::_current_wrap = NULL;

EMSCRIPTEN_BINDINGS(WrapImGuiContext) {
    emscripten::class_<WrapImGuiContext>("WrapImGuiContext")
    ;
}

template <typename T>
T import_value(const emscripten::val& value) {
    return value.as<T>();
}

template <typename T>
emscripten::val export_value(const T& value) {
    return emscripten::val(value);
}

template <>
float import_value(const emscripten::val& value) {
    const double _value = value.as<double>();
    if (double(+FLT_MAX) <= _value) return +FLT_MAX;
    if (_value <= double(-FLT_MAX)) return -FLT_MAX;
    return float(_value);
}

template <typename T>
class import_maybe_null_value {
protected:
    T _value;
    const emscripten::val& _import;
public:
    import_maybe_null_value(const emscripten::val& _import) : _import(_import) {
        if (!_import.isNull()) { _import_value(); }
    }
    virtual void _import_value() {
        _value = import_value<T>(_import);
    }
    operator T*() { return _import.isNull() ? NULL : &_value; }
    operator const T*() const { return _import.isNull() ? NULL : &_value; }
};

class import_maybe_null_string : public import_maybe_null_value<std::string> {
public:
    import_maybe_null_string(const emscripten::val& _import) : import_maybe_null_value(_import) {}
    operator const char*() const { return _import.isNull() ? NULL : _value.c_str(); }
};

emscripten::val export_maybe_null_string(const char* value) {
    return value == NULL ? emscripten::val::null() : emscripten::val(value);
}

template <typename T, size_t N = 1>
class access_value {
protected:
    T _value[N];
    emscripten::val& _access;
public:
    access_value(emscripten::val& _access) : _access(_access) {
        _import_value();
    }
    virtual ~access_value() {
        _export_value();
    }
    virtual void _import_value() {
        for (size_t i = 0; i < N; ++i) {
            _value[i] = import_value<T>(_access[i]);
        }
    }
    virtual void _export_value() {
        for (size_t i = 0; i < N; ++i) {
            _access.set(i, export_value<T>(_value[i]));
        }
    }
    operator T&() { return _value[0]; }
    operator const T&() const { return _value[0]; }
    operator T*() { return &_value[0]; }
    operator const T*() const { return &_value[0]; }
};

template <typename T, size_t N = 1>
class access_maybe_null_value {
protected:
    T _value[N];
    emscripten::val& _access;
public:
    access_maybe_null_value(emscripten::val& _access) : _access(_access) {
        if (!_access.isNull()) { _import_value(); }
    }
    virtual ~access_maybe_null_value() {
        if (!_access.isNull()) { _export_value(); }
    }
    virtual void _import_value() {
        for (size_t i = 0; i < N; ++i) {
            _value[i] = import_value<T>(_access[i]);
        }
    }
    virtual void _export_value() {
        for (size_t i = 0; i < N; ++i) {
            _access.set(i, export_value<T>(_value[i]));
        }
    }
    operator T*() { return _access.isNull() ? NULL : &_value[0]; }
    operator const T*() const { return _access.isNull() ? NULL : &_value[0]; }
};

template <typename T>
class access_typed_array {
protected:
    std::vector<T> _value;
    emscripten::val& _access;
public:
    access_typed_array(emscripten::val& access): _access(access) {
        _value.resize(_access["length"].template as<size_t>());
        emscripten::val(emscripten::typed_memory_view<T>(_value.size(), _value.data())).call<void>("set", _access);
    }
    ~access_typed_array() {
        _access.call<void>("set", emscripten::typed_memory_view<T>(_value.size(), _value.data()));
    }
    T* data() { return _value.data(); }
    const T* data() const { return _value.data(); }
    size_t size() { return _value.size(); }
    operator std::vector<T>&() { return _value; }
    operator const std::vector<T>&() const { return _value; }
};

ImVec2& import_ImVec2(const emscripten::val& value, ImVec2& out) {
    out.x = import_value<float>(value["x"]);
    out.y = import_value<float>(value["y"]);
    return out;
}

ImVec2 import_ImVec2(const emscripten::val& value) {
    ImVec2 out; import_ImVec2(value, out); return out;
}

emscripten::val export_ImVec2(const ImVec2& value, emscripten::val out) {
    out.set("x", export_value<float>(value.x));
    out.set("y", export_value<float>(value.y));
    return out;
}

emscripten::val export_ImVec2(const ImVec2& value) {
    return export_ImVec2(value, emscripten::val::object());
}

template <>
ImVec2 import_value(const emscripten::val& value) {
    return import_ImVec2(value);
}

ImVec2& ImVec2_Set(ImVec2& that, float x, float y) {
    that.x = x;
    that.y = y;
    return that;
}
ImVec2& ImVec2_Copy(ImVec2& that, emscripten::val other) { that = import_ImVec2(other); return that; }
bool ImVec2_Equals(const ImVec2& that, emscripten::val other) { return that.x == other["x"].as<float>() && that.y == other["y"].as<float>(); }

EMSCRIPTEN_BINDINGS(ImVec2) {
    emscripten::class_<ImVec2>("ImVec2")
        CLASS_MEMBER(ImVec2, x)
        CLASS_MEMBER(ImVec2, y)
        .function("Set", &ImVec2_Set, emscripten::return_value_policy::reference())
        .function("Copy", &ImVec2_Copy, emscripten::return_value_policy::reference())
        .function("Equals", &ImVec2_Equals)
    ;
}

ImVec4& import_ImVec4(const emscripten::val& value, ImVec4& out) {
    out.x = import_value<float>(value["x"]);
    out.y = import_value<float>(value["y"]);
    out.z = import_value<float>(value["z"]);
    out.w = import_value<float>(value["w"]);
    return out;
}

ImVec4 import_ImVec4(const emscripten::val& value) {
    ImVec4 out; import_ImVec4(value, out); return out;
}

emscripten::val export_ImVec4(const ImVec4& value, emscripten::val out) {
    out.set("x", export_value<float>(value.x));
    out.set("y", export_value<float>(value.y));
    out.set("z", export_value<float>(value.z));
    out.set("w", export_value<float>(value.w));
    return out;
}

emscripten::val export_ImVec4(const ImVec4& value) {
    return export_ImVec4(value, emscripten::val::object());
}

template <>
ImVec4 import_value(const emscripten::val& value) {
    return import_ImVec4(value);
}

ImVec4& ImVec4_Set(ImVec4& that, float x, float y, float z, float w) {
    that.x = x;
    that.y = y;
    that.z = z;
    that.w = w;
    return that;
}
ImVec4& ImVec4_Copy(ImVec4& that, emscripten::val other) { that = import_ImVec4(other); return that; }
bool ImVec4_Equals(const ImVec4& that, emscripten::val other) { return that.x == other["x"].as<float>() && that.y == other["y"].as<float>() && that.z == other["z"].as<float>() && that.w == other["w"].as<float>(); }

EMSCRIPTEN_BINDINGS(ImVec4) {
    emscripten::class_<ImVec4>("ImVec4")
        CLASS_MEMBER(ImVec4, x)
        CLASS_MEMBER(ImVec4, y)
        CLASS_MEMBER(ImVec4, z)
        CLASS_MEMBER(ImVec4, w)
        .function("Set", &ImVec4_Set, emscripten::return_value_policy::reference())
        .function("Copy", &ImVec4_Copy, emscripten::return_value_policy::reference())
        .function("Equals", &ImVec4_Equals)
    ;
}
EMSCRIPTEN_BINDINGS(ImGuiInputTextCallbackData) {
    emscripten::class_<ImGuiInputTextCallbackData>("ImGuiInputTextCallbackData")
        CLASS_MEMBER(ImGuiInputTextCallbackData, EventFlag)
        CLASS_MEMBER(ImGuiInputTextCallbackData, Flags)
        CLASS_MEMBER(ImGuiInputTextCallbackData, EventChar)
        CLASS_MEMBER(ImGuiInputTextCallbackData, EventKey)
        CLASS_MEMBER_GET_SET(ImGuiInputTextCallbackData, Buf,
            { return emscripten::val(std::string(that.Buf)); },
            {
                const auto text = value.as<std::string>();
                if (text.size() >= static_cast<size_t>(that.BufSize)) binding_error("Text exceeds UTF-8 buffer capacity");
                memcpy(that.Buf, text.c_str(), text.size() + 1);
                that.BufTextLen = static_cast<int>(text.size());
                that.CursorPos = std::min(that.CursorPos, that.BufTextLen);
                that.SelectionStart = std::min(that.SelectionStart, that.BufTextLen);
                that.SelectionEnd = std::min(that.SelectionEnd, that.BufTextLen);
                that.BufDirty = true;
            }
        )
        CLASS_MEMBER(ImGuiInputTextCallbackData, BufTextLen)
        .property("BufSize", emscripten::optional_override([](const ImGuiInputTextCallbackData& that) { return that.BufSize; }))
        CLASS_MEMBER(ImGuiInputTextCallbackData, BufDirty)
        CLASS_MEMBER(ImGuiInputTextCallbackData, CursorPos)
        CLASS_MEMBER(ImGuiInputTextCallbackData, SelectionStart)
        CLASS_MEMBER(ImGuiInputTextCallbackData, SelectionEnd)
        CLASS_METHOD(ImGuiInputTextCallbackData, DeleteChars)
        .function("InsertChars", FUNCTION(void, (ImGuiInputTextCallbackData& that, int pos, std::string text), {
            that.InsertChars(pos, text.c_str(), NULL);
        }))
        CLASS_METHOD(ImGuiInputTextCallbackData, HasSelection)
        CLASS_METHOD(ImGuiInputTextCallbackData, SelectAll)
        CLASS_METHOD(ImGuiInputTextCallbackData, ClearSelection)
    ;
}
EMSCRIPTEN_BINDINGS(ImGuiSizeCallbackData) {
    emscripten::class_<ImGuiSizeCallbackData>("ImGuiSizeCallbackData")
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiSizeCallbackData, Pos)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiSizeCallbackData, CurrentSize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiSizeCallbackData, DesiredSize)
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiListClipper) {
    emscripten::class_<ImGuiListClipper>("ImGuiListClipper")
        .constructor()
        CLASS_MEMBER(ImGuiListClipper, DisplayStart)
        CLASS_MEMBER(ImGuiListClipper, DisplayEnd)
        CLASS_MEMBER(ImGuiListClipper, ItemsCount)
        CLASS_MEMBER(ImGuiListClipper, ItemsHeight)
        CLASS_MEMBER(ImGuiListClipper, StartPosY)
        CLASS_METHOD(ImGuiListClipper, Begin)
        CLASS_METHOD(ImGuiListClipper, End)
        CLASS_METHOD(ImGuiListClipper, Step)
        CLASS_METHOD(ImGuiListClipper, IncludeItemByIndex)
        CLASS_METHOD(ImGuiListClipper, IncludeItemsByIndex)
        CLASS_METHOD(ImGuiListClipper, SeekCursorForItem)
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiTableColumnSortSpecs) {
    emscripten::class_<ImGuiTableColumnSortSpecs>("ImGuiTableColumnSortSpecs")
        CLASS_MEMBER(ImGuiTableColumnSortSpecs, ColumnUserID)
        CLASS_MEMBER(ImGuiTableColumnSortSpecs, ColumnIndex)
        CLASS_MEMBER(ImGuiTableColumnSortSpecs, SortOrder)
        CLASS_MEMBER_GET(ImGuiTableColumnSortSpecs, SortDirection,
            { return emscripten::val(that.SortDirection); })
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiTableSortSpecs) {
    emscripten::class_<ImGuiTableSortSpecs>("ImGuiTableSortSpecs")
      .function("GetSpec", FUNCTION(emscripten::val, (ImGuiTableSortSpecs& that, const int idx), {
            const ImGuiTableColumnSortSpecs* spec = &that.Specs[idx];
            return borrow(spec);
        }), emscripten::allow_raw_pointers())
        CLASS_MEMBER(ImGuiTableSortSpecs, SpecsCount)
        CLASS_MEMBER(ImGuiTableSortSpecs, SpecsDirty)
    ;
}

EMSCRIPTEN_BINDINGS(ImDrawCmd) {
    emscripten::class_<ImDrawCmd>("ImDrawCmd")
        CLASS_MEMBER(ImDrawCmd, ElemCount)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImDrawCmd, ClipRect)
        .function("GetTexID", &ImDrawCmd::GetTexID)
        CLASS_MEMBER(ImDrawCmd, VtxOffset)
        CLASS_MEMBER(ImDrawCmd, IdxOffset)
    ;
}

EMSCRIPTEN_BINDINGS(ImDrawList) {
    emscripten::class_<ImDrawList>("ImDrawList")
        .function("IterateDrawCmds", FUNCTION(void, (const ImDrawList* that, emscripten::val callback), {
            unsigned int ElemStart = 0;
            for (const ImDrawCmd* pcmd = that->CmdBuffer.begin(); pcmd != that->CmdBuffer.end(); pcmd++) {
                callback(borrow(pcmd), emscripten::val(ElemStart));
                ElemStart += pcmd->ElemCount;
            }
        }), emscripten::allow_raw_pointers())
        CLASS_MEMBER_GET(ImDrawList, IdxBuffer, {
            return emscripten::val(emscripten::typed_memory_view((size_t)(that.IdxBuffer.size() * sizeof(ImDrawIdx)), (unsigned char*) that.IdxBuffer.Data));
        })
        CLASS_MEMBER_GET(ImDrawList, VtxBuffer, {
            return emscripten::val(emscripten::typed_memory_view((size_t)(that.VtxBuffer.size() * sizeof(ImDrawVert)), (unsigned char*) that.VtxBuffer.Data));
        })
        CLASS_MEMBER(ImDrawList, Flags)
        .function("PushClipRect", FUNCTION(void, (ImDrawList& that, emscripten::val clip_rect_min, emscripten::val clip_rect_max, bool intersect_with_current_clip_rect), {
            that.PushClipRect(import_ImVec2(clip_rect_min), import_ImVec2(clip_rect_max), intersect_with_current_clip_rect);
        }))
        CLASS_METHOD(ImDrawList, PushClipRectFullScreen)
        CLASS_METHOD(ImDrawList, PopClipRect)
        .function("PushTexture", FUNCTION(void, (ImDrawList& that, emscripten::val texture_id), {
            that.PushTexture(ImTextureRef(texture_id.as<ImU64>()));
        }))
        CLASS_METHOD(ImDrawList, PopTexture)
        .function("GetClipRectMin", FUNCTION(emscripten::val, (ImDrawList& that, emscripten::val out), {
            return export_ImVec2(that.GetClipRectMin(), out);
        }))
        .function("GetClipRectMax", FUNCTION(emscripten::val, (ImDrawList& that, emscripten::val out), {
            return export_ImVec2(that.GetClipRectMax(), out);
        }))
        .function("AddLine", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, ImU32 col, float thickness, ImDrawFlags flags), {
            that.AddLine(import_ImVec2(a), import_ImVec2(b), col, thickness, flags);
        }))
        .function("AddRect", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, ImU32 col, float rounding, float thickness, ImDrawFlags flags), {
            that.AddRect(import_ImVec2(a), import_ImVec2(b), col, rounding, thickness, flags);
        }))
        .function("AddRectFilled", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, ImU32 col, float rounding, int rounding_corners_flags), {
            that.AddRectFilled(import_ImVec2(a), import_ImVec2(b), col, rounding, rounding_corners_flags);
        }))
        .function("AddRectFilledMultiColor", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, ImU32 col_upr_left, ImU32 col_upr_right, ImU32 col_bot_right, ImU32 col_bot_left), {
            that.AddRectFilledMultiColor(import_ImVec2(a), import_ImVec2(b), col_upr_left, col_upr_right, col_bot_right, col_bot_left);
        }))
        .function("AddQuad", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val c, emscripten::val d, ImU32 col, float thickness, ImDrawFlags flags), {
            that.AddQuad(import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), import_ImVec2(d), col, thickness, flags);
        }))
        .function("AddQuadFilled", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val c, emscripten::val d, ImU32 col), {
            that.AddQuadFilled(import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), import_ImVec2(d), col);
        }))
        .function("AddTriangle", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val c, ImU32 col, float thickness, ImDrawFlags flags), {
            that.AddTriangle(import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), col, thickness, flags);
        }))
        .function("AddTriangleFilled", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val c, ImU32 col), {
            that.AddTriangleFilled(import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), col);
        }))
        .function("AddCircle", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, ImU32 col, int num_segments, float thickness, ImDrawFlags flags), {
            that.AddCircle(import_ImVec2(centre), radius, col, num_segments, thickness, flags);
        }))
        .function("AddCircleFilled", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, ImU32 col, int num_segments), {
            that.AddCircleFilled(import_ImVec2(centre), radius, col, num_segments);
        }))
        .function("AddNgon", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, ImU32 col, int num_segments, float thickness, ImDrawFlags flags), {
            that.AddNgon(import_ImVec2(centre), radius, col, num_segments, thickness, flags);
        }))
        .function("AddNgonFilled", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, ImU32 col, int num_segments), {
            that.AddNgonFilled(import_ImVec2(centre), radius, col, num_segments);
        }))
        .function("AddText_A", FUNCTION(void, (ImDrawList& that, emscripten::val pos, ImU32 col, std::string text_begin), {
            that.AddText(import_ImVec2(pos), col, text_begin.c_str(), NULL);
        }))
        .function("AddText_B", FUNCTION(void, (ImDrawList& that, emscripten::val font, float font_size, emscripten::val pos, ImU32 col, std::string text_begin, float wrap_width, emscripten::val cpu_fine_clip_rect), {
            ImFont* _font = font.as<ImFont*>(emscripten::allow_raw_pointers());
            that.AddText(_font, font_size, import_ImVec2(pos), col, text_begin.c_str(), NULL, wrap_width, import_maybe_null_value<ImVec4>(cpu_fine_clip_rect));
        }))
        .function("AddImage", FUNCTION(void, (ImDrawList& that, emscripten::val user_texture_id, emscripten::val a, emscripten::val b, emscripten::val uv_a, emscripten::val uv_b, ImU32 col), {
            that.AddImage(ImTextureRef(user_texture_id.as<ImU64>()), import_ImVec2(a), import_ImVec2(b), import_ImVec2(uv_a), import_ImVec2(uv_b), col);
        }))
        .function("AddImageQuad", FUNCTION(void, (ImDrawList& that, emscripten::val user_texture_id, emscripten::val a, emscripten::val b, emscripten::val c, emscripten::val d, emscripten::val uv_a, emscripten::val uv_b, emscripten::val uv_c, emscripten::val uv_d, ImU32 col), {
            that.AddImageQuad(ImTextureRef(user_texture_id.as<ImU64>()), import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), import_ImVec2(d), import_ImVec2(uv_a), import_ImVec2(uv_b), import_ImVec2(uv_c), import_ImVec2(uv_d), col);
        }))
        .function("AddImageRounded", FUNCTION(void, (ImDrawList& that, emscripten::val user_texture_id, emscripten::val a, emscripten::val b, emscripten::val uv_a, emscripten::val uv_b, ImU32 col, float rounding, int rounding_corners), {
            that.AddImageRounded(ImTextureRef(user_texture_id.as<ImU64>()), import_ImVec2(a), import_ImVec2(b), import_ImVec2(uv_a), import_ImVec2(uv_b), col, rounding, rounding_corners);
        }))
        .function("AddPolyline", FUNCTION(void, (ImDrawList& that, emscripten::val points, const int num_points, ImU32 col, float thickness, ImDrawFlags flags), {
            if (num_points < 0 || num_points > points["length"].as<int>()) binding_error("Invalid point count");
            std::vector<ImVec2> _points(num_points);
            for (int i = 0; i < num_points; ++i) {
                _points[i] = import_ImVec2(points[i]);
            }
            that.AddPolyline(_points.data(), num_points, col, thickness, flags);
        }))
        .function("AddConvexPolyFilled", FUNCTION(void, (ImDrawList& that, emscripten::val points, const int num_points, ImU32 col, ImDrawFlags flags), {
            if (num_points < 0 || num_points > points["length"].as<int>()) binding_error("Invalid point count");
            std::vector<ImVec2> _points(num_points);
            for (int i = 0; i < num_points; ++i) {
                _points[i] = import_ImVec2(points[i]);
            }
            that.AddConvexPolyFilled(_points.data(), num_points, col, flags);
        }))
        .function("AddBezierCubic", FUNCTION(void, (ImDrawList& that, emscripten::val p1, emscripten::val p2, emscripten::val p3, emscripten::val p4, ImU32 col, float thickness, int num_segments, ImDrawFlags flags), {
            that.AddBezierCubic(import_ImVec2(p1), import_ImVec2(p2), import_ImVec2(p3), import_ImVec2(p4), col, thickness, num_segments, flags);
        }))
        .function("AddBezierQuadratic", FUNCTION(void, (ImDrawList& that, emscripten::val p1, emscripten::val p2, emscripten::val p3, ImU32 col, float thickness, int num_segments, ImDrawFlags flags), {
            that.AddBezierQuadratic(import_ImVec2(p1), import_ImVec2(p2), import_ImVec2(p3), col, thickness, num_segments, flags);
        }))
        CLASS_METHOD(ImDrawList, PathClear)
        .function("PathLineTo", FUNCTION(void, (ImDrawList& that, emscripten::val pos), {
            that.PathLineTo(import_ImVec2(pos));
        }))
        .function("PathLineToMergeDuplicate", FUNCTION(void, (ImDrawList& that, emscripten::val pos), {
            that.PathLineToMergeDuplicate(import_ImVec2(pos));
        }))
        .function("PathFillConvex", FUNCTION(void, (ImDrawList& that, ImU32 col, ImDrawFlags flags), {
            that.PathFillConvex(col, flags);
        }))
        .function("PathStroke", FUNCTION(void, (ImDrawList& that, ImU32 col, float thickness, ImDrawFlags flags), {
            that.PathStroke(col, thickness, flags);
        }))
        .function("PathArcTo", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, float a_min, float a_max, int num_segments), {
            that.PathArcTo(import_ImVec2(centre), radius, a_min, a_max, num_segments);
        }))
        .function("PathArcToFast", FUNCTION(void, (ImDrawList& that, emscripten::val centre, float radius, int a_min_of_12, int a_max_of_12), {
            that.PathArcToFast(import_ImVec2(centre), radius, a_min_of_12, a_max_of_12);
        }))
        .function("PathBezierCubicCurveTo", FUNCTION(void, (ImDrawList& that, emscripten::val p2, emscripten::val p3, emscripten::val p4, int num_segments), {
            that.PathBezierCubicCurveTo(import_ImVec2(p2), import_ImVec2(p3), import_ImVec2(p4), num_segments);
        }))
        .function("PathBezierQuadraticCurveTo", FUNCTION(void, (ImDrawList& that, emscripten::val p2, emscripten::val p3, int num_segments), {
            that.PathBezierQuadraticCurveTo(import_ImVec2(p2), import_ImVec2(p3), num_segments);
        }))
        .function("PathRect", FUNCTION(void, (ImDrawList& that, emscripten::val rect_min, emscripten::val rect_max, float rounding, int rounding_corners_flags), {
            that.PathRect(import_ImVec2(rect_min), import_ImVec2(rect_max), rounding, rounding_corners_flags);
        }))
        CLASS_METHOD(ImDrawList, ChannelsSplit)
        CLASS_METHOD(ImDrawList, ChannelsMerge)
        CLASS_METHOD(ImDrawList, ChannelsSetCurrent)

        CLASS_METHOD(ImDrawList, AddDrawCmd)
        CLASS_METHOD(ImDrawList, PrimReserve)
        CLASS_METHOD(ImDrawList, PrimUnreserve)
        .function("PrimRect", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, ImU32 col), {
            that.PrimRect(import_ImVec2(a), import_ImVec2(b), col);
        }))
        .function("PrimRectUV", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val uv_a, emscripten::val uv_b, ImU32 col), {
            that.PrimRectUV(import_ImVec2(a), import_ImVec2(b), import_ImVec2(uv_a), import_ImVec2(uv_b), col);
        }))
        .function("PrimQuadUV", FUNCTION(void, (ImDrawList& that, emscripten::val a, emscripten::val b, emscripten::val c, emscripten::val d, emscripten::val uv_a, emscripten::val uv_b, emscripten::val uv_c, emscripten::val uv_d, ImU32 col), {
            that.PrimQuadUV(import_ImVec2(a), import_ImVec2(b), import_ImVec2(c), import_ImVec2(d), import_ImVec2(uv_a), import_ImVec2(uv_b), import_ImVec2(uv_c), import_ImVec2(uv_d), col);
        }))
        .function("PrimWriteVtx", FUNCTION(void, (ImDrawList& that, emscripten::val pos, emscripten::val uv, ImU32 col), {
            that.PrimWriteVtx(import_ImVec2(pos), import_ImVec2(uv), col);
        }))
        .function("PrimWriteIdx", FUNCTION(void, (ImDrawList& that, ImDrawIdx idx), {
            that.PrimWriteIdx(idx);
        }))
        .function("PrimVtx", FUNCTION(void, (ImDrawList& that, emscripten::val pos, emscripten::val uv, ImU32 col), {
            that.PrimVtx(import_ImVec2(pos), import_ImVec2(uv), col);
        }))
        CLASS_METHOD(ImDrawList, _CalcCircleAutoSegmentCount)
    ;
}

EMSCRIPTEN_BINDINGS(ImDrawData) {
    emscripten::class_<ImDrawData>("ImDrawData")
        .function("IterateDrawLists", FUNCTION(void, (const ImDrawData* that, emscripten::val callback), {
            for (int n = 0; n < that->CmdLists.Size; n++) {
                const ImDrawList* cmd_list = that->CmdLists[n];
                callback(borrow(cmd_list));
            }
        }), emscripten::allow_raw_pointers())
        CLASS_MEMBER(ImDrawData, Valid)
        CLASS_MEMBER_GET(ImDrawData, CmdListsCount, { return emscripten::val(that.CmdLists.Size); })
        CLASS_MEMBER(ImDrawData, TotalIdxCount)
        CLASS_MEMBER(ImDrawData, TotalVtxCount)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImDrawData, DisplayPos)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImDrawData, DisplaySize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImDrawData, FramebufferScale)
        CLASS_METHOD(ImDrawData, DeIndexAllBuffers)
        .function("ScaleClipRects", FUNCTION(void, (ImDrawData& that, emscripten::val fb_scale), {
            that.ScaleClipRects(import_ImVec2(fb_scale));
        }))
    ;
}

EMSCRIPTEN_BINDINGS(ImFontGlyph) {
    emscripten::class_<ImFontGlyph>("ImFontGlyph")
        CLASS_MEMBER_GET(ImFontGlyph, Colored, { return emscripten::val(that.Colored != 0); })
        CLASS_MEMBER_GET(ImFontGlyph, Visible, { return emscripten::val(that.Visible != 0); })
        CLASS_MEMBER_GET(ImFontGlyph, Codepoint, { return emscripten::val(static_cast<unsigned int>(that.Codepoint)); })
        CLASS_MEMBER(ImFontGlyph, AdvanceX)
        CLASS_MEMBER(ImFontGlyph, X0)
        CLASS_MEMBER(ImFontGlyph, Y0)
        CLASS_MEMBER(ImFontGlyph, X1)
        CLASS_MEMBER(ImFontGlyph, Y1)
        CLASS_MEMBER(ImFontGlyph, U0)
        CLASS_MEMBER(ImFontGlyph, V0)
        CLASS_MEMBER(ImFontGlyph, U1)
        CLASS_MEMBER(ImFontGlyph, V1)
    ;
}

EMSCRIPTEN_BINDINGS(ImFontConfig) {
    emscripten::class_<ImFontConfig>("ImFontConfig")
        .constructor()
        CLASS_MEMBER(ImFontConfig, MergeMode)
        CLASS_MEMBER(ImFontConfig, PixelSnapH)
        CLASS_MEMBER(ImFontConfig, OversampleH)
        CLASS_MEMBER(ImFontConfig, OversampleV)
        CLASS_MEMBER(ImFontConfig, EllipsisChar)
        CLASS_MEMBER(ImFontConfig, SizePixels)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImFontConfig, GlyphOffset)
        CLASS_MEMBER(ImFontConfig, GlyphMinAdvanceX)
        CLASS_MEMBER(ImFontConfig, GlyphMaxAdvanceX)
        CLASS_MEMBER(ImFontConfig, GlyphExtraAdvanceX)
        CLASS_MEMBER(ImFontConfig, FontNo)
        CLASS_MEMBER(ImFontConfig, FontLoaderFlags)
        CLASS_MEMBER(ImFontConfig, RasterizerMultiply)
        CLASS_MEMBER(ImFontConfig, RasterizerDensity)
        CLASS_MEMBER(ImFontConfig, ExtraSizeScale)
        CLASS_MEMBER_GET_SET(ImFontConfig, Name,
            { return emscripten::val(std::string(that.Name)); },
            { snprintf(that.Name, sizeof(that.Name), "%s", value.as<std::string>().c_str()); })
    ;
}

EMSCRIPTEN_BINDINGS(ImFont) {
    emscripten::class_<ImFont>("ImFont")
        CLASS_MEMBER(ImFont, LegacySize)
        CLASS_MEMBER(ImFont, FallbackChar)
        CLASS_MEMBER(ImFont, EllipsisChar)
        CLASS_METHOD(ImFont, IsLoaded)
        CLASS_METHOD(ImFont, IsGlyphInFont)
        CLASS_METHOD(ImFont, AddRemapCodepoint)
        .function("GetDebugName", FUNCTION(std::string, (const ImFont& that), { return that.GetDebugName(); }))
        .function("GetFontBaked", &ImFont::GetFontBaked, emscripten::return_value_policy::reference())
    ;
}
EMSCRIPTEN_BINDINGS(ImFontBaked) {
    emscripten::class_<ImFontBaked>("ImFontBaked")
        CLASS_MEMBER(ImFontBaked, Size)
        CLASS_MEMBER(ImFontBaked, Ascent)
        CLASS_MEMBER(ImFontBaked, Descent)
        CLASS_MEMBER(ImFontBaked, RasterizerDensity)
        CLASS_METHOD(ImFontBaked, GetCharAdvance)
        CLASS_METHOD(ImFontBaked, IsGlyphLoaded)
        .function("FindGlyph", &ImFontBaked::FindGlyph, emscripten::return_value_policy::reference())
        .function("FindGlyphNoFallback", &ImFontBaked::FindGlyphNoFallback, emscripten::return_value_policy::reference())
    ;
}

EMSCRIPTEN_BINDINGS(ImFontAtlas) {
    emscripten::class_<ImFontAtlas>("ImFontAtlas")
        .function("AddFontDefault", &ImFontAtlas::AddFontDefault, emscripten::return_value_policy::reference(), emscripten::allow_raw_pointers())
        .function("AddFontFromMemoryTTF", FUNCTION(ImFont*, (ImFontAtlas& that, emscripten::val data, float size, ImFontConfig* config), {
            size_t length = data["byteLength"].as<size_t>();
            if (that.Locked) binding_error("Add fonts between frames");
            if (length <= 100 || length > static_cast<size_t>(INT_MAX) || !std::isfinite(size) || size < 0)
                binding_error("Invalid font data or size");
            void* copy = ImGui::MemAlloc(length);
            if (!copy) binding_error("Unable to allocate font data");
            emscripten::val(emscripten::typed_memory_view(length, static_cast<unsigned char*>(copy))).call<void>("set", data);
            ImFontConfig cfg = config ? *config : ImFontConfig();
            cfg.FontDataOwnedByAtlas = true;
            cfg.Flags |= ImFontFlags_NoLoadError;
            auto& io = ImGui::GetIO();
            const bool old_assert = io.ConfigErrorRecoveryEnableAssert;
            const bool old_log = io.ConfigErrorRecoveryEnableDebugLog;
            const bool old_tooltip = io.ConfigErrorRecoveryEnableTooltip;
            // Font load failures are reported as JavaScript exceptions below.
            io.ConfigErrorRecoveryEnableAssert = io.ConfigErrorRecoveryEnableDebugLog = io.ConfigErrorRecoveryEnableTooltip = false;
            ImFont* font = that.AddFontFromMemoryTTF(copy, static_cast<int>(length), size, &cfg);
            io.ConfigErrorRecoveryEnableAssert = old_assert;
            io.ConfigErrorRecoveryEnableDebugLog = old_log;
            io.ConfigErrorRecoveryEnableTooltip = old_tooltip;
            if (!font) binding_error("Font could not be loaded");
            return font;
        }), emscripten::return_value_policy::reference(), emscripten::allow_raw_pointers())
        CLASS_METHOD(ImFontAtlas, CompactCache)
        CLASS_METHOD(ImFontAtlas, Clear)
        CLASS_METHOD(ImFontAtlas, ClearFonts)
        .function("RemoveFont", &ImFontAtlas::RemoveFont, emscripten::allow_raw_pointers())
        CLASS_MEMBER(ImFontAtlas, TexMinWidth)
        CLASS_MEMBER(ImFontAtlas, TexMinHeight)
        CLASS_MEMBER(ImFontAtlas, TexMaxWidth)
        CLASS_MEMBER(ImFontAtlas, TexMaxHeight)
        CLASS_MEMBER_GET_RAW_POINTER(ImFontAtlas, TexData)
        .function("GetFontCount", FUNCTION(int, (const ImFontAtlas& that), { return that.Fonts.Size; }))
    ;
}
EMSCRIPTEN_BINDINGS(ImTextureData) {
    emscripten::class_<ImTextureData>("ImTextureData")
        CLASS_MEMBER(ImTextureData, Width)
        CLASS_MEMBER(ImTextureData, Height)
        CLASS_MEMBER(ImTextureData, Status)
        CLASS_MEMBER(ImTextureData, UniqueID)
        .function("GetTexID", &ImTextureData::GetTexID)
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiViewport) {
    emscripten::class_<ImGuiViewport>("ImGuiViewport")
        CLASS_MEMBER(ImGuiViewport, Flags)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiViewport, Pos)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiViewport, Size)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiViewport, WorkPos)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiViewport, WorkSize)
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiIO) {
    emscripten::class_<ImGuiIO>("ImGuiIO")
        CLASS_MEMBER(ImGuiIO, ConfigFlags)
        CLASS_MEMBER(ImGuiIO, BackendFlags)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiIO, DisplaySize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiIO, DisplayFramebufferScale)
        CLASS_MEMBER(ImGuiIO, DeltaTime)
        CLASS_MEMBER(ImGuiIO, IniSavingRate)
        CLASS_MEMBER(ImGuiIO, FontAllowUserScaling)
        CLASS_MEMBER(ImGuiIO, ConfigNavSwapGamepadButtons)
        CLASS_MEMBER(ImGuiIO, ConfigNavMoveSetMousePos)
        CLASS_MEMBER(ImGuiIO, ConfigNavCaptureKeyboard)
        CLASS_MEMBER(ImGuiIO, ConfigNavEscapeClearFocusItem)
        CLASS_MEMBER(ImGuiIO, ConfigNavEscapeClearFocusWindow)
        CLASS_MEMBER(ImGuiIO, ConfigNavCursorVisibleAuto)
        CLASS_MEMBER(ImGuiIO, ConfigNavCursorVisibleAlways)
        CLASS_MEMBER(ImGuiIO, ConfigMacOSXBehaviors)
        CLASS_MEMBER(ImGuiIO, ConfigInputTrickleEventQueue)
        CLASS_MEMBER(ImGuiIO, ConfigInputTextCursorBlink)
        CLASS_MEMBER(ImGuiIO, ConfigInputTextEnterKeepActive)
        CLASS_MEMBER(ImGuiIO, ConfigColorEditFlags)
        CLASS_MEMBER(ImGuiIO, ConfigDragClickToInputText)
        CLASS_MEMBER(ImGuiIO, ConfigWindowsResizeFromEdges)
        CLASS_MEMBER(ImGuiIO, ConfigWindowsMoveFromTitleBarOnly)
        CLASS_MEMBER(ImGuiIO, ConfigWindowsCopyContentsWithCtrlC)
        CLASS_MEMBER(ImGuiIO, ConfigScrollbarScrollByPage)
        CLASS_MEMBER(ImGuiIO, ConfigIniSettingsSaveLastUsedDate)
        CLASS_MEMBER(ImGuiIO, ConfigIniSettingsAutoDiscardMonths)
        CLASS_MEMBER(ImGuiIO, ConfigDebugIniSettings)
        CLASS_MEMBER(ImGuiIO, MouseDrawCursor)
        CLASS_MEMBER(ImGuiIO, ConfigMemoryCompactTimer)
        CLASS_MEMBER(ImGuiIO, MouseDoubleClickTime)
        CLASS_MEMBER(ImGuiIO, MouseDoubleClickMaxDist)
        CLASS_MEMBER(ImGuiIO, MouseSingleClickDelay)
        CLASS_MEMBER(ImGuiIO, MouseDragThreshold)
        CLASS_MEMBER(ImGuiIO, KeyRepeatDelay)
        CLASS_MEMBER(ImGuiIO, KeyRepeatRate)
        CLASS_MEMBER(ImGuiIO, ConfigErrorRecovery)
        CLASS_MEMBER(ImGuiIO, ConfigErrorRecoveryEnableAssert)
        CLASS_MEMBER(ImGuiIO, ConfigErrorRecoveryEnableDebugLog)
        CLASS_MEMBER(ImGuiIO, ConfigErrorRecoveryEnableTooltip)
        CLASS_MEMBER(ImGuiIO, ConfigDebugIsDebuggerPresent)
        CLASS_MEMBER(ImGuiIO, ConfigDebugHighlightIdConflicts)
        CLASS_MEMBER(ImGuiIO, ConfigDebugHighlightIdConflictsShowItemPicker)
        CLASS_MEMBER(ImGuiIO, ConfigDebugBeginReturnValueOnce)
        CLASS_MEMBER(ImGuiIO, ConfigDebugBeginReturnValueLoop)
        CLASS_MEMBER(ImGuiIO, ConfigDebugIgnoreFocusLoss)
        CLASS_MEMBER(ImGuiIO, ConfigDebugDrawListDefaultsToStrokeLegacy)
        CLASS_MEMBER(ImGuiIO, WantCaptureMouse)
        CLASS_MEMBER(ImGuiIO, WantCaptureKeyboard)
        CLASS_MEMBER(ImGuiIO, WantTextInput)
        CLASS_MEMBER(ImGuiIO, WantSetMousePos)
        CLASS_MEMBER(ImGuiIO, WantSaveIniSettings)
        CLASS_MEMBER(ImGuiIO, NavActive)
        CLASS_MEMBER(ImGuiIO, NavVisible)
        CLASS_MEMBER(ImGuiIO, Framerate)
        CLASS_MEMBER(ImGuiIO, MetricsRenderVertices)
        CLASS_MEMBER(ImGuiIO, MetricsRenderIndices)
        CLASS_MEMBER(ImGuiIO, MetricsRenderWindows)
        CLASS_MEMBER(ImGuiIO, MetricsActiveWindows)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiIO, MouseDelta)
        CLASS_MEMBER_GET_RAW_POINTER(ImGuiIO, Fonts)
        CLASS_MEMBER_GET_SET_RAW_POINTER(ImGuiIO, FontDefault)
        CLASS_MEMBER_GET(ImGuiIO, BackendPlatformName, { return export_maybe_null_string(that.BackendPlatformName); })
        CLASS_MEMBER_GET(ImGuiIO, BackendRendererName, { return export_maybe_null_string(that.BackendRendererName); })
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiIO, MousePos)
        .property("MouseWheel", emscripten::optional_override([](const ImGuiIO& that) { return that.MouseWheel; }))
        .property("MouseWheelH", emscripten::optional_override([](const ImGuiIO& that) { return that.MouseWheelH; }))
        .property("KeyMods", emscripten::optional_override([](const ImGuiIO& that) { return that.KeyMods; }))
        CLASS_MEMBER_GET(ImGuiIO, KeyCtrl, { return emscripten::val(that.KeyCtrl); })
        CLASS_MEMBER_GET(ImGuiIO, KeyShift, { return emscripten::val(that.KeyShift); })
        CLASS_MEMBER_GET(ImGuiIO, KeyAlt, { return emscripten::val(that.KeyAlt); })
        CLASS_MEMBER_GET(ImGuiIO, KeySuper, { return emscripten::val(that.KeySuper); })
        CLASS_METHOD(ImGuiIO, AddKeyEvent)
        CLASS_METHOD(ImGuiIO, AddKeyAnalogEvent)
        CLASS_METHOD(ImGuiIO, AddMousePosEvent)
        CLASS_METHOD(ImGuiIO, AddMouseButtonEvent)
        CLASS_METHOD(ImGuiIO, AddMouseWheelEvent)
        CLASS_METHOD(ImGuiIO, AddMouseSourceEvent)
        CLASS_METHOD(ImGuiIO, AddFocusEvent)
        CLASS_METHOD(ImGuiIO, AddInputCharacter)
        CLASS_METHOD(ImGuiIO, AddInputCharacterUTF16)
        .function("AddInputCharactersUTF8", FUNCTION(void, (ImGuiIO& that, const std::string& text), { that.AddInputCharactersUTF8(text.c_str()); }))
        CLASS_METHOD(ImGuiIO, ClearEventsQueue)
        CLASS_METHOD(ImGuiIO, ClearInputKeys)
        CLASS_METHOD(ImGuiIO, ClearInputMouse)
    ;
}

EMSCRIPTEN_BINDINGS(ImGuiStyle) {
    emscripten::class_<ImGuiStyle>("ImGuiStyle")
        .constructor()
        CLASS_MEMBER(ImGuiStyle, FontSizeBase)
        CLASS_MEMBER(ImGuiStyle, FontScaleMain)
        CLASS_MEMBER(ImGuiStyle, FontScaleDpi)
        CLASS_MEMBER(ImGuiStyle, Alpha)
        CLASS_MEMBER(ImGuiStyle, DisabledAlpha)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, WindowPadding)
        CLASS_MEMBER(ImGuiStyle, WindowRounding)
        CLASS_MEMBER(ImGuiStyle, WindowBorderSize)
        CLASS_MEMBER(ImGuiStyle, WindowBorderHoverPadding)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, WindowMinSize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, WindowTitleAlign)
        CLASS_MEMBER(ImGuiStyle, WindowMenuButtonPosition)
        CLASS_MEMBER(ImGuiStyle, ChildRounding)
        CLASS_MEMBER(ImGuiStyle, ChildBorderSize)
        CLASS_MEMBER(ImGuiStyle, PopupRounding)
        CLASS_MEMBER(ImGuiStyle, PopupBorderSize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, FramePadding)
        CLASS_MEMBER(ImGuiStyle, FrameRounding)
        CLASS_MEMBER(ImGuiStyle, FrameBorderSize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, ItemSpacing)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, ItemInnerSpacing)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, CellPadding)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, TouchExtraPadding)
        CLASS_MEMBER(ImGuiStyle, IndentSpacing)
        CLASS_MEMBER(ImGuiStyle, ColumnsMinSpacing)
        CLASS_MEMBER(ImGuiStyle, ScrollbarSize)
        CLASS_MEMBER(ImGuiStyle, ScrollbarRounding)
        CLASS_MEMBER(ImGuiStyle, ScrollbarPadding)
        CLASS_MEMBER(ImGuiStyle, GrabMinSize)
        CLASS_MEMBER(ImGuiStyle, GrabRounding)
        CLASS_MEMBER(ImGuiStyle, LogSliderDeadzone)
        CLASS_MEMBER(ImGuiStyle, ImageRounding)
        CLASS_MEMBER(ImGuiStyle, ImageBorderSize)
        CLASS_MEMBER(ImGuiStyle, TabRounding)
        CLASS_MEMBER(ImGuiStyle, TabBorderSize)
        CLASS_MEMBER(ImGuiStyle, TabMinWidthBase)
        CLASS_MEMBER(ImGuiStyle, TabMinWidthShrink)
        CLASS_MEMBER(ImGuiStyle, TabCloseButtonMinWidthSelected)
        CLASS_MEMBER(ImGuiStyle, TabCloseButtonMinWidthUnselected)
        CLASS_MEMBER(ImGuiStyle, TabBarBorderSize)
        CLASS_MEMBER(ImGuiStyle, TabBarOverlineSize)
        CLASS_MEMBER(ImGuiStyle, TableAngledHeadersAngle)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, TableAngledHeadersTextAlign)
        CLASS_MEMBER(ImGuiStyle, TreeLinesFlags)
        CLASS_MEMBER(ImGuiStyle, TreeLinesSize)
        CLASS_MEMBER(ImGuiStyle, TreeLinesRounding)
        CLASS_MEMBER(ImGuiStyle, MenuItemRounding)
        CLASS_MEMBER(ImGuiStyle, SelectableRounding)
        CLASS_MEMBER(ImGuiStyle, DragDropTargetRounding)
        CLASS_MEMBER(ImGuiStyle, DragDropTargetBorderSize)
        CLASS_MEMBER(ImGuiStyle, DragDropTargetPadding)
        CLASS_MEMBER(ImGuiStyle, ColorMarkerSize)
        CLASS_MEMBER(ImGuiStyle, ColorButtonPosition)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, ButtonTextAlign)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, SelectableTextAlign)
        CLASS_MEMBER(ImGuiStyle, InputTextCursorSize)
        CLASS_MEMBER(ImGuiStyle, SeparatorSize)
        CLASS_MEMBER(ImGuiStyle, SeparatorTextBorderSize)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, SeparatorTextAlign)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, SeparatorTextPadding)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, DisplayWindowPadding)
        CLASS_MEMBER_GET_RAW_REFERENCE(ImGuiStyle, DisplaySafeAreaPadding)
        CLASS_MEMBER(ImGuiStyle, MouseCursorScale)
        CLASS_MEMBER(ImGuiStyle, AntiAliasedLines)
        CLASS_MEMBER(ImGuiStyle, AntiAliasedLineEnds)
        CLASS_MEMBER(ImGuiStyle, AntiAliasedFill)
        CLASS_MEMBER(ImGuiStyle, CurveTessellationMaxError)
        CLASS_MEMBER(ImGuiStyle, CircleTessellationMaxError)
        CLASS_MEMBER(ImGuiStyle, HoverStationaryDelay)
        CLASS_MEMBER(ImGuiStyle, HoverDelayShort)
        CLASS_MEMBER(ImGuiStyle, HoverDelayNormal)
        CLASS_MEMBER(ImGuiStyle, HoverFlagsForTooltipMouse)
        CLASS_MEMBER(ImGuiStyle, HoverFlagsForTooltipNav)
        CLASS_MEMBER(ImGuiStyle, _MainScale)
        CLASS_MEMBER(ImGuiStyle, _NextFrameFontSizeBase)
        .function("GetColor", FUNCTION(emscripten::val, (ImGuiStyle& that, int index), {
            if (index < 0 || index >= ImGuiCol_COUNT) binding_error("Color index is out of range");
            return borrow(&that.Colors[index]);
        }))
        CLASS_METHOD(ImGuiStyle, ScaleAllSizes)
    ;
}

namespace ImGui {

template <typename T>
bool DragScalarV(const char* label, ImGuiDataType data_type, std::vector<T>& v, float v_speed, const void* v_min = NULL, const void* v_max = NULL, const char* format = NULL, ImGuiSliderFlags flags = 0) {
    return ImGui::DragScalarN(label, data_type, v.data(), v.size(), v_speed, v_min, v_max, format, flags);
}

template <typename T>
bool SliderScalarV(const char* label, ImGuiDataType data_type, std::vector<T>& v, const void* v_min, const void* v_max, const char* format = NULL, ImGuiSliderFlags flags = 0) {
    return ImGui::SliderScalarN(label, data_type, v.data(), v.size(), v_min, v_max, format, flags);
}

template <typename T>
bool InputScalarV(const char* label, ImGuiDataType data_type, std::vector<T>& v, const void* step = NULL, const void* step_fast = NULL, const char* format = NULL, ImGuiInputTextFlags flags = 0) {
    return ImGui::InputScalarN(label, data_type, v.data(), v.size(), step, step_fast, format, flags);
}

} // namespace ImGui

std::vector<char> input_buffer(emscripten::val buffer, size_t capacity, ImGuiInputTextFlags flags) {
    if (capacity == 0 || capacity > 16 * 1024 * 1024) binding_error("Text capacity must be 1 to 16777216 UTF-8 bytes, including NUL");
    if (flags & ImGuiInputTextFlags_CallbackResize) binding_error("CallbackResize is not supported; supply a larger text capacity");
    const auto text = buffer[0].as<std::string>();
    if (text.size() >= capacity) binding_error("Text exceeds UTF-8 buffer capacity");
    std::vector<char> bytes(capacity, 0);
    memcpy(bytes.data(), text.c_str(), text.size() + 1);
    return bytes;
}

int input_callback(ImGuiInputTextCallbackData* data) {
    return (*static_cast<emscripten::val*>(data->UserData))(borrow(data)).as<int>();
}

EMSCRIPTEN_BINDINGS(ImGui) {
    emscripten::function("Combo", FUNCTION(bool, (std::string label, emscripten::val current, emscripten::val getter, emscripten::val data, int count, int height), {
        struct Source { emscripten::val getter, data; std::string text; } source{getter, data, ""};
        return ImGui::Combo(label.c_str(), access_value<int>(current), +[](void* ptr, int index) -> const char* {
            auto& source = *static_cast<Source*>(ptr);
            source.text = source.getter(source.data, index).as<std::string>();
            return source.text.c_str();
        }, &source, count, height);
    }));
    emscripten::function("ListBox_A", FUNCTION(bool, (std::string label, emscripten::val current, emscripten::val items, int count, int height), {
        struct Source { emscripten::val items; std::string text; } source{items, ""};
        return ImGui::ListBox(label.c_str(), access_value<int>(current), +[](void* ptr, int index) -> const char* {
            auto& source = *static_cast<Source*>(ptr);
            source.text = source.items[index].as<std::string>();
            return source.text.c_str();
        }, &source, count, height);
    }));
    emscripten::function("ListBox_B", FUNCTION(bool, (std::string label, emscripten::val current, emscripten::val getter, emscripten::val data, int count, int height), {
        struct Source { emscripten::val getter, data; std::string text; } source{getter, data, ""};
        return ImGui::ListBox(label.c_str(), access_value<int>(current), +[](void* ptr, int index) -> const char* {
            auto& source = *static_cast<Source*>(ptr);
            source.text = source.getter(source.data, index).as<std::string>();
            return source.text.c_str();
        }, &source, count, height);
    }));

    emscripten::function("Image", FUNCTION(void, (ImU64 texture, emscripten::val size, emscripten::val uv0, emscripten::val uv1), {
        ImGui::Image(ImTextureRef(texture), import_ImVec2(size), import_ImVec2(uv0), import_ImVec2(uv1));
    }));
    emscripten::function("ImageWithBg", FUNCTION(void, (ImU64 texture, emscripten::val size, emscripten::val uv0, emscripten::val uv1, emscripten::val bg, emscripten::val tint), {
        ImGui::ImageWithBg(ImTextureRef(texture), import_ImVec2(size), import_ImVec2(uv0), import_ImVec2(uv1), import_ImVec4(bg), import_ImVec4(tint));
    }));
    emscripten::function("ImageButton", FUNCTION(bool, (std::string id, ImU64 texture, emscripten::val size, emscripten::val uv0, emscripten::val uv1, emscripten::val bg, emscripten::val tint), {
        return ImGui::ImageButton(id.c_str(), ImTextureRef(texture), import_ImVec2(size), import_ImVec2(uv0), import_ImVec2(uv1), import_ImVec4(bg), import_ImVec4(tint));
    }));

    emscripten::constant("IMGUI_VERSION", std::string(IMGUI_VERSION));
    emscripten::constant("IMGUI_VERSION_NUM", IMGUI_VERSION_NUM);

    emscripten::function("IMGUI_CHECKVERSION", FUNCTION(bool, (), { return IMGUI_CHECKVERSION(); }));

    emscripten::constant("ImGuiIOSize", sizeof(ImGuiIO));
    emscripten::constant("ImGuiStyleSize", sizeof(ImGuiStyle));
    emscripten::constant("ImVec2Size", sizeof(ImVec2));
    emscripten::constant("ImVec4Size", sizeof(ImVec4));

    emscripten::constant("ImDrawVertSize", sizeof(ImDrawVert));
    emscripten::constant("ImDrawIdxSize", sizeof(ImDrawIdx));
    emscripten::constant("ImDrawVertPosOffset", offsetof(ImDrawVert, pos));
    emscripten::constant("ImDrawVertUVOffset", offsetof(ImDrawVert, uv));
    emscripten::constant("ImDrawVertColOffset", offsetof(ImDrawVert, col));
    emscripten::function("CreateContext", FUNCTION(WrapImGuiContext*, (ImFontAtlas* shared_font_atlas), { return WrapImGuiContext::CreateContext(shared_font_atlas); }), emscripten::allow_raw_pointers()); // TODO: shared font atlas
    emscripten::function("DestroyContext", FUNCTION(void, (WrapImGuiContext* wrap), { WrapImGuiContext::DestroyContext(wrap); }), emscripten::allow_raw_pointers());
    emscripten::function("GetCurrentContext", FUNCTION(WrapImGuiContext*, (), { return WrapImGuiContext::GetCurrentContext(); }), emscripten::allow_raw_pointers());
    emscripten::function("SetCurrentContext", FUNCTION(void, (WrapImGuiContext* wrap), { WrapImGuiContext::SetCurrentContext(wrap); }), emscripten::allow_raw_pointers());
    emscripten::function("GetIO", +[]() -> ImGuiIO* { return &ImGui::GetIO(); }, emscripten::return_value_policy::reference());
    emscripten::function("GetStyle", +[]() -> ImGuiStyle* { return &ImGui::GetStyle(); }, emscripten::return_value_policy::reference());
    emscripten::function("NewFrame", &ImGui::NewFrame);
    emscripten::function("EndFrame", &ImGui::EndFrame);
    emscripten::function("Render", &ImGui::Render);
    emscripten::function("GetDrawData", FUNCTION(emscripten::val, (), { ImDrawData* p = ImGui::GetDrawData(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("ShowDemoWindow", FUNCTION(void, (emscripten::val p_open), { ImGui::ShowDemoWindow(access_maybe_null_value<bool>(p_open)); }));
    emscripten::function("ShowMetricsWindow", FUNCTION(void, (emscripten::val p_open), { ImGui::ShowMetricsWindow(access_maybe_null_value<bool>(p_open)); }));
    emscripten::function("ShowIDStackToolWindow", FUNCTION(void, (emscripten::val p_open), { ImGui::ShowIDStackToolWindow(access_maybe_null_value<bool>(p_open)); }));
    emscripten::function("ShowAboutWindow", FUNCTION(void, (emscripten::val p_open), { ImGui::ShowAboutWindow(access_maybe_null_value<bool>(p_open)); }));
    emscripten::function("ShowStyleEditor", FUNCTION(void, (emscripten::val ref), { ImGui::ShowStyleEditor(ref.isNull() ? NULL : ref.as<ImGuiStyle*>(emscripten::allow_raw_pointers())); }));
    emscripten::function("ShowStyleSelector", FUNCTION(bool, (std::string label), { return ImGui::ShowStyleSelector(label.c_str()); }));
    emscripten::function("ShowFontSelector", FUNCTION(void, (std::string label), { ImGui::ShowFontSelector(label.c_str()); }));
    emscripten::function("ShowUserGuide", &ImGui::ShowUserGuide);
    emscripten::function("GetVersion", FUNCTION(std::string, (), { return ImGui::GetVersion(); }));
    emscripten::function("StyleColorsDark", FUNCTION(void, (ImGuiStyle* dst), { ImGui::StyleColorsDark(dst); }), emscripten::allow_raw_pointers());
    emscripten::function("StyleColorsLight", FUNCTION(void, (ImGuiStyle* dst), { ImGui::StyleColorsLight(dst); }), emscripten::allow_raw_pointers());
    emscripten::function("StyleColorsClassic", FUNCTION(void, (ImGuiStyle* dst), { ImGui::StyleColorsClassic(dst); }), emscripten::allow_raw_pointers());
    emscripten::function("Begin", FUNCTION(bool, (std::string label, emscripten::val p_open, ImGuiWindowFlags flags), { return ImGui::Begin(label.c_str(), access_maybe_null_value<bool>(p_open), flags); }));
    emscripten::function("End", &ImGui::End);
    emscripten::function("BeginChild", FUNCTION(bool, (emscripten::val id, emscripten::val size, ImGuiChildFlags child_flags, ImGuiWindowFlags flags), {
        if (id.typeOf().strictlyEquals(emscripten::val("string"))) {
            return ImGui::BeginChild(id.as<std::string>().c_str(), import_ImVec2(size), child_flags, flags);
        } else {
            return ImGui::BeginChild(id.as<ImGuiID>(), import_ImVec2(size), child_flags, flags);
        }
    }));
    emscripten::function("EndChild", &ImGui::EndChild);
    emscripten::function("IsWindowAppearing", &ImGui::IsWindowAppearing);
    emscripten::function("IsWindowCollapsed", &ImGui::IsWindowCollapsed);
    emscripten::function("IsWindowFocused", &ImGui::IsWindowFocused);
    emscripten::function("IsWindowHovered", &ImGui::IsWindowHovered);
    emscripten::function("GetWindowDrawList", FUNCTION(emscripten::val, (), { ImDrawList* p = ImGui::GetWindowDrawList(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("GetWindowPos", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetWindowPos(), out); }));
    emscripten::function("GetWindowSize", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetWindowSize(), out); }));
    emscripten::function("GetWindowWidth", &ImGui::GetWindowWidth);
    emscripten::function("GetWindowHeight", &ImGui::GetWindowHeight);
    emscripten::function("SetNextWindowPos", FUNCTION(void, (emscripten::val pos, ImGuiCond cond, emscripten::val pivot), { ImGui::SetNextWindowPos(import_ImVec2(pos), cond, import_ImVec2(pivot)); }));
    emscripten::function("SetNextWindowSize", FUNCTION(void, (emscripten::val size, ImGuiCond cond), { ImGui::SetNextWindowSize(import_ImVec2(size), cond); }));
    emscripten::function("SetNextWindowSizeConstraints", FUNCTION(void, (emscripten::val size_min, emscripten::val size_max, emscripten::val custom_callback, emscripten::val custom_callback_data), {
        if (!custom_callback.isNull()) {
            WrapImGuiContext::GetCurrentContext()->_ImGui_SetNextWindowSizeConstraints_custom_callback = custom_callback;
            ImGui::SetNextWindowSizeConstraints(import_ImVec2(size_min), import_ImVec2(size_max), FUNCTION(void, (ImGuiSizeCallbackData* data), {
                WrapImGuiContext::GetCurrentContext()->_ImGui_SetNextWindowSizeConstraints_custom_callback(borrow(data));
            }), NULL);
        } else {
            ImGui::SetNextWindowSizeConstraints(import_ImVec2(size_min), import_ImVec2(size_max));
        }
    }));
    emscripten::function("SetNextWindowContentSize", FUNCTION(void, (emscripten::val size), { ImGui::SetNextWindowContentSize(import_ImVec2(size)); }));
    emscripten::function("SetNextWindowCollapsed", &ImGui::SetNextWindowCollapsed);
    emscripten::function("SetNextWindowFocus", &ImGui::SetNextWindowFocus);
    emscripten::function("SetNextWindowBgAlpha", &ImGui::SetNextWindowBgAlpha);
    emscripten::function("SetWindowPos", FUNCTION(void, (emscripten::val pos, ImGuiCond cond), { ImGui::SetWindowPos(import_ImVec2(pos), cond); }));
    emscripten::function("SetWindowSize", FUNCTION(void, (emscripten::val pos, ImGuiCond cond), { ImGui::SetWindowSize(import_ImVec2(pos), cond); }));
    emscripten::function("SetWindowCollapsed", FUNCTION(void, (bool collapsed, ImGuiCond cond), { ImGui::SetWindowCollapsed(collapsed, cond); }));
    emscripten::function("SetWindowFocus", FUNCTION(void, (), { ImGui::SetWindowFocus(); }));

    emscripten::function("SetWindowNamePos", FUNCTION(void, (std::string name, emscripten::val pos, ImGuiCond cond), { ImGui::SetWindowPos(name.c_str(), import_ImVec2(pos), cond); }));
    emscripten::function("SetWindowNameSize", FUNCTION(void, (std::string name, emscripten::val size, ImGuiCond cond), { ImGui::SetWindowSize(name.c_str(), import_ImVec2(size), cond); }));
    emscripten::function("SetWindowNameCollapsed", FUNCTION(void, (std::string name, bool collapsed, ImGuiCond cond), { ImGui::SetWindowCollapsed(name.c_str(), collapsed, cond); }));
    emscripten::function("SetWindowNameFocus", FUNCTION(void, (std::string name), { ImGui::SetWindowFocus(name.c_str()); }));
    emscripten::function("GetContentRegionAvail", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetContentRegionAvail(), out); }));

    emscripten::function("GetScrollX", &ImGui::GetScrollX);
    emscripten::function("GetScrollY", &ImGui::GetScrollY);
    emscripten::function("SetScrollX", &ImGui::SetScrollX);
    emscripten::function("SetScrollY", &ImGui::SetScrollY);
    emscripten::function("GetScrollMaxX", &ImGui::GetScrollMaxX);
    emscripten::function("GetScrollMaxY", &ImGui::GetScrollMaxY);
    emscripten::function("SetScrollHereX", &ImGui::SetScrollHereX);
    emscripten::function("SetScrollHereY", &ImGui::SetScrollHereY);
    emscripten::function("SetScrollFromPosX", &ImGui::SetScrollFromPosX);
    emscripten::function("SetScrollFromPosY", &ImGui::SetScrollFromPosY);
    emscripten::function("PushFont", FUNCTION(void, (emscripten::val font, float size), { ImFont* _font = font.isNull() ? NULL : font.as<ImFont*>(emscripten::allow_raw_pointers()); ImGui::PushFont(_font, size); }));
    emscripten::function("PopFont", &ImGui::PopFont);
    emscripten::function("PushStyleColor", FUNCTION(void, (ImGuiCol idx, emscripten::val col), {
        if (col.typeOf().strictlyEquals(emscripten::val("number"))) {
            ImGui::PushStyleColor(idx, col.as<ImU32>());
        } else {
            ImGui::PushStyleColor(idx, import_ImVec4(col));
        }
    }));
    emscripten::function("PopStyleColor", &ImGui::PopStyleColor);
    emscripten::function("PushStyleVar", FUNCTION(void, (ImGuiStyleVar idx, emscripten::val var), {
        if (var.typeOf().strictlyEquals(emscripten::val("number"))) {
            ImGui::PushStyleVar(idx, import_value<float>(var));
        } else {
            ImGui::PushStyleVar(idx, import_ImVec2(var));
        }
    }));
    emscripten::function("PopStyleVar", &ImGui::PopStyleVar);

    emscripten::function("PushItemWidth", &ImGui::PushItemWidth);
    emscripten::function("PopItemWidth", &ImGui::PopItemWidth);
    emscripten::function("SetNextItemWidth", &ImGui::SetNextItemWidth);
    emscripten::function("CalcItemWidth", &ImGui::CalcItemWidth);
    emscripten::function("PushTextWrapPos", &ImGui::PushTextWrapPos);
    emscripten::function("PopTextWrapPos", &ImGui::PopTextWrapPos);
    emscripten::function("GetFont", FUNCTION(emscripten::val, (), { ImFont* p = ImGui::GetFont(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("GetFontSize", &ImGui::GetFontSize);
    emscripten::function("GetFontTexUvWhitePixel", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetFontTexUvWhitePixel(), out); }));
    emscripten::function("GetColorU32_A", FUNCTION(ImU32, (ImGuiCol idx, emscripten::val alpha_mul), { return ImGui::GetColorU32(idx, import_value<float>(alpha_mul)); }));
    emscripten::function("GetColorU32_B", FUNCTION(ImU32, (emscripten::val col), { return ImGui::GetColorU32(import_ImVec4(col)); }));
    emscripten::function("GetColorU32_C", FUNCTION(ImU32, (ImU32 col), { return ImGui::GetColorU32(col); }));
    emscripten::function("GetStyleColorVec4", FUNCTION(emscripten::val, (ImGuiCol idx), { const ImVec4* p = &ImGui::GetStyleColorVec4(idx); return borrow(p); }));
    emscripten::function("Separator", &ImGui::Separator);
    emscripten::function("SameLine", &ImGui::SameLine);
    emscripten::function("NewLine", &ImGui::NewLine);
    emscripten::function("Spacing", &ImGui::Spacing);
    emscripten::function("Dummy", FUNCTION(void, (emscripten::val size), { ImGui::Dummy(import_ImVec2(size)); }));
    emscripten::function("Indent", &ImGui::Indent);
    emscripten::function("Unindent", &ImGui::Unindent);
    emscripten::function("BeginGroup", &ImGui::BeginGroup);
    emscripten::function("EndGroup", &ImGui::EndGroup);
    emscripten::function("GetCursorPos", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetCursorPos(), out); }));
    emscripten::function("GetCursorPosX", &ImGui::GetCursorPosX);
    emscripten::function("GetCursorPosY", &ImGui::GetCursorPosY);
    emscripten::function("SetCursorPos", FUNCTION(void, (emscripten::val local_pos), { ImGui::SetCursorPos(import_ImVec2(local_pos)); }));
    emscripten::function("SetCursorPosX", &ImGui::SetCursorPosX);
    emscripten::function("SetCursorPosY", &ImGui::SetCursorPosY);
    emscripten::function("GetCursorStartPos", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetCursorStartPos(), out); }));
    emscripten::function("GetCursorScreenPos", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetCursorScreenPos(), out); }));
    emscripten::function("SetCursorScreenPos", FUNCTION(void, (emscripten::val pos), { ImGui::SetCursorScreenPos(import_ImVec2(pos)); }));
    emscripten::function("AlignTextToFramePadding", &ImGui::AlignTextToFramePadding);
    emscripten::function("GetTextLineHeight", &ImGui::GetTextLineHeight);
    emscripten::function("GetTextLineHeightWithSpacing", &ImGui::GetTextLineHeightWithSpacing);
    emscripten::function("GetFrameHeight", &ImGui::GetFrameHeight);
    emscripten::function("GetFrameHeightWithSpacing", &ImGui::GetFrameHeightWithSpacing);
    emscripten::function("PushID", FUNCTION(void, (emscripten::val id), {
        if (id.typeOf().strictlyEquals(emscripten::val("number"))) {
            return ImGui::PushID(id.as<int>());
        } else {
            return ImGui::PushID(id.as<std::string>().c_str());
        }
    }));
    emscripten::function("PopID", &ImGui::PopID);
    emscripten::function("GetID", FUNCTION(ImGuiID, (emscripten::val id), {
        if (id.typeOf().strictlyEquals(emscripten::val("number"))) {
            return ImGui::GetID((const void*) id.as<int>());
        } else {
            return ImGui::GetID(id.as<std::string>().c_str());
        }
    }));
    emscripten::function("TextUnformatted", FUNCTION(void, (std::string text), { ImGui::TextUnformatted(text.c_str(), NULL); }));
    emscripten::function("Text", FUNCTION(void, (std::string fmt), { ImGui::Text("%s", fmt.c_str()); }));
    emscripten::function("TextColored", FUNCTION(void, (emscripten::val col, std::string fmt), { ImGui::TextColored(import_ImVec4(col), "%s", fmt.c_str()); }));
    emscripten::function("TextDisabled", FUNCTION(void, (std::string fmt), { ImGui::TextDisabled("%s", fmt.c_str()); }));
    emscripten::function("TextWrapped", FUNCTION(void, (std::string fmt), { ImGui::TextWrapped("%s", fmt.c_str()); }));
    emscripten::function("LabelText", FUNCTION(void, (std::string label, std::string fmt), { ImGui::LabelText(label.c_str(), "%s", fmt.c_str()); }));
    emscripten::function("BulletText", FUNCTION(void, (std::string fmt), { ImGui::BulletText("%s", fmt.c_str()); }));
    emscripten::function("Button", FUNCTION(bool, (std::string label, emscripten::val size), { return ImGui::Button(label.c_str(), import_ImVec2(size)); }));
    emscripten::function("SmallButton", FUNCTION(bool, (std::string label), { return ImGui::SmallButton(label.c_str()); }));
    emscripten::function("InvisibleButton", FUNCTION(bool, (std::string str_id, emscripten::val size, ImGuiButtonFlags flags), { return ImGui::InvisibleButton(str_id.c_str(), import_ImVec2(size), flags); }));
    emscripten::function("ArrowButton", FUNCTION(bool, (std::string label, ImGuiDir dir), { return ImGui::ArrowButton(label.c_str(), dir); }));

    emscripten::function("Checkbox", FUNCTION(bool, (std::string label, emscripten::val v), { return ImGui::Checkbox(label.c_str(), access_value<bool>(v)); }));
    emscripten::function("CheckboxFlags", FUNCTION(bool, (std::string label, emscripten::val flags, unsigned int flags_value), {
        return ImGui::CheckboxFlags(label.c_str(), access_value<unsigned int>(flags), flags_value);
    }));
    emscripten::function("RadioButton_A", FUNCTION(bool, (std::string label, bool active), { return ImGui::RadioButton(label.c_str(), active); }));
    emscripten::function("RadioButton_B", FUNCTION(bool, (std::string label, emscripten::val v, int v_button), { return ImGui::RadioButton(label.c_str(), access_value<int>(v), v_button); }));
    emscripten::function("ProgressBar", FUNCTION(void, (float fraction, emscripten::val size_arg, emscripten::val overlay), { ImGui::ProgressBar(fraction, import_ImVec2(size_arg), import_maybe_null_string(overlay)); }));
    emscripten::function("Bullet", &ImGui::Bullet);
    emscripten::function("BeginCombo", FUNCTION(bool, (std::string label, emscripten::val preview_value, ImGuiComboFlags flags), { return ImGui::BeginCombo(label.c_str(), import_maybe_null_string(preview_value), flags); }));
    emscripten::function("EndCombo", &ImGui::EndCombo);

    emscripten::function("DragFloat", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragFloat(label.c_str(), access_value<float>(v), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragFloat2", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragFloat2(label.c_str(), access_value<float, 2>(v), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragFloat3", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragFloat3(label.c_str(), access_value<float, 3>(v), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragFloat4", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragFloat4(label.c_str(), access_value<float, 4>(v), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragFloatRange2", FUNCTION(bool, (std::string label, emscripten::val v_current_min, emscripten::val v_current_max, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, emscripten::val format_max, ImGuiSliderFlags flags), {
        return ImGui::DragFloatRange2(label.c_str(), access_value<float>(v_current_min), access_value<float>(v_current_max), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), import_maybe_null_string(format_max), flags);
    }));
    emscripten::function("DragInt", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragInt(label.c_str(), access_value<int>(v), import_value<float>(v_speed), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragInt2", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragInt2(label.c_str(), access_value<int, 2>(v), import_value<float>(v_speed), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragInt3", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragInt3(label.c_str(), access_value<int, 3>(v), import_value<float>(v_speed), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragInt4", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_speed, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::DragInt4(label.c_str(), access_value<int, 4>(v), import_value<float>(v_speed), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("DragIntRange2", FUNCTION(bool, (std::string label, emscripten::val v_current_min, emscripten::val v_current_max, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, emscripten::val format_max, ImGuiSliderFlags flags), {
        return ImGui::DragIntRange2(label.c_str(), access_value<int>(v_current_min), access_value<int>(v_current_max), import_value<float>(v_speed), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), import_maybe_null_string(format_max), flags);
    }));
    emscripten::function("DragScalar", FUNCTION(bool, (std::string label, ImGuiDataType data_type, emscripten::val v, emscripten::val v_speed, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        switch (data_type) {
            case ImGuiDataType_S8:
                return ImGui::DragScalarV<ImS8>(label.c_str(), data_type, access_typed_array<ImS8>(v), import_value<float>(v_speed), import_maybe_null_value<ImS8>(v_min), import_maybe_null_value<ImS8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U8:
                return ImGui::DragScalarV<ImU8>(label.c_str(), data_type, access_typed_array<ImU8>(v), import_value<float>(v_speed), import_maybe_null_value<ImU8>(v_min), import_maybe_null_value<ImU8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S16:
                return ImGui::DragScalarV<ImS16>(label.c_str(), data_type, access_typed_array<ImS16>(v), import_value<float>(v_speed), import_maybe_null_value<ImS16>(v_min), import_maybe_null_value<ImS16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U16:
                return ImGui::DragScalarV<ImU16>(label.c_str(), data_type, access_typed_array<ImU16>(v), import_value<float>(v_speed), import_maybe_null_value<ImU16>(v_min), import_maybe_null_value<ImU16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S32:
                return ImGui::DragScalarV<ImS32>(label.c_str(), data_type, access_typed_array<ImS32>(v), import_value<float>(v_speed), import_maybe_null_value<ImS32>(v_min), import_maybe_null_value<ImS32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U32:
                return ImGui::DragScalarV<ImU32>(label.c_str(), data_type, access_typed_array<ImU32>(v), import_value<float>(v_speed), import_maybe_null_value<ImU32>(v_min), import_maybe_null_value<ImU32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Float:
                return ImGui::DragScalarV<float>(label.c_str(), data_type, access_typed_array<float>(v), import_value<float>(v_speed), import_maybe_null_value<float>(v_min), import_maybe_null_value<float>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Double:
                return ImGui::DragScalarV<double>(label.c_str(), data_type, access_typed_array<double>(v), import_value<float>(v_speed), import_maybe_null_value<double>(v_min), import_maybe_null_value<double>(v_max), import_maybe_null_string(format), flags);
        }
        return false;
    }));
    emscripten::function("SliderFloat", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderFloat(label.c_str(), access_value<float>(v), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderFloat2", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderFloat2(label.c_str(), access_value<float, 2>(v), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderFloat3", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderFloat3(label.c_str(), access_value<float, 3>(v), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderFloat4", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderFloat4(label.c_str(), access_value<float, 4>(v), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderAngle", FUNCTION(bool, (std::string label, emscripten::val v_rad, emscripten::val v_degrees_min, emscripten::val v_degrees_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderAngle(label.c_str(), access_value<float>(v_rad), import_value<float>(v_degrees_min), import_value<float>(v_degrees_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderInt", FUNCTION(bool, (std::string label, emscripten::val v, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderInt(label.c_str(), access_value<int>(v), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderInt2", FUNCTION(bool, (std::string label, emscripten::val v, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderInt2(label.c_str(), access_value<int, 2>(v), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderInt3", FUNCTION(bool, (std::string label, emscripten::val v, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderInt3(label.c_str(), access_value<int, 3>(v), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderInt4", FUNCTION(bool, (std::string label, emscripten::val v, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::SliderInt4(label.c_str(), access_value<int, 4>(v), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("SliderScalar", FUNCTION(bool, (std::string label, ImGuiDataType data_type, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        switch (data_type) {
            case ImGuiDataType_S8:
                return ImGui::SliderScalarV<ImS8>(label.c_str(), data_type, access_typed_array<ImS8>(v), import_maybe_null_value<ImS8>(v_min), import_maybe_null_value<ImS8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U8:
                return ImGui::SliderScalarV<ImU8>(label.c_str(), data_type, access_typed_array<ImU8>(v), import_maybe_null_value<ImU8>(v_min), import_maybe_null_value<ImU8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S16:
                return ImGui::SliderScalarV<ImS16>(label.c_str(), data_type, access_typed_array<ImS16>(v), import_maybe_null_value<ImS16>(v_min), import_maybe_null_value<ImS16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U16:
                return ImGui::SliderScalarV<ImU16>(label.c_str(), data_type, access_typed_array<ImU16>(v), import_maybe_null_value<ImU16>(v_min), import_maybe_null_value<ImU16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S32:
                return ImGui::SliderScalarV<ImS32>(label.c_str(), data_type, access_typed_array<ImS32>(v), import_maybe_null_value<ImS32>(v_min), import_maybe_null_value<ImS32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U32:
                return ImGui::SliderScalarV<ImU32>(label.c_str(), data_type, access_typed_array<ImU32>(v), import_maybe_null_value<ImU32>(v_min), import_maybe_null_value<ImU32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Float:
                return ImGui::SliderScalarV<float>(label.c_str(), data_type, access_typed_array<float>(v), import_maybe_null_value<float>(v_min), import_maybe_null_value<float>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Double:
                return ImGui::SliderScalarV<double>(label.c_str(), data_type, access_typed_array<double>(v), import_maybe_null_value<double>(v_min), import_maybe_null_value<double>(v_max), import_maybe_null_string(format), flags);
        }
        return false;
    }));
    emscripten::function("VSliderFloat", FUNCTION(bool, (std::string label, emscripten::val size, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::VSliderFloat(label.c_str(), import_ImVec2(size), access_value<float>(v), import_value<float>(v_min), import_value<float>(v_max), import_maybe_null_string(format), flags);
    }));
    emscripten::function("VSliderInt", FUNCTION(bool, (std::string label, emscripten::val size, emscripten::val v, int v_min, int v_max, emscripten::val format, ImGuiSliderFlags flags), {
        return ImGui::VSliderInt(label.c_str(), import_ImVec2(size), access_value<int>(v), v_min, v_max, import_maybe_null_string(format), flags);
    }));
    emscripten::function("VSliderScalar", FUNCTION(bool, (std::string label, emscripten::val size, ImGuiDataType data_type, emscripten::val v, emscripten::val v_min, emscripten::val v_max, emscripten::val format, ImGuiSliderFlags flags), {
        switch (data_type) {
            case ImGuiDataType_S8:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImS8>(v).data(), import_maybe_null_value<ImS8>(v_min), import_maybe_null_value<ImS8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U8:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImU8>(v).data(), import_maybe_null_value<ImU8>(v_min), import_maybe_null_value<ImU8>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S16:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImS16>(v).data(), import_maybe_null_value<ImS16>(v_min), import_maybe_null_value<ImS16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U16:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImU16>(v).data(), import_maybe_null_value<ImU16>(v_min), import_maybe_null_value<ImU16>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_S32:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImS32>(v).data(), import_maybe_null_value<ImS32>(v_min), import_maybe_null_value<ImS32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_U32:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<ImU32>(v).data(), import_maybe_null_value<ImU32>(v_min), import_maybe_null_value<ImU32>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Float:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<float>(v).data(), import_maybe_null_value<float>(v_min), import_maybe_null_value<float>(v_max), import_maybe_null_string(format), flags);
            case ImGuiDataType_Double:
                return ImGui::VSliderScalar(label.c_str(), import_ImVec2(size), data_type, access_typed_array<double>(v).data(), import_maybe_null_value<double>(v_min), import_maybe_null_value<double>(v_max), import_maybe_null_string(format), flags);
        }
        return false;
    }));
    emscripten::function("InputText", FUNCTION(bool, (std::string label, emscripten::val buf, size_t capacity, ImGuiInputTextFlags flags, emscripten::val callback), {
        auto bytes = input_buffer(buf, capacity, flags);
        bool changed = ImGui::InputText(label.c_str(), bytes.data(), capacity, flags, callback.isNull() ? nullptr : input_callback, &callback);
        buf.set(0, std::string(bytes.data()));
        return changed;
    }));
    emscripten::function("InputTextMultiline", FUNCTION(bool, (std::string label, emscripten::val buf, size_t capacity, emscripten::val size, ImGuiInputTextFlags flags, emscripten::val callback), {
        auto bytes = input_buffer(buf, capacity, flags);
        bool changed = ImGui::InputTextMultiline(label.c_str(), bytes.data(), capacity, import_ImVec2(size), flags, callback.isNull() ? nullptr : input_callback, &callback);
        buf.set(0, std::string(bytes.data()));
        return changed;
    }));
    emscripten::function("InputTextWithHint", FUNCTION(bool, (std::string label, std::string hint, emscripten::val buf, size_t capacity, ImGuiInputTextFlags flags, emscripten::val callback), {
        auto bytes = input_buffer(buf, capacity, flags);
        bool changed = ImGui::InputTextWithHint(label.c_str(), hint.c_str(), bytes.data(), capacity, flags, callback.isNull() ? nullptr : input_callback, &callback);
        buf.set(0, std::string(bytes.data()));
        return changed;
    }));
    emscripten::function("InputFloat", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val step, emscripten::val step_fast, emscripten::val format, ImGuiInputTextFlags flags), {
        return ImGui::InputFloat(label.c_str(), access_value<float>(v), import_value<float>(step), import_value<float>(step_fast), import_maybe_null_string(format), flags);
    }));
    emscripten::function("InputFloat2", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val format, ImGuiInputTextFlags flags), {
        return ImGui::InputFloat2(label.c_str(), access_value<float, 2>(v), import_maybe_null_string(format), flags);
    }));
    emscripten::function("InputFloat3", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val format, ImGuiInputTextFlags flags), {
        return ImGui::InputFloat3(label.c_str(), access_value<float, 3>(v), import_maybe_null_string(format), flags);
    }));
    emscripten::function("InputFloat4", FUNCTION(bool, (std::string label, emscripten::val v, emscripten::val format, ImGuiInputTextFlags flags), {
        return ImGui::InputFloat4(label.c_str(), access_value<float, 4>(v), import_maybe_null_string(format), flags);
    }));
    emscripten::function("InputInt", FUNCTION(bool, (std::string label, emscripten::val v, int step, int step_fast, ImGuiInputTextFlags flags), {
        return ImGui::InputInt(label.c_str(), access_value<int>(v), step, step_fast, flags);
    }));
    emscripten::function("InputInt2", FUNCTION(bool, (std::string label, emscripten::val v, ImGuiInputTextFlags flags), {
        return ImGui::InputInt2(label.c_str(), access_value<int, 2>(v), flags);
    }));
    emscripten::function("InputInt3", FUNCTION(bool, (std::string label, emscripten::val v, ImGuiInputTextFlags flags), {
        return ImGui::InputInt3(label.c_str(), access_value<int, 3>(v), flags);
    }));
    emscripten::function("InputInt4", FUNCTION(bool, (std::string label, emscripten::val v, ImGuiInputTextFlags flags), {
        return ImGui::InputInt4(label.c_str(), access_value<int, 4>(v), flags);
    }));
    emscripten::function("InputDouble", FUNCTION(bool, (std::string label, emscripten::val v, double step, double step_fast, emscripten::val format, ImGuiInputTextFlags flags), {
        return ImGui::InputDouble(label.c_str(), access_value<double>(v), step, step_fast, import_maybe_null_string(format), flags);
    }));
    emscripten::function("InputScalar", FUNCTION(bool, (std::string label, ImGuiDataType data_type, emscripten::val v, emscripten::val step, emscripten::val step_fast, emscripten::val format, ImGuiInputTextFlags flags), {
        switch (data_type) {
            case ImGuiDataType_S8:
                return ImGui::InputScalarV<ImS8>(label.c_str(), data_type, access_typed_array<ImS8>(v), import_maybe_null_value<ImS8>(step), import_maybe_null_value<ImS8>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_U8:
                return ImGui::InputScalarV<ImU8>(label.c_str(), data_type, access_typed_array<ImU8>(v), import_maybe_null_value<ImU8>(step), import_maybe_null_value<ImU8>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_S16:
                return ImGui::InputScalarV<ImS16>(label.c_str(), data_type, access_typed_array<ImS16>(v), import_maybe_null_value<ImS16>(step), import_maybe_null_value<ImS16>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_U16:
                return ImGui::InputScalarV<ImU16>(label.c_str(), data_type, access_typed_array<ImU16>(v), import_maybe_null_value<ImU16>(step), import_maybe_null_value<ImU16>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_S32:
                return ImGui::InputScalarV<ImS32>(label.c_str(), data_type, access_typed_array<ImS32>(v), import_maybe_null_value<ImS32>(step), import_maybe_null_value<ImS32>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_U32:
                return ImGui::InputScalarV<ImU32>(label.c_str(), data_type, access_typed_array<ImU32>(v), import_maybe_null_value<ImU32>(step), import_maybe_null_value<ImU32>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_Float:
                return ImGui::InputScalarV<float>(label.c_str(), data_type, access_typed_array<float>(v), import_maybe_null_value<float>(step), import_maybe_null_value<float>(step_fast), import_maybe_null_string(format), flags);
            case ImGuiDataType_Double:
                return ImGui::InputScalarV<double>(label.c_str(), data_type, access_typed_array<double>(v), import_maybe_null_value<double>(step), import_maybe_null_value<double>(step_fast), import_maybe_null_string(format), flags);
        }
        return false;
    }));
    emscripten::function("ColorEdit3", FUNCTION(bool, (std::string label, emscripten::val col, ImGuiColorEditFlags flags), { return ImGui::ColorEdit3(label.c_str(), access_value<float, 3>(col), flags); }));
    emscripten::function("ColorEdit4", FUNCTION(bool, (std::string label, emscripten::val col, ImGuiColorEditFlags flags), { return ImGui::ColorEdit4(label.c_str(), access_value<float, 4>(col), flags); }));
    emscripten::function("ColorPicker3", FUNCTION(bool, (std::string label, emscripten::val col, ImGuiColorEditFlags flags), { return ImGui::ColorPicker3(label.c_str(), access_value<float, 3>(col), flags); }));
    emscripten::function("ColorPicker4", FUNCTION(bool, (std::string label, emscripten::val col, ImGuiColorEditFlags flags, emscripten::val ref_col), { return ImGui::ColorPicker4(label.c_str(), access_value<float, 4>(col), flags, access_maybe_null_value<float, 4>(ref_col)); }));
    emscripten::function("ColorButton", FUNCTION(bool, (std::string label, emscripten::val col, ImGuiColorEditFlags flags, emscripten::val size), { return ImGui::ColorButton(label.c_str(), import_ImVec4(col), flags, import_ImVec2(size)); }));

    emscripten::function("TreeNode_A", FUNCTION(bool, (std::string label), { return ImGui::TreeNode(label.c_str()); }));
    emscripten::function("TreeNode_B", FUNCTION(bool, (std::string str_id, std::string fmt), { return ImGui::TreeNode(str_id.c_str(), "%s", fmt.c_str()); }));
    emscripten::function("TreeNode_C", FUNCTION(bool, (int ptr_id, std::string fmt), { return ImGui::TreeNode((const void*) ptr_id, "%s", fmt.c_str()); }));
    emscripten::function("TreeNodeEx_A", FUNCTION(bool, (std::string label, ImGuiTreeNodeFlags flags), { return ImGui::TreeNodeEx(label.c_str(), flags); }));
    emscripten::function("TreeNodeEx_B", FUNCTION(bool, (std::string str_id, ImGuiTreeNodeFlags flags, std::string fmt), { return ImGui::TreeNodeEx(str_id.c_str(), flags, "%s", fmt.c_str()); }));
    emscripten::function("TreeNodeEx_C", FUNCTION(bool, (int ptr_id, ImGuiTreeNodeFlags flags, std::string fmt), { return ImGui::TreeNodeEx((const void*) ptr_id, flags, "%s", fmt.c_str());     }));
    emscripten::function("TreePush_A", FUNCTION(void, (std::string str_id), { ImGui::TreePush(str_id.c_str()); }));
    emscripten::function("TreePush_B", FUNCTION(void, (int ptr_id), { ImGui::TreePush((const void*) ptr_id); }));
    emscripten::function("TreePop", &ImGui::TreePop);
    emscripten::function("GetTreeNodeToLabelSpacing", &ImGui::GetTreeNodeToLabelSpacing);
    emscripten::function("CollapsingHeader_A", FUNCTION(bool, (std::string label, ImGuiTreeNodeFlags flags), { return ImGui::CollapsingHeader(label.c_str(), flags); }));
    emscripten::function("CollapsingHeader_B", FUNCTION(bool, (std::string label, emscripten::val p_open, ImGuiTreeNodeFlags flags), { return ImGui::CollapsingHeader(label.c_str(), access_maybe_null_value<bool>(p_open), flags); }));
    emscripten::function("SetNextItemOpen", &ImGui::SetNextItemOpen);
    emscripten::function("Selectable_A", FUNCTION(bool, (std::string label, bool selected, ImGuiSelectableFlags flags, emscripten::val size), {
        return ImGui::Selectable(label.c_str(), selected, flags, import_ImVec2(size));
    }));
    emscripten::function("Selectable_B", FUNCTION(bool, (std::string label, emscripten::val p_selected, ImGuiSelectableFlags flags, emscripten::val size), {
        return ImGui::Selectable(label.c_str(), access_maybe_null_value<bool>(p_selected), flags, import_ImVec2(size));
    }));
    emscripten::function("BeginListBox", FUNCTION(bool, (std::string label, emscripten::val size), {
        return ImGui::BeginListBox(label.c_str(), import_ImVec2(size));
    }));
    emscripten::function("EndListBox", &ImGui::EndListBox);

    emscripten::function("PlotLines", FUNCTION(void, (std::string label, emscripten::val values_getter, emscripten::val data, int values_count, int values_offset, emscripten::val overlay_text, emscripten::val scale_min, emscripten::val scale_max, emscripten::val graph_size), {
        WrapImGuiContext* ctx = WrapImGuiContext::GetCurrentContext();
        ctx->_ImGui_PlotLines_values_getter = values_getter;
        ctx->_ImGui_PlotLines_data = data;
        ImGui::PlotLines(label.c_str(), FUNCTION(float, (void* data, int idx), {
            WrapImGuiContext* ctx = WrapImGuiContext::GetCurrentContext();
            return import_value<float>(ctx->_ImGui_PlotLines_values_getter(ctx->_ImGui_PlotLines_data, emscripten::val(idx)));
        }), NULL, values_count, values_offset, import_maybe_null_string(overlay_text), import_value<float>(scale_min), import_value<float>(scale_max), import_ImVec2(graph_size));
    }));
    emscripten::function("PlotHistogram", FUNCTION(void, (std::string label, emscripten::val values_getter, emscripten::val data, int values_count, int values_offset, emscripten::val overlay_text, emscripten::val scale_min, emscripten::val scale_max, emscripten::val graph_size), {
        WrapImGuiContext* ctx = WrapImGuiContext::GetCurrentContext();
        ctx->_ImGui_PlotHistogram_values_getter = values_getter;
        ctx->_ImGui_PlotHistogram_data = data;
        ImGui::PlotHistogram(label.c_str(), FUNCTION(float, (void* data, int idx), {
            WrapImGuiContext* ctx = WrapImGuiContext::GetCurrentContext();
            return import_value<float>(ctx->_ImGui_PlotHistogram_values_getter(ctx->_ImGui_PlotHistogram_data, emscripten::val(idx)));
        }), NULL, values_count, values_offset, import_maybe_null_string(overlay_text), import_value<float>(scale_min), import_value<float>(scale_max), import_ImVec2(graph_size));
    }));
    emscripten::function("Value_A", FUNCTION(void, (std::string prefix, bool b), { ImGui::Value(prefix.c_str(), b); }));
    emscripten::function("Value_B", FUNCTION(void, (std::string prefix, int v), { ImGui::Value(prefix.c_str(), v); }));
    emscripten::function("Value_C", FUNCTION(void, (std::string prefix, unsigned int v), { ImGui::Value(prefix.c_str(), v); }));
    emscripten::function("Value_D", FUNCTION(void, (std::string prefix, float v, emscripten::val float_format), { ImGui::Value(prefix.c_str(), v, import_maybe_null_string(float_format)); }));
    emscripten::function("BeginMenuBar", &ImGui::BeginMenuBar);
    emscripten::function("EndMenuBar", &ImGui::EndMenuBar);
    emscripten::function("BeginMainMenuBar", &ImGui::BeginMainMenuBar);
    emscripten::function("EndMainMenuBar", &ImGui::EndMainMenuBar);
    emscripten::function("BeginMenu", FUNCTION(bool, (std::string label, bool enabled), { return ImGui::BeginMenu(label.c_str(), enabled); }));
    emscripten::function("EndMenu", &ImGui::EndMenu);
    emscripten::function("MenuItem_A", FUNCTION(bool, (std::string label, emscripten::val shortcut, bool selected, bool enabled), { return ImGui::MenuItem(label.c_str(), import_maybe_null_string(shortcut), selected, enabled); }));
    emscripten::function("MenuItem_B", FUNCTION(bool, (std::string label, emscripten::val shortcut, emscripten::val p_selected, bool enabled), { return ImGui::MenuItem(label.c_str(), import_maybe_null_string(shortcut), access_maybe_null_value<bool>(p_selected), enabled); }));
    emscripten::function("BeginTooltip", &ImGui::BeginTooltip);
    emscripten::function("EndTooltip", &ImGui::EndTooltip);
    emscripten::function("SetTooltip", FUNCTION(void, (std::string fmt), { ImGui::SetTooltip("%s", fmt.c_str()); }));
    emscripten::function("BeginPopup", FUNCTION(bool, (std::string str_id, ImGuiWindowFlags flags), { return ImGui::BeginPopup(str_id.c_str(), flags); }));
    emscripten::function("BeginPopupModal", FUNCTION(bool, (std::string name, emscripten::val p_open, ImGuiWindowFlags flags), { return ImGui::BeginPopupModal(name.c_str(), access_maybe_null_value<bool>(p_open), flags); }));
    emscripten::function("EndPopup", &ImGui::EndPopup);
    emscripten::function("OpenPopup", FUNCTION(void, (std::string str_id, ImGuiPopupFlags popup_flags), { ImGui::OpenPopup(str_id.c_str(), popup_flags); }));
    emscripten::function("OpenPopupOnItemClick", FUNCTION(void, (emscripten::val str_id, ImGuiPopupFlags popup_flags), { ImGui::OpenPopupOnItemClick(import_maybe_null_string(str_id), popup_flags); }));
    emscripten::function("CloseCurrentPopup", &ImGui::CloseCurrentPopup);
    emscripten::function("BeginPopupContextItem", FUNCTION(bool, (emscripten::val str_id, ImGuiPopupFlags popup_flags), { return ImGui::BeginPopupContextItem(import_maybe_null_string(str_id), popup_flags); }));
    emscripten::function("BeginPopupContextWindow", FUNCTION(bool, (emscripten::val str_id, ImGuiPopupFlags popup_flags), { return ImGui::BeginPopupContextWindow(import_maybe_null_string(str_id), popup_flags); }));
    emscripten::function("BeginPopupContextVoid", FUNCTION(bool, (emscripten::val str_id, ImGuiPopupFlags popup_flags), { return ImGui::BeginPopupContextVoid(import_maybe_null_string(str_id), popup_flags); }));
    emscripten::function("IsPopupOpen", FUNCTION(bool, (std::string str_id, ImGuiPopupFlags flags), { return ImGui::IsPopupOpen(str_id.c_str(), flags); }));
    emscripten::function("BeginTable", FUNCTION(bool, (std::string str_id, int column, ImGuiTableFlags flags, emscripten::val outer_size, float inner_width), { return ImGui::BeginTable(str_id.c_str(), column, flags, import_ImVec2(outer_size), inner_width); }));
    emscripten::function("EndTable", FUNCTION(void, (), { ImGui::EndTable(); }));
    emscripten::function("TableNextRow", FUNCTION(void, (ImGuiTableRowFlags row_flags, float min_row_height), { ImGui::TableNextRow(row_flags, min_row_height); }));
    emscripten::function("TableNextColumn", FUNCTION(bool, (), { return ImGui::TableNextColumn(); }));
    emscripten::function("TableSetColumnIndex", FUNCTION(bool, (int column_n), { return ImGui::TableSetColumnIndex(column_n); }));
    emscripten::function("TableSetupColumn", FUNCTION(void, (std::string label, ImGuiTableColumnFlags flags, float init_width_or_weight, ImU32 user_id), { ImGui::TableSetupColumn(label.c_str(), flags, init_width_or_weight, user_id); }));
    emscripten::function("TableSetupScrollFreeze", FUNCTION(void, (int cols, int rows), { ImGui::TableSetupScrollFreeze(cols, rows); }));
    emscripten::function("TableHeadersRow", FUNCTION(void, (), { ImGui::TableHeadersRow(); }));
    emscripten::function("TableHeader", FUNCTION(void, (std::string label), { ImGui::TableHeader(label.c_str()); }));
    emscripten::function("TableGetSortSpecs", FUNCTION(emscripten::val, (), { ImGuiTableSortSpecs* p = ImGui::TableGetSortSpecs(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("TableGetColumnCount", FUNCTION(int, (), { return ImGui::TableGetColumnCount(); }));
    emscripten::function("TableGetColumnIndex", FUNCTION(int, (), { return ImGui::TableGetColumnIndex(); }));
    emscripten::function("TableGetRowIndex", FUNCTION(int, (), { return ImGui::TableGetRowIndex(); }));
    emscripten::function("TableGetColumnName", FUNCTION(std::string, (int column_n), { return ImGui::TableGetColumnName(column_n); }));
    emscripten::function("TableGetColumnFlags", FUNCTION(ImGuiTableColumnFlags, (int column_n), { return ImGui::TableGetColumnFlags(column_n); }));
    emscripten::function("TableSetColumnEnabled", FUNCTION(void, (int column_n, bool v), { return ImGui::TableSetColumnEnabled(column_n, v); }));
    emscripten::function("TableSetBgColor", FUNCTION(void, (ImGuiTableBgTarget target, ImU32 color, int column_n), { ImGui::TableSetBgColor(target, color, column_n); }));
    emscripten::function("Columns", FUNCTION(void, (int count, emscripten::val id, bool border), { ImGui::Columns(count, import_maybe_null_string(id), border); }));
    emscripten::function("NextColumn", &ImGui::NextColumn);
    emscripten::function("GetColumnIndex", &ImGui::GetColumnIndex);
    emscripten::function("GetColumnWidth", &ImGui::GetColumnWidth);
    emscripten::function("SetColumnWidth", &ImGui::SetColumnWidth);
    emscripten::function("GetColumnOffset", &ImGui::GetColumnOffset);
    emscripten::function("SetColumnOffset", &ImGui::SetColumnOffset);
    emscripten::function("GetColumnsCount", &ImGui::GetColumnsCount);
    emscripten::function("BeginTabBar", FUNCTION(bool, (std::string str_id, ImGuiTabBarFlags flags), { return ImGui::BeginTabBar(str_id.c_str(), flags); }));
    emscripten::function("EndTabBar", &ImGui::EndTabBar);
    emscripten::function("BeginTabItem", FUNCTION(bool, (std::string label, emscripten::val p_open, ImGuiTabItemFlags flags), { return ImGui::BeginTabItem(label.c_str(), access_maybe_null_value<bool>(p_open), flags); }));
    emscripten::function("EndTabItem", &ImGui::EndTabItem);
    emscripten::function("TabItemButton", FUNCTION(bool, (std::string label, ImGuiTabItemFlags flags), { return ImGui::TabItemButton(label.c_str(), flags); }));
    emscripten::function("SetTabItemClosed", FUNCTION(void, (std::string tab_or_docked_window_label), { ImGui::SetTabItemClosed(tab_or_docked_window_label.c_str()); }));
    emscripten::function("LogToTTY", &ImGui::LogToTTY);

    emscripten::function("LogToClipboard", &ImGui::LogToClipboard);
    emscripten::function("LogFinish", &ImGui::LogFinish);
    emscripten::function("LogButtons", &ImGui::LogButtons);
    emscripten::function("LogText", FUNCTION(void, (std::string fmt), { ImGui::LogText("%s", fmt.c_str()); }));
    emscripten::function("BeginDragDropSource", &ImGui::BeginDragDropSource);
    emscripten::function("SetDragDropPayload", FUNCTION(bool, (std::string type, ImGuiCond cond), {
        if (type.empty() || type.size() >= 32 || type.find('\0') != std::string::npos) binding_error("Payload type must contain 1 to 31 UTF-8 bytes without NUL");
        if (cond != 0 && cond != ImGuiCond_Always && cond != ImGuiCond_Once) binding_error("Payload condition must be Always or Once");
        const int token = 1;
        return ImGui::SetDragDropPayload(type.c_str(), &token, sizeof(token), cond);
    }));
    emscripten::function("EndDragDropSource", &ImGui::EndDragDropSource);
    emscripten::function("BeginDragDropTarget", &ImGui::BeginDragDropTarget);
    emscripten::function("AcceptDragDropPayload", FUNCTION(bool, (std::string type, ImGuiDragDropFlags flags), { return ImGui::AcceptDragDropPayload(type.c_str(), flags) != NULL; }));
    emscripten::function("EndDragDropTarget", &ImGui::EndDragDropTarget);
    emscripten::function("GetDragDropPayload", FUNCTION(emscripten::val, (), { const ImGuiPayload* payload = ImGui::GetDragDropPayload(); return payload ? emscripten::val(std::string(payload->DataType)) : emscripten::val::null(); }));
    emscripten::function("BeginDisabled", &ImGui::BeginDisabled);
    emscripten::function("EndDisabled", &ImGui::EndDisabled);
    emscripten::function("PushClipRect", FUNCTION(void, (emscripten::val clip_rect_min, emscripten::val clip_rect_max, bool intersect_with_current_clip_rect), {
        return ImGui::PushClipRect(import_ImVec2(clip_rect_min), import_ImVec2(clip_rect_max), intersect_with_current_clip_rect);
    }));
    emscripten::function("PopClipRect", &ImGui::PopClipRect);
    emscripten::function("SetItemDefaultFocus", &ImGui::SetItemDefaultFocus);
    emscripten::function("SetKeyboardFocusHere", &ImGui::SetKeyboardFocusHere);
    emscripten::function("IsItemHovered", &ImGui::IsItemHovered);
    emscripten::function("IsItemActive", &ImGui::IsItemActive);
    emscripten::function("IsItemFocused", &ImGui::IsItemFocused);
    emscripten::function("IsItemClicked", &ImGui::IsItemClicked);
    emscripten::function("IsItemVisible", &ImGui::IsItemVisible);
    emscripten::function("IsItemEdited", &ImGui::IsItemEdited);
    emscripten::function("IsItemActivated", &ImGui::IsItemActivated);
    emscripten::function("IsItemDeactivated", &ImGui::IsItemDeactivated);
    emscripten::function("IsItemDeactivatedAfterEdit", &ImGui::IsItemDeactivatedAfterEdit);
    emscripten::function("IsItemToggledOpen", &ImGui::IsItemToggledOpen);
    emscripten::function("IsAnyItemHovered", &ImGui::IsAnyItemHovered);
    emscripten::function("IsAnyItemActive", &ImGui::IsAnyItemActive);
    emscripten::function("IsAnyItemFocused", &ImGui::IsAnyItemFocused);
    emscripten::function("GetItemRectMin", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetItemRectMin(), out); }));
    emscripten::function("GetItemRectMax", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetItemRectMax(), out); }));
    emscripten::function("GetItemRectSize", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetItemRectSize(), out); }));
    emscripten::function("SetNextItemAllowOverlap", &ImGui::SetNextItemAllowOverlap);
    emscripten::function("GetMainViewport", FUNCTION(emscripten::val, (), { ImGuiViewport* p = ImGui::GetMainViewport(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("IsRectVisible_A", FUNCTION(bool, (emscripten::val size), { return ImGui::IsRectVisible(import_ImVec2(size)); }));
    emscripten::function("IsRectVisible_B", FUNCTION(bool, (emscripten::val rect_min, emscripten::val rect_max), { return ImGui::IsRectVisible(import_ImVec2(rect_min), import_ImVec2(rect_max)); }));
    emscripten::function("GetTime", &ImGui::GetTime);
    emscripten::function("GetFrameCount", &ImGui::GetFrameCount);
    emscripten::function("GetBackgroundDrawList", FUNCTION(emscripten::val, (), { ImDrawList* p = ImGui::GetBackgroundDrawList(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("GetForegroundDrawList", FUNCTION(emscripten::val, (), { ImDrawList* p = ImGui::GetForegroundDrawList(); return borrow(p); }), emscripten::allow_raw_pointers());
    emscripten::function("GetStyleColorName", FUNCTION(std::string, (ImGuiCol idx), { return std::string(ImGui::GetStyleColorName(idx)); }));

    emscripten::function("CalcTextSize", FUNCTION(emscripten::val, (std::string text, bool hide_text_after_double_hash, float wrap_width, emscripten::val out), {
        return export_ImVec2(ImGui::CalcTextSize(text.c_str(), NULL, hide_text_after_double_hash, wrap_width), out);
    }));
    emscripten::function("ColorConvertU32ToFloat4", FUNCTION(emscripten::val, (ImU32 in, emscripten::val out), { return export_ImVec4(ImGui::ColorConvertU32ToFloat4(in), out); }));
    emscripten::function("ColorConvertFloat4ToU32", FUNCTION(ImU32, (emscripten::val in), { return ImGui::ColorConvertFloat4ToU32(import_ImVec4(in)); }));
    emscripten::function("ColorConvertRGBtoHSV", FUNCTION(void, (float r, float g, float b, emscripten::val out_h, emscripten::val out_s, emscripten::val out_v), {
        ImGui::ColorConvertRGBtoHSV(r, g, b, access_value<float>(out_h), access_value<float>(out_s), access_value<float>(out_v));
    }));
    emscripten::function("ColorConvertHSVtoRGB", FUNCTION(void, (float h, float s, float v, emscripten::val out_r, emscripten::val out_g, emscripten::val out_b), {
        ImGui::ColorConvertHSVtoRGB(h, s, v, access_value<float>(out_r), access_value<float>(out_g), access_value<float>(out_b));
    }));

    emscripten::function("IsKeyDown", &ImGui::IsKeyDown);
    emscripten::function("IsKeyPressed", &ImGui::IsKeyPressed);
    emscripten::function("IsKeyReleased", &ImGui::IsKeyReleased);
    emscripten::function("GetKeyPressedAmount", &ImGui::GetKeyPressedAmount);

    emscripten::function("IsMouseDown", &ImGui::IsMouseDown);
    emscripten::function("IsMouseClicked", &ImGui::IsMouseClicked);
    emscripten::function("IsMouseReleased", &ImGui::IsMouseReleased);
    emscripten::function("IsMouseDoubleClicked", &ImGui::IsMouseDoubleClicked);
    emscripten::function("GetMouseClickedCount", &ImGui::GetMouseClickedCount);
    emscripten::function("IsMouseHoveringRect", FUNCTION(bool, (emscripten::val r_min, emscripten::val r_max, bool clip), { return ImGui::IsMouseHoveringRect(import_ImVec2(r_min), import_ImVec2(r_max), clip); }));
    emscripten::function("IsMousePosValid", FUNCTION(bool, (emscripten::val mouse_pos), { return ImGui::IsMousePosValid(import_maybe_null_value<ImVec2>(mouse_pos)); }));
    emscripten::function("IsAnyMouseDown", &ImGui::IsAnyMouseDown);
    emscripten::function("GetMousePos", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetMousePos(), out); }));
    emscripten::function("GetMousePosOnOpeningCurrentPopup", FUNCTION(emscripten::val, (emscripten::val out), { return export_ImVec2(ImGui::GetMousePosOnOpeningCurrentPopup(), out); }));
    emscripten::function("IsMouseDragging", &ImGui::IsMouseDragging);
    emscripten::function("GetMouseDragDelta", FUNCTION(emscripten::val, (int button, float lock_threshold, emscripten::val out), { return export_ImVec2(ImGui::GetMouseDragDelta(button, lock_threshold), out); }));
    emscripten::function("ResetMouseDragDelta", &ImGui::ResetMouseDragDelta);
    emscripten::function("GetMouseCursor", &ImGui::GetMouseCursor);
    emscripten::function("SetMouseCursor", &ImGui::SetMouseCursor);

    emscripten::function("GetClipboardText", FUNCTION(std::string, (), { const char* text = ImGui::GetClipboardText(); return (text != NULL) ? text : ""; }));
    emscripten::function("SetClipboardText", FUNCTION(void, (emscripten::val text), { ImGui::SetClipboardText(text.as<std::string>().c_str()); }));
    emscripten::function("LoadIniSettingsFromMemory", FUNCTION(void, (std::string ini_data), { ImGui::LoadIniSettingsFromMemory(ini_data.c_str()); }));
    emscripten::function("SaveIniSettingsToMemory", FUNCTION(std::string, (), { return ImGui::SaveIniSettingsToMemory(); }));
    emscripten::function("DebugCheckVersionAndDataLayout", FUNCTION(bool, (std::string version_str, size_t sz_io, size_t sz_style, size_t sz_vec2, size_t sz_vec4, size_t sz_drawvert, size_t sz_drawidx), {
        return ImGui::DebugCheckVersionAndDataLayout(version_str.c_str(), sz_io, sz_style, sz_vec2, sz_vec4, sz_drawvert, sz_drawidx);
    }));

}

EMSCRIPTEN_BINDINGS(ImGuiTextFilter) {
    emscripten::class_<ImGuiTextFilter>("ImGuiTextFilter")
        .constructor(+[](const std::string& filter) { return new ImGuiTextFilter(filter.c_str()); }, emscripten::allow_raw_pointers())
        .function("Draw", FUNCTION(bool, (ImGuiTextFilter& that, const std::string& label), { return that.Draw(label.c_str()); }))
        .function("SetFilter", FUNCTION(void, (ImGuiTextFilter& that, const std::string& text), {
            snprintf(that.InputBuf, sizeof(that.InputBuf), "%s", text.c_str()); that.Build();
        }))
        .function("PassFilter", FUNCTION(bool, (ImGuiTextFilter& that, const std::string& text), { return that.PassFilter(text.c_str()); }))
        CLASS_METHOD(ImGuiTextFilter, Clear)
        CLASS_METHOD(ImGuiTextFilter, IsActive)
    ;
}
EMSCRIPTEN_BINDINGS(ImDrawListSplitter) {
    emscripten::class_<ImDrawListSplitter>("ImDrawListSplitter")
        .constructor()
        CLASS_METHOD(ImDrawListSplitter, Clear)
        .function("Split", &ImDrawListSplitter::Split, emscripten::allow_raw_pointers())
        .function("Merge", &ImDrawListSplitter::Merge, emscripten::allow_raw_pointers())
        .function("SetCurrentChannel", &ImDrawListSplitter::SetCurrentChannel, emscripten::allow_raw_pointers())
    ;
}

EMSCRIPTEN_BINDINGS(selection) {
    emscripten::value_object<ImGuiSelectionRequest>("ImGuiSelectionRequest")
        .field("Type", &ImGuiSelectionRequest::Type)
        .field("Selected", &ImGuiSelectionRequest::Selected)
        .field("RangeDirection", &ImGuiSelectionRequest::RangeDirection)
        .field("RangeFirstItem", &ImGuiSelectionRequest::RangeFirstItem)
        .field("RangeLastItem", &ImGuiSelectionRequest::RangeLastItem);
    emscripten::class_<ImGuiMultiSelectIO>("ImGuiMultiSelectIO")
        CLASS_MEMBER(ImGuiMultiSelectIO, RangeSrcItem)
        CLASS_MEMBER(ImGuiMultiSelectIO, NavIdItem)
        CLASS_MEMBER(ImGuiMultiSelectIO, NavIdSelected)
        CLASS_MEMBER(ImGuiMultiSelectIO, RangeSrcReset)
        CLASS_MEMBER(ImGuiMultiSelectIO, ItemsCount)
        .function("GetRequests", FUNCTION(emscripten::val, (const ImGuiMultiSelectIO& that), {
            auto requests = emscripten::val::array();
            for (const auto& request : that.Requests) requests.call<void>("push", emscripten::val(request));
            return requests;
        }));
    emscripten::function("BeginMultiSelect", &ImGui::BeginMultiSelect, emscripten::return_value_policy::reference());
    emscripten::function("EndMultiSelect", &ImGui::EndMultiSelect, emscripten::return_value_policy::reference());
    emscripten::function("SetNextItemSelectionUserData", &ImGui::SetNextItemSelectionUserData);
    emscripten::function("IsItemToggledSelection", &ImGui::IsItemToggledSelection);
    emscripten::function("GetFontBaked", &ImGui::GetFontBaked, emscripten::return_value_policy::reference());
    emscripten::function("PushItemFlag", &ImGui::PushItemFlag);
    emscripten::function("PopItemFlag", &ImGui::PopItemFlag);
    emscripten::function("SetNextFrameWantCaptureKeyboard", &ImGui::SetNextFrameWantCaptureKeyboard);
    emscripten::function("SetNextFrameWantCaptureMouse", &ImGui::SetNextFrameWantCaptureMouse);
    emscripten::function("BeginItemTooltip", &ImGui::BeginItemTooltip);
    emscripten::function("SetItemTooltip", FUNCTION(void, (const std::string& text), { ImGui::SetItemTooltip("%s", text.c_str()); }));
    emscripten::function("Shortcut", &ImGui::Shortcut);
    emscripten::function("SetNextItemShortcut", &ImGui::SetNextItemShortcut);
    emscripten::function("IsKeyChordPressed", &ImGui::IsKeyChordPressed);
}
