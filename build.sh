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

if [ "$1" = "release" ] || [ "$1" = "--release" ] || [ "$1" = "-release" ]; then
    build_release
elif [ "$1" = "debug" ] || [ "$1" = "--debug" ] || [ "$1" = "-debug" ]; then
    build_debug
    ./swissterrain3d
else
    echo "No build mode specified, starting debug build"
    build_debug
    ./swissterrain3d
fi



