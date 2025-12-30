import * as THREE from "three"
import { IndexStitchingMode } from "./IndexStitchingMode";

export class GeometryGenerator {

    private static _indexBuffersForStitchingModes: Map<IndexStitchingMode, THREE.BufferAttribute> = new Map();
    private static _geometriesForStitchingModes: Map<IndexStitchingMode, THREE.BufferGeometry> = new Map();

    private static readonly TILE_SIZE = 33

    static initialize() {
        GeometryGenerator.intitializeIndexBufferForStitchingModes();
        GeometryGenerator.initalizeGeometriesForStitchingModes();
    }


    static getGeometryForStitchingMode(mode: IndexStitchingMode): THREE.BufferGeometry | undefined {
        return GeometryGenerator._geometriesForStitchingModes.get(mode);
    }

    private static intitializeIndexBufferForStitchingModes() {
        for (const modeKey in IndexStitchingMode) {
            const mode = Number(modeKey) as IndexStitchingMode;
            if (!isNaN(mode)) {
                const indices = GeometryGenerator.generateIndexBufferForStitchingMode(mode, this.TILE_SIZE);
                const indexAttribute = new THREE.BufferAttribute(new Uint32Array(indices), 1);
                GeometryGenerator._indexBuffersForStitchingModes.set(mode, indexAttribute);
            }
        }
    }

    private static initalizeGeometriesForStitchingModes() {
        for (const modeKey in IndexStitchingMode) {
            const mode = Number(modeKey) as IndexStitchingMode;
            if (!isNaN(mode)) {
                const geometry = GeometryGenerator.createRegularGridGeometry(1, mode)
                geometry.rotateX(-Math.PI * 0.5)
                GeometryGenerator._geometriesForStitchingModes.set(mode, geometry);
            }
        }

    }

    private static getIndexBufferForStitchingMode(mode: IndexStitchingMode): THREE.BufferAttribute | undefined {
        return GeometryGenerator._indexBuffersForStitchingModes.get(mode);
    }

    private static createRegularGridGeometry(size: number, indexStitchingMode = IndexStitchingMode.Full): THREE.BufferGeometry {
        if (GeometryGenerator._indexBuffersForStitchingModes.size === 0) {
            throw new Error("GeometryGenerator: Index buffers for stitching modes have not been initialized. Call intitializeIndexBufferForStitchingModes first.");
        }

        const positions: number[] = [];
        const uvs: number[] = [];
        const indexBuffer = GeometryGenerator.getIndexBufferForStitchingMode(indexStitchingMode);

        if (!indexBuffer) {
            throw new Error(`GeometryGenerator: No index buffer found for stitching mode ${IndexStitchingMode[indexStitchingMode]}`);
        }

        const halfSize = size / 2;

        // We subdivide each "logical" quad into a 2x2 grid:
        const gridRes = this.TILE_SIZE * 2;
        const step = size / gridRes;


        // Generate vertex positions + UVs on a uniform grid
        for (let y = 0; y <= gridRes; y++) {
            for (let x = 0; x <= gridRes; x++) {
                const posX = x * step - halfSize;
                const posY = y * step - halfSize;
                const posZ = 0;
                positions.push(posX, posY, posZ);
                uvs.push(x / gridRes, y / gridRes);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indexBuffer);
        geometry.computeVertexNormals();
        return geometry;
    }

    private static generateGeometryId(size: number, indexStitchingMode: IndexStitchingMode): string {
        return `size_${size}_mode_${IndexStitchingMode[indexStitchingMode]}`;
    }

    private static generateIndexBufferForStitchingModeNorthEdge(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \          /|
        //   |   \      /  |
        //   |     \  /    |
        //   h ---- i ---- d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeWestEdge(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h      i ---- d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];
        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, a, i);

        return indices;
    }

    private static generateIndexBufferForStitchingModeEastEdge(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h ---- i      d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeSouthEdge(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h ---- i ---- d
        //   |    /   \    |
        //   |  /      \   |
        //   |/          \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeNorthWestCorner(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \          /|
        //   |   \      /  |
        //   |     \  /    |
        //   h      i ---- d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, g, i);
        indices.push(g, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeSouthEastCorner(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h ---- i      d
        //   |    /   \    |
        //   |  /      \   |
        //   |/          \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, c, i);
        indices.push(c, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeSouthWestCorner(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h      i ---- d
        //   |    /   \    |
        //   |  /      \   |
        //   |/          \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeFull(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \    |     /|
        //   |   \  |   /  |
        //   |     \| /    |
        //   h ---- i ---- d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, d, i);
        indices.push(d, e, i);
        indices.push(e, f, i);
        indices.push(f, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }

    private static generateIndexBufferForStitchingModeNorthEastCorner(gridRes: number, x: number, y: number): number[] {
        //   g ---- f ---- e
        //   | \          /|
        //   |   \      /  |
        //   |     \  /    |
        //   h ---- i      d
        //   |    / | \    |
        //   |  /   |  \   |
        //   |/     |    \ |
        //   a ---- b ---- c
        const idx = (x: number, y: number) => y * (gridRes + 1) + x;
        const a = idx(x, y);
        const b = idx(x + 1, y);
        const c = idx(x + 2, y);

        const h = idx(x, y + 1);
        const i = idx(x + 1, y + 1);
        const d = idx(x + 2, y + 1);

        const g = idx(x, y + 2);
        const f = idx(x + 1, y + 2);
        const e = idx(x + 2, y + 2);
        const indices: number[] = [];

        indices.push(a, b, i);
        indices.push(b, c, i);
        indices.push(c, e, i);
        indices.push(e, g, i);
        indices.push(g, h, i);
        indices.push(h, a, i);
        return indices;
    }


    private static generateIndexBufferForStitchingMode(mode: IndexStitchingMode, resolution: number): number[] {
        const indices: number[] = [];

        // We subdivide each "logical" quad into a 2x2 grid:
        const gridRes = resolution * 2;

        for (let y = 0; y < gridRes; y += 2) {
            for (let x = 0; x < gridRes; x += 2) {
                const stitchNorthEdge = (mode == IndexStitchingMode.North || mode == IndexStitchingMode.NorthWest || mode == IndexStitchingMode.NorthEast) && y === gridRes - 2;
                const stitchWestEdge = (mode == IndexStitchingMode.West || mode == IndexStitchingMode.SouthWest || mode == IndexStitchingMode.NorthWest) && x === 0;
                const stitchEastEdge = (mode == IndexStitchingMode.East || mode == IndexStitchingMode.NorthEast || mode == IndexStitchingMode.SouthEast) && x === gridRes - 2;
                const stitchSouthEdge = (mode == IndexStitchingMode.South || mode == IndexStitchingMode.SouthWest || mode == IndexStitchingMode.SouthEast) && y === 0;
                const stitchSouthWestCorner = mode == IndexStitchingMode.SouthWest && x === 0 && y === 0;
                const stitchSouthEastCorner = mode == IndexStitchingMode.SouthEast && x === gridRes - 2 && y === 0;
                const stitchNorthWestCorner = mode == IndexStitchingMode.NorthWest && x === 0 && y === gridRes - 2;
                const stitchNorthEastCorner = mode == IndexStitchingMode.NorthEast && x === gridRes - 2 && y === gridRes - 2;
                if (stitchSouthWestCorner) {
                    const southWestCornerIndices = GeometryGenerator.generateIndexBufferForStitchingModeSouthWestCorner(gridRes, x, y);
                    indices.push(...southWestCornerIndices);
                }
                else if (stitchNorthEastCorner) {
                    const northEastCornerIndices = GeometryGenerator.generateIndexBufferForStitchingModeNorthEastCorner(gridRes, x, y);
                    indices.push(...northEastCornerIndices);
                }
                else if (stitchNorthWestCorner) {
                    const northWestCornerIndices = GeometryGenerator.generateIndexBufferForStitchingModeNorthWestCorner(gridRes, x, y);
                    indices.push(...northWestCornerIndices);
                }
                else if (stitchSouthEastCorner) {
                    const southEastCornerIndices = GeometryGenerator.generateIndexBufferForStitchingModeSouthEastCorner(gridRes, x, y);
                    indices.push(...southEastCornerIndices);
                }
                else if (stitchNorthEdge) {
                    const northEdgeIndices = GeometryGenerator.generateIndexBufferForStitchingModeNorthEdge(gridRes, x, y);
                    indices.push(...northEdgeIndices);
                }
                else if (stitchWestEdge) {
                    const westEdgeIndices = GeometryGenerator.generateIndexBufferForStitchingModeWestEdge(gridRes, x, y);
                    indices.push(...westEdgeIndices);
                }
                else if (stitchEastEdge) {
                    const eastEdgeIndices = GeometryGenerator.generateIndexBufferForStitchingModeEastEdge(gridRes, x, y);
                    indices.push(...eastEdgeIndices);

                }
                else if (stitchSouthEdge) {
                    const southEdgeIndices = GeometryGenerator.generateIndexBufferForStitchingModeSouthEdge(gridRes, x, y);
                    indices.push(...southEdgeIndices);
                }
                else {
                    const fullIndices = GeometryGenerator.generateIndexBufferForStitchingModeFull(gridRes, x, y);
                    indices.push(...fullIndices);
                }
            }
        }
        return indices;
    }
}
