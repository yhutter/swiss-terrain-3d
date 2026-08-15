cmake_minimum_required(VERSION 3.30)
project(swissterrain3d)

set(CMAKE_BUILD_TYPE Debug)

add_subdirectory(src/vendored/SDL EXCLUDE_FROM_ALL)

set(SDLTTF_VENDORED ON)
add_subdirectory(src/vendored/SDL_ttf EXCLUDE_FROM_ALL)

add_executable(swissterrain3d src/main.c)
target_link_libraries(swissterrain3d PRIVATE SDL3::SDL3 SDL3_ttf::SDL3_ttf)

# Copy over assets directory
add_custom_command(TARGET swissterrain3d POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_SOURCE_DIR}/src/assets
        $<TARGET_FILE_DIR:swissterrain3d>/assets
)
