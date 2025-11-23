import * as THREE from "three"

export type TerrainTileParams = {
    id: string, // unique identifier for the tile consists of lod level and x/z position (which is the center of the plane)
    xPos: number,
    zPos: number,
    size: number
    resolution: number
    dopTexture: THREE.Texture
    demTexture: THREE.Texture
    wireframe: boolean,
    shouldUseDemTexture: boolean,
    minHeightScale: number,
    maxHeightScale: number,
}
