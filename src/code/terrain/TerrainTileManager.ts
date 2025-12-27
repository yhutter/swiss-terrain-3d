import * as THREE from "three/webgpu"
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainMetadataParser } from "./TerrainMetadataParser";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata";
import { TerrainTile } from "./TerrainTile";
import { TerrainTileParams } from "./TerrainTileParams";
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";
import { App } from "../App";

export class TerrainTileManager {

    private static _terrainMetadata: TerrainMetadata | null = null;
    private static _demTextureCache = new Map<string, THREE.Texture>();
    private static _dopTextureCache = new Map<string, THREE.Texture>();


    static get terrainMetadata(): TerrainMetadata | null {
        return this._terrainMetadata;
    }

    static async initialize(metadataPath: string): Promise<void> {
        await TerrainTileManager.initializeFromMetadata(metadataPath);
        await TerrainTileManager.preloadTextures();
    }

    private static async initializeFromMetadata(metadataPath: string) {
        TerrainTileManager._terrainMetadata = await TerrainMetadataParser.parseFromJson(metadataPath);
    }

    private static async preloadTextures() {
        if (this._terrainMetadata === null) {
            console.warn("TerrainTileManager: Terrain metadata not initialized.");
            return;
        }

        const textureLoader = new THREE.TextureLoader();

        const demPromises = this._terrainMetadata.levels.map(async (level) => {
            if (!this._demTextureCache.has(level.demImagePath)) {
                const demTexture = await textureLoader.loadAsync(level.demImagePath);
                demTexture.generateMipmaps = false
                demTexture.wrapS = THREE.ClampToEdgeWrapping
                demTexture.wrapT = THREE.ClampToEdgeWrapping
                this._demTextureCache.set(level.demImagePath, demTexture);
            }
        });

        const dopPromises = this._terrainMetadata.levels.map(async (level) => {
            if (!this._dopTextureCache.has(level.dopImagePath)) {
                const dopTexture = await textureLoader.loadAsync(level.dopImagePath);
                dopTexture.colorSpace = THREE.SRGBColorSpace
                // In WebGPU anisotropic filtering cannot be changed afterwards therefore we set it directly here and do not expose a tweak for it.
                dopTexture.anisotropy = App.instance.renderer.getMaxAnisotropy()
                dopTexture.generateMipmaps = true
                dopTexture.minFilter = THREE.LinearMipmapLinearFilter
                dopTexture.magFilter = THREE.LinearFilter
                this._dopTextureCache.set(level.dopImagePath, dopTexture);
            }
        });

        await Promise.all([...demPromises, ...dopPromises]);
    }

    static requestTerrainTileForNode(
        node: QuadTreeNode,
        wireframe: boolean,
        shouldUseDemTexture: boolean,
        enableBoxHelper: boolean,
        enableLineMesh: boolean,
        enableStitchingColor: boolean): TerrainTile | null {

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

        const dopTexture = this._dopTextureCache.get(terrainTileInfo.dopImagePath);
        if (!dopTexture) {
            console.error(`TerrainTileManager: DOP texture not preloaded for path ${terrainTileInfo.dopImagePath}.`);
            return null;
        }


        const demTexture = this._demTextureCache.get(terrainTileInfo.demImagePath);
        if (!demTexture) {
            console.error(`TerrainTileManager: DEM texture not preloaded for path ${terrainTileInfo.demImagePath}.`);
            return null;
        }

        const params: TerrainTileParams = {
            id: node.id,
            level: node.level,
            xPos: xPos,
            zPos: zPos,
            bounds: node.bounds,
            size: node.size.x,
            dopTexture: dopTexture,
            demTexture: demTexture,
            wireframe: wireframe,
            shouldUseDemTexture: shouldUseDemTexture,
            enableBoxHelper: enableBoxHelper,
            enableLineMesh: enableLineMesh,
            enableStichingColor: enableStitchingColor,
            minHeightScale: TerrainTileManager._terrainMetadata.globalMinElevation,
            maxHeightScale: TerrainTileManager._terrainMetadata.globalMaxElevation,
            stitchingMode: node.indexStitchingMode,
        };

        const tile = new TerrainTile(params);
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
