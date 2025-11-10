import * as THREE from "three/build/three.webgpu"
import { TerrainTileParams } from './TerrainTileParams';
import { App } from './App.js';
import { TerrainTile } from "./TerrainTile.js";
import { TerrainMetadata } from "./TerrainMetadata.js";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata.js";
import { mx_hash_int_4 } from "three/src/nodes/materialx/lib/mx_noise.js";

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
     * @param {number} resolution 
     * @param {boolean} wireframe 
     * @returns {Promise<TerrainTile>}
     */
    async #createTerrainTile(
        tileInfo,
        resolution = 512,
        wireframe = false,
    ) {
        const dopTexture = await App.instance.textureLoader.loadAsync(tileInfo.dopImagePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace

        const demTexture = await App.instance.textureLoader.loadAsync(tileInfo.demImagePath)

        const size = tileInfo.normalizeBoundingBox.getSize(new THREE.Vector2())

        const terrainTileParams = new TerrainTileParams(
            size.x * this.#renderScale,
            resolution,
            dopTexture,
            demTexture,
            wireframe,
        )
        const terrainTile = new TerrainTile(terrainTileParams)

        // Position the tile based on the normalized bounding box
        const center = tileInfo.normalizeBoundingBox.getCenter(new THREE.Vector2())
        terrainTile.mesh?.position.set(
            center.x * this.#renderScale,
            0,
            // The minus here is important to flip the Y axis to match Three.js coordinate system
            -center.y * this.#renderScale,
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
        for (const tileInfo of exampleTiles) {
            const terrainTile = await this.#createTerrainTile(
                tileInfo,
                128,
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
