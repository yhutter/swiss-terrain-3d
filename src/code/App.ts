import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three"
import { Pane, FolderApi } from "tweakpane"
import { Terrain } from "./terrain/Terrain"

const TERRAIN_METADATA_PATH = "/static/data/output_tiles-sargans/terrain_metadata.json"
const ENV_MAP_PATH = "/static/maps/envmap-1k.hdr"

const RENDER_SCALE = 0.001

export class App {
    private _renderer: THREE.WebGLRenderer
    private _camera: THREE.PerspectiveCamera
    private _scene: THREE.Scene
    private _clock: THREE.Clock
    private _terrain: Terrain | null = null
    private _pane: Pane
    private _tweaksFolder: FolderApi
    private _textureLoader: THREE.TextureLoader
    private _hdrLoader: HDRLoader
    private _orbitControls: OrbitControls

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
    }

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
        this._camera.position.set(0, 1, 2)

        this._orbitControls = new OrbitControls(this._camera, this._renderer.domElement)
        this._orbitControls.enableDamping = true

        this._scene = new THREE.Scene()

        this._textureLoader = new THREE.TextureLoader()

        this._clock = new THREE.Clock()

        this._pane = new Pane()
        this._tweaksFolder = this._pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })
    }

    async run(): Promise<void> {
        await this.setupTerrain()

        this.setupHDREnvironment()
        this.setupTweaks()

        window.addEventListener("resize", () => this.onResize())

        this.render()
    }

    private async setupTerrain(): Promise<void> {
        this._terrain = new Terrain(RENDER_SCALE)
        await this._terrain.loadTerrain(TERRAIN_METADATA_PATH)
    }

    private async setupHDREnvironment(): Promise<void> {
        const envMap = await this._hdrLoader.loadAsync(ENV_MAP_PATH)
        envMap.mapping = THREE.EquirectangularReflectionMapping
        this._scene.environment = envMap
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
    }

    private update(): void {
        const dt = this._clock.getDelta()
        this._orbitControls.update()
        this._terrain?.update(dt)
    }

    private render(): void {
        this.update()
        this._renderer.render(this._scene, this._camera)
        window.requestAnimationFrame(() => this.render())
    }
}
