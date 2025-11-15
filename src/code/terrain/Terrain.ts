import * as THREE from "three"
import { TerrainTileParams } from './TerrainTileParams';
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadataParser } from "./TerrainMetadataParser";
import { TerrainLevelMetadata } from "./TerrainLevelMetadata";

export class Terrain extends THREE.Group {
    private _tweaks = {
        wireframe: false,
        animate: false,
        anisotropy: 16,
    }

    private _terrainTiles: TerrainTile[] = []
    private _renderScale: number = 1.0

    constructor(renderScale: number) {
        super()
        this._renderScale = renderScale
        this.setupTweaks()
    }

    async loadTerrain(metadataPath: string): Promise<void> {
        const metadata = await TerrainMetadataParser.parseFromJson(metadataPath)

        // Load all tiles of same level
        const exampleTiles = metadata.levels.filter(level => level.level === 0)

        // Because the tiles are always square we can take either x or y
        const maxTile = Math.max(...exampleTiles.map(t => t.tileX))

        const resolution = 128
        for (const tileInfo of exampleTiles) {
            const terrainTile = await this.createTerrainTile(
                tileInfo,
                maxTile,
                resolution,
                this._tweaks.wireframe,
            )
            this._terrainTiles.push(terrainTile)
        }

        for (const tile of this._terrainTiles) {
            if (tile.mesh) {
                this.add(tile.mesh)
            }
        }
        App.instance.scene.add(this)
    }

    update(dt: number): void {
        if (this._tweaks.animate) {
            this.rotateY(Math.PI * dt * 0.1)
        }
    }

    private setupTweaks(): void {
        const folder = App.instance.pane.addFolder({
            title: 'Terrain',
            expanded: true,
        })

        folder.addBinding(this._tweaks, "anisotropy", {
            label: "Anisotropy",
            min: 1,
            max: 32,
            step: 1,
        }).on("change", (e) => {
            for (const tile of this._terrainTiles) {
                if (tile.dopTexture) {
                    tile.dopTexture.anisotropy = e.value
                    tile.dopTexture.needsUpdate = true
                }
            }
        })

        folder.addBinding(this._tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            for (const tile of this._terrainTiles) {
                if (tile.material) {
                    tile.material.wireframe = e.value
                    tile.material.needsUpdate = true
                }
            }
        })

        folder.addBinding(this._tweaks, "animate", {
            label: "Animate",
        })
    }


    private async createTerrainTile(
        tileInfo: TerrainLevelMetadata,
        maxTile: number,
        resolution: number = 512,
        wireframe: boolean = false,
    ): Promise<TerrainTile> {
        const dopTexture = await App.instance.textureLoader.loadAsync(tileInfo.dopImagePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace
        dopTexture.wrapS = THREE.ClampToEdgeWrapping
        dopTexture.wrapT = THREE.ClampToEdgeWrapping
        dopTexture.generateMipmaps = true
        dopTexture.anisotropy = this._tweaks.anisotropy

        const demTexture = await App.instance.textureLoader.loadAsync(tileInfo.demImagePath)
        demTexture.wrapS = THREE.ClampToEdgeWrapping
        demTexture.wrapT = THREE.ClampToEdgeWrapping
        demTexture.generateMipmaps = true
        demTexture.minFilter = THREE.LinearFilter
        demTexture.magFilter = THREE.LinearFilter

        // We assume that all bounding boxes are square
        const boundingBoxSize = tileInfo.bboxWorldSpace.getSize(new THREE.Vector2())
        const size = boundingBoxSize.x * this._renderScale

        const terrainTileParams: TerrainTileParams = {
            size,
            resolution,
            dopTexture,
            demTexture,
            wireframe,
        }
        const terrainTile = new TerrainTile(terrainTileParams)

        const posX = tileInfo.bboxWorldSpace.min.x * this._renderScale;
        const posZ = tileInfo.bboxWorldSpace.min.y * this._renderScale;

        terrainTile.mesh?.position.set(
            posX,
            0,
            posZ,
        )
        return terrainTile
    }
}
