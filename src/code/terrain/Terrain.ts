import * as THREE from "three"
import { App } from '../App';
import { TerrainTile } from "./TerrainTile";
import { TerrainMetadata } from "./TerrainMetadata";
import { TerrainTileManager } from "./TerrainTileManager";
import { QuadTree } from "../QuadTree/QuadTree";
import { QuadTreeNode } from "../QuadTree/QuadTreeNode";
import { GeometryGenerator } from "../Utils/GeometryGenerator";
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";
import { ColorGenerator } from "../Utils/ColorGenerator";
import { TerrainCameraControls } from "./TerrainCameraControls";

export class Terrain extends THREE.Group {

    private _tileSize: number = 33

    private _tweaks = {
        wireframe: false,
        anisotropy: 16,
        enableQuadTreeVisualization: false,
        enableBoxHelper: false,
        enableStitchingColor: true,
        northStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.North) || ColorGenerator.white,
        eastStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.East) || ColorGenerator.white,
        southStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.South) || ColorGenerator.white,
        westStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.West) || ColorGenerator.white,
        northEastStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.NorthEast) || ColorGenerator.white,
        southEastStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.SouthEast) || ColorGenerator.white,
        southWestStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.SouthWest) || ColorGenerator.white,
        northWestStitchingColor: ColorGenerator.colorForSitchingMode.get(IndexStitchingMode.NorthWest) || ColorGenerator.white,
    }

    // TODO: Make these paths selectable via dropdown in Tweakpane
    private _terrainMetadataPath = "/static/data/output_tiles-chur/metadata.json"

    private _terrainTiles: TerrainTile[] = []
    private _metadata: TerrainMetadata | null = null
    private _camera: THREE.PerspectiveCamera
    private _cameraQuadTreeVisualization: THREE.OrthographicCamera
    private _cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    private _quadTree: QuadTree | null = null
    private _terrainCameraControls: TerrainCameraControls
    private _loadingTileIds = new Set<string>();
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
        if (this._tweaks.enableQuadTreeVisualization) {
            return this._cameraQuadTreeVisualization
        }
        return this._camera
    }

    constructor() {
        super()

        const aspect = App.instance.aspect
        // TODO: Calculate far based on terrain size
        const near = 1
        const far = 25000
        this._camera = new THREE.PerspectiveCamera(45, aspect, near, far)

        this._cameraQuadTreeVisualization = new THREE.OrthographicCamera()
        this._cameraQuadTreeVisualization.near = near
        this._cameraQuadTreeVisualization.far = far
        this._terrainCameraControls = new TerrainCameraControls(this._camera, this, App.instance.renderer.domElement)
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

        const size = new THREE.Vector2()
        this._metadata.bboxWorldSpace.getSize(size)
        this._size.copy(size)

        const maxDepth = this.maxLevel
        this._quadTree = new QuadTree(this.boundingBox!, maxDepth)

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

        this.toggleQuadTreeVisualization(this._tweaks.enableQuadTreeVisualization)

        App.instance.scene.add(this)
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
        if (this._quadTree != null) {
            const position = new THREE.Vector2(this._cameraPosition.x, this._cameraPosition.z)
            this._quadTree.insertPosition(position)
            const quadTreeNodes = this._quadTree.getChildren()
            for (const node of quadTreeNodes) {
                this._quadTree.updateStitchingModeForNode(node, quadTreeNodes)
            }
            this.updateFromQuadTreeNodes(quadTreeNodes)
        }
    }

    private updateFromQuadTreeNodes(quadTreeNodes: QuadTreeNode[]): void {
        // Track player position
        if (this._tweaks.enableQuadTreeVisualization) {
            this._cameraQuadTreeVisualization.position.x = this._cameraPosition.x
            this._cameraQuadTreeVisualization.position.z = this._cameraPosition.z
        }

        // Figure out which tiles we can remove, e.g. tiles that are not in the Quad Tree Nodes.
        for (const tile of this._terrainTiles) {
            const foundNode = quadTreeNodes.find(node => node.id === tile.identifier)
            if (!foundNode) {
                // Remove tile
                const tileIndex = this._terrainTiles.indexOf(tile)
                this._terrainTiles.splice(tileIndex, 1)
                this.remove(tile)
                TerrainTileManager.removeTileFromCache(tile)
                tile.dispose()
            }
        }

        for (const node of quadTreeNodes) {
            const existingTile = this._terrainTiles.find(tile => tile.identifier === node.id)
            if (existingTile) {
                // Keep in sync with tweaks
                existingTile.enableBoxHelper(this._tweaks.enableBoxHelper)
                existingTile.setAnisotropy(this._tweaks.anisotropy)
                existingTile.setWireframe(this._tweaks.wireframe)
                existingTile.enableStitchingColor(this._tweaks.enableStitchingColor)
                existingTile.useDemTexture(!this._tweaks.enableQuadTreeVisualization)
                existingTile.onStitchingModeChanged(node.indexStitchingMode)
                continue
            }
            if (this._loadingTileIds.has(node.id)) {
                continue
            }
            this._loadingTileIds.add(node.id);
            const useDemTexture = !this._tweaks.enableQuadTreeVisualization
            TerrainTileManager.requestTerrainTileForNode(node, this._tweaks.anisotropy, this._tileSize, this._tweaks.wireframe, useDemTexture, this._tweaks.enableStitchingColor, this._tweaks.enableBoxHelper).then((tile) => {
                this._loadingTileIds.delete(node.id);
                if (!tile) {
                    console.error(`Terrain: Failed to get tile for node ${node.id}`)
                    return
                }
                this._terrainTiles.push(tile)
                this.add(tile)
            })
        }

    }

    private toggleQuadTreeVisualization(enabled: boolean): void {
        const useDemTexture = !enabled
        for (const tile of this._terrainTiles) {
            tile.useDemTexture(useDemTexture)
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
                tile.setAnisotropy(e.value)
            }
        })

        folder.addBinding(this._tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            for (const tile of this._terrainTiles) {
                tile.setWireframe(e.value)
            }
        })

        folder.addBinding(this._tweaks, "enableQuadTreeVisualization", {
            label: "Enable QuadTree Visualization"
        }).on("change", (e) => {
            this.toggleQuadTreeVisualization(e.value)
        })

        folder.addBinding(this._tweaks, "enableStitchingColor", {
            label: "Enable Stitching Color"
        }).on("change", (e) => {
            for (const tile of this._terrainTiles) {
                tile.enableStitchingColor(e.value)
            }
        })

        folder.addBinding(this._tweaks, "enableBoxHelper", {
            label: "Enable Box Helper"
        }).on("change", (e) => {
            for (const tile of this._terrainTiles) {
                tile.enableBoxHelper(e.value)
            }
        })

        const stitchingFolder = App.instance.pane.addFolder({
            title: 'Terrain Stitching Colors',
            expanded: true,
        })

        stitchingFolder.addBinding(this._tweaks, "northStitchingColor", {
            label: "North Color",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "northEastStitchingColor", {
            label: "North East",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "northWestStitchingColor", {
            label: "North West",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "eastStitchingColor", {
            label: "East",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "southStitchingColor", {
            label: "South",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "southEastStitchingColor", {
            label: "South East",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "southWestStitchingColor", {
            label: "South West",
            view: "color",
            color: { type: "float" }
        })

        stitchingFolder.addBinding(this._tweaks, "westStitchingColor", {
            label: "West",
            view: "color",
            color: { type: "float" }
        })
    }
}
