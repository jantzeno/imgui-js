set_xmakever("3.1.2")
set_project("imgui-js")
set_version("2.0.0")
set_languages("c++17")
add_rules("mode.debug", "mode.release")
set_allowedplats("wasm")
set_allowedarchs("wasm32")
set_policy("package.requires_lock", true)

package("libsdl3-web")
    set_base("libsdl3")
    add_versions("archive:3.4.18", "9cd42377704398796071b8597cd7e21da254a43bad98c4199739647adc13fa6f")
    add_versions("github:3.4.18", "release-3.4.18")
    on_install("wasm", function (package)
        -- The upstream recipe's Wasm installer iterates a nil dependency list.
        import("package.tools.cmake").install(package, {
            "-DCMAKE_BUILD_TYPE=" .. (package:is_debug() and "Debug" or "Release"),
            "-DSDL_SHARED=OFF", "-DSDL_STATIC=ON", "-DSDL_TEST_LIBRARY=OFF",
            "-DSDL_TESTS=OFF", "-DSDL_EXAMPLES=OFF", "-DSDL_PTHREADS=OFF"
        }, {cflags = {"-sUSE_SDL=0"}})
    end)
package_end()

package("plutosvg-fonts")
    set_base("plutosvg")
    add_deps("cmake", "plutovg v1.3.3")
    add_deps("freetype 2.14.1", {configs = {png = true}})
    on_install(function (package)
        import("package.tools.cmake").install(package, {
            "-DCMAKE_BUILD_TYPE=" .. (package:is_debug() and "Debug" or "Release"),
            "-DBUILD_SHARED_LIBS=OFF", "-DPLUTOSVG_BUILD_EXAMPLES=OFF",
            "-DPLUTOSVG_ENABLE_FREETYPE=ON"
        })
    end)
package_end()

add_requires("libsdl3-web 3.4.18", {system = false})
add_requires("freetype 2.14.1", {system = false, configs = {png = true}})
add_requires("plutosvg-fonts v0.0.8", {system = false})

target("bind-imgui")
    set_kind("binary")
    set_filename("bind-imgui.js")
    set_targetdir("dist")
    add_packages("libsdl3-web", "freetype", "plutosvg-fonts")
    add_includedirs("imgui", "imgui/backends", "build/generated")
    add_files("src/bind-imgui.cpp", "src/browser.cpp")
    add_files("imgui/imgui.cpp", "imgui/imgui_draw.cpp", "imgui/imgui_widgets.cpp",
              "imgui/imgui_tables.cpp", "imgui/imgui_demo.cpp")
    add_files("imgui/backends/imgui_impl_sdl3.cpp", "imgui/backends/imgui_impl_opengl3.cpp")
    add_files("imgui/misc/freetype/imgui_freetype.cpp")
    add_defines("IMGUI_DISABLE_OBSOLETE_FUNCTIONS", "IMGUI_USE_WCHAR32", "IMGUI_IMPL_OPENGL_ES3")
    add_defines("IMGUI_ENABLE_FREETYPE", "IMGUI_ENABLE_FREETYPE_PLUTOSVG")
    add_ldflags("-lembind", "--no-entry", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
                "-sALLOW_MEMORY_GROWTH=1", "-sMIN_WEBGL_VERSION=2", "-sMAX_WEBGL_VERSION=2",
                "-sEXPORTED_FUNCTIONS=_malloc,_free",
                "-sEXPORTED_RUNTIME_METHODS=requestFullscreen",
                "-sINCOMING_MODULE_JS_API=canvas,locateFile,wasmBinary,print,printErr,onAbort",
                "--emit-tsd bind-imgui.d.ts", {force = true})
    if is_mode("debug") then
        add_ldflags("-sASSERTIONS=1", "-sSTACK_OVERFLOW_CHECK=2", {force = true})
    end
