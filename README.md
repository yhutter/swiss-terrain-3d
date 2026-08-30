<div class="center">
    <h1>Swiss Terrain 3D</h1>
    <img src="./assets/screenshot_01.png" alt="Screenshot 01"/>
</div>

Implementation of a 3D Terrain Renderer based on the `CDLOD Algrotihm` using the `SDL Framework` and the Swisstopo Dataset.

## Prerequisites
> :warning: Make sure you have the following installed on your system:
- CMake `v3.5 or higher`. Can be installed from [here](https://cmake.org/download/)
- Ninja build tool. Can be installed from [here](https://github.com/ninja-build/ninja/releases)
- C Compiler `Clang, GCC or MSVC`

## Dataset
The project uses the Swisstopo dataset `ALTI3D` as well as `SWISSIMAGE` for terrain data. You can download the dataset from the official swisstopo website. For example the `ALTI3D` dataset can be found [here](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) whereas the `SWISSIMAGE` dataset is available under the following [link](https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm).

## Ressources
- [SDL3 CMake Guide](https://wiki.libsdl.org/SDL3/README-cmake)
- [SDL3 API Guide](https://wiki.libsdl.org/SDL3/CategoryAPI)
- [SDL3 GPU Guide](https://www.jonathanfischer.net/gpu-by-example-part1/)
- [GPU for Beginners](https://gpuforbeginners.com/)
- [ImGui SDL3 Example](https://github.com/ocornut/imgui/blob/master/examples/example_sdl3_sdlgpu3/main.cpp)

## Libraries
The following Libraries are used:
- [SDL3](https://github.com/libsdl-org/SDL)
- [Imgui](https://github.com/ocornut/imgui)

## How to build and run

```bash
git clone https://github.com/yhutter/swiss-terrain-3d --depth=1 --recurse-submodules
cd swiss-terrain-3d
git submodule update --init --recursive
chmod +x ./build.sh
./build.sh -release # Release Build
./build.sh -debug # Debug Build
./build.sh # Calling without any arguments will also trigger Debug Build
```

