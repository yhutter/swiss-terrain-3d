import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/webgpu"
import { Pane, FolderApi } from "tweakpane"

export class App {
    private renderer!: THREE.WebGPURenderer
    private camera!: THREE.PerspectiveCamera
    private scene!: THREE.Scene
    private sizes = {
        width: 0,
        height: 0,
    }
    private clock!: THREE.Clock
    private mesh!: THREE.Mesh
    private pane!: Pane
    private tweaksFolder!: FolderApi
    private tweaks = {
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
    }
    private textureLoader!: THREE.TextureLoader
    private hdrLoader!: HDRLoader
    private controls!: OrbitControls
    private elapsedTime = 0

    async initialize() {
        const canvas = document.getElementById("app") as HTMLCanvasElement
        this.renderer = new THREE.WebGPURenderer({
            antialias: true,
            canvas: canvas
        })
        this.sizes.width = window.innerWidth
        this.sizes.height = window.innerHeight
        this.renderer.setSize(this.sizes.width, this.sizes.height)

        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this.renderer.setPixelRatio(pixelRatio)
        this.renderer.setClearColor(this.tweaks.background)
        this.renderer.toneMapping = this.tweaks.toneMapping

        this.hdrLoader = new HDRLoader()

        await this.renderer.init()

        const aspect = this.sizes.width / this.sizes.height
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 1000)
        this.camera.position.set(0, 1, 1)

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true

        this.scene = new THREE.Scene()


        this.textureLoader = new THREE.TextureLoader()
        const texture = await this.textureLoader.loadAsync("/static/maps/texture.jpg")
        texture.colorSpace = THREE.SRGBColorSpace

        const heightMap = await this.textureLoader.loadAsync("/static/maps/height.png")

        const size = 1
        const resolution = 512
        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution)
        const mat = new THREE.MeshStandardNodeMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            wireframe: this.tweaks.wireframe,
            map: texture,
            displacementMap: heightMap,
        })

        this.mesh = new THREE.Mesh(geo, mat)
        this.mesh.geometry.rotateX(-Math.PI * 0.5)
        this.camera.lookAt(this.mesh.position)
        this.scene.add(this.mesh)

        const envMap = await this.hdrLoader.loadAsync("/static/maps/envmap-1k.hdr")
        envMap.mapping = THREE.EquirectangularReflectionMapping
        this.scene.environment = envMap
        this.scene.background = envMap
        this.scene.backgroundBlurriness = this.tweaks.backgroundBlurriness

        this.clock = new THREE.Clock()

        this.pane = new Pane()
        this.tweaksFolder = this.pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })

        this.setupTweaks()

        window.addEventListener("resize", () => this.resize())

        this.render()
    }

    private setupTweaks() {
        this.tweaksFolder.addBinding(this.tweaks, "background", {
            label: "Background Color",
            view: "color",
            color: { type: "float" }
        }).on("change", (e) => {
            this.renderer.setClearColor(e.value)
        })

        this.tweaksFolder.addBinding(this.tweaks, "backgroundBlurriness", {
            label: "Background Blur",
            min: 0,
            max: 1.0,
            step: 0.01
        }).on("change", (e) => {
            this.scene.backgroundBlurriness = e.value
        })

        this.tweaksFolder.addBinding(this.tweaks, "toneMapping", {
            label: "Tone Mapping",
            options: this.tweaks.toneMappingOptions
        }).on("change", (e) => {
            this.renderer.toneMapping = e.value
        })

        this.tweaksFolder.addBinding(this.tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            (this.mesh.material as THREE.MeshStandardNodeMaterial).wireframe = e.value
        })

        this.tweaksFolder.addBinding(this.tweaks, "animate", {
            label: "Animate",
        })
    }

    private resize(): void {
        this.sizes.width = window.innerWidth
        this.sizes.height = window.innerHeight

        this.renderer.setSize(this.sizes.width, this.sizes.height)
        const pixelRatio = Math.min(2, window.devicePixelRatio)
        this.renderer.setPixelRatio(pixelRatio)

        const aspect = this.sizes.width / this.sizes.height
        this.camera.aspect = aspect
        this.camera.updateProjectionMatrix()
    }

    private update(): void {
        const dt = this.clock.getDelta()
        const speed = 0.25
        this.controls.update()

        if (this.tweaks.animate) {
            this.elapsedTime += dt
            this.mesh.rotateY(Math.PI * dt * speed)

        }
    }

    private render(): void {
        this.update()
        this.renderer.render(this.scene, this.camera)
        window.requestAnimationFrame(() => this.render())
    }
}
