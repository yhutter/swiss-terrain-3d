import * as THREE from "three"

export type TerrainLevelMetadata = {
    level: number
    demImagePath: string
    demKtxImagePath: string
    dopImagePath: string
    dopKtxImagePath: string
    bboxWorldSpace: THREE.Box2
    centerWorldSpace: THREE.Vector2
}
