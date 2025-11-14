import { TerrainLevelMetadata } from "./TerrainLevelMetadata"

export interface TerrainMetadata {
    centerX: number
    centerY: number
    levels: TerrainLevelMetadata[]
}
