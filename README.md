<div class="center">
    <h1>Swiss Terrain 3D</h1>
    <img src="./assets/screenshot_01.png" alt="Screenshot 01"/>
</div>

Implementation of a 3D Terrain Renderer based on the `CDLOD Algrotihm` using the `SDL Framework` and the Swisstopo Dataset.

## :warning: Prerequisites
Make sure you have the following installed on your system:
- CMake `v3.5 or higher`. Can be installed from [here](https://cmake.org/download/)
- Ninja build tool. Can be installed from [here](https://github.com/ninja-build/ninja/releases)
- C Compiler `Clang, GCC or MSVC`

## :books: Dataset
The project uses the Swisstopo dataset `ALTI3D` as well as `SWISSIMAGE` for terrain data. You can download the dataset from the official swisstopo website. For example the `ALTI3D` dataset can be found [here](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) whereas the `SWISSIMAGE` dataset is available under the following [link](https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm).

## :clap: Ressources
- [SDL3 CMake Guide](https://wiki.libsdl.org/SDL3/README-cmake)
- [SDL3 API Guide](https://wiki.libsdl.org/SDL3/CategoryAPI)

## :rocket: How to build and run
First the repository needs to be cloned:

```bash
git clone https://github.com/yhutter/swiss-terrain-3d --depth=1 --recurse-submodules
cd swiss-terrain-3d
mkdir build
cmake -S . -B build -G Ninja
cmake --build build --config Release -j16
```

