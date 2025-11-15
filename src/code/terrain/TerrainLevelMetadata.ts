import * as THREE from "three"

export interface TerrainLevelMetadata {
    level: number
    demImagePath: string
    dopImagePath: string
    bboxWorldSpace: THREE.Box2
    minElevation: number
    maxElevation: number
    meanElevation: number
    tileX: number
    tileY: number
}
