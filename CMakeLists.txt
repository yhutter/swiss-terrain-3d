cmake_minimum_required(VERSION 3.5)
project(swissterrain3d)
add_subdirectory(src/vendored/SDL EXCLUDE_FROM_ALL)

add_executable(swissterrain3d src/main.c)
target_link_libraries(swissterrain3d PRIVATE SDL3::SDL3)

