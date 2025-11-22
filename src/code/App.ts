import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three"
import { Pane, FolderApi } from "tweakpane"
import { Terrain } from "./terrain/Terrain"
import { Player } from "./Player"
import { InputHandler } from "./helpers/InputHandler"
import { QuadTree } from "./quadtree/QuadTree"
import { QuadTreeHelper } from "./quadtree/QuadTreeHelper"

export class App {
    private _terrainMetadataPath = "/static/data/output_tiles-chur/terrain_metadata.json"
    private _envMapPath = "/static/maps/envmap-1k.hdr"

    // We receive the units in meters (for example 1000 meters). To have a more manageable scale in the 3D scene, we apply a render scale of 0.001 so that 1000 meters becomes 1 unit in the 3D scene.
    private _renderScale = 0.001

    private _renderer: THREE.WebGLRenderer
    private _camera: THREE.PerspectiveCamera
    private _defaultCameraPosition = new THREE.Vector3(0, 1, 2)
    private _cameraQuadTreeVisualization: THREE.PerspectiveCamera
    private _defaultQuadTreeVisualizationCameraPosition = new THREE.Vector3(0, 3, 0)
    private _scene: THREE.Scene
    private _clock: THREE.Clock
    private _pane: Pane
    private _tweaksFolder: FolderApi
    private _textureLoader: THREE.TextureLoader
    private _hdrLoader: HDRLoader
    private _orbitControls: OrbitControls
    private _inputHandler: InputHandler

    private _sizes = {
        width: 0,
        height: 0,
    }

    private _tweaks = {
        background: new THREE.Color(0x000000),
        toneMappingOptions: {
            "None": THREE.NoToneMapping,
            "Agx": THREE.AgXToneMapping,
            "Filmic": THREE.ACESFilmicToneMapping,
            "Reinhard": THREE.ReinhardToneMapping,
        },
        toneMapping: THREE.NoToneMapping,
        enableQuadTreeVisualization: true,
    }

    private _terrain: Terrain | null = null
    private _player: Player | null = null
    private _playerStartPosition: THREE.Vector3 | null = null
    private _quadTree: QuadTree | null = null
    private _quadTreeHelper: QuadTreeHelper | null = null


    private static _instance: App

    static get instance(): App {
        if (!this._instance) {
            this._instance = new App()
        }
        return this._instance
    }

    get pane(): Pane {
        return this._pane
    }

    get textureLoader(): THREE.TextureLoader {
        return this._textureLoader
    }

    get scene(): THREE.Scene {
        return this._scene
    }

    get inputHandler(): InputHandler {
        return this._inputHandler
    }

    get renderScale(): number {
        return this._renderScale
    }

    constructor() {
        const canvas = document.getElementById("app") as HTMLCanvasElement
        this._renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: canvas
        })

        this._sizes.width = window.innerWidth
        this._sizes.height = window.innerHeight
        this._renderer.setSize(this._sizes.width, this._sizes.height)

        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this._renderer.setPixelRatio(pixelRatio)
        this._renderer.setClearColor(this._tweaks.background)
        this._renderer.toneMapping = this._tweaks.toneMapping

        this._hdrLoader = new HDRLoader()

        const aspect = this._sizes.width / this._sizes.height

        this._camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this._camera.position.copy(this._defaultCameraPosition)

        this._cameraQuadTreeVisualization = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this._cameraQuadTreeVisualization.position.copy(this._defaultQuadTreeVisualizationCameraPosition)

        this._orbitControls = new OrbitControls(this._camera, this._renderer.domElement)
        this._orbitControls.enableDamping = true

        this._scene = new THREE.Scene()

        this._textureLoader = new THREE.TextureLoader()

        this._clock = new THREE.Clock()

        this._pane = new Pane()
        this._tweaksFolder = this._pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })

        this._inputHandler = new InputHandler()
    }

    async run(): Promise<void> {
        await this.setupTerrain()

        // No point in continuing if terrain failed to load
        if (!this._terrain) {
            console.error("Failed to load terrain!")
            return
        }

        this.setupPlayer()

        const maxDepth = this._terrain.maxLevel
        this._quadTree = new QuadTree(this._terrain.boundingBox!, maxDepth)

        this._quadTreeHelper = new QuadTreeHelper(this._quadTree)
        this._scene.add(this._quadTreeHelper)


        const terrainCenter = this._terrain!.center
        this._camera.lookAt(terrainCenter)

        this.setupHDREnvironment()
        this.setupTweaks()

        this.toggleQuadTreeVisualization(this._tweaks.enableQuadTreeVisualization)

        window.addEventListener("resize", () => this.onResize())

        this.render()
    }

    private setupPlayer(): void {
        if (!this._terrain) return

        const terrainCenter = this._terrain.center
        this._playerStartPosition = new THREE.Vector3(
            terrainCenter.x + 1,
            0.0,
            terrainCenter.z + 1,
        )
        this._player = new Player(this._playerStartPosition)
        this._cameraQuadTreeVisualization.position.x = this._playerStartPosition.x
        this._cameraQuadTreeVisualization.position.z = this._playerStartPosition.z
        this._cameraQuadTreeVisualization.rotation.x = -Math.PI / 2
    }

    private async setupTerrain(): Promise<void> {
        this._terrain = new Terrain()
        await this._terrain.initialize(this._terrainMetadataPath)
    }

    private async setupHDREnvironment(): Promise<void> {
        const envMap = await this._hdrLoader.loadAsync(this._envMapPath)
        envMap.mapping = THREE.EquirectangularReflectionMapping
        this._scene.environment = envMap
    }

    private toggleQuadTreeVisualization(enabled: boolean): void {
        if (enabled) {
            this._quadTreeHelper!.visible = true
            this._terrain!.shouldUseDemTexture = false
        }
        else {
            this._quadTreeHelper!.visible = false
            this._terrain!.shouldUseDemTexture = true
        }
    }

    private setupTweaks(): void {
        this._tweaksFolder.addBinding(this._tweaks, "background", {
            label: "Background Color",
            view: "color",
            color: { type: "float" }
        }).on("change", (e) => {
            this._renderer.setClearColor(e.value)
        })

        this._tweaksFolder.addBinding(this._tweaks, "toneMapping", {
            label: "Tone Mapping",
            options: this._tweaks.toneMappingOptions
        }).on("change", (e) => {
            this._renderer.toneMapping = e.value
        })

        this._tweaksFolder.addBinding(this._tweaks, "enableQuadTreeVisualization", {
            label: "Enable QuadTree Visualization"
        }).on("change", (e) => {
            this.toggleQuadTreeVisualization(e.value)
        })
    }

    private onResize(): void {
        this._sizes.width = window.innerWidth
        this._sizes.height = window.innerHeight

        this._renderer.setSize(this._sizes.width, this._sizes.height)
        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this._renderer.setPixelRatio(pixelRatio)

        const aspect = this._sizes.width / this._sizes.height
        this._camera.aspect = aspect
        this._camera.updateProjectionMatrix()

        this._cameraQuadTreeVisualization.aspect = aspect
        this._cameraQuadTreeVisualization.updateProjectionMatrix()
    }

    private update() {
        const dt = this._clock.getDelta()
        this._orbitControls.update()
        this._player?.update(dt)
        this._quadTree?.insertPosition(this._player!.position2D)
        this._quadTreeHelper?.update()
        this._terrain?.update(dt, this._quadTree!.getChildren())

        // Track player position
        this._cameraQuadTreeVisualization.position.x = this._player!.position.x
        this._cameraQuadTreeVisualization.position.z = this._player!.position.z
    }

    private render() {
        this.update()
        const camera = this._tweaks.enableQuadTreeVisualization ? this._cameraQuadTreeVisualization : this._camera
        this._renderer.render(this._scene, camera)
        window.requestAnimationFrame(() => this.render())
    }
}
