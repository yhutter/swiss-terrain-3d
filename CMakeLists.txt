cmake_minimum_required(VERSION 3.10)
project(swissterrain3d)

set(CMAKE_BUILD_TYPE Debug)

set(SDL_SHARED OFF)
set(SDL_STATIC ON)

add_subdirectory(src/vendored/SDL EXCLUDE_FROM_ALL)

add_executable(swissterrain3d src/main.c)
target_link_libraries(swissterrain3d PRIVATE SDL3::SDL3-static)

