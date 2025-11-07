import * as THREE from "three/build/three.webgpu"
import { TerrainTileParams } from './TerrainTileParams';
import { App } from './App.js';
import { GeometryHelper } from './GeometryHelper.js';

export class TerrainTile {
    /** @type {THREE.Mesh?} */
    #mesh = null

    /** @type {THREE.MeshStandardNodeMaterial?} */
    #material = null

    /** @type {TerrainTileParams} */
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
     * @param {TerrainTileParams} params 
     */
    constructor(params) {
        this.#params = params
        const resolution = this.#params.resolution
        const size = this.#params.size

        const geo = GeometryHelper.createRegularGridGeometry(resolution, size)
        geo.rotateX(-Math.PI * 0.5)

        this.#material = new THREE.MeshStandardNodeMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            wireframe: this.#tweaks.wireframe,
            map: this.#params.dopTexture,
            displacementMap: this.#params.demTexture,
            displacementScale: this.#tweaks.displacementScale,
        })

        this.#mesh = new THREE.Mesh(geo, this.#material)
        this.#mesh.position.z = 1
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
