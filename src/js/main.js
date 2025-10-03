import { ACESFilmicToneMapping } from "three"
import { HDRLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import * as THREE from "three/webgpu"
import { Pane } from "tweakpane"

let renderer = null
let camera = null
let scene = null
let sizes = {
    width: 0,
    height: 0,
}
let clock = null
let mesh = null
let pane = null
let tweaksFolder = null
let tweaks = {
    wireframe: false,
    background: new THREE.Color(0x000000),
    animate: false,
    toneMappingOptions: {
        "None": THREE.NoToneMapping,
        "Agx": THREE.AgXToneMapping,
        "Filmic": THREE.ACESFilmicToneMapping,
        "Reinhard": THREE.ReinhardToneMapping,
    },
    toneMapping: THREE.ACESFilmicToneMapping
}
let textureLoader = null
let hdrLoader = null
let controls = null
let elapsedTime = 0

window.onload = async () => {
    const canvas = document.getElementById("app")
    renderer = new THREE.WebGPURenderer({
        antialias: true,
        canvas: canvas
    })
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    renderer.setSize(sizes.width, sizes.height)

    const pixelRatio = Math.min(2, window.devicePixelRatio)
    renderer.setPixelRatio(pixelRatio)
    renderer.setClearColor(tweaks.background)
    renderer.toneMapping = tweaks.toneMapping

    hdrLoader = new HDRLoader()

    await renderer.init()

    const aspect = sizes.width / sizes.height
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.position.set(0, 1, 1)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    scene = new THREE.Scene()


    textureLoader = new THREE.TextureLoader()
    const texture = await textureLoader.loadAsync("/static/maps/texture.png")
    texture.colorSpace = THREE.SRGBColorSpace

    const heightMap = await textureLoader.loadAsync("/static/maps/height.png")

    const size = 1
    const resolution = 512
    const geo = new THREE.PlaneGeometry(size, size, resolution, resolution)
    const mat = new THREE.MeshStandardNodeMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        wireframe: tweaks.wireframe,
        map: texture,
        displacementMap: heightMap,
    })

    mesh = new THREE.Mesh(geo, mat)
    mesh.geometry.rotateX(-Math.PI * 0.5)
    camera.lookAt(mesh.position)
    scene.add(mesh)

    const envMap = await hdrLoader.loadAsync("/static/maps/envmap-1k.hdr")
    envMap.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = envMap

    clock = new THREE.Clock()

    pane = new Pane()
    tweaksFolder = pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })

    // Add Tweaks
    tweaksFolder.addBinding(tweaks, "background", {
        label: "Background Color",
        view: "color",
        color: { type: "float" }
    }).on("change", e => {
        renderer.setClearColor(e.value)
    })

    tweaksFolder.addBinding(tweaks, "toneMapping", {
        label: "Tone Mapping",
        options: tweaks.toneMappingOptions
    }).on("change", e => {
        renderer.toneMapping = e.value
    })

    tweaksFolder.addBinding(tweaks, "wireframe", {
        label: "Wireframe",
    }).on("change", e => {
        mesh.material.wireframe = e.value
    })

    tweaksFolder.addBinding(tweaks, "animate", {
        label: "Animate",
    })

    window.addEventListener("resize", resize)

    render()
}

const resize = () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    renderer.setSize(sizes.width, sizes.height)
    const pixelRatio = Math.min(2, window.devicePixelRatio)
    renderer.setPixelRatio(pixelRatio)

    const aspect = sizes.width / sizes.height
    camera.aspect = aspect
    camera.updateProjectionMatrix()
}

const update = () => {
    const dt = clock.getDelta()
    const speed = 0.25
    controls.update()

    if (tweaks.animate) {
        elapsedTime += dt
        mesh.rotateY(Math.PI * dt * speed)

    }

}

const render = () => {
    update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(render)
}
