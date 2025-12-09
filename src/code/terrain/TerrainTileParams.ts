import { IndexStitchingMode } from "../Utils/IndexStitchingMode"
import * as THREE from 'three';

export type TerrainTileParams = {
    id: string, // unique identifier for the tile consists of lod level and x/z position (which is the center of the plane)
    xPos: number,
    zPos: number,
    size: number,
    bounds: THREE.Box2,
    anistropy: number,
    resolution: number
    dopTexturePath: string,
    demTexturePath: string,
    wireframe: boolean,
    shouldUseDemTexture: boolean,
    enableStitchingColor: boolean,
    enableBoxHelper: boolean,
    minHeightScale: number,
    maxHeightScale: number,
    stitchingMode: IndexStitchingMode
}
