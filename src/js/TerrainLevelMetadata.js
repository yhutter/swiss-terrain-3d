import * as THREE from "three"

export class TerrainLevelMetadata {
    /** @type {number} */
    level = 0

    /** @type {string} */
    demImagePath = ""

    /** @type {string} */
    dopImagePath = ""

    /** @type {THREE.Box2} */
    normalizeBoundingBox = new THREE.Box2()

    /** @type {number} */
    minElevation = 0.0

    /** @type {number} */
    maxElevation = 0.0

    /** @type {number} */
    meanElevation = 0.0

    /** @type {number} */
    tileX = 0

    /** @type {number} */
    tileY = 0

    /** 
     * Cleans up the image path to be relative to the /static/ folder.
     * @param {string} path 
     * @returns {string}
     */
    #cleanUpImagePath(path) {
        const staticIndex = path.indexOf("static")
        if (staticIndex !== -1) {
            return "/" + path.substring(staticIndex)
        }
        return path
    }

    /** 
     * Creates a TerrainLevelMetadata instance from a JSON Object.
     * @param {any} data
     */
    constructor(data) {
        this.level = data["level"] || 0
        this.demImagePath = data["dem_image_path"] || ""
        this.dopImagePath = data["dop_image_path"] || ""

        this.demImagePath = this.#cleanUpImagePath(this.demImagePath)
        this.dopImagePath = this.#cleanUpImagePath(this.dopImagePath)

        const normalizedBbox = data["normalized_bbox"] || [0, 0, 0, 0]
        this.normalizeBoundingBox = new THREE.Box2(
            new THREE.Vector2(normalizedBbox[0], normalizedBbox[1]),
            new THREE.Vector2(normalizedBbox[2], normalizedBbox[3]),
        )
        this.minElevation = data["min_elevation"] || 0.0
        this.maxElevation = data["max_elevation"] || 0.0
        this.meanElevation = data["mean_elevation"] || 0.0
        this.tileX = data["tile_x"] || 0
        this.tileY = data["tile_y"] || 0
    }


}
