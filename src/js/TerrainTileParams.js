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

    /**
     * @param {number} size
     * @param {number} resolution
     * @param {THREE.Texture} dopTexture
     * @param {THREE.Texture} demTexture
     */
    constructor(size, resolution, dopTexture, demTexture) {
        this.size = size
        this.resolution = resolution
        this.dopTexture = dopTexture
        this.demTexture = demTexture
    }
}
