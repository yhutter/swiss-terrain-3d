import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/build/three.webgpu"
import { Pane, FolderApi } from "tweakpane"
import { Terrain } from "./Terrain.js"

export class App {

    /** @type{THREE.WebGPURenderer} */
    #renderer

    /** @type {THREE.PerspectiveCamera} */
    #camera

    /** @type {THREE.Scene} */
    #scene

    /** @type {THREE.Clock} */
    #clock

    /** @type {Terrain?} */
    #terrain = null


    /** @type {Pane} */
    #pane

    /** @type {FolderApi} */
    #tweaksFolder

    /** @type {THREE.TextureLoader} */
    #textureLoader

    /** @type {HDRLoader} */
    #hdrLoader

    /** @type {OrbitControls} */
    #orbitControls

    #sizes = {
        width: 0,
        height: 0,
    }

    #tweaks = {
        background: new THREE.Color(0x000000),
        toneMappingOptions: {
            "None": THREE.NoToneMapping,
            "Agx": THREE.AgXToneMapping,
            "Filmic": THREE.ACESFilmicToneMapping,
            "Reinhard": THREE.ReinhardToneMapping,
        },
        toneMapping: THREE.NoToneMapping,
    }

    /** @type {App} */
    static #instance

    static get instance() {
        if (!this.#instance) {
            this.#instance = new App()
        }
        return this.#instance
    }

    get pane() {
        return this.#pane
    }

    get textureLoader() {
        return this.#textureLoader
    }

    get scene() {
        return this.#scene
    }

    constructor() {
        const canvas = document.getElementById("app")
        this.#renderer = new THREE.WebGPURenderer({
            antialias: true,
            // @ts-ignore
            canvas: canvas
        })

        this.#sizes.width = window.innerWidth
        this.#sizes.height = window.innerHeight
        this.#renderer.setSize(this.#sizes.width, this.#sizes.height)

        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this.#renderer.setPixelRatio(pixelRatio)
        this.#renderer.setClearColor(this.#tweaks.background)
        this.#renderer.toneMapping = this.#tweaks.toneMapping

        this.#hdrLoader = new HDRLoader()

        const aspect = this.#sizes.width / this.#sizes.height
        this.#camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this.#camera.position.set(0, 1, 2)

        this.#orbitControls = new OrbitControls(this.#camera, this.#renderer.domElement)
        this.#orbitControls.enableDamping = true

        this.#scene = new THREE.Scene()

        this.#textureLoader = new THREE.TextureLoader()

        this.#clock = new THREE.Clock()

        this.#pane = new Pane()
        this.#tweaksFolder = this.#pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })
    }


    async run() {
        await this.#renderer.init()
        await this.#setupTerrain()

        this.#setupHDREnvironment()
        this.#setupTweaks()

        window.addEventListener("resize", () => this.#onResize())

        this.#render()
    }

    async #setupTerrain() {

        this.#terrain = new Terrain()
        await this.#terrain.loadTerrainTiles()
    }

    async #setupHDREnvironment() {
        const envMap = await this.#hdrLoader.loadAsync("/static/maps/envmap-1k.hdr")
        envMap.mapping = THREE.EquirectangularReflectionMapping
        this.#scene.environment = envMap
    }

    #setupTweaks() {
        this.#tweaksFolder.addBinding(this.#tweaks, "background", {
            label: "Background Color",
            view: "color",
            color: { type: "float" }
        }).on("change", (e) => {
            this.#renderer.setClearColor(e.value)
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "toneMapping", {
            label: "Tone Mapping",
            options: this.#tweaks.toneMappingOptions
        }).on("change", (e) => {
            this.#renderer.toneMapping = e.value
        })

    }

    #onResize() {
        this.#sizes.width = window.innerWidth
        this.#sizes.height = window.innerHeight

        this.#renderer.setSize(this.#sizes.width, this.#sizes.height)
        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this.#renderer.setPixelRatio(pixelRatio)

        const aspect = this.#sizes.width / this.#sizes.height
        this.#camera.aspect = aspect
        this.#camera.updateProjectionMatrix()
    }

    #update() {
        const dt = this.#clock.getDelta()
        this.#orbitControls.update()
        this.#terrain?.update(dt)
    }

    #render() {
        this.#update()
        this.#renderer.render(this.#scene, this.#camera)
        window.requestAnimationFrame(() => this.#render())
    }
}
