import * as THREE from "three/build/three.webgpu"
import { TerrainTileParams } from './TerrainTileParams';
import { GeometryHelper } from './GeometryHelper.js';

export class TerrainTile {
    /** @type {THREE.Mesh?} */
    #mesh = null

    /** @type {THREE.MeshStandardNodeMaterial?} */
    #material = null

    /** @type {TerrainTileParams} */
    #params


    get mesh() {
        return this.#mesh
    }

    get material() {
        return this.#material
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
            wireframe: this.#params.wireframe,
            map: this.#params.dopTexture,
            displacementMap: this.#params.demTexture,
        })

        this.#mesh = new THREE.Mesh(geo, this.#material)
    }
}
