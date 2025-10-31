import os
import math
import shutil
import json
from pathlib import Path
from osgeo import gdal
import csv
import requests
from tqdm import tqdm

LOCATION = "sargans"
DEM_CSV = f"./data/{LOCATION}/ch.swisstopo.swissalti3d.csv"  # Example DEM tile list
DOP_CSV = (
    f"./data/{LOCATION}/ch.swisstopo.swissimage.csv"  # Example orthophoto tile list
)
DEM_INPUT_DIR = f"./data/swiss-alti3d-{LOCATION}"
DOP_INPUT_DIR = f"./data/swiss-image-{LOCATION}"
OUTPUT_DIR = f"./data/output_tiles-{LOCATION}"

SRS = "EPSG:2056"  # Swiss coordinate system
CHUNK_PX = 500  # tile size in pixels for each level of detail
MAX_LEVELS = None  # If set to None, the level will be determined automatically so that the highest level is 1x1 tile.
RESAMPLING = "average"

MOS_DEM_VRT = "mosaic_dem.vrt"
MOS_DOP_VRT = "mosaic_dop.vrt"
MOS_DEM_CROP = "mosaic_dem_cropped.vrt"
MOS_DOP_CROP = "mosaic_dop_cropped.vrt"


def download_tiles_from_csv(csv_path: str, output_dir: str):
    """
    Reads a Swisstopo CSV file and downloads all GeoTIFF tiles listed inside.
    Saves them to output_dir (creates if missing).
    Skips files that already exist.
    """
    os.makedirs(output_dir, exist_ok=True)

    urls = []
    with open(csv_path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            # Try to detect URL column dynamically
            for key in row.keys():
                if "http" in row[key]:
                    urls.append(row[key])
                    break

    print(f"Found {len(urls)} tile URLs in {csv_path}")
    print(urls)

    for url in tqdm(urls, desc="Downloading tiles"):
        filename = os.path.basename(url)
        out_path = Path(output_dir) / filename
        if out_path.exists():
            continue

        try:
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            with open(out_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            print(f"Failed to download {url}: {e}")


def ensure_clean_dir(path: str):
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)


def get_raster_info(ds):
    """
    Returns the bounding box (minx, miny, maxx, maxy), size (width, height), and pixel size (px, py) of the given GeoTIFF file.
    """
    gt = ds.GetGeoTransform()
    px = gt[1]
    py = abs(gt[5])
    minx, maxy = gt[0], gt[3]
    width, height = ds.RasterXSize, ds.RasterYSize
    maxx = minx + width * px
    miny = maxy - height * py
    return (minx, miny, maxx, maxy), (width, height), (px, py)


def build_vrt(input_dir: str, out_vrt: str):
    """
    Builds a Virtual Runtime (VRT) mosaic from all all GeoTIFF files in the input directory.
    """
    files = [str(p) for p in Path(input_dir).glob("*.tif")]
    if not files:
        raise RuntimeError(f"No GeoTIFFs found in {input_dir}")
    print(f"Building VRT from {len(files)} tiles → {out_vrt}")
    gdal.BuildVRT(out_vrt, files)


def decide_max_levels(
    width_px: int, height_px: int, chunk_px: int, max_level_overwrite
):
    """
    Decide the maximum number of LOD levels based on input dimensions and chunk size so that the highest level is 1x1 tile.
    Can be overwritten by max_level_overwrite.
    """
    if max_level_overwrite is not None:
        return max_level_overwrite

    tiles_x = width_px / chunk_px
    tiles_y = height_px / chunk_px
    min_tiles = min(tiles_x, tiles_y)
    if min_tiles < 1:
        raise RuntimeError("Input mosaic smaller than one chunk — check CHUNK_PX.")
    max_level = int(math.floor(math.log2(min_tiles)))
    return max_level + 1


def crop_to_divisible_grid(src_vrt: str, out_vrt: str, chunk_px: int, levels: int):
    """
    Crops the input VRT so that its dimensions are cleanly divisible by the requested chunk size and levels.
    """
    ds = gdal.Open(src_vrt)
    (minx, miny, maxx, maxy), (W, H), (px, py) = get_raster_info(ds)

    base_multiple = chunk_px * (2 ** (levels - 1))
    W_crop = (W // base_multiple) * base_multiple
    H_crop = (H // base_multiple) * base_multiple
    if W_crop == 0 or H_crop == 0:
        raise RuntimeError(
            "Cropping removed too much — reduce levels or use larger input."
        )

    maxx_crop = minx + W_crop * px
    miny_crop = maxy - H_crop * py

    print(f"Cropping to {W_crop}×{H_crop} px for {levels} levels.")
    gdal.Warp(
        out_vrt,
        ds,
        outputBounds=(minx, miny_crop, maxx_crop, maxy),
        dstSRS=SRS,
        cropToCutline=False,
        resampleAlg="bilinear",
        format="VRT",
        dstAlpha=False,
    )
    ds = None
    return out_vrt, (minx, miny_crop, maxx_crop, maxy)


def build_vrt_lods(src_vrt: str, out_root: str, levels: int, extent):
    """
    Builds a vrt for each level of detail (LOD) from the source VRT inside the out_root folder.
    """
    minx, miny, maxx, maxy = extent
    ds = gdal.Open(src_vrt)
    _, (W, H), _ = get_raster_info(ds)
    ds = None

    for L in range(levels):
        lvl_dir = Path(out_root) / f"level_{L}"
        lvl_dir.mkdir(parents=True, exist_ok=True)
        out_vrt = str(lvl_dir / f"mosaic_L{L}.vrt")

        W_out = W // (2**L)
        H_out = H // (2**L)

        print(f"L{L}: {W_out}×{H_out} px")
        gdal.Warp(
            out_vrt,
            src_vrt,
            width=W_out,
            height=H_out,
            outputBounds=(minx, miny, maxx, maxy),
            resampleAlg=RESAMPLING,
            targetAlignedPixels=False,
            dstSRS=SRS,
            format="VRT",
        )


def tile_vrt_lod(level_vrt: str, out_dir: str, chunk_px: int):
    """
    Tiles the given level VRT into chunks of chunk_px size and saves them into out_dir.
    """
    ds = gdal.Open(level_vrt)
    (minx, miny, maxx, maxy), (W, H), (px, py) = get_raster_info(ds)
    tiles_x = W // chunk_px
    tiles_y = H // chunk_px
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    for ty in range(tiles_y):
        for tx in range(tiles_x):
            xmin = minx + tx * chunk_px * px
            xmax = xmin + chunk_px * px
            ymax = maxy - ty * chunk_px * py
            ymin = ymax - chunk_px * py

            out_tif = Path(out_dir) / f"tile_{ty:03d}_{tx:03d}.tif"
            gdal.Translate(
                str(out_tif),
                ds,
                projWin=[xmin, ymax, xmax, ymin],
                width=chunk_px,
                height=chunk_px,
                format="GTiff",
                creationOptions=["TILED=YES", "COMPRESS=DEFLATE"],
            )
    ds = None


def generate_height_map_from_tif(input_file, output_file, scale):
    """
    Generates a height map from the input GeoTIFF file, scaling elevation values to the specified range.
    """
    ds = gdal.Open(input_file)
    band = ds.GetRasterBand(1)
    min_val, max_val, mean_val, _ = band.GetStatistics(True, True)

    translate_options = gdal.TranslateOptions(
        format="PNG",
        outputType=gdal.GDT_UInt16,
        scaleParams=[[min_val, max_val, scale[0], scale[1]]],
    )

    gdal.Translate(destName=output_file, srcDS=input_file, options=translate_options)


def generate_image_from_tif(input_file, output_file):
    """
    Generates an RGB PNG image from a GeoTIFF (e.g., from SwissIMAGE tiles).
    Only the first three bands are used for RGB.
    """
    ds = gdal.Open(input_file)
    if ds is None:
        print(f"Could not open {input_file}")
        return

    # Most SwissIMAGE files have at least 3 bands (RGB), sometimes 4 (RGB+NIR)
    num_bands = min(ds.RasterCount, 3)
    translate_options = gdal.TranslateOptions(
        format="PNG",
        outputType=gdal.GDT_Byte,
        bandList=list(range(1, num_bands + 1)),  # Bands 1–3
    )

    gdal.Translate(destName=output_file, srcDS=ds, options=translate_options)
    ds = None


def get_tile_metadata(tile_path: Path):
    ds = gdal.Open(str(tile_path))
    if ds is None:
        return None

    band = ds.GetRasterBand(1)
    stats = band.GetStatistics(True, True)
    if stats is None:
        return None

    gt = ds.GetGeoTransform()
    width, height = ds.RasterXSize, ds.RasterYSize
    minx, maxy = gt[0], gt[3]
    maxx = minx + width * gt[1]
    miny = maxy + height * gt[5]

    return {
        "path": str(tile_path),
        "bbox": [minx, miny, maxx, maxy],
        "size": [width, height],
        "min": stats[0],
        "max": stats[1],
        "mean": stats[2],
    }


def collect_metadata(dem_root: Path, dop_root: Path, levels: int):
    metadata = []
    for L in range(levels):
        dem_tiles = list((dem_root / f"level_{L}" / "tiles").glob("*.tif"))
        for dem_tile in dem_tiles:
            info = get_tile_metadata(dem_tile)
            if info is None:
                continue

            ty, tx = [int(x) for x in dem_tile.stem.split("_")[1:3]]
            dem_image_path = Path(f"{dem_tile}.png")
            dop_tile = dop_root / f"level_{L}" / "tiles" / f"tile_{ty:03d}_{tx:03d}.tif"
            dop_image_path = Path(f"{dop_tile}.png")

            entry = {
                "id": f"L{L}_{ty:03d}_{tx:03d}",
                "level": L,
                "tile_x": tx,
                "tile_y": ty,
                "dem_tif_path": str(dem_tile),
                "dem_image_path": str(dem_image_path)
                if dem_image_path.exists()
                else None,
                "dop_tif_path": str(dop_tile),
                "dop_image_path": str(dop_image_path)
                if dop_image_path.exists()
                else None,
                "bbox": info["bbox"],
                "size": info["size"],
                "min_elev": info["min"],
                "max_elev": info["max"],
                "mean_elev": info["mean"],
            }
            metadata.append(entry)
    return metadata


def process_all(
    dem_input: str, dop_input: str, out_dir: str, chunk_px: int, max_levels_cfg
):
    """
    Main processing function to build and tile DEM and Image LOD pyramids.
    """
    ensure_clean_dir(out_dir)

    # DEM and Image mosaics
    dem_vrt = str(Path(out_dir) / MOS_DEM_VRT)
    dop_vrt = str(Path(out_dir) / MOS_DOP_VRT)
    build_vrt(dem_input, dem_vrt)
    build_vrt(dop_input, dop_vrt)

    # Inspect mosaic dimensions
    ds_dem = gdal.Open(dem_vrt)
    _, (W, H), _ = get_raster_info(ds_dem)
    ds_dem = None

    levels = decide_max_levels(W, H, chunk_px, max_levels_cfg)
    print(
        f"DEM/Image base size: {W}×{H} px → {levels} levels (L0..L{levels - 1}), top = 1×1 tile"
    )

    # Crop both mosaics to same extent
    dem_crop, extent = crop_to_divisible_grid(
        dem_vrt, str(Path(out_dir) / MOS_DEM_CROP), chunk_px, levels
    )
    dop_crop, _ = crop_to_divisible_grid(
        dop_vrt, str(Path(out_dir) / MOS_DOP_CROP), chunk_px, levels
    )

    # DEM LOD pyramid
    dem_root = Path(out_dir) / "dem"
    print("\nBuilding DEM LODs...")
    build_vrt_lods(dem_crop, str(dem_root), levels, extent)

    # dop LOD pyramid
    dop_root = Path(out_dir) / "dop"
    print("\nBuilding DOP LODs...")
    build_vrt_lods(dop_crop, str(dop_root), levels, extent)

    # Tiling process
    print("\nTiling DEM levels...")
    for L in range(levels):
        level_vrt = str(dem_root / f"level_{L}" / f"mosaic_L{L}.vrt")
        tiles_out = str(dem_root / f"level_{L}" / "tiles")
        tile_vrt_lod(level_vrt, tiles_out, chunk_px)

    print("\nTiling DOP levels...")
    for L in range(levels):
        level_vrt = str(dop_root / f"level_{L}" / f"mosaic_L{L}.vrt")
        tiles_out = str(dop_root / f"level_{L}" / "tiles")
        tile_vrt_lod(level_vrt, tiles_out, chunk_px)

    print("\nGenerating DEM images...")
    for L in range(levels):
        dem_tiles = list((dem_root / f"level_{L}" / "tiles").glob("*.tif"))
        for dem_tile in dem_tiles:
            height_map_path = dem_tile.parent / f"{dem_tile.name}.png"
            generate_height_map_from_tif(
                str(dem_tile), str(height_map_path), scale=(0, 65535)
            )

    print("\nGenerating DOP images...")
    for L in range(levels):
        dop_tiles = list((dop_root / f"level_{L}" / "tiles").glob("*.tif"))
        for dop_tile in dop_tiles:
            png_path = dop_tile.parent / f"{dop_tile.name}.png"
            generate_image_from_tif(str(dop_tile), str(png_path))

    # Metadata
    print("\nWrite tile metadata...")
    metadata = collect_metadata(dem_root, dop_root, levels)
    meta_path = Path(out_dir) / "terrain_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\nDone")


if __name__ == "__main__":
    print("Downloading SwissALTI3D tiles...")
    download_tiles_from_csv(DEM_CSV, DEM_INPUT_DIR)

    print("Downloading SwissIMAGE tiles...")
    download_tiles_from_csv(DOP_CSV, DOP_INPUT_DIR)

    print("Starting preprocessing pipeline...")
    process_all(DEM_INPUT_DIR, DOP_INPUT_DIR, OUTPUT_DIR, CHUNK_PX, MAX_LEVELS)
