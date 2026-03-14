import * as THREE from "three"

import TerrainTileVertexShader from "./Shaders/TerrainTile.vert"
import TerrainTileFragmentShader from "./Shaders/TerrainTile.frag"

import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';


import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

export class TerrainTile extends THREE.Group {
    private _identifier: string
    private _mesh: THREE.Mesh | null = null
    private _lineMesh: Line2 | null = null
    private _material: CustomShaderMaterial<typeof THREE.MeshStandardMaterial> | null = null
    private _stitchingMode: IndexStitchingMode = IndexStitchingMode.Full
    private _boxHelper: THREE.BoxHelper | null = null
    private _enableStitchingColor: boolean = false
    private _params: TerrainTileParams;

    get identifier(): string {
        return this._identifier
    }

    useDemTexture(value: boolean) {
        if (!this._material) {
            return
        }
        if (this._material.uniforms.uUseDemTexture.value === value) {
            return
        }
        this._material.uniforms.uUseDemTexture.value = value;
    }

    get mesh(): THREE.Mesh | null {
        return this._mesh
    }

    enableLineMesh(value: boolean) {
        if (this._lineMesh) {
            if (this._lineMesh.visible === value) {
                return
            }
            this._lineMesh.visible = value
        }

    }

    enableStitchingColor(value: boolean) {
        if (!this._material) {
            return
        }
        if (this._enableStitchingColor === value) {
            return
        }
        this._enableStitchingColor = value
        this._material.uniforms.uTintColor.value = (this._stitchingMode == IndexStitchingMode.Full || !this._enableStitchingColor) ? new THREE.Color(0xffffff) : new THREE.Color(0xffff00)
    }

    enableBoxHelper(value: boolean) {
        if (this._boxHelper) {
            if (this._boxHelper.visible === value) {
                return
            }
            this._boxHelper.visible = value
        }
    }

    setWireframe(value: boolean) {
        if (!this._material) {
            return
        }
        if (this._material.wireframe === value) {
            return
        }
        this._material.wireframe = value
    }

    onStitchingModeChanged(mode: IndexStitchingMode) {
        if (this._stitchingMode === mode) {
            return
        }
        this._stitchingMode = mode
        this.updateStitchingModeDependentResources()
    }

    dispose() {
        if (this._boxHelper) {
            this.remove(this._boxHelper)
        }
        if (this._mesh) {
            this.remove(this._mesh)
        }
        if (this._lineMesh) {
            this._lineMesh.geometry.dispose()
            this.remove(this._lineMesh)
        }
        if (this._material) {
            this._material.dispose()
        }
    }

    constructor(params: TerrainTileParams) {
        super()
        this._params = params
        this._identifier = this._params.id
        const wireframe = params.wireframe
        const size = params.size
        const geo = GeometryGenerator.getGeometryForStitchingMode(params.stitchingMode)
        this._material = new CustomShaderMaterial({
            baseMaterial: THREE.MeshStandardMaterial,
            side: THREE.DoubleSide,
            wireframe: wireframe,
            vertexShader: TerrainTileVertexShader,
            fragmentShader: TerrainTileFragmentShader,
            uniforms: {
                uDopTexture: { value: params.dopTexture },
                uDemTexture: { value: params.demTexture },
                uUseDemTexture: { value: params.shouldUseDemTexture },
                uHeightScaleMin: { value: params.minHeightScale },
                uHeightScaleMax: { value: params.maxHeightScale },
                uTintColor: { value: new THREE.Color(0xffffff) },
            }
        })

        this._mesh = new THREE.Mesh(geo, this._material)
        this._mesh.scale.set(size, 1, size)
        this._mesh.position.set(params.xPos, 0, params.zPos)
        this.add(this._mesh)

        // Important for frustum culling
        this.recomputeBoundingSphere()
        this._boxHelper = new THREE.BoxHelper(this._mesh, 0xff0000)
        this._boxHelper.visible = params.enableBoxHelper
        this.add(this._boxHelper)

        this._stitchingMode = params.stitchingMode

        this._lineMesh = this.createLineMesh(params.bounds)
        this._lineMesh.visible = params.enableLineMesh
        this.add(this._lineMesh)
        this._enableStitchingColor = params.enableStichingColor
        this.updateStitchingModeDependentResources()
    }

    private updateStitchingModeDependentResources() {
        if (!this._material) {
            return
        }
        this._material.uniforms.uTintColor.value = (this._stitchingMode == IndexStitchingMode.Full || !this._enableStitchingColor) ? new THREE.Color(0xffffff) : new THREE.Color(0xffff00)

        if (this._lineMesh) {
            const colors = this.getVertexColorsForStitchingMode(this._stitchingMode)
            this._lineMesh.geometry.setColors(colors)
        }

        if (this._mesh && this._mesh.geometry) {
            const newGeometry = GeometryGenerator.getGeometryForStitchingMode(this._stitchingMode)
            if (newGeometry == null) {
                console.error("Failed to get new geometry for stitching mode:", this._stitchingMode)
                return
            }
            this._mesh.geometry = newGeometry
        }
    }

    private getVertexColorsForStitchingMode(stitchingMode: IndexStitchingMode): number[] {
        const colors = []
        const baseColor = [1, 1, 1]

        const isSouthEdgeStitching = stitchingMode === IndexStitchingMode.South || stitchingMode === IndexStitchingMode.SouthEast || stitchingMode === IndexStitchingMode.SouthWest
        const isEastEdgeStitching = stitchingMode === IndexStitchingMode.East || stitchingMode === IndexStitchingMode.NorthEast || stitchingMode === IndexStitchingMode.SouthEast
        const isNorthEdgeStitching = stitchingMode === IndexStitchingMode.North || stitchingMode === IndexStitchingMode.NorthEast || stitchingMode === IndexStitchingMode.NorthWest
        const isWestEdgeStitching = stitchingMode === IndexStitchingMode.West || stitchingMode === IndexStitchingMode.NorthWest || stitchingMode === IndexStitchingMode.SouthWest

        // North edge
        const northEdgeColor = isNorthEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...northEdgeColor, ...northEdgeColor)

        // East edge
        const eastEdgeColor = isEastEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...eastEdgeColor, ...eastEdgeColor)

        // South Edge
        const southEdgeColor = isSouthEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...southEdgeColor, ...southEdgeColor)

        // West edge
        const westEdgeColor = isWestEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...westEdgeColor, ...westEdgeColor)

        return colors
    }

    private recomputeBoundingSphere() {
        if (!this._mesh) {
            return
        }
        this._mesh.geometry.computeBoundingBox()
        const bb = this._mesh.geometry.boundingBox!
        bb.min.y = this._params.minHeightScale
        bb.max.y = this._params.maxHeightScale
        this._mesh.geometry.boundingBox = bb

        const sphere = new THREE.Sphere()
        bb.getBoundingSphere(sphere)
        this._mesh.geometry.boundingSphere = sphere
    }

    private createLineMesh(bounds: THREE.Box2): Line2 {
        const geometry = new LineGeometry()
        const positions = []

        const cellMin = bounds.min
        const cellMax = bounds.max

        const minHeight = this._params.level


        positions.push(
            // North edge
            cellMin.x, minHeight, cellMin.y,
            cellMax.x, minHeight, cellMin.y,

            // East edge
            cellMax.x, minHeight, cellMin.y,
            cellMax.x, minHeight, cellMax.y,

            // South edge
            cellMax.x, minHeight, cellMax.y,
            cellMin.x, minHeight, cellMax.y,

            // West edge
            cellMin.x, minHeight, cellMax.y,
            cellMin.x, minHeight, cellMin.y,
        )

        const colors = this.getVertexColorsForStitchingMode(this._stitchingMode)

        geometry.setPositions(positions)
        geometry.setColors(colors)

        const material = new LineMaterial({
            vertexColors: true,
            depthWrite: false,
            depthTest: true,
            transparent: true,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            linewidth: 4
        })
        const lineMesh = new Line2(geometry, material);
        return lineMesh
    }
}
