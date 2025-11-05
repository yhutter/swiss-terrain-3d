import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/build/three.webgpu"
import { Pane, FolderApi } from "tweakpane"

export class App {

    /** @type{THREE.WebGPURenderer} */
    #renderer

    /** @type {THREE.PerspectiveCamera} */
    #camera

    /** @type {THREE.Scene} */
    #scene

    /** @type {THREE.Clock} */
    #clock

    /** @type {THREE.Mesh?} */
    #mesh = null

    /** @type {THREE.MeshStandardNodeMaterial?} */
    #material = null

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

    #elapsedTime = 0

    #sizes = {
        width: 0,
        height: 0,
    }

    #tweaks = {
        wireframe: false,
        background: new THREE.Color(0x000000),
        animate: false,
        toneMappingOptions: {
            "None": THREE.NoToneMapping,
            "Agx": THREE.AgXToneMapping,
            "Filmic": THREE.ACESFilmicToneMapping,
            "Reinhard": THREE.ReinhardToneMapping,
        },
        toneMapping: THREE.ACESFilmicToneMapping,
        backgroundBlurriness: 0.75,
        displacementScale: 0.16,
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
        this.#camera.position.set(0, 1, 1)

        this.#orbitControls = new OrbitControls(this.#camera, this.#renderer.domElement)
        this.#orbitControls.enableDamping = true

        this.#scene = new THREE.Scene()

        this.#textureLoader = new THREE.TextureLoader()

        this.#clock = new THREE.Clock()

        this.#pane = new Pane()
        this.#tweaksFolder = this.#pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })
    }


    async initialize() {
        await this.#renderer.init()

        const texturePath = "/static/data/output_tiles-sargans/dop/level_1/tiles/tile_000_000.tif.png"
        const texture = await this.#textureLoader.loadAsync(texturePath)
        texture.colorSpace = THREE.SRGBColorSpace

        const heightMapPath = "/static/data/output_tiles-sargans/dem/level_1/tiles/tile_000_000.tif.png"
        const heightMap = await this.#textureLoader.loadAsync(heightMapPath)

        const size = 1
        const resolution = 512
        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution)
        this.#material = new THREE.MeshStandardNodeMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            wireframe: this.#tweaks.wireframe,
            map: texture,
            displacementMap: heightMap,
            displacementScale: this.#tweaks.displacementScale,
        })

        this.#mesh = new THREE.Mesh(geo, this.#material)
        this.#mesh.geometry.rotateX(-Math.PI * 0.5)
        this.#camera.lookAt(this.#mesh.position)
        this.#scene.add(this.#mesh)

        const envMap = await this.#hdrLoader.loadAsync("/static/maps/envmap-1k.hdr")
        envMap.mapping = THREE.EquirectangularReflectionMapping
        this.#scene.environment = envMap
        this.#scene.background = envMap
        this.#scene.backgroundBlurriness = this.#tweaks.backgroundBlurriness


        this.setupTweaks()

        window.addEventListener("resize", () => this.#Resize())

        this.#Render()
    }

    setupTweaks() {
        this.#tweaksFolder.addBinding(this.#tweaks, "background", {
            label: "Background Color",
            view: "color",
            color: { type: "float" }
        }).on("change", (e) => {
            this.#renderer.setClearColor(e.value)
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "backgroundBlurriness", {
            label: "Background Blur",
            min: 0,
            max: 1.0,
            step: 0.01
        }).on("change", (e) => {
            this.#scene.backgroundBlurriness = e.value
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "displacementScale", {
            label: "Displacement Scale",
            min: 0,
            max: 5.0,
            step: 0.01
        }).on("change", (e) => {
            if (this.#material) {
                this.#material.displacementScale = e.value
            }
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "toneMapping", {
            label: "Tone Mapping",
            options: this.#tweaks.toneMappingOptions
        }).on("change", (e) => {
            this.#renderer.toneMapping = e.value
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            if (this.#material) {
                this.#material.wireframe = e.value
            }
        })

        this.#tweaksFolder.addBinding(this.#tweaks, "animate", {
            label: "Animate",
        })
    }

    #Resize() {
        this.#sizes.width = window.innerWidth
        this.#sizes.height = window.innerHeight

        this.#renderer.setSize(this.#sizes.width, this.#sizes.height)
        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this.#renderer.setPixelRatio(pixelRatio)

        const aspect = this.#sizes.width / this.#sizes.height
        this.#camera.aspect = aspect
        this.#camera.updateProjectionMatrix()
    }

    #Update() {
        const dt = this.#clock.getDelta()
        const speed = 0.25
        this.#orbitControls.update()

        if (this.#tweaks.animate) {
            this.#elapsedTime += dt
            if (this.#mesh) {
                this.#mesh.rotateY(Math.PI * dt * speed)
            }
        }
    }

    #Render() {
        this.#Update()
        this.#renderer.render(this.#scene, this.#camera)
        window.requestAnimationFrame(() => this.#Render())
    }
}
