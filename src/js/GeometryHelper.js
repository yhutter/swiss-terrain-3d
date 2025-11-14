import * as THREE from "three"
export class GeometryHelper {

    /** 
     * @param {number} x
     * @param {number} y
     * @param {number} resolution
     * @returns {number}
     */
    static getIndexForGrid(x, y, resolution) {
        return y * (resolution + 1) + x;
    }


    /** 
     * Generates a regular grid geometry with an alternating diagonal pattern already rotate as a horizontal plane.
     * @param {number} resolution
     * @param {number} size
     * @returns {THREE.BufferGeometry}
     */
    static createRegularGridGeometry(resolution, size) {
        const positions = [];
        const indices = [];
        const uvs = [];

        const step = size / resolution;

        // Generate vertex positions & UVs
        for (let y = 0; y <= resolution; y++) {
            for (let x = 0; x <= resolution; x++) {
                const posX = x * step - size / 2;
                const posY = y * step - size / 2;
                const posZ = 0
                positions.push(posX, posY, posZ)

                const uvX = x / resolution;
                const uvY = y / resolution;
                uvs.push(uvX, uvY);
            }
        }


        // Generate alternating diagonal pattern
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const a = GeometryHelper.getIndexForGrid(x, y, resolution);
                const b = GeometryHelper.getIndexForGrid(x + 1, y, resolution);
                const c = GeometryHelper.getIndexForGrid(x, y + 1, resolution);
                const d = GeometryHelper.getIndexForGrid(x + 1, y + 1, resolution);

                // Alternate the diagonal based on the sum of x and y
                if ((x + y) % 2 === 0) {
                    indices.push(a, b, c, b, d, c);
                } else {
                    indices.push(a, b, d, a, d, c);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }
}
