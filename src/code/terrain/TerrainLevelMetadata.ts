import * as THREE from "three"

export type TerrainLevelMetadata = {
    level: number
    demImagePath: string
    dopImagePath: string
    bboxWorldSpace: THREE.Box2
    centerWorldSpace: THREE.Vector2
    minElevation: number
    maxElevation: number
    meanElevation: number
    tileX: number
    tileY: number
}
