#!/bin/bash

set -e

build_release() {
    mkdir -p build
    cd build
    echo "Building release build..."
    cmake -DCMAKE_BUILD_TYPE=MinSizeRel ..
    cmake --build . -j16
    echo "Done."
}

build_debug() {
    mkdir -p build
    cd build
    echo "Building debug build..."
    cmake -DCMAKE_BUILD_TYPE=Debug .. 
    cmake --build . -j16
    echo "Done."
}

recompile_shaders() {
    echo "Recompiling shaders..."
    sokol-shdc --input ./src/assets/shaders/swissterrain3d.glsl --output ./src/shader.h --slang glsl430:hlsl5:metal_macos
}

if [ "$1" = "release" ] || [ "$1" = "--release" ] || [ "$1" = "-release" ]; then
    recompile_shaders
    build_release
elif [ "$1" = "debug" ] || [ "$1" = "--debug" ] || [ "$1" = "-debug" ]; then
    recompile_shaders
    build_debug
    ./swissterrain3d
else
    echo "No build mode specified, starting debug build"
    recompile_shaders
    build_debug
    ./swissterrain3d
fi



