import * as THREE from "three"
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainTileManager } from "./TerrainTileManager";
import { QuadTree } from "../QuadTree/QuadTree";
import { Player } from '../Player';
import { OrbitControls } from "three/examples/jsm/Addons.js"
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";
import { GeometryGenerator } from "../Utils/GeometryGenerator";
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";

export class Terrain extends THREE.Group {

    private _tileSize: number = 33

    private _tweaks = {
        wireframe: false,
        anisotropy: 16,
        enableQuadTreeVisualization: true,
    }

    // TODO: Make these paths selectable via dropdown in Tweakpane
    // private _terrainMetadataPath = "/static/data/output_tiles-sargans/metadata.json"
    private _terrainMetadataPath = "/static/data/output_tiles-sargans/metadata.json"

    private _terrainTiles: TerrainTile[] = []
    private _metadata: TerrainMetadata | null = null
    private _shouldUseDemTexture: boolean = false
    private _camera: THREE.PerspectiveCamera
    private _defaultCameraPosition = new THREE.Vector3(0, 1, 2)
    private _cameraQuadTreeVisualization: THREE.OrthographicCamera
    private _cameraQuadTreeVisualizationFrustumSize = 5
    private _defaultQuadTreeVisualizationCameraPosition = new THREE.Vector3(0, 3, 0)
    private _player: Player | null = null
    private _playerStartPosition: THREE.Vector3 | null = null
    private _quadTree: QuadTree | null = null
    private _orbitControls: OrbitControls
    private _loadingTileIds = new Set<string>();

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

    get activeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
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

        // this._cameraQuadTreeVisualization = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this._cameraQuadTreeVisualization = new THREE.OrthographicCamera(
            this._cameraQuadTreeVisualizationFrustumSize * aspect / -2,
            this._cameraQuadTreeVisualizationFrustumSize * aspect / 2,
            this._cameraQuadTreeVisualizationFrustumSize / 2,
            this._cameraQuadTreeVisualizationFrustumSize / -2,
            0.01,
            1000
        )
        this._cameraQuadTreeVisualization.position.copy(this._defaultQuadTreeVisualizationCameraPosition)

        this._orbitControls = new OrbitControls(this._camera, App.instance.renderer.domElement)
        this._orbitControls.enableDamping = true
        this.setupTweaks()
    }

    async initialize(): Promise<void> {
        GeometryGenerator.intitializeIndexBufferForStitchingModes(this._tileSize)
        await TerrainTileManager.initializeFromMetadata(this._terrainMetadataPath)
        this._metadata = TerrainTileManager.terrainMetadata
        if (!this._metadata) {
            console.error("Terrain: Failed to load terrain metadata!")
            return
        }

        const maxDepth = this.maxLevel
        this._quadTree = new QuadTree(this.boundingBox!, maxDepth)

        this._camera.lookAt(this.center)

        this._playerStartPosition = new THREE.Vector3(
            this.center.x,
            0.0,
            this.center.z,
        )

        this._player = new Player(this._playerStartPosition)
        this.add(this._player.mesh)

        this._cameraQuadTreeVisualization.position.x = this._playerStartPosition.x
        this._cameraQuadTreeVisualization.position.z = this._playerStartPosition.z
        this._cameraQuadTreeVisualization.rotation.x = -Math.PI / 2

        this.toggleQuadTreeVisualization(this._tweaks.enableQuadTreeVisualization)

        // this.tileStitchingPlayground()

        App.instance.scene.add(this)
    }

    onResize(aspect: number): void {
        this._camera.aspect = aspect
        this._camera.updateProjectionMatrix()

        this._cameraQuadTreeVisualization.left = this._cameraQuadTreeVisualizationFrustumSize * aspect / -2
        this._cameraQuadTreeVisualization.right = this._cameraQuadTreeVisualizationFrustumSize * aspect / 2
        this._cameraQuadTreeVisualization.top = this._cameraQuadTreeVisualizationFrustumSize / 2
        this._cameraQuadTreeVisualization.bottom = this._cameraQuadTreeVisualizationFrustumSize / -2
        this._cameraQuadTreeVisualization.updateProjectionMatrix()
    }

    update(dt: number) {
        this._orbitControls.update()
        if (this._player != null) {
            this._player.update(dt)
        }
        if (this._quadTree != null) {
            const position = this._player?.position2D || new THREE.Vector2(0, 0)
            this._quadTree.insertPosition(position)
            const quadTreeNodes = this._quadTree.getChildren()
            for (const node of quadTreeNodes) {
                this._quadTree.updateStitchingModeForNode(node, quadTreeNodes)
            }
            this.updateFromQuadTreeNodes(quadTreeNodes)
        }
    }


    // TODO: Remove this method if we are sure tile stitching is working correctly.
    private tileStitchingPlayground() {
        const geometryOne = GeometryGenerator.createRegularGridGeometry(this._tileSize, 1)
        geometryOne.rotateX(-Math.PI * 0.5)

        const materialOne = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        const meshOne = new THREE.Mesh(geometryOne, materialOne)
        this.add(meshOne)

        const geometryTwo = GeometryGenerator.createRegularGridGeometry(this._tileSize, 0.5)
        geometryTwo.rotateX(-Math.PI * 0.5)
        const indexBufferGeometryTwo = GeometryGenerator.getIndexBufferForStitchingMode(IndexStitchingMode.West)
        if (indexBufferGeometryTwo !== undefined) {
            geometryTwo.setIndex(indexBufferGeometryTwo)
        }

        const materialTwo = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        const meshTwo = new THREE.Mesh(geometryTwo, materialTwo)
        meshTwo.position.x = 0.75
        meshTwo.position.z = -0.25
        this.add(meshTwo)
    }

    private updateFromQuadTreeNodes(quadTreeNodes: QuadTreeNode[]): void {
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
                if (tile.mesh) {
                    this.remove(tile.mesh)
                }
                if (tile.lineMesh) {
                    this.remove(tile.lineMesh)
                }
                const tileIndex = this._terrainTiles.indexOf(tile)
                this._terrainTiles.splice(tileIndex, 1)
                tile.dispose()
            }
        }

        for (const node of quadTreeNodes) {
            const existingTile = this._terrainTiles.find(tile => tile.id === node.id)
            if (existingTile) {
                // Keep existing tile in sync with tweaks
                existingTile.useDemTexture = this._shouldUseDemTexture
                existingTile.onStitchingModeChanged(node.indexStitchingMode)
                continue
            }
            if (this._loadingTileIds.has(node.id)) {
                continue
            }
            this._loadingTileIds.add(node.id);
            TerrainTileManager.requestTerrainTileForNode(node, this._tweaks.anisotropy, this._tileSize, this._tweaks.wireframe, this._shouldUseDemTexture).then((tile) => {
                this._loadingTileIds.delete(node.id);
                if (!tile) {
                    console.error(`Terrain: Failed to get tile for node ${node.id}`)
                    return
                }
                this._terrainTiles.push(tile)
                if (tile.mesh) {
                    this.add(tile.mesh)
                }
                if (tile.lineMesh) {
                    this.add(tile.lineMesh)
                }
            })
        }

    }

    private toggleQuadTreeVisualization(enabled: boolean): void {
        this._shouldUseDemTexture = !enabled
        if (enabled) {
            for (const tile of this._terrainTiles) {
                if (tile.lineMesh) {
                    tile.lineMesh.visible = true
                    tile.useDemTexture = this._shouldUseDemTexture
                }
            }
        }
        else {
            for (const tile of this._terrainTiles) {
                if (tile.lineMesh) {
                    tile.lineMesh.visible = false
                    tile.useDemTexture = this._shouldUseDemTexture
                }
            }
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
