import { IndexStitchingMode } from "../Utils/IndexStitchingMode"
import * as THREE from 'three';

export type TerrainTileParams = {
    id: string, // unique identifier for the tile consists of lod level and x/z position (which is the center of the plane)
    level: number,
    xPos: number,
    zPos: number,
    size: number,
    bounds: THREE.Box2,
    anistropy: number,
    dopTexture: THREE.Texture,
    demTexture: THREE.Texture,
    wireframe: boolean,
    shouldUseDemTexture: boolean,
    enableBoxHelper: boolean,
    enableLineMesh: boolean,
    enableStichingColor: boolean,
    minHeightScale: number,
    maxHeightScale: number,
    stitchingMode: IndexStitchingMode
}
