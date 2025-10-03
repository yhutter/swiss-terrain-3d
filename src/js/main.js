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
    backgroundColor: new THREE.Color(0x000000)
}

window.onload = async () => {
    const canvas = document.getElementById("app")
    renderer = new THREE.WebGPURenderer({
        antialias: true,
        canvas: canvas
    })
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    renderer.setSize(sizes.width, sizes.height)
    renderer.setClearColor(tweaks.backgroundColor)

    const pixelRatio = Math.min(2, window.devicePixelRatio)
    renderer.setPixelRatio(pixelRatio)

    await renderer.init()

    const aspect = sizes.width / sizes.height
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.position.set(0, 0, 2)

    scene = new THREE.Scene()

    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshBasicNodeMaterial({ color: 0xffffff })

    mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    clock = new THREE.Clock()

    pane = new Pane()
    tweaksFolder = pane.addFolder({ title: "Swiss Terrain 3D", expanded: true })
    tweaksFolder.addBinding(tweaks, "backgroundColor", {
        label: "Background Color",
        view: "color",
        color: { type: "float" }
    }).on("change", e => {
        renderer.setClearColor(e.value)
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
    mesh.rotateY(Math.PI * dt * speed)
}

const render = () => {
    update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(render)
}
