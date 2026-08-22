#!/bin/bash

build_release() {
    mkdir -p $1
    cd $1

    echo "Building release build in $1..."
    cmake -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel ..  
    cmake --build . -j16 
    echo "Done! check executable in $1"
}

build_debug() {
    mkdir -p $1
    cd $1

    echo "Building debug build in $1..."
    cmake -G Ninja -DCMAKE_BUILD_TYPE=Debug ..  
    cmake --build . -j16 
    echo "Done! check executable in $1"
}

if [ "$1" = "release" ] || [ "$1" = "--release" ] || [ "$1" = "-release" ]; then
    build_release "./build_release"
elif [ "$1" = "debug" ] || [ "$1" = "--debug" ] || [ "$1" = "-debug" ]; then
    build_debug "./build_debug"
else
    echo "Got no arguments...starting debug build"
    build_debug "./build_debug"
fi



