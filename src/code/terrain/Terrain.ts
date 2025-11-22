import * as THREE from "three"
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainTileManager } from "./TerrainTileManager";
import { QuadTreeNode } from "../quadtree/QuadTreeNode";

export class Terrain extends THREE.Group {
    private _tweaks = {
        wireframe: false,
        anisotropy: 16,
    }

    private _terrainTiles: TerrainTile[] = []
    private _metadata: TerrainMetadata | null = null
    private _shouldUseDemTexture: boolean = false

    get center(): THREE.Vector3 {
        if (!this._metadata) {
            return new THREE.Vector3(0)
        }
        const center = new THREE.Vector2()
        this._metadata.bboxWorldSpace.getCenter(center)
        return new THREE.Vector3(
            center.x,
            0,
            center.y,
        )
    }

    get maxLevel(): number {
        if (!this._metadata) {
            return 0
        }
        return Math.max(...this._metadata.levels.map(level => level.level))
    }

    get boundingBox(): THREE.Box2 | null {
        if (!this._metadata) {
            return null
        }
        return this._metadata.bboxWorldSpace
    }

    constructor() {
        super()
        this.setupTweaks()
    }

    set shouldUseDemTexture(shouldUse: boolean) {
        this._shouldUseDemTexture = shouldUse
        for (const tile of this._terrainTiles) {
            tile.useDemTexture = shouldUse
        }
    }

    async initialize(metadataPath: string): Promise<void> {
        await TerrainTileManager.initializeFromMetadata(metadataPath)
        this._metadata = TerrainTileManager.terrainMetadata!
        App.instance.scene.add(this)
    }

    update(dt: number, quadTreeNodes: QuadTreeNode[]) {
        const resolution = 33
        for (const node of quadTreeNodes) {
            const foundExistingTile = this._terrainTiles.find(tile => tile.id === node.id)
            if (foundExistingTile) {
                continue
            }
            TerrainTileManager.requestTerrainTileForNode(node, this._tweaks.anisotropy, resolution, this._tweaks.wireframe, this._shouldUseDemTexture).then((tile) => {
                if (!tile) {
                    console.error(`Terrain: Failed to get tile for node ${node.id}`)
                    return
                }
                this._terrainTiles.push(tile)
                // TODO: Fix this warning here
                this.add(tile.mesh)
            })
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
    }
}
