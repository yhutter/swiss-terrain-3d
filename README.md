# Swiss Terrain 3D
Implementation of a 3D Terrain Renderer in ThreeJS based on Swisstopo Dataset 

## :warning: Prerequisites
Make sure you have the following installed on your system:
- NodeJS `v16 or higher`. Can be installed from [here](https://nodejs.org/)
- GDAL for preprocessing the terrain data. Installation instructions can be found [here](https://gdal.org/download.html).
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

## :package: Libraries
This project uses the following libraries
- [ThreeJS](https://threejs.org/)
- [ThreeJS Custom Shader Material](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)
- [SimonDev GameDev Course](https://simondev.io/courses/)
- [SimonDev Quadtree & LOD](https://www.youtube.com/watch?v=YO_A5w_fxRQ)
- [SimonDev Quadtree Implementation](https://github.com/simondevyoutube/ProceduralTerrain_Part3)
- [TweakPane](https://tweakpane.github.io/docs/)
- [GDAL (Preprocessing)](https://gdal.org/)

## :rocket: How to Run
```bash
cd src
npm install
npm run dev
```

