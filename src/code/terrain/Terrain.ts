import * as THREE from "three"
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainTileManager } from "./TerrainTileManager";
import { QuadTree } from "../QuadTree/QuadTree";
import { QuadTreeHelper } from "../QuadTree/QuadTreeHelper";
import { Player } from '../Player';
import { OrbitControls } from "three/examples/jsm/Addons.js"

export class Terrain extends THREE.Group {
    private _tweaks = {
        wireframe: false,
        anisotropy: 16,
        enableQuadTreeVisualization: true,
    }

    // TODO: Make these paths selectable via dropdown in Tweakpane
    private _terrainMetadataPath = "/static/data/output_tiles-sargans/terrain_metadata.json"

    private _terrainTiles: TerrainTile[] = []
    private _metadata: TerrainMetadata | null = null
    private _shouldUseDemTexture: boolean = false
    private _camera: THREE.PerspectiveCamera
    private _defaultCameraPosition = new THREE.Vector3(0, 1, 2)
    private _cameraQuadTreeVisualization: THREE.PerspectiveCamera
    private _defaultQuadTreeVisualizationCameraPosition = new THREE.Vector3(0, 3, 0)
    private _player: Player | null = null
    private _playerStartPosition: THREE.Vector3 | null = null
    private _quadTree: QuadTree | null = null
    private _quadTreeHelper: QuadTreeHelper | null = null
    private _orbitControls: OrbitControls

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

    get activeCamera(): THREE.PerspectiveCamera {
        if (this._tweaks.enableQuadTreeVisualization) {
            return this._cameraQuadTreeVisualization
        }
        return this._camera
    }

    constructor() {
        super()

        const aspect = App.instance.aspect
        this._camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this._camera.position.copy(this._defaultCameraPosition)

        this._cameraQuadTreeVisualization = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this._cameraQuadTreeVisualization.position.copy(this._defaultQuadTreeVisualizationCameraPosition)

        this._orbitControls = new OrbitControls(this._camera, App.instance.renderer.domElement)
        this._orbitControls.enableDamping = true
        this.setupTweaks()
    }

    set shouldUseDemTexture(shouldUse: boolean) {
        this._shouldUseDemTexture = shouldUse
        for (const tile of this._terrainTiles) {
            tile.useDemTexture = shouldUse
        }
    }

    async initialize(): Promise<void> {
        await TerrainTileManager.initializeFromMetadata(this._terrainMetadataPath)
        this._metadata = TerrainTileManager.terrainMetadata
        if (!this._metadata) {
            console.error("Terrain: Failed to load terrain metadata!")
            return
        }

        const maxDepth = this.maxLevel
        this._quadTree = new QuadTree(this.boundingBox!, maxDepth)

        this._quadTreeHelper = new QuadTreeHelper(this._quadTree)
        this.add(this._quadTreeHelper)

        this._camera.lookAt(this.center)

        this._playerStartPosition = new THREE.Vector3(
            this.center.x,
            0.0,
            this.center.z,
        )

        this._player = new Player(this._playerStartPosition)
        this._cameraQuadTreeVisualization.position.x = this._playerStartPosition.x
        this._cameraQuadTreeVisualization.position.z = this._playerStartPosition.z
        this._cameraQuadTreeVisualization.rotation.x = -Math.PI / 2

        this.toggleQuadTreeVisualization(this._tweaks.enableQuadTreeVisualization)

        App.instance.scene.add(this)
    }

    onResize(aspect: number): void {
        this._camera.aspect = aspect
        this._camera.updateProjectionMatrix()

        this._cameraQuadTreeVisualization.aspect = aspect
        this._cameraQuadTreeVisualization.updateProjectionMatrix()
    }

    update(dt: number) {
        this._orbitControls.update()
        this._player?.update(dt)
        this._quadTree?.insertPosition(this._player!.position2D)
        this._quadTreeHelper?.update()

        const quadTreeNodes = this._quadTree?.getChildren() || []
        const resolution = 33

        // Track player position
        if (this._tweaks.enableQuadTreeVisualization) {
            this._cameraQuadTreeVisualization.position.x = this._player!.position.x
            this._cameraQuadTreeVisualization.position.z = this._player!.position.z
        }

        // Figure out which tiles we can remove, e.g. tiles that are not in the quadTreeNodes.
        for (const tile of this._terrainTiles) {
            const foundNode = quadTreeNodes.find(node => node.id === tile.id)
            if (!foundNode) {
                // Remove tile
                this.remove(tile.mesh)
                const tileIndex = this._terrainTiles.indexOf(tile)
                this._terrainTiles.splice(tileIndex, 1)
                tile.dispose()
            }
        }

        for (const node of quadTreeNodes) {
            const foundExistingTile = this._terrainTiles.find(tile => tile.id === node.id)
            if (foundExistingTile) {
                foundExistingTile.useDemTexture = this._shouldUseDemTexture
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

    private toggleQuadTreeVisualization(enabled: boolean): void {
        if (enabled) {
            this._quadTreeHelper!.visible = true
            this.shouldUseDemTexture = false
        }
        else {
            this._quadTreeHelper!.visible = false
            this.shouldUseDemTexture = true
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

        folder.addBinding(this._tweaks, "enableQuadTreeVisualization", {
            label: "Enable QuadTree Visualization"
        }).on("change", (e) => {
            this.toggleQuadTreeVisualization(e.value)
        })
    }
}
