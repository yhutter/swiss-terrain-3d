import * as THREE from "three"
import { TerrainLevelMetadata } from "./TerrainLevelMetadata"

export interface TerrainMetadata {
    bboxWorldSpace: THREE.Box2,
    levels: TerrainLevelMetadata[]
}
