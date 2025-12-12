import * as THREE from "three/webgpu"
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainMetadataParser } from "./TerrainMetadataParser";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata";
import { TerrainTile } from "./TerrainTile";
import { TerrainTileParams } from "./TerrainTileParams";
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";

export class TerrainTileManager {

    private static _terrainMetadata: TerrainMetadata | null = null;
    private static _terrainTileGeometryCache = new Map<string, THREE.BufferGeometry>();


    static get terrainMetadata(): TerrainMetadata | null {
        return this._terrainMetadata;
    }

    static async initializeFromMetadata(metadataPath: string) {
        TerrainTileManager._terrainMetadata = await TerrainMetadataParser.parseFromJson(metadataPath);
    }

    static async requestTerrainTileForNode(
        node: QuadTreeNode,
        anisotropy: number,
        wireframe: boolean,
        shouldUseDemTexture: boolean,
        enableBoxHelper: boolean,
        enableLineMesh: boolean,
        enableStitchingColor: boolean): Promise<TerrainTile | null> {

        if (TerrainTileManager._terrainMetadata === null) {
            console.warn("TerrainTileManager: Terrain metadata not initialized.");
            return null;
        }

        const terrainTileInfo = this.getTileInfoForNode(node);
        if (!terrainTileInfo) {
            debugger
            console.error("TerrainTileManager: No tile metadata found for the given node.");
            return null;
        }

        const xPos = terrainTileInfo.centerWorldSpace.x;
        const zPos = terrainTileInfo.centerWorldSpace.y;


        const params: TerrainTileParams = {
            id: node.id,
            level: node.level,
            xPos: xPos,
            zPos: zPos,
            bounds: node.bounds,
            size: node.size.x,
            anistropy: anisotropy,
            dopTexturePath: terrainTileInfo.dopImagePath,
            demTexturePath: terrainTileInfo.demImagePath,
            wireframe: wireframe,
            shouldUseDemTexture: shouldUseDemTexture,
            enableBoxHelper: enableBoxHelper,
            enableLineMesh: enableLineMesh,
            enableStichingColor: enableStitchingColor,
            minHeightScale: TerrainTileManager._terrainMetadata.globalMinElevation,
            maxHeightScale: TerrainTileManager._terrainMetadata.globalMaxElevation,
            stitchingMode: node.indexStitchingMode,
        };

        const tile = await TerrainTile.createFromParams(params);
        // this._terrainTileCache.push(tile);
        return tile;
    }

    private static getTileInfoForNode(node: QuadTreeNode): TerrainLevelMetadata | null {
        if (!this._terrainMetadata) {
            console.warn("TerrainTileManager: Terrain metadata not initialized.");
            return null;
        }
        const tileInfo = this._terrainMetadata.levels.filter((t) => t.level === node.level && t.centerWorldSpace.x === node.center.x && t.centerWorldSpace.y === node.center.y);
        if (!tileInfo) {
            console.warn(`TerrainTileManager: No tile infos found for level ${node.level}.`);
        }
        if (tileInfo.length > 1) {
            console.warn(`TerrainTileManager: Multiple tile infos found for level ${node.level}, center (${node.center.x}, ${node.center.y}). Using the first one.`);

        }
        return tileInfo[0];
    }
}
