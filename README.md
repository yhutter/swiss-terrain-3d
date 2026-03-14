<div class="center">
    <h1>Swiss Terrain 3D</h1>
    <img src="./assets/screenshot_01.png" alt="Screenshot 01"/>
</div>

Implementation of a 3D Terrain Renderer in Three.js based on Swisstopo Dataset.

## :warning: Prerequisites
Make sure you have the following installed on your system:
- NodeJS `v16 or higher`. Can be installed from [here](https://nodejs.org/)
- Python `v3.6 or higher`. Can be installed from [here](https://www.python.org/downloads/)
- KTX Tools have to be installed and available in your system path. You can download them [here](https://github.com/KhronosGroup/KTX-Software/releases).

## :books: Dataset
The project uses the Swisstopo dataset `ALTI3D` as well as `SWISSIMAGE` for terrain data. You can download the dataset from the official swisstopo website. For example the `ALTI3D` dataset can be found [here](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) whereas the `SWISSIMAGE` dataset is available under the following [link](https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm).

## :gear: Preprocessing
> :warning: Currently only the Swisstopo dataset with a resolution of `2m` is supported.

Before running the project, you need to preprocess the Swisstopo data. For this purpose the script `main.py` under the `preprocess folder` can be used. Simply execute the Script by running:

```bash
cd preprocess
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
python main.py
```

The script can be configured via the `preprocess-config.json` file. Make sure to set the correct paths to the input data and the output directory. The script will automatically download and process the data to be used by the 3d visualization.

## :clap: Ressources
- [ThreeJS](https://threejs.org/)
- [SimonDev GameDev Course](https://simondev.io/courses/)
- [SimonDev Quadtree & LOD](https://www.youtube.com/watch?v=YO_A5w_fxRQ)
- [SimonDev Quadtree Implementation](https://github.com/simondevyoutube/ProceduralTerrain_Part3)
- [Process GeoTIFF Files with Python](https://kipling.medium.com/using-a-geotiff-and-a-touch-of-python-to-make-topographic-images-1c1b0349551b)
- [Themes for TweakPane](https://tweakpane.github.io/docs/theming/#builder)
- [ThreeJS Examples](https://threejs.org/examples/)
- [SimonDev Custom FPS Controls](https://github.com/simondevyoutube/ProceduralTerrain_Part3/blob/master/src/controls.js)
- [KTX Tools](https://github.com/KhronosGroup/KTX-Software/releases)
- [PolyHaven German Town Street HDRI](https://polyhaven.com/a/german_town_street)
- [PolyHaven Plains Sunset HDRI](https://polyhaven.com/a/plains_sunset)
- [PolyHaven Rogland Clear Night HDRI](https://polyhaven.com/a/rogland_clear_night)

## :package: Libraries
This project uses the following libraries
- [TweakPane](https://tweakpane.github.io/docs/)
- [Python GeoTIFF Library)](https://github.com/KipCrossing/geotiff)
- [stats-gl](https://github.com/RenaudRohlinger/stats-gl)

## :rocket: How to Run
> :warning: Make sure to preprocess the data before running the project. Furthermore you need to adapt the path to the generated metadata file inside the `Terrain.ts` file.

```bash
cd src
npm install
npm run dev
```

