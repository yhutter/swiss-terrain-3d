import * as THREE from "three"

export type TerrainTileParams = {
    size: number
    resolution: number
    dopTexture: THREE.Texture
    demTexture: THREE.Texture
    wireframe: boolean
}
