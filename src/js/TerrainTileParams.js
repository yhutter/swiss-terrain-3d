export class TerrainTileParams {
    /** @type {number} */
    size

    /** @type {number} */
    resolution

    /** @type {string} */
    dopPath

    /** @type {string} */
    demPath

    /**
     * @param {number} size
     * @param {number} resolution
     * @param {string} dopPath
     * @param {string} demPath
     */
    constructor(size, resolution, dopPath, demPath) {
        this.size = size
        this.resolution = resolution
        this.dopPath = dopPath
        this.demPath = demPath
    }
}
