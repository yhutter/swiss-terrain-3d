import os
import shutil
import json
from pathlib import Path
import csv
import requests
import re
from tqdm import tqdm
from geotiff import GeoTiff
import numpy as np
from PIL import Image
import math


DOP_UPDATE_CYCLE_YEARS = 3
DEM_UPDATE_CYCLE_YEARS = 6

COORDINATE_SYSTEM = 2056  # Swiss coordinate system

DEM_M_TO_PX = 2  # SwissALTI3D has 2m resolution
DOP_M_TO_PX = 2  # SwissIMAGE has 2m resolution


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
            if type == "dem":
                update_cycle = DEM_UPDATE_CYCLE_YEARS
            else:
                update_cycle = DOP_UPDATE_CYCLE_YEARS
            print(f"Failed to download {url}")
            print("Retrying until past update period...")
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


def ensure_dir(path: Path):
    os.makedirs(path, exist_ok=True)


def get_width_height_px_from_bbox(bbox: tuple, meters_to_px: float) -> (int, int):
    """
    Calculates width and height in pixels from bounding box and meters to pixel ratio.
    """
    ((upper_left_x, upper_left_y), (lower_right_x, lower_right_y)) = bbox
    width_m = lower_right_x - upper_left_x
    height_m = upper_left_y - lower_right_y
    width_px = int(width_m / meters_to_px)
    height_px = int(height_m / meters_to_px)
    return width_px, height_px


def extract_min_max_height_from_dem(dem_file: str) -> (float, float):
    """
    Extracts min and max height values from DEM GeoTIFF.
    """
    dem_geotiff = GeoTiff(dem_file, as_crs=COORDINATE_SYSTEM)
    bbox = dem_geotiff.tif_bBox_converted
    height_values = dem_geotiff.read_box(bbox)
    max_height = np.amax(height_values)
    min_height = np.amin(height_values)
    return min_height, max_height


def file_name_from_bbox(bbox: tuple) -> str:
    ((upper_left_x, upper_left_y), (lower_right_x, lower_right_y)) = bbox
    return f"{upper_left_x}-{upper_left_y}_{lower_right_x}-{lower_right_y}"


def extract_texture_from_dop(
    dop_file: str, out_dir_path: str
) -> (float, float, float, float):
    """
    Extracts the texture from the DOP GeoTIFF and saves as RGB PNG file.
    Returns bounding box (x and y for top left and bottom right) cooridnates.
    """
    dop_geotiff = GeoTiff(dop_file, as_crs=COORDINATE_SYSTEM)
    bbox = dop_geotiff.tif_bBox_converted
    color_values = dop_geotiff.read_box(bbox)

    # Save bounding box in filename
    upper_left_x = int(bbox[0][0])
    upper_left_y = int(bbox[0][1])
    lower_right_x = int(bbox[1][0])
    lower_right_y = int(bbox[1][1])
    bbox = ((upper_left_x, upper_left_y), (lower_right_x, lower_right_y))
    out_file_name = f"{file_name_from_bbox(bbox)}.png"
    out_file = out_dir_path / out_file_name
    Image.fromarray(color_values).convert("RGB").save(out_file)
    return bbox


def extract_height_map_from_dem(
    dem_file: str, out_dir_path: str, global_min_height: float, global_max_height: float
) -> (float, float, float, float):
    """
    Extracts height map from DEM GeoTIFF and saves as greyscale PNG.
    The height values are normalized according to the provided global min and max height.
    Returns bounding box (x and y for top left and bottom right) cooridnates.
    """
    dem_geotiff = GeoTiff(dem_file, as_crs=COORDINATE_SYSTEM)
    bbox = dem_geotiff.tif_bBox_converted
    height_values = dem_geotiff.read_box(bbox)

    # Normalize height values to 0-255 range based on global min and max height
    img_array = 255 * (
        (height_values - global_min_height) / (global_max_height - global_min_height)
    )

    # Save bounding box in filename
    upper_left_x = int(bbox[0][0])
    upper_left_y = int(bbox[0][1])
    lower_right_x = int(bbox[1][0])
    lower_right_y = int(bbox[1][1])
    bbox = ((upper_left_x, upper_left_y), (lower_right_x, lower_right_y))
    out_file_name = f"{file_name_from_bbox(bbox)}.png"
    out_file = out_dir_path / out_file_name
    Image.fromarray(img_array).convert("RGB").save(out_file)
    return bbox


def combine_textures(
    textures_path: str,
    out_file: str,
    bbox: ((float, float), (float, float)),
    meters_to_px: float,
):
    """
    Combines multiple images into a single large image covering the specified bounding box and taking into account the meters to px ratio.
    """
    (
        (global_upper_left_x, global_upper_left_y),
        (global_lower_right_x, global_lower_right_y),
    ) = bbox
    width_px, height_px = get_width_height_px_from_bbox(bbox, meters_to_px)

    combined_texture = np.zeros((height_px, width_px, 3), dtype=np.uint8)

    texture_files = list(Path(textures_path).glob("*.png"))
    for texture_file in texture_files:
        m = re.match(r"(\d+)-(\d+)_(\d+)-(\d+)\.png", texture_file.name)
        if not m:
            continue
        upper_left_x = int(m.group(1))
        upper_left_y = int(m.group(2))

        texture_img = Image.open(texture_file)
        texture_pixels = np.array(texture_img)

        texture_width_px = texture_pixels.shape[1]
        texture_height_px = texture_pixels.shape[0]

        x_offset = upper_left_x - global_upper_left_x
        y_offset = global_upper_left_y - upper_left_y

        y_offset_px = int(y_offset / meters_to_px)
        x_offset_px = int(x_offset / meters_to_px)

        combined_texture[
            y_offset_px : y_offset_px + texture_height_px,
            x_offset_px : x_offset_px + texture_width_px,
        ] = texture_pixels

    Image.fromarray(combined_texture).convert("RGB").save(out_file)


def combine_height_maps(
    height_maps_path: str,
    out_file: str,
    bbox: ((float, float), (float, float)),
    meters_to_px: float,
):
    """
    Combines multiple height map images into a single large height map covering the specified bounding box and taking into account the meters to px ratio.
    """
    (
        (global_upper_left_x, global_upper_left_y),
        (global_lower_right_x, global_lower_right_y),
    ) = bbox
    width_px, height_px = get_width_height_px_from_bbox(bbox, meters_to_px)

    combined_height_map = np.zeros((height_px, width_px, 3), dtype=np.uint8)

    height_map_files = list(Path(height_maps_path).glob("*.png"))
    for height_map_file in height_map_files:
        m = re.match(r"(\d+)-(\d+)_(\d+)-(\d+)\.png", height_map_file.name)
        if not m:
            continue
        upper_left_x = int(m.group(1))
        upper_left_y = int(m.group(2))

        height_map_img = Image.open(height_map_file)
        height_map_pixels = np.array(height_map_img)

        height_map_width_px = height_map_pixels.shape[1]
        height_map_height_px = height_map_pixels.shape[0]

        x_offset = upper_left_x - global_upper_left_x
        y_offset = global_upper_left_y - upper_left_y

        y_offset_px = int(y_offset / meters_to_px)
        x_offset_px = int(x_offset / meters_to_px)

        combined_height_map[
            y_offset_px : y_offset_px + height_map_height_px,
            x_offset_px : x_offset_px + height_map_width_px,
        ] = height_map_pixels

    Image.fromarray(combined_height_map).convert("RGB").save(out_file)


def decide_max_levels(width_px: int, height_px: int, chunk_px: int) -> int:
    """
    Decide the maximum number of LOD levels that the highest level is 1x1 tile.
    """
    tiles_x = width_px / chunk_px
    tiles_y = height_px / chunk_px
    min_tiles = min(tiles_x, tiles_y)
    if min_tiles < 1:
        raise RuntimeError("Input mosaic smaller than one chunk — check CHUNK_PX.")
    max_level = int(math.floor(math.log2(min_tiles)))
    return max_level + 1


def get_crop_dimensions_squared(
    levels: int, chunk_px: int, width: int, height: int
) -> int:
    base_multiple = chunk_px * (2 ** (levels - 1))
    width_crop = (width // base_multiple) * base_multiple
    height_crop = (height // base_multiple) * base_multiple
    # Make it square by shrinking the longer dimension
    side = min(width_crop, height_crop)
    return side


def crop_image_to_square(image_path: str, out_path: str, crop_size_px: int):
    """
    Crops the input image to a square of size crop_size_px x crop_size_px from the top-left corner.
    """
    img = Image.open(image_path)
    cropped_img = img.crop((0, 0, crop_size_px, crop_size_px))
    cropped_img.save(out_path)


def get_pixel_region_from_bbox(
    bbox: ((float, float), (float, float)), meters_to_px: float
) -> (int, int, int, int):
    """
    Converts a bounding box in meters to pixel coordinates.
    Returns (x_offset_px, y_offset_px, width_px, height_px)
    """
    ((upper_left_x, upper_left_y), (lower_right_x, lower_right_y)) = bbox
    x_offset_m = upper_left_x
    y_offset_m = lower_right_y
    width_m = lower_right_x - upper_left_x
    height_m = upper_left_y - lower_right_y

    x_offset_px = int(x_offset_m / meters_to_px)
    y_offset_px = int(y_offset_m / meters_to_px)
    width_px = int(width_m / meters_to_px)
    height_px = int(height_m / meters_to_px)

    return x_offset_px, y_offset_px, width_px, height_px


def extract_tile_from_image(
    image_path: str,
    out_path: str,
    x_offset_px: int,
    y_offset_px: int,
    width_px: int,
    height_px: int,
):
    """
    Extracts a tile from the input image at the specified pixel offsets and size, and saves it to out_path.
    """
    img = Image.open(image_path)
    tile_img = img.crop(
        (x_offset_px, y_offset_px, x_offset_px + width_px, y_offset_px + height_px)
    )
    tile_img.save(out_path)


def patch_dem_borders(level_dir: Path, pixel_overlap: int = 1):
    """
    Copies a 1px border from each DEM tile into its east and south neighbours,
    so that adjacent tiles share identical edge pixels.
    Tiles are expected to follow the naming: ULx-ULy_LRx-LRy.png
    and to form a regular grid.
    """
    tiles = list(level_dir.glob("*.png"))
    if not tiles:
        return

    # First pass: load all tiles and their metadata
    tile_map = {}  # key: (ulx, uly) -> dict(img, bbox, width_m, height_m)
    for tile_path in tiles:
        m = re.match(r"(\d+)-(\d+)_(\d+)-(\d+)\.png", tile_path.name)
        if not m:
            continue

        ulx = int(m.group(1))
        uly = int(m.group(2))
        lrx = int(m.group(3))
        lry = int(m.group(4))

        width_m = lrx - ulx
        height_m = uly - lry  # note: upper_left_y > lower_right_y

        img = np.array(Image.open(tile_path))  # uint8 (H, W, 3)

        tile_map[(ulx, uly)] = {
            "path": tile_path,
            "img": img,
            "bbox": ((ulx, uly), (lrx, lry)),
            "width_m": width_m,
            "height_m": height_m,
        }

    # Second pass: copy edges into east & south neighbours
    for (ulx, uly), data in tile_map.items():
        img = data["img"]
        H, W, _ = img.shape
        width_m = data["width_m"]
        height_m = data["height_m"]

        # East neighbour: same uly, ulx + width_m
        east_key = (ulx + width_m, uly)
        if east_key in tile_map:
            east_img = tile_map[east_key]["img"]
            # copy this tile's rightmost column into east tile's leftmost column
            east_img[:, 0, :] = img[:, W - pixel_overlap, :]

        # South neighbour: same ulx, uly - height_m
        south_key = (ulx, uly - height_m)
        if south_key in tile_map:
            south_img = tile_map[south_key]["img"]
            # copy this tile's bottom row into south tile's top row
            south_img[0, :, :] = img[H - pixel_overlap, :, :]

    # Final pass: save everything back
    for data in tile_map.values():
        Image.fromarray(data["img"]).save(data["path"])


def process_dop_lod_level(
    level: int,
    combined_texture_path: str,
    out_dir: str,
    bbox_combined_texture: ((float, float), (float, float)),
    meters_to_px: float,
    chunk_px: int,
) -> str:
    # Level 0: full resolution of the combined height map
    # Each subsequent level halves the resolution
    # We skip LOD0 as at runtime because of the Quadtree structure LOD0 is not used.
    if level == 0:
        return
    scale_factor = 2**level
    level_width_px, level_height_px = get_width_height_px_from_bbox(
        bbox_combined_texture, meters_to_px
    )
    tile_level_width_px = level_width_px // scale_factor
    tile_level_height_px = level_height_px // scale_factor
    lod_dir = Path(out_dir) / "dop" / f"lod_{level}"
    ensure_dir(lod_dir)
    # We do not resize the height map in order to avoid interpolation artifacts.
    # Instead, we extract tiles directly from the original combined height map at the appropriate offsets.
    tiles_x = level_width_px // tile_level_width_px
    tiles_y = level_height_px // tile_level_height_px
    bbox_combined_texture_upper_left_x = bbox_combined_texture[0][0]
    bbox_combined_texture_upper_left_y = bbox_combined_texture[0][1]

    for ty in range(tiles_y):
        for tx in range(tiles_x):
            x_offset_px = tx * tile_level_width_px
            y_offset_px = ty * tile_level_height_px
            tile_bbox = (
                (
                    bbox_combined_texture_upper_left_x + x_offset_px * meters_to_px,
                    bbox_combined_texture_upper_left_y - y_offset_px * meters_to_px,
                ),
                (
                    bbox_combined_texture_upper_left_x
                    + (x_offset_px + tile_level_width_px) * meters_to_px,
                    bbox_combined_texture_upper_left_y
                    - (y_offset_px + tile_level_height_px) * meters_to_px,
                ),
            )

            tile_name = file_name_from_bbox(tile_bbox)

            out_tile_path = lod_dir / f"{tile_name}.png"
            extract_tile_from_image(
                combined_texture_path,
                out_tile_path,
                x_offset_px,
                y_offset_px,
                tile_level_width_px,
                tile_level_height_px,
            )
    return lod_dir


def downsample_tiles_in_lod_dir(
    lod_dir: str, downsample_size: int, filter=Image.NEAREST
):
    """
    Downsamples all tiles in the specified LOD directory to the specified downsample size using the specified filter.
    """
    tile_files = list(Path(lod_dir).glob("*.png"))
    for tile_file in tile_files:
        img = Image.open(tile_file)
        resized_img = img.resize((downsample_size, downsample_size), filter)
        resized_img.save(tile_file)


def process_dem_lod_level(
    level: int,
    combined_height_map_path: str,
    out_dir: str,
    bbox_combined_height_map: ((float, float), (float, float)),
    meters_to_px: float,
    chunk_px: int,
) -> str:
    scale_factor = 2**level
    level_width_px, level_height_px = get_width_height_px_from_bbox(
        bbox_combined_height_map, meters_to_px
    )
    tile_level_width_px = level_width_px // scale_factor
    tile_level_height_px = level_height_px // scale_factor
    lod_dir = Path(out_dir) / "dem" / f"lod_{level}"
    ensure_dir(lod_dir)
    # We do not resize the height map in order to avoid interpolation artifacts.
    # Instead, we extract tiles directly from the original combined height map at the appropriate offsets.
    tiles_x = level_width_px // tile_level_width_px
    tiles_y = level_height_px // tile_level_height_px
    bbox_combined_height_map_upper_left_x = bbox_combined_height_map[0][0]
    bbox_combined_height_map_upper_left_y = bbox_combined_height_map[0][1]

    for ty in range(tiles_y):
        for tx in range(tiles_x):
            x_offset_px = tx * tile_level_width_px
            y_offset_px = ty * tile_level_height_px
            tile_bbox = (
                (
                    bbox_combined_height_map_upper_left_x + x_offset_px * meters_to_px,
                    bbox_combined_height_map_upper_left_y - y_offset_px * meters_to_px,
                ),
                (
                    bbox_combined_height_map_upper_left_x
                    + (x_offset_px + tile_level_width_px) * meters_to_px,
                    bbox_combined_height_map_upper_left_y
                    - (y_offset_px + tile_level_height_px) * meters_to_px,
                ),
            )

            tile_name = file_name_from_bbox(tile_bbox)

            out_tile_path = lod_dir / f"{tile_name}.png"
            extract_tile_from_image(
                combined_height_map_path,
                out_tile_path,
                x_offset_px,
                y_offset_px,
                tile_level_width_px,
                tile_level_height_px,
            )
    return lod_dir


def preprocess(dem_input: str, dop_input: str, out_dir: str, chunk_px: int):
    """
    Main processing function to build and tile DEM and Image LOD pyramids.
    """
    ensure_clean_dir(out_dir)

    dem_input_files = list(Path(dem_input).glob("*.tif"))
    dop_input_files = list(Path(dop_input).glob("*.tif"))

    # Figure out global min and max height across all DEM tiles
    dem_min_height_values = np.array([], dtype=np.float32)
    dem_max_height_values = np.array([], dtype=np.float32)
    print(f"Processing {len(dem_input_files)} DEM input files...")
    for dem_file in dem_input_files:
        print(".", end="")
        min_height, max_height = extract_min_max_height_from_dem(dem_file)
        dem_min_height_values = np.append(dem_min_height_values, min_height)
        dem_max_height_values = np.append(dem_max_height_values, max_height)

    global_min_height = np.amin(dem_min_height_values)
    global_max_height = np.amax(dem_max_height_values)
    print(
        "\nGlobal DEM height range:", global_min_height, "m to", global_max_height, "m"
    )

    # Extract all texture data and save as images
    print("Extracting textures from DOP files")
    dop_tiles_dir = Path(out_dir) / "dop" / "tiles"
    ensure_dir(dop_tiles_dir)
    dop_upper_left_x_values = np.array([], dtype=np.int32)
    dop_upper_left_y_values = np.array([], dtype=np.int32)
    dop_lower_right_x_values = np.array([], dtype=np.int32)
    dop_lower_right_y_values = np.array([], dtype=np.int32)

    print(f"Processing {len(dop_input_files)} DOP input files...")
    for dop_file in dop_input_files:
        print(".", end="")
        bbox = extract_texture_from_dop(dop_file, dop_tiles_dir)
        (upper_left_x, upper_left_y), (lower_right_x, lower_right_y) = bbox
        dop_upper_left_x_values = np.append(dop_upper_left_x_values, upper_left_x)
        dop_upper_left_y_values = np.append(dop_upper_left_y_values, upper_left_y)
        dop_lower_right_x_values = np.append(dop_lower_right_x_values, lower_right_x)
        dop_lower_right_y_values = np.append(dop_lower_right_y_values, lower_right_y)

    # Combine all texture images into a single large texture map
    print("\nCombining texture tiles into a single large texture map...")
    global_dop_upper_left_x = np.amin(dop_upper_left_x_values)
    global_dop_upper_left_y = np.amax(dop_upper_left_y_values)
    global_dop_lower_right_x = np.amax(dop_lower_right_x_values)
    global_dop_lower_right_y = np.amin(dop_lower_right_y_values)
    global_dop_bbox = (
        (global_dop_upper_left_x, global_dop_upper_left_y),
        (global_dop_lower_right_x, global_dop_lower_right_y),
    )
    combined_texture_dir = Path(out_dir) / "dop" / "combined"
    ensure_dir(combined_texture_dir)
    combined_texture_file_path = (
        combined_texture_dir / f"{file_name_from_bbox(global_dop_bbox)}.png"
    )
    combine_textures(
        dop_tiles_dir,
        combined_texture_file_path,
        global_dop_bbox,
        DOP_M_TO_PX,
    )

    # Extract all height data and save as images
    dem_upper_left_x_values = np.array([], dtype=np.int32)
    dem_upper_left_y_values = np.array([], dtype=np.int32)
    dem_lower_right_x_values = np.array([], dtype=np.int32)
    dem_lower_right_y_values = np.array([], dtype=np.int32)
    dem_tiles_dir = Path(out_dir) / "dem" / "tiles"
    ensure_dir(dem_tiles_dir)
    print("Extracting height map tiles from DEM files")
    print(f"Processing {len(dem_input_files)} DEM input files...")
    for dem_file in dem_input_files:
        bbox = extract_height_map_from_dem(
            dem_file, dem_tiles_dir, global_min_height, global_max_height
        )
        (upper_left_x, upper_left_y), (lower_right_x, lower_right_y) = bbox
        dem_upper_left_x_values = np.append(dem_upper_left_x_values, upper_left_x)
        dem_upper_left_y_values = np.append(dem_upper_left_y_values, upper_left_y)
        dem_lower_right_x_values = np.append(dem_lower_right_x_values, lower_right_x)
        dem_lower_right_y_values = np.append(dem_lower_right_y_values, lower_right_y)

    global_dem_upper_left_x = np.amin(dem_upper_left_x_values)
    global_dem_upper_left_y = np.amax(dem_upper_left_y_values)
    global_dem_lower_right_x = np.amax(dem_lower_right_x_values)
    global_dem_lower_right_y = np.amin(dem_lower_right_y_values)
    global_dem_bbox = (
        (global_dem_upper_left_x, global_dem_upper_left_y),
        (global_dem_lower_right_x, global_dem_lower_right_y),
    )

    # Combine all height maps into a single large height map
    print("Combining height map tiles into a single large height map...")
    combined_height_maps_dir = Path(out_dir) / "dem" / "combined"
    ensure_dir(combined_height_maps_dir)
    combined_height_map_file_path = (
        combined_height_maps_dir / f"{file_name_from_bbox(global_dem_bbox)}.png"
    )
    combine_height_maps(
        dem_tiles_dir,
        combined_height_map_file_path,
        global_dem_bbox,
        DEM_M_TO_PX,
    )
    dem_combined_width_px, dem_combined_height_px = get_width_height_px_from_bbox(
        global_dem_bbox, DEM_M_TO_PX
    )

    lod_levels = decide_max_levels(
        dem_combined_width_px, dem_combined_height_px, chunk_px
    )

    # Crop to square dimensions that fit full LODs
    print(
        "Cropping combined height map and texture to square dimensions for full LODs..."
    )
    crop_size_px = get_crop_dimensions_squared(
        lod_levels, chunk_px, dem_combined_width_px, dem_combined_height_px
    )

    # DEM
    cropped_global_dem_bbox = (
        (global_dem_upper_left_x, global_dem_upper_left_y),
        (
            global_dem_upper_left_x + crop_size_px * DEM_M_TO_PX,
            global_dem_upper_left_y - crop_size_px * DEM_M_TO_PX,
        ),
    )

    combined_height_map_cropped_dir = Path(out_dir) / "dem" / "cropped"
    ensure_dir(combined_height_map_cropped_dir)
    combined_height_map_cropped_file_path = (
        combined_height_map_cropped_dir
        / f"{file_name_from_bbox(cropped_global_dem_bbox)}.png"
    )

    crop_image_to_square(
        combined_height_map_file_path,
        combined_height_map_cropped_file_path,
        crop_size_px,
    )

    # DOP
    cropped_global_dop_bbox = (
        (global_dop_upper_left_x, global_dop_upper_left_y),
        (
            global_dop_upper_left_x + crop_size_px * DOP_M_TO_PX,
            global_dop_upper_left_y - crop_size_px * DOP_M_TO_PX,
        ),
    )
    combined_texture_cropped_dir = Path(out_dir) / "dop" / "cropped"
    ensure_dir(combined_texture_cropped_dir)
    combined_texture_cropped_file_path = (
        combined_texture_cropped_dir
        / f"{file_name_from_bbox(cropped_global_dop_bbox)}.png"
    )

    crop_image_to_square(
        combined_texture_file_path,
        combined_texture_cropped_file_path,
        crop_size_px,
    )

    # Now that we have a cropped combined height map, we can proceed to build LODs and tile them.
    print(f"Generating DEM {lod_levels} LOD levels...")
    for level in range(lod_levels):
        print(f"Processing DEM LOD level {level}...")
        # We skip LOD0 as at runtime because of the Quadtree structure LOD0 is not used (it is the root node).
        if level == 0:
            continue
        lod_dir = process_dem_lod_level(
            level,
            combined_height_map_cropped_file_path,
            out_dir,
            cropped_global_dem_bbox,
            DEM_M_TO_PX,
            chunk_px,
        )
        # Patch borders to ensure seamless tiling (1px overlap)
        patch_dem_borders(lod_dir, 1)
        # Important: We do NOT want to downsample DEM tiles at all — this would introduce interpolation artifacts.

    print(f"Generating DOP {lod_levels} LOD levels...")
    for level in range(lod_levels):
        print(f"Processing DOP LOD level {level}...")
        # We skip LOD0 as at runtime because of the Quadtree structure LOD0 is not used (it is the root node).
        if level == 0:
            continue
        lod_dir = process_dop_lod_level(
            level,
            combined_texture_cropped_file_path,
            out_dir,
            cropped_global_dop_bbox,
            DOP_M_TO_PX,
            chunk_px,
        )
        # Downsample DOP tiles to chunk size in order to save space.
        downsample_tiles_in_lod_dir(lod_dir, chunk_px, Image.BILINEAR)

    # Collect level metadata
    print("Generating metadata...")
    lod_levels_info = []
    dem_bbox_center = (
        int((cropped_global_dop_bbox[0][0] + cropped_global_dop_bbox[1][0]) / 2),
        int((cropped_global_dop_bbox[0][1] + cropped_global_dop_bbox[1][1]) / 2),
    )
    dop_bbox_center = (
        int((cropped_global_dop_bbox[0][0] + cropped_global_dop_bbox[1][0]) / 2),
        int((cropped_global_dop_bbox[0][1] + cropped_global_dop_bbox[1][1]) / 2),
    )
    for level in range(lod_levels):
        level_dem_dir = Path(out_dir) / "dem" / f"lod_{level}"
        level_dop_dir = Path(out_dir) / "dop" / f"lod_{level}"

        dem_tiles = list(level_dem_dir.glob("*.png"))

        for dem_tile in dem_tiles:
            m = re.match(r"(\d+)-(\d+)_(\d+)-(\d+)\.png", dem_tile.name)
            if not m:
                continue
            upper_left_x = int(m.group(1))
            upper_left_y = int(m.group(2))
            lower_right_x = int(m.group(3))
            lower_right_y = int(m.group(4))
            tile_bbox = (
                (upper_left_x, upper_left_y),
                (lower_right_x, lower_right_y),
            )
            tile_bbox_world_space = (
                (upper_left_x - dem_bbox_center[0], upper_left_y - dem_bbox_center[1]),
                (
                    lower_right_x - dem_bbox_center[0],
                    lower_right_y - dem_bbox_center[1],
                ),
            )
            dop_tile = level_dop_dir / dem_tile.name  # same tile name as DEM
            level_info = {
                "level": level,
                "dem_image_path": str(dem_tile),
                "dop_image_path": str(dop_tile),
                "bbox": [
                    int(tile_bbox[0][0]),
                    int(tile_bbox[0][1]),
                    int(tile_bbox[1][0]),
                    int(tile_bbox[1][1]),
                ],
                "bbox_world_space": [
                    int(tile_bbox_world_space[0][0]),
                    int(tile_bbox_world_space[0][1]),
                    int(tile_bbox_world_space[1][0]),
                    int(tile_bbox_world_space[1][1]),
                ],
            }
            lod_levels_info.append(level_info)

    dem_bbox_center = (
        int((cropped_global_dem_bbox[0][0] + cropped_global_dem_bbox[1][0]) / 2),
        int((cropped_global_dem_bbox[0][1] + cropped_global_dem_bbox[1][1]) / 2),
    )
    dem_bbox_world_space = (
        (
            cropped_global_dem_bbox[0][0] - dem_bbox_center[0],
            cropped_global_dem_bbox[0][1] - dem_bbox_center[1],
        ),
        (
            cropped_global_dem_bbox[1][0] - dem_bbox_center[0],
            cropped_global_dem_bbox[1][1] - dem_bbox_center[1],
        ),
    )
    dop_bbox_center = (
        int((cropped_global_dop_bbox[0][0] + cropped_global_dop_bbox[1][0]) / 2),
        int((cropped_global_dop_bbox[0][1] + cropped_global_dop_bbox[1][1]) / 2),
    )
    dop_bbox_world_space = (
        (
            cropped_global_dop_bbox[0][0] - dop_bbox_center[0],
            cropped_global_dop_bbox[0][1] - dop_bbox_center[1],
        ),
        (
            cropped_global_dop_bbox[1][0] - dop_bbox_center[0],
            cropped_global_dem_bbox[1][1] - dop_bbox_center[1],
        ),
    )
    metadata = {
        "dem": {
            "global_min_height": float(global_min_height),
            "global_max_height": float(global_max_height),
            "bbox": [
                int(cropped_global_dem_bbox[0][0]),
                int(cropped_global_dem_bbox[0][1]),
                int(cropped_global_dem_bbox[1][0]),
                int(cropped_global_dem_bbox[1][1]),
            ],
            "bbox_center": [
                dem_bbox_center[0],
                dem_bbox_center[1],
            ],
            "bbox_world_space": [
                int(dem_bbox_world_space[0][0]),
                int(dem_bbox_world_space[0][1]),
                int(dem_bbox_world_space[1][0]),
                int(dem_bbox_world_space[1][1]),
            ],
            "meters_to_px": DEM_M_TO_PX,
            "lod_levels": lod_levels,
        },
        "dop": {
            "bbox": [
                int(cropped_global_dop_bbox[0][0]),
                int(cropped_global_dop_bbox[0][1]),
                int(cropped_global_dop_bbox[1][0]),
                int(cropped_global_dop_bbox[1][1]),
            ],
            "bbox_center": [
                dop_bbox_center[0],
                dop_bbox_center[1],
            ],
            "bbox_world_space": [
                int(dop_bbox_world_space[0][0]),
                int(dop_bbox_world_space[0][1]),
                int(dop_bbox_world_space[1][0]),
                int(dop_bbox_world_space[1][1]),
            ],
            "meters_to_px": DOP_M_TO_PX,
            "lod_levels": lod_levels,
        },
        "levels": lod_levels_info,
    }
    metadata_file_path = Path(out_dir) / "metadata.json"
    with open(metadata_file_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata to {metadata_file_path}")

    print("\nDone")


if __name__ == "__main__":
    use_patching = True
    config_file_path = "./preprocess-config.json"

    # Load parameters from json config
    if not os.path.exists(config_file_path):
        raise RuntimeError(f"Config file not found: {config_file_path}")

    with open(config_file_path, "r") as f:
        config = json.load(f)
        active_config_name = config.get("active", None)
        if not active_config_name:
            raise RuntimeError("No active config specified in preprocess-config.json")

        active_config = config.get(active_config_name, None)
        if not active_config:
            raise RuntimeError(
                f"Active config '{active_config_name}' not found in preprocess-config.json"
            )
        use_patching = active_config.get("use_patching", True)
        skip_download = active_config.get("skip_download", False)
        dem_csv_path = active_config.get("dem_csv_path", None)
        dop_csv_path = active_config.get("dop_csv_path", None)
        dem_download_dir = active_config.get("dem_download_dir", None)
        dop_download_dir = active_config.get("dop_download_dir", None)
        output_dir = active_config.get("output_dir", None)
        tile_size_px = active_config.get("tile_size_px", 500)
        print("Config file found. Using the following parameters:")
        print(json.dumps(active_config, indent=2))

    if not skip_download:
        if use_patching:
            dem_csv_patched_path = f"{dem_csv_path}.patched"
            print("Patching SwissALTI3D CSV for missing tiles...")
            patch_swisstopo_csv(dem_csv_path, dem_csv_patched_path, type="dem")

        print("Downloading SwissALTI3D tiles...")
        if use_patching:
            download_tiles_from_csv(dem_csv_patched_path, dem_download_dir)
        else:
            download_tiles_from_csv(dem_csv_path, dem_download_dir)

        if use_patching:
            dop_csv_patched_path = f"{dop_csv_path}.patched"
            print("Patching SwissIMAGE CSV for missing tiles...")
            patch_swisstopo_csv(dop_csv_path, dop_csv_patched_path, type="dop")

        print("Downloading SwissIMAGE tiles...")
        if use_patching:
            download_tiles_from_csv(dop_csv_patched_path, dop_download_dir)
        else:
            download_tiles_from_csv(dop_csv_path, dop_download_dir)

    print("Starting preprocessing pipeline...")
    preprocess(dem_download_dir, dop_download_dir, output_dir, tile_size_px)
