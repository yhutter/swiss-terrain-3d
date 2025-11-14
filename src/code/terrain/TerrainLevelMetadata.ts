import * as THREE from "three"

export interface TerrainLevelMetadata {
    level: number
    demImagePath: string
    dopImagePath: string
    normalizeBoundingBox: THREE.Box2
    minElevation: number
    maxElevation: number
    meanElevation: number
    tileX: number
    tileY: number
}
