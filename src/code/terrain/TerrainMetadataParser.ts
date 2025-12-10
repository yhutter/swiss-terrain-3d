import * as THREE from "three/webgpu"
import { TerrainLevelMetadata } from "./TerrainLevelMetadata"
import { TerrainMetadata } from "./TerrainMetadata"
import { App } from "../App"

export class TerrainMetadataParser {
    private static cleanUpImagePath(path: string): string {
        const staticIndex = path.indexOf("static")
        if (staticIndex !== -1) {
            return "/" + path.substring(staticIndex)
        }
        return path
    }

    private static parseTerrainLevelMetadata(data: any): TerrainLevelMetadata {
        const terrainLevelMetadata: TerrainLevelMetadata = {
            level: data["level"] || 0,
            demImagePath: TerrainMetadataParser.cleanUpImagePath(data["dem_image_path"] || ""),
            dopImagePath: TerrainMetadataParser.cleanUpImagePath(data["dop_image_path"] || ""),
            bboxWorldSpace: new THREE.Box2(
                new THREE.Vector2(
                    data["bbox_world_space"]?.[0] || 0,
                    data["bbox_world_space"]?.[1] * -1 || 0
                ),
                new THREE.Vector2(
                    data["bbox_world_space"]?.[2] || 0,
                    data["bbox_world_space"]?.[3] * -1 || 0
                )
            ),
            centerWorldSpace: new THREE.Vector2(),
        }

        terrainLevelMetadata.bboxWorldSpace.min.multiplyScalar(App.instance.renderScale)
        terrainLevelMetadata.bboxWorldSpace.max.multiplyScalar(App.instance.renderScale)
        const center = new THREE.Vector2()
        terrainLevelMetadata.bboxWorldSpace.getCenter(center)
        center.y = center.y // Invert Y axis because of coordinate sytem differences betwen LV95 and Three.js
        terrainLevelMetadata.centerWorldSpace = center

        return terrainLevelMetadata
    }


    static async parseFromJson(jsonPath: string): Promise<TerrainMetadata> {
        const response = await fetch(jsonPath)
        if (!response.ok) {
            throw new Error(`Failed to load terrain metadata from ${jsonPath}: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        const terrainMetadata: TerrainMetadata = {
            bboxWorldSpace: new THREE.Box2(
                new THREE.Vector2(
                    data["dem"]["bbox_world_space"]?.[0] || 0,
                    data["dem"]["bbox_world_space"]?.[1] * -1 || 0
                ),
                new THREE.Vector2(
                    data["dem"]["bbox_world_space"]?.[2] || 0,
                    data["dem"]["bbox_world_space"]?.[3] * -1 || 0
                )
            ),
            globalMinElevation: data["dem"]["global_min_height"] || 0,
            globalMaxElevation: data["dem"]["global_max_height"] || 0,
            levels: [],
        }

        terrainMetadata.bboxWorldSpace.min.multiplyScalar(App.instance.renderScale)
        terrainMetadata.bboxWorldSpace.max.multiplyScalar(App.instance.renderScale)

        terrainMetadata.globalMinElevation *= App.instance.renderScale
        terrainMetadata.globalMaxElevation *= App.instance.renderScale

        const levelsData = data["levels"] || []
        for (const levelData of levelsData) {
            const levelMetadata = TerrainMetadataParser.parseTerrainLevelMetadata(levelData)
            terrainMetadata.levels.push(levelMetadata)
        }
        return terrainMetadata
    }
}
