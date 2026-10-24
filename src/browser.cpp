#define SDL_MAIN_HANDLED
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <GLES3/gl3.h>
#include <emscripten/bind.h>
#include "imgui.h"
#include "imgui_impl_sdl3.h"
#include "imgui_impl_opengl3.h"
#include <string>
#include <unordered_set>
#include <vector>

namespace {
SDL_Window* window = nullptr;
SDL_GLContext gl_context = nullptr;
bool platform_ready = false;
bool renderer_ready = false;
std::unordered_set<GLuint> textures;
std::string clipboard;
emscripten::val clipboard_writer = emscripten::val::undefined();

[[noreturn]] void fail(const char* message) { emscripten::val::global("Error").new_(std::string(message)).throw_(); }

ImTextureID create_texture(emscripten::val pixels, int width, int height) {
    GLint maximum = 0;
    glGetIntegerv(GL_MAX_TEXTURE_SIZE, &maximum);
    if (width <= 0 || height <= 0 || width > maximum || height > maximum) fail("Texture dimensions exceed WebGL2 limits");
    const size_t length = static_cast<size_t>(width) * height * 4;
    if (pixels["byteLength"].as<size_t>() != length) fail("Expected width * height * 4 RGBA bytes");
    std::vector<unsigned char> bytes(length);
    emscripten::val(emscripten::typed_memory_view(length, bytes.data())).call<void>("set", pixels);
    GLint binding, alignment, row_length, skip_rows, skip_pixels;
    glGetIntegerv(GL_TEXTURE_BINDING_2D, &binding);
    glGetIntegerv(GL_UNPACK_ALIGNMENT, &alignment);
    glGetIntegerv(GL_UNPACK_ROW_LENGTH, &row_length);
    glGetIntegerv(GL_UNPACK_SKIP_ROWS, &skip_rows);
    glGetIntegerv(GL_UNPACK_SKIP_PIXELS, &skip_pixels);
    GLuint texture = 0;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glPixelStorei(GL_UNPACK_SKIP_ROWS, 0);
    glPixelStorei(GL_UNPACK_SKIP_PIXELS, 0);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, bytes.data());
    const GLenum error = glGetError();
    glBindTexture(GL_TEXTURE_2D, binding);
    glPixelStorei(GL_UNPACK_ALIGNMENT, alignment);
    glPixelStorei(GL_UNPACK_ROW_LENGTH, row_length);
    glPixelStorei(GL_UNPACK_SKIP_ROWS, skip_rows);
    glPixelStorei(GL_UNPACK_SKIP_PIXELS, skip_pixels);
    if (error != GL_NO_ERROR || texture == 0) { glDeleteTextures(1, &texture); fail("WebGL2 texture upload failed"); }
    textures.insert(texture);
    return static_cast<ImTextureID>(texture);
}

void destroy_texture(ImTextureID id) {
    const auto found = textures.find(static_cast<GLuint>(id));
    if (id > UINT32_MAX || found == textures.end()) fail("Texture is not owned by this runtime, or was already destroyed");
    GLuint texture = *found;
    glDeleteTextures(1, &texture);
    textures.erase(found);
}

void shutdown_browser() {
    if (gl_context) SDL_GL_MakeCurrent(window, gl_context);
    for (GLuint texture : textures) glDeleteTextures(1, &texture);
    textures.clear();
    if (renderer_ready) ImGui_ImplOpenGL3_Shutdown();
    if (platform_ready) ImGui_ImplSDL3_Shutdown();
    renderer_ready = platform_ready = false;
    clipboard.clear();
    clipboard_writer = emscripten::val::undefined();
    if (gl_context) SDL_GL_DestroyContext(gl_context);
    if (window) SDL_DestroyWindow(window);
    gl_context = nullptr;
    window = nullptr;
    SDL_Quit();
}

std::string init_browser(const std::string& selector, int width, int height) {
    if (window) return "SDL3 is already initialized";
    SDL_SetMainReady();
    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD)) return SDL_GetError();
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 0);
    SDL_PropertiesID properties = SDL_CreateProperties();
    SDL_SetStringProperty(properties, SDL_PROP_WINDOW_CREATE_EMSCRIPTEN_CANVAS_ID_STRING, selector.c_str());
    SDL_SetStringProperty(properties, SDL_PROP_WINDOW_CREATE_EMSCRIPTEN_KEYBOARD_ELEMENT_STRING, selector.c_str());
    SDL_SetNumberProperty(properties, SDL_PROP_WINDOW_CREATE_WIDTH_NUMBER, width);
    SDL_SetNumberProperty(properties, SDL_PROP_WINDOW_CREATE_HEIGHT_NUMBER, height);
    SDL_SetBooleanProperty(properties, SDL_PROP_WINDOW_CREATE_OPENGL_BOOLEAN, true);
    SDL_SetBooleanProperty(properties, SDL_PROP_WINDOW_CREATE_HIGH_PIXEL_DENSITY_BOOLEAN, true);
    SDL_SetBooleanProperty(properties, SDL_PROP_WINDOW_CREATE_RESIZABLE_BOOLEAN, true);
    window = SDL_CreateWindowWithProperties(properties);
    SDL_DestroyProperties(properties);
    if (window) gl_context = SDL_GL_CreateContext(window);
    if (gl_context) platform_ready = ImGui_ImplSDL3_InitForOpenGL(window, gl_context);
    if (platform_ready) renderer_ready = ImGui_ImplOpenGL3_Init("#version 300 es");
    if (!renderer_ready) {
        const std::string error = std::string("SDL3/WebGL2 initialization failed: ") + SDL_GetError();
        shutdown_browser();
        return error;
    }
    ImGui::GetIO().IniFilename = nullptr;
    auto& platform = ImGui::GetPlatformIO();
    platform.Platform_GetClipboardTextFn = +[](ImGuiContext*) { return clipboard.c_str(); };
    platform.Platform_SetClipboardTextFn = +[](ImGuiContext*, const char* text) {
        clipboard = text ? text : "";
        if (!clipboard_writer.isUndefined()) clipboard_writer(clipboard);
    };
    return "";
}

void new_frame() {
    SDL_GL_MakeCurrent(window, gl_context);
    SDL_Event event;
    while (SDL_PollEvent(&event)) ImGui_ImplSDL3_ProcessEvent(&event);
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();
}

void render_frame() {
    ImGui::Render();
    int width, height;
    SDL_GetWindowSizeInPixels(window, &width, &height);
    glViewport(0, 0, width, height);
    glClearColor(0.10f, 0.10f, 0.10f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    SDL_GL_SwapWindow(window);
}
}

EMSCRIPTEN_BINDINGS(browser) {
    emscripten::function("BrowserInit", &init_browser);
    emscripten::function("BrowserNewFrame", &new_frame);
    emscripten::function("BrowserRender", &render_frame);
    emscripten::function("BrowserShutdown", &shutdown_browser);
    emscripten::function("BrowserCreateTexture", &create_texture);
    emscripten::function("BrowserDestroyTexture", &destroy_texture);
    emscripten::function("BrowserResize", +[](int width, int height) { SDL_SetWindowSize(window, width, height); });
    emscripten::function("BrowserSetClipboardWriter", +[](emscripten::val writer) { clipboard_writer = writer; });
    emscripten::function("BrowserFocus", +[](bool focused) {
        auto& io = ImGui::GetIO();
        if (!focused) { SDL_ResetKeyboard(); io.ClearInputKeys(); io.ClearInputMouse(); }
        io.AddFocusEvent(focused);
    });
    emscripten::function("BrowserPaste", +[](const std::string& text, bool modifier_down) {
        clipboard = text;
        auto& io = ImGui::GetIO();
        const ImGuiKey modifier = io.ConfigMacOSXBehaviors ? ImGuiMod_Super : ImGuiMod_Ctrl;
        io.AddKeyEvent(modifier, true);
        io.AddKeyEvent(ImGuiKey_V, true);
        io.AddKeyEvent(ImGuiKey_V, false);
        if (!modifier_down) io.AddKeyEvent(modifier, false);
    });
}
