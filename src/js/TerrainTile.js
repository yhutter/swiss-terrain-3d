import * as THREE from "three/build/three.webgpu"
import { texture, uv, vec2, float, add, sub, mul, vec3, positionLocal } from "three/build/three.tsl"

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
        const wireframe = this.#params.wireframe
        const size = this.#params.size

        const geo = GeometryHelper.createRegularGridGeometry(
            resolution,
            size
        )
        geo.rotateX(-Math.PI * 0.5)

        const colorSample = texture(this.#params.dopTexture, uv())
        const heightSample = texture(this.#params.demTexture, uv()).r;
        const displacedPosition = add(positionLocal, vec3(0, heightSample, 0));

        this.#material = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
            wireframe: wireframe,
            colorNode: colorSample,
            positionNode: displacedPosition,
            displacementMap: this.#params.demTexture,
        })

        this.#mesh = new THREE.Mesh(geo, this.#material)
    }
}
