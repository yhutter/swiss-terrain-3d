export type TerrainTileParams = {
    id: string, // unique identifier for the tile consists of lod level and x/z position (which is the center of the plane)
    xPos: number,
    zPos: number,
    size: number,
    anistropy: number,
    resolution: number
    dopTexturePath: string,
    demTexturePath: string,
    wireframe: boolean,
    shouldUseDemTexture: boolean,
    minHeightScale: number,
    maxHeightScale: number,
}
