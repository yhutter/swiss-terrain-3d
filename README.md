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
- [Sokol + ImGUI Starter Template](https://github.com/floooh/cimgui-sokol-starterkit)
- [Sokol Clear Screen Example](https://github.com/floooh/sokol-samples/blob/master/sapp/clear-sapp.c)

## :rocket: How to build and run
First the repository needs to be cloned:

```bash
git clone https://github.com/yhutter/swiss-terrain-3d --depth=1
cd swiss-terrain-3d
chmod +x build.sh # Make shell script executable (Utility script which invokes CMake etc.)
./build.sh --release # Trigger release build
./build.sh --debug # Trigger debug build (this is also the default if no arguments are passed)
```
After that there should be a `swiss-terrain-3d` executable available in either `build_debug` or `build_release` (depending on which kind of build you triggered via `build.sh`).

