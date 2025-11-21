import * as THREE from 'three';
import { QuadTree } from './QuadTree';

export class QuadTreeHelper extends THREE.LineSegments {
    private _quadTree: QuadTree
    private _geometry: THREE.BufferGeometry
    private _material: THREE.LineBasicMaterial

    constructor(quadTree: QuadTree) {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            depthWrite: false,
            depthTest: true,
            transparent: true,
        });
        super(geometry, material)

        this._quadTree = quadTree;
        this._geometry = geometry;
        this._material = material;
        this.updateGeometry();
    }

    dispose(): void {
        this._geometry.dispose();
        this._material.dispose();
    }

    update(): void {
        this.updateGeometry();
    }

    private updateGeometry(): void {
        const bounds = this._quadTree.allBounds;

        const vertices = []
        const colors = []
        const minHeight = 0.0

        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];

            const cellMin = b.min;
            const cellMax = b.max;

            // Insert lines for the 4 corners according to bounding box
            vertices.push(
                cellMin.x, minHeight, cellMin.y,
                cellMax.x, minHeight, cellMin.y,

                cellMax.x, minHeight, cellMin.y,
                cellMax.x, minHeight, cellMax.y,

                cellMax.x, minHeight, cellMax.y,
                cellMin.x, minHeight, cellMax.y,

                cellMin.x, minHeight, cellMax.y,
                cellMin.x, minHeight, cellMin.y,
            )

            for (let j = 0; j < 8; j++) {
                colors.push(1, 1, 1);
            }
        }

        this._geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this._geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
}
