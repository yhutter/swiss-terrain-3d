import { HDRLoader } from "three/examples/jsm/Addons.js"
import * as THREE from "three"
import { Pane, FolderApi } from "tweakpane"
import { Terrain } from "./Terrain/Terrain"
import { InputHandler } from "./Utils/InputHandler"

export class App {
    private _envMapPath = "/static/maps/envmap-1k.hdr"

    // We receive the units in meters (for example 1000 meters). To have a more manageable scale in the 3D scene, we apply a render scale of 0.001 so that 1000 meters becomes 1 unit in the 3D scene.
    // private _renderScale = 0.001
    private _renderScale = 1

    private _renderer: THREE.WebGLRenderer
    private _scene: THREE.Scene
    private _clock: THREE.Clock
    private _pane: Pane
    private _tweaksFolder: FolderApi
    private _textureLoader: THREE.TextureLoader
    private _hdrLoader: HDRLoader
    private _inputHandler: InputHandler

    private _tweaks = {
        background: new THREE.Color(0xffffff),
        toneMappingOptions: {
            "None": THREE.NoToneMapping,
            "Agx": THREE.AgXToneMapping,
            "Filmic": THREE.ACESFilmicToneMapping,
            "Reinhard": THREE.ReinhardToneMapping,
        },
        toneMapping: THREE.NoToneMapping,
    }

    private _terrain: Terrain | null = null


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

    get renderer(): THREE.WebGLRenderer {
        return this._renderer
    }

    get aspect(): number {
        return window.innerWidth / window.innerHeight
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
            canvas: canvas,
            // Logarithmic Depth Buffer helps prevent z-fighting issues in large scenes
            logarithmicDepthBuffer: true,
        })

        this._renderer.setSize(window.innerWidth, window.innerHeight)

        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this._renderer.setPixelRatio(pixelRatio)
        this._renderer.setClearColor(this._tweaks.background)
        this._renderer.toneMapping = this._tweaks.toneMapping

        this._hdrLoader = new HDRLoader()

        this._scene = new THREE.Scene()

        this._textureLoader = new THREE.TextureLoader()

        this._clock = new THREE.Clock()

        this._pane = new Pane()
        this._tweaksFolder = this._pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })

        this._inputHandler = new InputHandler()
    }

    async run(): Promise<void> {
        this._terrain = new Terrain()
        await this._terrain.initialize()

        // No point in continuing if terrain failed to load
        if (!this._terrain) {
            console.error("Failed to load terrain!")
            return
        }

        this.setupHDREnvironment()
        this.setupTweaks()

        window.addEventListener("resize", () => this.onResize())
        this.onResize()
        this.render()
    }

    private async setupHDREnvironment(): Promise<void> {
        const envMap = await this._hdrLoader.loadAsync(this._envMapPath)
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
        this._renderer.setSize(window.innerWidth, window.innerHeight)
        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this._renderer.setPixelRatio(pixelRatio)
        this._terrain?.onResize(this.aspect)
    }

    private update() {
        const dt = this._clock.getDelta()
        this._terrain?.update(dt)

    }

    private render() {
        this.update()
        const camera = this._terrain!.activeCamera
        this._renderer.render(this._scene, camera)
        window.requestAnimationFrame(() => this.render())
    }
}
