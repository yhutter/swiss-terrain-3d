import * as THREE from "three/build/three.webgpu"
import { TerrainTileParams } from './TerrainTileParams';
import { App } from './App.js';
import { TerrainTile } from "./TerrainTile.js";

export class Terrain extends THREE.Group {
    #tweaks = {
        wireframe: false,
        animate: false,
    }

    /** @type {TerrainTile[]} */
    #terrainTiles = []

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

    constructor() {
        super()
        this.#setupTweaks()
    }

    /** 
     * @param {string} dopTexturePath 
     * @param {string} demTexturePath 
     * @param {number} size 
     * @param {number} resolution 
     * @param {boolean} wireframe 
     * @returns {Promise<TerrainTile>}
     */
    async createTerrainTile(
        dopTexturePath,
        demTexturePath,
        size = 1,
        resolution = 512,
        wireframe = false,
    ) {
        const dopTexture = await App.instance.textureLoader.loadAsync(dopTexturePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace

        const demTexture = await App.instance.textureLoader.loadAsync(demTexturePath)

        const terrainTileParams = new TerrainTileParams(
            size,
            resolution,
            dopTexture,
            demTexture,
            wireframe,
        )
        const terrainTile = new TerrainTile(terrainTileParams)
        return terrainTile
    }

    async loadTerrainTiles() {
        App.instance.textureLoader.setPath("/static/data/output_tiles-sargans/")

        const terrainTile1 = await this.createTerrainTile(
            "dop/level_0/tiles/tile_000_000.tif.png",
            "dem/level_0/tiles/tile_000_000.tif.png",
            1,
            512,
        )

        const terrainTile2 = await this.createTerrainTile(
            "dop/level_0/tiles/tile_000_001.tif.png",
            "dem/level_0/tiles/tile_000_001.tif.png",
            1,
            512,
        )

        terrainTile2.mesh?.position.set(1.0, 0, 0)

        this.#terrainTiles.push(terrainTile1)
        this.#terrainTiles.push(terrainTile2)

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
