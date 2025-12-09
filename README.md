# Swiss Terrain 3D
Implementation of a 3D Terrain Renderer in ThreeJS based on Swisstopo Dataset 

## :warning: Prerequisites
Make sure you have the following installed on your system:
- NodeJS `v16 or higher`. Can be installed from [here](https://nodejs.org/)
- Python `v3.6 or higher`. Can be installed from [here](https://www.python.org/downloads/)

## :gear: Preprocessing
Before running the project, you need to preprocess the Swisstopo data. For this purpose the script `main.py` under the `preprocess folder` can be used. Simply execute the Script by running:
```bash
cd preprocess
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
python main.py
```

## :clap: Ressources
- [ThreeJS](https://threejs.org/)
- [SimonDev GameDev Course](https://simondev.io/courses/)
- [SimonDev Quadtree & LOD](https://www.youtube.com/watch?v=YO_A5w_fxRQ)
- [SimonDev Quadtree Implementation](https://github.com/simondevyoutube/ProceduralTerrain_Part3)
- [Process GeoTIFF Files with Python](https://kipling.medium.com/using-a-geotiff-and-a-touch-of-python-to-make-topographic-images-1c1b0349551b)
- [Themes for TweakPane](https://tweakpane.github.io/docs/theming/#builder)
- [ThreeJS Examples](https://threejs.org/examples/)
- [SimonDev Custom FPS Controls](https://github.com/simondevyoutube/ProceduralTerrain_Part3/blob/master/src/controls.js)

## :package: Libraries
This project uses the following libraries
- [ThreeJS Custom Shader Material](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)
- [TweakPane](https://tweakpane.github.io/docs/)
- [Python GeoTIFF Library)](https://github.com/KipCrossing/geotiff)

## :rocket: How to Run
```bash
cd src
npm install
npm run dev
```

