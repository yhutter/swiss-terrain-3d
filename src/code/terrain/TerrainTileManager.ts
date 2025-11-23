import * as THREE from "three";
import { App } from "../App";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainMetadataParser } from "./TerrainMetadataParser";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata";
import { TerrainTile } from "./TerrainTile";
import { TerrainTileParams } from "./TerrainTileParams";
import { QuadTreeNode } from "../quadtree/QuadTreeNode";

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
        const tileId = this.generateTileId(node.level, node.center.x, node.center.y);

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
            console.warn("TerrainTileManager: No tile metadata found for the given node.");
            debugger
            return null;
        }

        const xPos = terrainTileInfo.centerWorldSpace.x;
        const zPos = terrainTileInfo.centerWorldSpace.y;

        const tile = await this.createTerrainTile(
            tileId,
            terrainTileInfo.dopImagePath,
            terrainTileInfo.demImagePath,
            xPos,
            zPos,
            node.size.x,
            anisotropy,
            resolution,
            wireframe,
            shouldUseDemTexture,
            terrainTileInfo.globalMinElevation,
            terrainTileInfo.globalMaxElevation,
        );
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

    private static generateTileId(level: number, x: number, z: number): string {
        return `lod${level}_x${x}_z${z}`;
    }

    private static async createTerrainTile(
        id: string,
        dopImagePath: string,
        demImagePath: string,
        xPos: number,
        zPos: number,
        size: number,
        anisotropy: number,
        resolution: number,
        wireframe: boolean,
        useDemTexture: boolean,
        minHeightScale: number,
        maxHeightScale: number,
    ): Promise<TerrainTile> {
        const dopTexture = await App.instance.textureLoader.loadAsync(dopImagePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace
        dopTexture.wrapS = THREE.ClampToEdgeWrapping
        dopTexture.wrapT = THREE.ClampToEdgeWrapping
        dopTexture.generateMipmaps = true
        dopTexture.anisotropy = anisotropy

        const demTexture = await App.instance.textureLoader.loadAsync(demImagePath)
        demTexture.wrapS = THREE.ClampToEdgeWrapping
        demTexture.wrapT = THREE.ClampToEdgeWrapping
        demTexture.generateMipmaps = true
        demTexture.minFilter = THREE.LinearFilter
        demTexture.magFilter = THREE.LinearFilter
        const terrainTileParams: TerrainTileParams = {
            id: id,
            xPos: xPos,
            zPos: zPos,
            size: size,
            resolution: resolution,
            dopTexture: dopTexture,
            demTexture: demTexture,
            wireframe: wireframe,
            shouldUseDemTexture: useDemTexture,
            minHeightScale: minHeightScale,
            maxHeightScale: maxHeightScale,
        }
        return new TerrainTile(terrainTileParams)
    }
}
