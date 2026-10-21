#/bin/bash

set -e # Fail on error

# Build
clang src/main.c `pkg-config --libs --cflags raylib` -o swissterrain3d

#Run
./swissterrain3d
