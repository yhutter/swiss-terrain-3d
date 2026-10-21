<div class="center">
    <h1>Swiss Terrain 3D</h1>
    <img src="./assets/screenshot_01.png" alt="Screenshot 01"/>
</div>

Implementation of a 3D Terrain Renderer in `C` and `Raylib`.

## :warning: Prerequisites
Make sure you have the following installed on your system:
- A C compiler such as `gcc`, `mscv` or `clang`.
- Have the `raylib` framework installed on your system.
- Have the `pkg-config` command installed

## :books: Dataset
The project uses the Swisstopo dataset `ALTI3D` as well as `SWISSIMAGE` for terrain data. You can download the dataset from the official swisstopo website. For example the `ALTI3D` dataset can be found [here](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) whereas the `SWISSIMAGE` dataset is available under the following [link](https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm).

## :clap: Ressources
- [Raylib Cheatsheet](https://www.raylib.com/cheatsheet/cheatsheet.html)
- [Raylib Examples](https://www.raylib.com/examples.html)

## :package: Libraries
This project uses the following libraries
- [Raylib](https://github.com/raysan5/raylib)

## :rocket: How to Run

First you need to build the software. Take not of the `Prerequisite` mentioned above.

```bash
chmod +x ./build.sh # Make the script executable
./build.sh release # Make release build
./build.sh # Make debug build
```

After that you can simply run it by executing the `swissterrain3d` executable.

