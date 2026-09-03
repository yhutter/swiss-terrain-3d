<div class="center">
    <h1>Swiss Terrain 3D</h1>
</div>

Implementation of a 3D Terrain Renderer based on the `CDLOD Algrotihm` using the `SDL Framework` and the Swisstopo Dataset.

## Prerequisites
> :warning: Make sure you have the following installed on your system:
- CMake `v3.2 or higher`. Can be installed from [here](https://cmake.org/download/)
- C Compiler `Clang, GCC or MSVC`
- `sokol-shdc` is required if you want to recompile the Shaders. Binaries can be downloaded from [here](https://github.com/floooh/sokol-tools-bin). The source code can be found [here](https://github.com/floooh/sokol-tools/tree/master).

## Dataset
The project uses the Swisstopo dataset `ALTI3D` as well as `SWISSIMAGE` for terrain data. You can download the dataset from the official swisstopo website. For example the `ALTI3D` dataset can be found [here](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) whereas the `SWISSIMAGE` dataset is available under the following [link](https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm).

## Ressources
- [Sokol + Cimgui Starter Template](https://github.com/floooh/cimgui-sokol-starterkit)
- [sokol-shdc](https://github.com/floooh/sokol-tools/tree/master)
- [Sokol Examples Repo](https://github.com/floooh/sokol-samples)
- [Sokol Examples WebGL2](https://floooh.github.io/sokol-html5/index.html)

## Libraries
The following Libraries are used:
- [Sokol](https://github.com/floooh/sokol)

## How to build and run

```bash
git clone https://github.com/yhutter/swiss-terrain-3d --depth=1
cd swiss-terrain-3d
chmod +x ./build.sh
./build.sh -release # Release Build
./build.sh -debug # Debug Build
./build.sh # Calling without any arguments will also trigger Debug Build
```

