import * as THREE from "three"
import vertexShader from '../static/shaders/terrain.vert.glsl'
import fragmentShader from '../static/shaders/terrain.frag.glsl'
import CustomShaderMaterial from "three-custom-shader-material/vanilla";


import { TerrainTileParams } from './TerrainTileParams';
import { GeometryHelper } from './GeometryHelper.js';

export class TerrainTile {
    /** @type {THREE.Mesh?} */
    #mesh = null

    /** @type {CustomShaderMaterial?} */
    #material = null

    /** @type {TerrainTileParams} */
    #params


    get mesh() {
        return this.#mesh
    }

    get material() {
        return this.#material
    }

    get demTexture() {
        return this.#params.demTexture
    }

    get dopTexture() {
        return this.#params.dopTexture
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


        this.#material = new CustomShaderMaterial({
            baseMaterial: THREE.MeshStandardMaterial,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                dopTexture: { value: this.#params.dopTexture },
                demTexture: { value: this.#params.demTexture }
            },
            side: THREE.DoubleSide,
            wireframe: wireframe,
        })

        this.#mesh = new THREE.Mesh(geo, this.#material)
    }
}
