from osgeo import gdal
import csv
import json


def generate_height_map_from_tif(input_file, output_file):
    ds = gdal.Open(input_file)
    band = ds.GetRasterBand(1)
    min_val, max_val, _, _ = band.GetStatistics(True, True)

    translate_options = gdal.TranslateOptions(
        format="GTiff",
        outputType=gdal.GDT_UInt16,
        scaleParams=[[min_val, max_val, 0, 65535]],
    )

    gdal.Translate(destName=output_file, srcDS=input_file, options=translate_options)

    print("Heightmap successuflly created:", output_file)


def convert_metadata_to_json(csv_path, json_path):
    """
    The generated csv file does not contain headers and directly the raw data. However the data in the columns corresponds to the following:
    filename: The name of the tile (e.g., tile_01_01).
    minx: The minimum X-coordinate of the tile's bounding box.
    maxx: The maximum X-coordinate of the tile's bounding box.
    miny: The minimum Y-coordinate of the tile's bounding box.
    maxy: The maximum Y-coordinate of the tile's bounding box.
    """
    tiles = []
    with open(csv_path) as f:
        reader = csv.reader(f, delimiter=";")
        for row in reader:
            file_path = row[0]
            min_x = float(row[1])
            min_y = float(row[2])
            max_x = float(row[3])
            max_y = float(row[4])
            tiles.append(
                {
                    "file": file_path,
                    "bbox": [
                        min_x,
                        min_y,
                        max_x,
                        max_y,
                    ],
                }
            )

    with open(json_path, "w") as f:
        json.dump(tiles, f, indent=4)
    print(f"Generated Metadatafile {json_path}")


def get_bbox_from_geotiff(geotiff_path):
    ds = gdal.Open(geotiff_path)
    gt = ds.GetGeoTransform()
    x_size = ds.RasterXSize
    y_size = ds.RasterYSize

    def pixel_to_geo(px, py):
        x = gt[0] + px * gt[1] + py * gt[2]
        y = gt[3] + px * gt[4] + py * gt[5]
        return x, y

    # Compute four corners of bounding box
    ulx, uly = pixel_to_geo(0, 0)
    urx, ury = pixel_to_geo(x_size, 0)
    llx, lly = pixel_to_geo(0, y_size)
    lrx, lry = pixel_to_geo(x_size, y_size)

    # Derive min/max values
    min_x = min(ulx, urx, llx, lrx)
    max_x = max(ulx, urx, llx, lrx)
    min_y = min(uly, ury, lly, lry)
    max_y = max(uly, ury, lly, lry)

    ds = None

    return (min_x, min_y, max_x, max_y)


def extract_image_region(
    mosaic_path, output_path, bbox, format="GTiff", size=(1024, 1024)
):
    minX, minY, maxX, maxY = bbox

    warp_options = gdal.WarpOptions(
        format=format,
        outputBounds=(minX, minY, maxX, maxY),
        width=size[0],
        height=size[1],
        resampleAlg=gdal.GRA_Bilinear,  # smoother resampling for imagery
    )

    print(f"Extracting texture for bbox: {bbox}")
    gdal.Warp(
        destNameOrDestDS=output_path, srcDSOrSrcDSTab=mosaic_path, options=warp_options
    )
    print(f"Saved cropped image to {output_path}")
