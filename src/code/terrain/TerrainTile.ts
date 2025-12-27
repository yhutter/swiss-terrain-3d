import * as THREE from "three/webgpu"
import { uniform, Fn, vec3, texture, uv, mix, positionGeometry, If, vec4 } from "three/tsl"

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";

export class TerrainTile extends THREE.Group {
    private _identifier: string
    private _mesh: THREE.Mesh | null = null
    private _lineMesh: THREE.LineSegments | null = null
    private _material: THREE.MeshStandardNodeMaterial | null = null
    private _stitchingMode: IndexStitchingMode = IndexStitchingMode.Full
    private _boxHelper: THREE.BoxHelper | null = null
    private _enableStitchingColor: boolean = false
    private _params: TerrainTileParams;
    private _uUseDemTexture = uniform(true);
    private _uTintColor = uniform(new THREE.Color(0xffffff));
    private _uDopTexture = uniform<THREE.Texture | null>(null);
    private _uDemTexture = uniform<THREE.Texture | null>(null);
    private _uHeightScaleMin = uniform(0.0);
    private _uHeightScaleMax = uniform(1.0);

    private readonly _positionNode = Fn(() => {
        let finalPosition = vec3(0)
        If(this._uUseDemTexture, () => {
            const height = texture(this._uDemTexture.value!, uv()).r
            const normalizedHeight = mix(this._uHeightScaleMin, this._uHeightScaleMax, height)
            finalPosition.assign(positionGeometry.add(vec3(0, normalizedHeight, 0)))
        }).Else(() => {
            finalPosition.assign(positionGeometry)
        })
        return finalPosition
    })

    private readonly _colorNode = Fn(() => {
        const dopColor = texture(this._uDopTexture.value!, uv())
        const finalColor = vec4(this._uTintColor.mul(dopColor))
        return finalColor
    })


    get identifier(): string {
        return this._identifier
    }

    useDemTexture(value: boolean) {
        if (this._uUseDemTexture.value === value) {
            return
        }
        if (this._material) {
            this._uUseDemTexture.value = value;
        }
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
        if (this._enableStitchingColor === value) {
            return
        }
        this._enableStitchingColor = value
        this._uTintColor.value = (this._stitchingMode == IndexStitchingMode.Full || !this._enableStitchingColor) ? new THREE.Color(0xffffff) : new THREE.Color(0xffff00)
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
        if (this._material) {
            if (this._material.wireframe === value) {
                return
            }
            this._material.wireframe = value
        }
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

        this._material = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
            wireframe: wireframe,
            positionNode: this._positionNode(),
            colorNode: this._colorNode(),
        })

        this._uDopTexture.value = params.dopTexture;
        this._uDemTexture.value = params.demTexture;
        this._uUseDemTexture.value = params.shouldUseDemTexture;
        this._uHeightScaleMin.value = params.minHeightScale;
        this._uHeightScaleMax.value = params.maxHeightScale;

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
        this._uTintColor.value = (this._stitchingMode == IndexStitchingMode.Full || !this._enableStitchingColor) ? new THREE.Color(0xffffff) : new THREE.Color(0xffff00)

        if (this._lineMesh) {
            const colorBufferAttribute = this._lineMesh.geometry.getAttribute('color')
            const colors = this.getVertexColorsForStitchingMode(this._stitchingMode)
            colorBufferAttribute.array.set(colors)
            colorBufferAttribute.needsUpdate = true;
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

    private createLineMesh(bounds: THREE.Box2): THREE.LineSegments {
        const geometry = new THREE.BufferGeometry()
        const vertices = []

        const cellMin = bounds.min
        const cellMax = bounds.max

        const minHeight = this._params.level


        vertices.push(
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

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            depthWrite: false,
            depthTest: true,
            transparent: true,
        })
        const lineMesh = new THREE.LineSegments(geometry, material)
        return lineMesh
    }
}
