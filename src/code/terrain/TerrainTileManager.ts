import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainMetadataParser } from "./TerrainMetadataParser";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata";
import { TerrainTile } from "./TerrainTile";
import { TerrainTileParams } from "./TerrainTileParams";
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";
import { IdGenerator } from "../Utils/IdGenerator";

export class TerrainTileManager {

    private static _terrainMetadata: TerrainMetadata | null = null;
    private static _terrainTileCache: Map<string, TerrainTile> = new Map();


    public static get terrainMetadata(): TerrainMetadata | null {
        return this._terrainMetadata;
    }

    static async initializeFromMetadata(metadataPath: string) {
        TerrainTileManager._terrainMetadata = await TerrainMetadataParser.parseFromJson(metadataPath);
    }

    static async requestTerrainTileForNode(node: QuadTreeNode, anisotropy: number, resolution: number, wireframe: boolean, shouldUseDemTexture: boolean): Promise<TerrainTile | null> {
        const tileId = IdGenerator.generate(node.level, node.center.x, node.center.y);

        // See if we have it in the cache
        if (this._terrainTileCache.has(tileId)) {
            return this._terrainTileCache.get(tileId)!;
        }
        if (!this._terrainMetadata) {
            console.warn("TerrainTileManager: Terrain metadata not initialized.");
            return null;
        }

        const terrainTileInfo = this.getTileInfoForNode(node);
        if (!terrainTileInfo) {
            console.error("TerrainTileManager: No tile metadata found for the given node.");
            return null;
        }

        const xPos = terrainTileInfo.centerWorldSpace.x;
        const zPos = terrainTileInfo.centerWorldSpace.y;

        const params: TerrainTileParams = {
            id: tileId,
            xPos: xPos,
            zPos: zPos,
            size: node.size.x,
            anistropy: anisotropy,
            resolution: resolution,
            dopTexturePath: terrainTileInfo.dopImagePath,
            demTexturePath: terrainTileInfo.demImagePath,
            wireframe: wireframe,
            shouldUseDemTexture: shouldUseDemTexture,
            minHeightScale: terrainTileInfo.globalMinElevation,
            maxHeightScale: terrainTileInfo.globalMaxElevation,
        };

        const tile = await TerrainTile.createFromParams(params);
        this._terrainTileCache.set(tileId, tile);
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
