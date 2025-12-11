import { HDRLoader } from "three/examples/jsm/Addons.js"
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js"
import * as THREE from "three/webgpu"
import { Pane, FolderApi } from "tweakpane"
import { Terrain } from "./Terrain/Terrain"
import Stats from "stats-gl";

export class App {
    private _envMapPath = "/static/maps/envmap-1k.hdr"

    // We receive the units in meters (for example 1000 meters). Tweak this value to have a more manageable scale in the 3D scene. Basically this value maps meter to scene units.
    private _renderScale = 1

    private _renderer: THREE.WebGPURenderer
    private _scene: THREE.Scene
    private _clock: THREE.Clock
    private _pane: Pane
    private _tweaksFolder: FolderApi
    private _textureLoader: THREE.TextureLoader
    private _skyMesh: SkyMesh | null = null
    private _sunPosition = new THREE.Vector3()
    private _hdrLoader: HDRLoader
    private readonly _stats = new Stats({
        trackFPS: true,
        trackGPU: true,
        trackHz: false,
        trackCPT: false,
        logsPerSecond: 4,
        graphsPerSecond: 30,
        samplesLog: 40,
        samplesGraph: 10,
        precision: 2,
        horizontal: true,
        minimal: false,
        mode: 0
    });

    private _tweaks = {
        background: new THREE.Color(0xffffff),
        toneMappingOptions: {
            "None": THREE.NoToneMapping,
            "Agx": THREE.AgXToneMapping,
            "Filmic": THREE.ACESFilmicToneMapping,
            "Reinhard": THREE.ReinhardToneMapping,
        },
        toneMapping: THREE.NoToneMapping,
        showStats: true,
        sky: {
            turbidity: 10,
            rayleigh: 1.25,
            elevation: 3,
            mieCoefficient: 0,
            mieDirectionlG: 1,
            azimuth: 180
        }
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

    get renderer(): THREE.WebGPURenderer {
        return this._renderer
    }

    get aspect(): number {
        return window.innerWidth / window.innerHeight
    }

    get renderScale(): number {
        return this._renderScale
    }

    constructor() {
        this._renderer = new THREE.WebGPURenderer({
            antialias: true,
        })

        this._renderer.setSize(window.innerWidth, window.innerHeight)

        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this._renderer.setPixelRatio(pixelRatio)
        this._renderer.setClearColor(this._tweaks.background)
        this._renderer.toneMapping = this._tweaks.toneMapping
        document.body.appendChild(this._renderer.domElement)

        this._hdrLoader = new HDRLoader()

        this._scene = new THREE.Scene()

        this._textureLoader = new THREE.TextureLoader()

        this._clock = new THREE.Clock()

        this._pane = new Pane()
        this._tweaksFolder = this._pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })
        document.body.appendChild(this._stats.dom);

        this._stats.init(this._renderer)

    }

    async run(): Promise<void> {
        this._terrain = new Terrain()
        await this._terrain.initialize()

        // No point in continuing if terrain failed to load
        if (!this._terrain) {
            console.error("Failed to load terrain!")
            return
        }
        this._scene.add(this._terrain)

        this._skyMesh = new SkyMesh()
        // TODO: Use the terrain size here
        this._skyMesh.scale.setScalar(450000 * this._renderScale)

        this._scene.add(this._skyMesh)

        this.setupHDREnvironment()
        this.setupTweaks()
        this.onSkyTweaksChanged()

        window.addEventListener("resize", () => this.onResize())
        this.onResize()
        this._renderer.setAnimationLoop(() => this.tick())
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

        this._tweaksFolder.addBinding(this._tweaks, "showStats", {
            label: "Show Stats",
        }).on("change", (e) => {
            this._stats.dom.style.display = e.value ? "block" : "none"
        })

        const skyFolder = this._tweaksFolder.addFolder({
            title: "Sky",
            expanded: true,
        })

        skyFolder.addBinding(this._tweaks.sky, "turbidity", {
            label: "Turbidity",
            min: 0,
            max: 20,
            step: 0.1,
        }).on("change", () => this.onSkyTweaksChanged())

        skyFolder.addBinding(this._tweaks.sky, "rayleigh", {
            label: "Rayleigh",
            min: 0,
            max: 4,
            step: 0.001,
        }).on("change", () => this.onSkyTweaksChanged())

        skyFolder.addBinding(this._tweaks.sky, "elevation", {
            label: "Elevation",
            min: 0,
            max: 90,
            step: 0.1,
        }).on("change", () => this.onSkyTweaksChanged())

        skyFolder.addBinding(this._tweaks.sky, "mieCoefficient", {
            label: "Mie Coefficient",
            min: 0,
            max: 0.1,
            step: 0.001,
        }).on("change", () => this.onSkyTweaksChanged())

        skyFolder.addBinding(this._tweaks.sky, "mieDirectionlG", {
            label: "Mie Directional G",
            min: 0,
            max: 1,
            step: 0.001,
        }).on("change", () => this.onSkyTweaksChanged())

        skyFolder.addBinding(this._tweaks.sky, "azimuth", {
            label: "Azimuth",
            min: -180,
            max: 180,
            step: 0.1,
        }).on("change", () => this.onSkyTweaksChanged())

    }

    private onSkyTweaksChanged(): void {
        if (!this._skyMesh) return

        this._skyMesh.turbidity.value = this._tweaks.sky.turbidity
        this._skyMesh.rayleigh.value = this._tweaks.sky.rayleigh
        this._skyMesh.mieCoefficient.value = this._tweaks.sky.mieCoefficient
        this._skyMesh.mieDirectionalG.value = this._tweaks.sky.mieDirectionlG

        const phi = THREE.MathUtils.degToRad(90 - this._tweaks.sky.elevation)
        const theta = THREE.MathUtils.degToRad(this._tweaks.sky.azimuth)

        this._sunPosition.setFromSphericalCoords(1, phi, theta)
        this._skyMesh.sunPosition.value.copy(this._sunPosition)
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

    private tick() {
        this.update()
        const camera = this._terrain!.activeCamera
        this._renderer.render(this._scene, camera)
        this._renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER)
        this._stats.update();
    }
}
