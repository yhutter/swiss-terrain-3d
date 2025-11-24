import * as THREE from "three"

export class GeometryGenerator {

    static createRegularGridGeometry(resolution: number, size: number): THREE.BufferGeometry {
        const positions: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];

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
                const a = GeometryGenerator.getIndexForGrid(x, y, resolution);
                const b = GeometryGenerator.getIndexForGrid(x + 1, y, resolution);
                const c = GeometryGenerator.getIndexForGrid(x, y + 1, resolution);
                const d = GeometryGenerator.getIndexForGrid(x + 1, y + 1, resolution);

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

    private static getIndexForGrid(x: number, y: number, resolution: number): number {
        return y * (resolution + 1) + x;
    }
}
