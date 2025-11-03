import os
import math
import shutil
import json
from pathlib import Path
from osgeo import gdal
import csv
import requests
import re
from tqdm import tqdm

DOP_UPDATE_CYCLE_YEARS = 3
DEM_UPDATE_CYCLE_YEARS = 6

LOCATION = "chur"
DEM_CSV = f"./data/{LOCATION}/ch.swisstopo.swissalti3d.csv"  # Example DEM tile list
DOP_CSV = (
    f"./data/{LOCATION}/ch.swisstopo.swissimage.csv"  # Example orthophoto tile list
)
DEM_INPUT_DIR = f"./data/swiss-alti3d-{LOCATION}"
DOP_INPUT_DIR = f"./data/swiss-image-{LOCATION}"
OUTPUT_DIR = f"./data/output_tiles-{LOCATION}"


SRS = "EPSG:2056"  # Swiss coordinate system
CHUNK_PX = 1000  # tile size in pixels for each level of detail should be cleanly divisible by the tile size of swisstopo (e.g 1kmx1km)
MAX_LEVELS = None  # If set to None, the level will be determined automatically so that the highest level is 1x1 tile.
RESAMPLING = "average"

MOS_DEM_VRT = "mosaic_dem.vrt"
MOS_DOP_VRT = "mosaic_dop.vrt"
MOS_DEM_CROP = "mosaic_dem_cropped.vrt"
MOS_DOP_CROP = "mosaic_dop_cropped.vrt"


def create_dem_url(year: int, east: int, north: int, resolution: int = 2) -> str:
    return f"https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_{year}_{east}-{north}/swissalti3d_{year}_{east}-{north}_{resolution}_2056_5728.tif"


def create_dop_url(year: int, east: int, north: int, resolution: int = 2) -> str:
    return f"https://data.geo.admin.ch/ch.swisstopo.swissimage-dop10/swissimage-dop10_{year}_{east}-{north}/swissimage-dop10_{year}_{east}-{north}_{resolution}_2056.tif"


def create_swisstopo_url(
    type: str, year: int, east: int, north: int, resolution: int = 2
) -> str:
    if type == "dem":
        return create_dem_url(year, east, north, resolution)
    elif type == "dop":
        return create_dop_url(year, east, north, resolution)
    else:
        raise ValueError(f"Unknown type: {type}")


def patch_swisstopo_csv(csv_path, output_csv_path, type="dem"):
    """
    Reads a SwissTopo CSV of image URLs, detects missing 1 km LV95 tiles,
    and adds URLs for the missing grid cells.
    This is necessary because there might be a few tiles missing around the borders.
    """
    url_infos = []
    with open(csv_path, newline="") as f:
        reader = csv.reader(f)
        for r in reader:
            if not r:
                continue
            url = r[0].strip()
            m = re.search(r"(\d{4})_(\d{4})-(\d{4})", url)
            if not m:
                continue
            year, east, north = m.groups()
            url_info = {
                "year": int(year),
                "east": int(east),
                "north": int(north),
                "url": url,
            }
            url_infos.append(url_info)

    if not url_infos:
        print("[ERROR] No valid URLs found in CSV.")
        return

    # Determine grid extents
    easts = sorted({info["east"] for info in url_infos})
    norths = sorted({info["north"] for info in url_infos})

    # Iterate through east and north ranges to find missing tiles
    missings = []
    for e in range(easts[0], easts[-1] + 1):
        for n in range(norths[0], norths[-1] + 1):
            # If it is missing take the years from the closest matching tiles with the same northing
            is_missing = not any(
                info["east"] == e and info["north"] == n for info in url_infos
            )
            if is_missing:
                years = set(info["year"] for info in url_infos if info["north"] == n)
                for year in years:
                    missings.append((year, e, n))

    print(f"[INFO] Found missing tiles in {len(easts)}×{len(norths)} grid.")

    new_url_infos = []
    for m in missings:
        year = m[0]
        e = m[1]
        n = m[2]
        url = create_swisstopo_url(type, year, e, n)
        new_url_info = {
            "year": year,
            "east": e,
            "north": n,
            "url": url,
            "type": type,
        }
        new_url_infos.append(new_url_info)

    # Write combined CSV sorted by year in ascending order
    combined_url_infos = url_infos + new_url_infos
    combined_url_infos.sort(key=lambda x: (x["year"]), reverse=True)
    with open(output_csv_path, "w", newline="") as f:
        writer = csv.DictWriter(
            f, delimiter=";", fieldnames=["year", "north", "east", "type", "url"]
        )
        writer.writeheader()
        for info in combined_url_infos:
            # Write out rows with keys
            writer.writerow(
                {
                    "year": info["year"],
                    "north": info["north"],
                    "east": info["east"],
                    "type": type,
                    "url": info["url"],
                }
            )
    print(
        f"[OK] Wrote patched CSV with {len(combined_url_infos)} total URLs to {output_csv_path}."
    )


def try_download_tile(url: str, out_path: Path) -> bool:
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True

    except Exception:
        return False


def download_tiles_from_csv(csv_path: str, output_dir: str):
    """
    Reads a Swisstopo CSV file and downloads all GeoTIFF tiles listed inside.
    Saves them to output_dir (creates if missing).
    """
    os.makedirs(output_dir, exist_ok=True)

    url_infos = []
    with open(csv_path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            url = row["url"].strip()
            north = int(row["north"])
            east = int(row["east"])
            type = row["type"]
            year = int(row["year"])
            url_info = {
                "year": year,
                "east": east,
                "north": north,
                "type": type,
                "url": url,
            }
            url_infos.append(url_info)

    print(f"Found {len(url_infos)} tile URLs in {csv_path}")

    for url_info in tqdm(url_infos, desc="Downloading tiles"):
        downloaded = url_info.get("downloaded", False)
        if downloaded:
            print(f"Skipping already downloaded tile: {url_info['url']}")
            continue

        url = url_info["url"]
        year = url_info["year"]
        type = url_info["type"]
        east = url_info["east"]
        north = url_info["north"]

        filename = os.path.basename(url)
        out_path = Path(output_dir) / filename
        if not try_download_tile(url, out_path):
            print(f"Failed to download {url}")
            print("Retrying once with one period in the past")
            if type == "dem":
                update_cycle = DEM_UPDATE_CYCLE_YEARS
            else:
                update_cycle = DOP_UPDATE_CYCLE_YEARS
            past_year = year - update_cycle
            url = create_swisstopo_url(type, past_year, east, north)
            if not try_download_tile(url, out_path):
                print(f"Failed to download {url}")
                print("Retrying in between the periods...")
                success = False
                for offset in range(1, update_cycle):
                    inter_year = year - offset
                    print(f"Trying year {inter_year}...")
                    url = create_swisstopo_url(type, inter_year, east, north)
                    # Break out on first success
                    if try_download_tile(url, out_path):
                        success = True
                        print(f"Successfully downloaded with {url}")
                        # Mark other infos with same east and north as skipped
                        for info in url_infos:
                            if info["east"] == east and info["north"] == north:
                                info["downloaded"] = True
                        break
                # No result found
                if not success:
                    print(f"Failed to download {url}")
            else:
                # Mark other infos with same east and north as skipped
                for info in url_infos:
                    if info["east"] == east and info["north"] == north:
                        info["downloaded"] = True
        else:
            # Mark other infos with same east and north as skipped
            for info in url_infos:
                if info["east"] == east and info["north"] == north:
                    info["downloaded"] = True


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


def crop_to_divisible_square_grid(
    src_vrt: str, out_vrt: str, chunk_px: int, levels: int
):
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

    # Make it square by shrinking the longer dimension
    side = min(W_crop, H_crop)
    W_crop = H_crop = side

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


def generate_empty_image(width, height, color, output_file):
    """
    Generates an empty RGB PNG image of the specified size and filled with the given color.
    Note that color should be a value between 0 and 255.
    """
    mem_driver = gdal.GetDriverByName("MEM")
    mem_ds = mem_driver.Create("", width, height, 1, gdal.GDT_UInt16)
    band = mem_ds.GetRasterBand(1)
    band.Fill(color)

    # 2. Copy to disk using CreateCopy
    png_driver = gdal.GetDriverByName("PNG")
    png_driver.CreateCopy(output_file, mem_ds, strict=0)

    mem_ds = None
    print(f"[INFO] Created empty height map: {output_file}")


def generate_height_map_from_tif(input_file, output_file, scale):
    """
    Generates a height map from the input GeoTIFF file, scaling elevation values to the specified range.
    """
    ds = gdal.Open(input_file)
    band = ds.GetRasterBand(1)

    try:
        stats = band.GetStatistics(True, True)
    except RuntimeError:
        stats = None

    if stats is None:
        print(f"Could not compute statistics for {input_file}")
        print("Generating empty height map instead.")
        ds = None
        generate_empty_image(CHUNK_PX, CHUNK_PX, 0, output_file)
        return

    min_val, max_val, mean_val, _ = stats

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
    band = ds.GetRasterBand(1)
    try:
        stats = band.GetStatistics(True, True)
    except RuntimeError:
        print(f"Could not compute statistics for {tile_path}")
        stats = None

    if stats is None or ds is None:
        return {
            "path": str(tile_path),
            "valid": False,
            "bbox": None,
            "size": None,
            "min": None,
            "max": None,
            "mean": None,
        }

    gt = ds.GetGeoTransform()
    width, height = ds.RasterXSize, ds.RasterYSize
    minx, maxy = gt[0], gt[3]
    maxx = minx + width * gt[1]
    miny = maxy + height * gt[5]

    return {
        "path": str(tile_path),
        "valid": True,
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
            ty, tx = [int(x) for x in dem_tile.stem.split("_")[1:3]]
            dem_image_path = Path(f"{dem_tile}.png")
            dop_tile = dop_root / f"level_{L}" / "tiles" / f"tile_{ty:03d}_{tx:03d}.tif"
            dop_image_path = Path(f"{dop_tile}.png")

            entry = {
                "id": f"L{L}_{ty:03d}_{tx:03d}",
                "valid": info["valid"],
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
    dem_crop, extent = crop_to_divisible_square_grid(
        dem_vrt, str(Path(out_dir) / MOS_DEM_CROP), chunk_px, levels
    )
    dop_crop, _ = crop_to_divisible_square_grid(
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
    use_patching = True

    if use_patching:
        DEM_CSV_PATCHED = f"{DEM_CSV}.patched"
        print("Patching SwissALTI3D CSV for missing tiles...")
        patch_swisstopo_csv(DEM_CSV, DEM_CSV_PATCHED, type="dem")

    print("Downloading SwissALTI3D tiles...")
    if use_patching:
        download_tiles_from_csv(DEM_CSV_PATCHED, DEM_INPUT_DIR)
    else:
        download_tiles_from_csv(DEM_CSV, DEM_INPUT_DIR)

    if use_patching:
        DOP_CSV_PATCHED = f"{DOP_CSV}.patched"
        print("Patching SwissIMAGE CSV for missing tiles...")
        patch_swisstopo_csv(DOP_CSV, DOP_CSV_PATCHED, type="dop")

    print("Downloading SwissIMAGE tiles...")
    if use_patching:
        download_tiles_from_csv(DOP_CSV_PATCHED, DOP_INPUT_DIR)
    else:
        download_tiles_from_csv(DOP_CSV, DOP_INPUT_DIR)

    print("Starting preprocessing pipeline...")
    process_all(DEM_INPUT_DIR, DOP_INPUT_DIR, OUTPUT_DIR, CHUNK_PX, MAX_LEVELS)
