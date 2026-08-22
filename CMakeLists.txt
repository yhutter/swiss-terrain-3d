# CMake File based on https://github.com/floooh/cimgui-sokol-starterkit
cmake_minimum_required(VERSION 3.20)
project(swiss-terrain-3d)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 11)
# Linux -pthread shenanigans
if (CMAKE_SYSTEM_NAME STREQUAL Linux)
    set(THREADS_PREFER_PTHREAD_FLAG ON)
    find_package(Threads REQUIRED)
endif()

#=== LIBRARY: cimgui + Dear ImGui
add_library(cimgui STATIC
    src/vendored/cimgui/cimgui.cpp
    src/vendored/cimgui/cimgui.h
    src/vendored/cimgui/imgui.cpp
    src/vendored/cimgui/imgui.h
    src/vendored/cimgui/imgui_widgets.cpp
    src/vendored/cimgui/imgui_draw.cpp
    src/vendored/cimgui/imgui_tables.cpp
    src/vendored/cimgui/imgui_demo.cpp)
target_include_directories(cimgui INTERFACE src/vendored/cimgui)

#=== LIBRARY: sokol
# add headers to the the file list because they are useful to have in IDEs
set(SOKOL_HEADERS
    src/vendored/sokol/sokol_gfx.h
    src/vendored/sokol/sokol_app.h
    src/vendored/sokol/sokol_imgui.h
    src/vendored/sokol/sokol_glue.h)
if(CMAKE_SYSTEM_NAME STREQUAL Darwin)
    add_library(sokol STATIC src/vendored/sokol/sokol.c ${SOKOL_HEADERS})
    target_compile_options(sokol PRIVATE -x objective-c)
    target_link_libraries(sokol PUBLIC
        "-framework QuartzCore"
        "-framework Cocoa"
        "-framework Metal")
else()
    add_library(sokol STATIC src/vendored/sokol/sokol.c ${SOKOL_HEADERS})
    if (CMAKE_SYSTEM_NAME STREQUAL Linux)
        target_link_libraries(sokol INTERFACE X11 Xi Xcursor GL dl m)
        target_link_libraries(sokol PUBLIC Threads::Threads)
    endif()
endif()
target_link_libraries(sokol PUBLIC cimgui)
target_include_directories(sokol INTERFACE src/vendored/sokol)

#=== EXECUTABLE: swiss-terrain-3d
if(CMAKE_SYSTEM_NAME STREQUAL Windows)
    add_executable(swiss-terrain-3d WIN32 src/main.c)
    set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY VS_STARTUP_PROJECT swiss-terrain-3d)
else()
    add_executable(swiss-terrain-3d src/main.c)
endif()
target_link_libraries(swiss-terrain-3d sokol)

# Emscripten-specific linker options
if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    set(CMAKE_EXECUTABLE_SUFFIX ".html")
    # use our own minimal shell.html
    target_link_options(swiss-terrain-3d PRIVATE --shell-file src/vendored/sokol/shell.html)
    # link with WebGL2
    target_link_options(swiss-terrain-3d PRIVATE -sUSE_WEBGL2=1)
    # WASM+JS size optimizations
    target_link_options(swiss-terrain-3d PRIVATE -sNO_FILESYSTEM=1 -sASSERTIONS=0 -sMALLOC=emmalloc --closure=1)
endif()

# explicitly strip dead code
if (CMAKE_C_COMPILER_ID MATCHES "Clang" AND NOT CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    target_link_options(swiss-terrain-3d PRIVATE LINKER:-dead_strip)
endif()

# this hack removes the xxx-CMakeForceLinker.cxx dummy file
set_target_properties(swiss-terrain-3d PROPERTIES LINKER_LANGUAGE C)
