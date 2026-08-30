cmake_minimum_required(VERSION 3.30)
project(swissterrain3d)

set(IMGUI_FILES
    src/vendored/imgui/imgui.cpp
    src/vendored/imgui/imgui_demo.cpp
    src/vendored/imgui/imgui_draw.cpp
    src/vendored/imgui/imgui_tables.cpp
    src/vendored/imgui/imgui_widgets.cpp
    src/vendored/imgui/backends/imgui_impl_sdl3.cpp
    src/vendored/imgui/backends/imgui_impl_sdlgpu3.cpp)

include_directories(swissterrain3d AFTER src/vendored/imgui)
include_directories(swissterrain3d AFTER src/vendored/imgui/backends)

add_subdirectory(src/vendored/SDL EXCLUDE_FROM_ALL)

set(SDLTTF_VENDORED ON)
add_subdirectory(src/vendored/SDL_ttf EXCLUDE_FROM_ALL)

add_executable(swissterrain3d src/main.cpp ${IMGUI_FILES})
target_link_libraries(swissterrain3d PRIVATE SDL3::SDL3 SDL3_ttf::SDL3_ttf)
