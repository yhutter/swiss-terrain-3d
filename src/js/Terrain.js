import * as THREE from "three/build/three.webgpu"
import { TerrainParams } from './TerrainParams';
import { App } from './App.js';

export class Terrain {
    /** @type {THREE.Mesh?} */
    #mesh = null

    /** @type {THREE.MeshStandardNodeMaterial?} */
    #material = null

    /** @type {TerrainParams} */
    #params

    #tweaks = {
        wireframe: false,
        displacementScale: 0.2,
        animate: false,
    }

    get mesh() {
        return this.#mesh
    }

    /** 
     * @param {TerrainParams} params 
     */
    constructor(params) {
        this.#params = params
    }

    async create() {
        const texture = await App.instance.textureLoader.loadAsync(this.#params.dopPath)
        texture.colorSpace = THREE.SRGBColorSpace

        const heightMap = await App.instance.textureLoader.loadAsync(this.#params.demPath)

        const geo = new THREE.PlaneGeometry(this.#params.size, this.#params.size, this.#params.resolution, this.#params.resolution)
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

        this.#setupTweaks()
    }

    #setupTweaks() {
        const folder = App.instance.pane.addFolder({
            title: 'Terrain',
            expanded: true,
        })

        folder.addBinding(this.#tweaks, "displacementScale", {
            label: "Displacement Scale",
            min: 0,
            max: 5.0,
            step: 0.01
        }).on("change", (e) => {
            if (this.#material) {
                this.#material.displacementScale = e.value
            }
        })

        folder.addBinding(this.#tweaks, "wireframe", {
            label: "Wireframe",
        }).on("change", (e) => {
            if (this.#material) {
                this.#material.wireframe = e.value
            }
        })

        folder.addBinding(this.#tweaks, "animate", {
            label: "Animate",
        })
    }

    /** 
     * @param {number} dt
     */
    update(dt) {
        if (this.#tweaks.animate && this.#mesh) {
            this.#mesh.rotateY(Math.PI * dt * 0.25)
        }
    }


}
