import * as THREE from "three"

export type TerrainLevelMetadata = {
    level: number
    demImagePath: string
    dopImagePath: string
    bboxWorldSpace: THREE.Box2
    centerWorldSpace: THREE.Vector2
}
