import * as THREE from "three/webgpu"
import { TerrainLevelMetadata } from "./TerrainLevelMetadata"

export type TerrainMetadata = {
    bboxWorldSpace: THREE.Box2,
    globalMinElevation: number,
    globalMaxElevation: number,
    levels: TerrainLevelMetadata[]
}
