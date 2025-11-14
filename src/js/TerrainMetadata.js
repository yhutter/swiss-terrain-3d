import { TerrainLevelMetadata } from "./TerrainLevelMetadata.js"

export class TerrainMetadata {

    /** @type {number} */
    centerX = 0
    /** @type {number} */
    centerY = 0

    /** @type {TerrainLevelMetadata[]} */
    levels = []

    /**
     * Load terrain metadata from a JSON file.
     * @param {string} jsonPath 
     * @returns {Promise<TerrainMetadata>}
     */
    static async loadFromJson(jsonPath) {
        const response = await fetch(jsonPath)
        if (!response.ok) {
            throw new Error(`Failed to load terrain metadata from ${jsonPath}: ${response.status} ${response.statusText}`)
        }
        const jsonData = await response.json()
        return new TerrainMetadata(jsonData)
    }

    /** 
     * Creates a TerrainMetadata instance from a JSON Object.
     * @param {any} data
     */
    constructor(data) {
        this.centerX = data["center_origin"]?.[0] || 0
        this.centerY = data["center_origin"]?.[1] || 0
        const levelsData = data["levels"] || []
        for (const levelData of levelsData) {
            const levelMetadata = new TerrainLevelMetadata(levelData)
            this.levels.push(levelMetadata)
        }
    }
}
