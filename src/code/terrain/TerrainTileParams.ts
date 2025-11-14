import * as THREE from "three"

export interface TerrainTileParams {
    size: number
    resolution: number
    dopTexture: THREE.Texture
    demTexture: THREE.Texture
    wireframe: boolean
}
