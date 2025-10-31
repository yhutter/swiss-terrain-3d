import os
import math
import shutil
from pathlib import Path
from osgeo import gdal

DEM_INPUT_DIR = "./data/swiss-alti3d"
IMG_INPUT_DIR = "./data/swiss-image"
OUTPUT_DIR = "./data/output_tiles"

SRS = "EPSG:2056"  # Swiss coordinate system
CHUNK_PX = 1000  # tile size in pixels for each level of detail
MAX_LEVELS = None  # If set to None, the level will be determined automatically so that the highest level is 1x1 tile.
RESAMPLING = "average"

MOS_DEM_VRT = "mosaic_dem.vrt"
MOS_IMG_VRT = "mosaic_img.vrt"
MOS_DEM_CROP = "mosaic_dem_cropped.vrt"
MOS_IMG_CROP = "mosaic_img_cropped.vrt"


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


def process_all(
    dem_input: str, img_input: str, out_dir: str, chunk_px: int, max_levels_cfg
):
    """
    Main processing function to build and tile DEM and Image LOD pyramids.
    """
    ensure_clean_dir(out_dir)

    # DEM and Image mosaics
    dem_vrt = str(Path(out_dir) / MOS_DEM_VRT)
    img_vrt = str(Path(out_dir) / MOS_IMG_VRT)
    build_vrt(dem_input, dem_vrt)
    build_vrt(img_input, img_vrt)

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
    img_crop, _ = crop_to_divisible_grid(
        img_vrt, str(Path(out_dir) / MOS_IMG_CROP), chunk_px, levels
    )

    # DEM LOD pyramid
    dem_root = Path(out_dir) / "dem"
    print("\nBuilding DEM LODs...")
    build_vrt_lods(dem_crop, str(dem_root), levels, extent)

    # IMG LOD pyramid
    img_root = Path(out_dir) / "img"
    print("\nBuilding Image LODs...")
    build_vrt_lods(img_crop, str(img_root), levels, extent)

    # Tiling process
    print("\nTiling DEM levels...")
    for L in range(levels):
        level_vrt = str(dem_root / f"level_{L}" / f"mosaic_L{L}.vrt")
        tiles_out = str(dem_root / f"level_{L}" / "tiles")
        tile_vrt_lod(level_vrt, tiles_out, chunk_px)

    print("\nTiling Image levels...")
    for L in range(levels):
        level_vrt = str(img_root / f"level_{L}" / f"mosaic_L{L}.vrt")
        tiles_out = str(img_root / f"level_{L}" / "tiles")
        tile_vrt_lod(level_vrt, tiles_out, chunk_px)

    print("\nDone — DEM and Image LOD pyramids built and tiled consistently!")


if __name__ == "__main__":
    process_all(DEM_INPUT_DIR, IMG_INPUT_DIR, OUTPUT_DIR, CHUNK_PX, MAX_LEVELS)
