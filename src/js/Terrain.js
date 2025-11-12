import * as THREE from "three/build/three.webgpu"
import { TerrainTileParams } from './TerrainTileParams';
import { App } from './App.js';
import { TerrainTile } from "./TerrainTile.js";
import { TerrainMetadata } from "./TerrainMetadata.js";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata.js";

export class Terrain extends THREE.Group {
    #tweaks = {
        wireframe: false,
        animate: false,
    }

    /** @type {TerrainTile[]} */
    #terrainTiles = []

    /** @type {number} */
    #renderScale = 1.0

    #setupTweaks() {
        const folder = App.instance.pane.addFolder({
            title: 'Terrain',
            expanded: true,
        })

        folder.addBinding(this.#tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            for (const tile of this.#terrainTiles) {
                if (tile.material) {
                    tile.material.wireframe = e.value
                    tile.material.needsUpdate = true
                }
            }
        })

        folder.addBinding(this.#tweaks, "animate", {
            label: "Animate",
        })
    }

    /** 
     * Creates a Terrain instance with the provided render scale.
     * @param {number} renderScale
     */
    constructor(renderScale) {
        super()
        this.#renderScale = renderScale
        this.#setupTweaks()
    }

    /** 
     * @param {TerrainLevelMetadata} tileInfo
     * @param {number} maxTile
     * @param {number} resolution
     * @param {boolean} wireframe 
     * @returns {Promise<TerrainTile>}
     */
    async #createTerrainTile(
        tileInfo,
        maxTile,
        resolution = 512,
        wireframe = false,
    ) {
        const dopTexture = await App.instance.textureLoader.loadAsync(tileInfo.dopImagePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace
        dopTexture.wrapS = THREE.ClampToEdgeWrapping
        dopTexture.wrapT = THREE.ClampToEdgeWrapping

        const demTexture = await App.instance.textureLoader.loadAsync(tileInfo.demImagePath)
        demTexture.wrapS = THREE.ClampToEdgeWrapping
        demTexture.wrapT = THREE.ClampToEdgeWrapping
        demTexture.generateMipmaps = false
        demTexture.minFilter = THREE.LinearFilter
        demTexture.magFilter = THREE.LinearFilter

        const boundingBoxSize = tileInfo.normalizeBoundingBox.getSize(new THREE.Vector2())
        const size = boundingBoxSize.x * this.#renderScale

        const terrainTileParams = new TerrainTileParams(
            size,
            resolution,
            dopTexture,
            demTexture,
            wireframe,
        )
        const terrainTile = new TerrainTile(terrainTileParams)

        const tileSize = boundingBoxSize.x * this.#renderScale;
        const posX = (tileInfo.tileX - 0.5 * maxTile) * tileSize;
        const posZ = (tileInfo.tileY - 0.5 * maxTile) * tileSize;

        terrainTile.mesh?.position.set(
            posX,
            0,
            posZ,
        )
        return terrainTile
    }

    /** 
     * Load terrain from metadata.
     * @param {string} metadataPath 
     */
    async loadTerrain(metadataPath) {
        const metadata = await TerrainMetadata.loadFromJson(metadataPath)

        // Load all tiles of same level
        const exampleTiles = metadata.levels.filter(level => level.level === 0)
        const defaultResolution = 128

        // Because the tiles are always square we can take either x or y
        const maxTile = Math.max(...exampleTiles.map(t => t.tileX))

        for (const tileInfo of exampleTiles) {
            const includeEdge = tileInfo.tileX === maxTile
            const resolution = (defaultResolution - 1) - (includeEdge ? 0 : 1)
            const terrainTile = await this.#createTerrainTile(
                tileInfo,
                maxTile,
                resolution,
                this.#tweaks.wireframe,
            )
            this.#terrainTiles.push(terrainTile)
        }

        for (const tile of this.#terrainTiles) {
            if (tile.mesh) {
                this.add(tile.mesh)
            }
        }
        App.instance.scene.add(this)
    }

    /** 
     * @param {number} dt 
     */
    update(dt) {
        if (this.#tweaks.animate) {
            this.rotateY(Math.PI * dt * 0.1)
        }
    }
}
