import * as THREE from "three/build/three.webgpu"

export class TerrainTileParams {
    /** @type {number} */
    size

    /** @type {number} */
    resolution

    /** @type {THREE.Texture} */
    dopTexture

    /** @type {THREE.Texture} */
    demTexture

    /** @type {boolean} */
    wireframe = false

    /**
     * @param {number} size
     * @param {number} resolution
     * @param {THREE.Texture} dopTexture
     * @param {THREE.Texture} demTexture
     * @param {boolean} wireframe
     */
    constructor(
        size,
        resolution,
        dopTexture,
        demTexture,
        wireframe = false,
    ) {
        this.size = size
        this.resolution = resolution
        this.dopTexture = dopTexture
        this.demTexture = demTexture
        this.wireframe = wireframe
    }
}
