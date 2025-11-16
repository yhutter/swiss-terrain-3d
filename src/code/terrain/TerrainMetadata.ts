import * as THREE from "three"
import { TerrainLevelMetadata } from "./TerrainLevelMetadata"

export type TerrainMetadata = {
    bboxWorldSpace: THREE.Box2,
    levels: TerrainLevelMetadata[]
}
