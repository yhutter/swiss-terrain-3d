import * as THREE from "three"
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainTileManager } from "./TerrainTileManager";
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";
import { GeometryGenerator } from "../Utils/GeometryGenerator";
import { TerrainCameraControls } from "./TerrainCameraControls";
import { QuadTreeWorker } from "../QuadTree/QuadTreeWorker";

export class Terrain extends THREE.Group {

    private _tweaks = {
        wireframe: false,
        switchToOrtographicCamera: false,
        enableDemTexture: true,
        enableLineMesh: false,
        enableStitchingColor: false,
        enableBoxHelper: false,
    }

    private _quadTreeWorker: QuadTreeWorker | null = null;

    // TODO: Make these paths selectable via dropdown in Tweakpane
    private _terrainMetadataPath = "/static/data/output_tiles-chur/metadata.json"

    private _tilesBeingPrecompiled = new Set<string>()
    private _currentActiveTiles: Map<string, TerrainTile> = new Map<string, TerrainTile>()
    private _metadata: TerrainMetadata | null = null
    private _camera: THREE.PerspectiveCamera
    private _cameraQuadTreeVisualization: THREE.OrthographicCamera
    private _cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

    private _terrainCameraControls: TerrainCameraControls
    private _size: THREE.Vector2 = new THREE.Vector2(0, 0)

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
        if (this._tweaks.switchToOrtographicCamera) {
            return this._cameraQuadTreeVisualization
        }
        return this._camera
    }

    constructor() {
        super()

        const aspect = App.instance.aspect
        // TODO: Calculate far based on terrain size (use half terrain size)
        const near = 1
        const far = 20000
        this._camera = new THREE.PerspectiveCamera(70, aspect, near, far)

        this._cameraQuadTreeVisualization = new THREE.OrthographicCamera()
        this._cameraQuadTreeVisualization.near = near
        this._cameraQuadTreeVisualization.far = far
        this._terrainCameraControls = new TerrainCameraControls(this._camera, this, App.instance.renderer.domElement)
        this.setupTweaks()
    }

    async initialize(): Promise<void> {
        GeometryGenerator.initialize()
        await TerrainTileManager.initialize(this._terrainMetadataPath)
        this._metadata = TerrainTileManager.terrainMetadata
        if (!this._metadata) {
            console.error("Terrain: Failed to load terrain metadata!")
            return
        }

        const size = new THREE.Vector2()
        this._metadata.bboxWorldSpace.getSize(size)
        this._size.copy(size)

        const maxDepth = this.maxLevel
        this._quadTreeWorker = new QuadTreeWorker(
            this.boundingBox!,
            maxDepth,
            (nodes) => this.updateFromQuadTreeNodes(nodes)
        )

        this._cameraPosition = new THREE.Vector3(
            this.center.x,
            (this._metadata.globalMaxElevation - this._metadata.globalMinElevation) * 0.5,
            this.center.z,
        )
        this._camera.position.copy(this._cameraPosition)

        this._cameraQuadTreeVisualization.position.set(
            this.center.x,
            this._metadata.globalMaxElevation,
            this.center.z
        );
        this._cameraQuadTreeVisualization.lookAt(
            this.center.x,
            0,
            this.center.z
        );

        this._cameraQuadTreeVisualization.rotation.x = -Math.PI / 2
    }

    onResize(aspect: number): void {
        this._camera.aspect = aspect
        this._camera.updateProjectionMatrix()

        const cameraQuadTreeFrustumSize = Math.max(this._size.y, this._size.x / aspect)
        this._cameraQuadTreeVisualization.left = cameraQuadTreeFrustumSize * aspect / -2
        this._cameraQuadTreeVisualization.right = cameraQuadTreeFrustumSize * aspect / 2
        this._cameraQuadTreeVisualization.top = cameraQuadTreeFrustumSize / 2
        this._cameraQuadTreeVisualization.bottom = cameraQuadTreeFrustumSize / -2
        this._cameraQuadTreeVisualization.updateProjectionMatrix()
    }

    update(dt: number) {
        this._terrainCameraControls.update(dt)
        this._cameraPosition.copy(this._camera.position)
        const position = new THREE.Vector2(this._cameraPosition.x, this._cameraPosition.z)
        if (this._quadTreeWorker != null) {
            this._quadTreeWorker.insertPosition(position)
        }
    }

    private updateFromQuadTreeNodes(quadTreeNodes: QuadTreeNode[]): void {
        // Track player position
        this._cameraQuadTreeVisualization.position.x = this._cameraPosition.x
        this._cameraQuadTreeVisualization.position.z = this._cameraPosition.z

        const nodeIds = new Set(quadTreeNodes.map(node => node.id))

        // Figure out which tiles we can remove, e.g. tiles that are not in the Quad Tree Nodes.
        for (const tile of this._currentActiveTiles.values()) {
            if (!nodeIds.has(tile.identifier)) {
                // Remove tile
                this.removeTile(tile)
            }
        }

        for (const node of quadTreeNodes) {
            const existingTile = this._currentActiveTiles.get(node.id)
            if (existingTile) {
                // Keep in sync with tweaks
                existingTile.enableBoxHelper(this._tweaks.enableBoxHelper)
                existingTile.setWireframe(this._tweaks.wireframe)
                existingTile.useDemTexture(this._tweaks.enableDemTexture)
                existingTile.enableStitchingColor(this._tweaks.enableStitchingColor)
                existingTile.onStitchingModeChanged(node.indexStitchingMode)
                continue
            }

            const useDemTexture = this._tweaks.enableDemTexture
            const tile = TerrainTileManager.requestTerrainTileForNode(
                node,
                this._tweaks.wireframe,
                useDemTexture,
                this._tweaks.enableBoxHelper,
                this._tweaks.enableLineMesh,
                this._tweaks.enableStitchingColor
            )
            if (!tile) {
                console.error(`Terrain: Failed to get tile for node ${node.id}`)
                return
            }
            if (this._tilesBeingPrecompiled.has(tile.identifier)) {
                continue
            }
            this._tilesBeingPrecompiled.add(tile.identifier)
            App.instance.renderer.compileAsync(tile, this._camera).then(() => {
                this._tilesBeingPrecompiled.delete(tile.identifier)
                this._currentActiveTiles.set(tile.identifier, tile)
                this.add(tile)
                // console.log(`Compiled tile ${tile.identifier} async`)
            })
            // console.log(`Compiled tile ${tile.identifier}`)
        }
    }

    private removeTile(tile: TerrainTile): void {
        this._currentActiveTiles.delete(tile.identifier)
        tile.dispose()
        this.remove(tile)
    }


    private setupTweaks(): void {
        const folder = App.instance.pane.addFolder({
            title: 'Terrain',
            expanded: true,
        })

        folder.addBinding(this._tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            for (const tile of this._currentActiveTiles.values()) {
                tile.setWireframe(e.value)
            }
        })

        folder.addBinding(this._tweaks, "switchToOrtographicCamera", { label: "Switch to Ortographic Camera" })

        folder.addBinding(this._tweaks, "enableBoxHelper", {
            label: "Enable Box Helper"
        }).on("change", (e) => {
            for (const tile of this._currentActiveTiles.values()) {
                tile.enableBoxHelper(e.value)
            }
        })

        folder.addBinding(this._tweaks, "enableLineMesh", {
            label: "Enable Line Mesh"
        }).on("change", (e) => {
            for (const tile of this._currentActiveTiles.values()) {
                tile.enableLineMesh(e.value)
            }
        })

        folder.addBinding(this._tweaks, "enableDemTexture", {
            label: "Enable DEM Texture"
        }).on("change", (e) => {
            for (const tile of this._currentActiveTiles.values()) {
                tile.useDemTexture(e.value)
            }
        })

        folder.addBinding(this._tweaks, "enableStitchingColor", {
            label: "Enable Stitching Color"
        }).on("change", (e) => {
            for (const tile of this._currentActiveTiles.values()) {
                tile.enableStitchingColor(e.value)
            }
        })
    }
}
