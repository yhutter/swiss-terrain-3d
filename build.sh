#!/bin/bash

set -e

build_release() {
    mkdir -p build
    echo "Building release build..."
    cmake -S . -B build -G Ninja
    cmake --build build --config Release -j16
    echo "Done."
}

build_debug() {
    mkdir -p build
    echo "Building debug build..."
    cmake -S . -B build -G Ninja
    cmake --build build --config Debug -j16
    echo "Done."
}

if [ "$1" = "release" ] || [ "$1" = "--release" ] || [ "$1" = "-release" ]; then
    build_release
elif [ "$1" = "debug" ] || [ "$1" = "--debug" ] || [ "$1" = "-debug" ]; then
    build_debug
    ./build/swissterrain3d
else
    echo "No build mode specified, starting debug build"
    build_debug
    ./build/swissterrain3d
fi



