import * as THREE from "three/webgpu"
import { uniform, Fn, vec4, vec3, texture, uv, mix, positionGeometry, If, bool } from "three/tsl"

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { App } from '../App';
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";
import { ColorGenerator } from "../Utils/ColorGenerator";

export class TerrainTile extends THREE.Group {
    private _identifier: string
    private _mesh: THREE.Mesh | null = null
    private _lineMesh: THREE.LineSegments | null = null
    private _material: THREE.MeshStandardNodeMaterial | null = null
    private _demTexture: THREE.Texture | null = null
    private _dopTexture: THREE.Texture | null = null
    private _stitchingMode: IndexStitchingMode = IndexStitchingMode.Full
    private _boxHelper: THREE.BoxHelper | null = null
    private _params: TerrainTileParams;
    private _uUseDemTexture = uniform(true);
    private _uTintColor = uniform(new THREE.Color(1, 1, 1));
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
        return vec4(dopColor.mul(this._uTintColor).rgb, dopColor.a)
    })


    get identifier(): string {
        return this._identifier
    }

    useDemTexture(value: boolean) {
        if (this._lineMesh) {
            this._lineMesh.visible = !value
        }
        if (this._material) {
            this._uUseDemTexture.value = value;
        }
    }

    enableBoxHelper(value: boolean) {
        if (this._boxHelper) {
            this._boxHelper.visible = value
        }
    }

    enableStitchingColor(value: boolean) {
        if (this._material) {
            if (value) {
                const tintColor = ColorGenerator.colorForSitchingMode.get(this._stitchingMode) || new THREE.Color(1, 1, 1)
                this._uTintColor.value.copy(tintColor);
            } else {
                this._uTintColor.value.set(1, 1, 1);
            }
        }
    }

    setAnisotropy(value: number) {
        if (this._dopTexture) {
            this._dopTexture.anisotropy = value
        }
    }

    setWireframe(value: boolean) {
        if (this._material) {
            this._material.wireframe = value
        }
    }

    onStitchingModeChanged(mode: IndexStitchingMode) {
        if (this._stitchingMode === mode) {
            return
        }
        this._stitchingMode = mode

        const indexBuffer = GeometryGenerator.getIndexBufferForStitchingMode(this._stitchingMode)

        if (this._mesh && indexBuffer) {
            this._mesh.geometry.setIndex(indexBuffer)
            this._mesh.geometry.computeVertexNormals()
        }

        const tintColor = ColorGenerator.colorForSitchingMode.get(this._stitchingMode) || new THREE.Color(1, 1, 1)
        if (this._material) {
            this._uTintColor.value.copy(tintColor);
        }
    }

    dispose() {
        if (this._boxHelper) {
            this.remove(this._boxHelper)
        }
        if (this._mesh) {
            this._mesh.geometry.dispose()
            this.remove(this._mesh)
        }
        if (this._lineMesh) {
            this._lineMesh.geometry.dispose()
            this.remove(this._lineMesh)
        }
        if (this._material) {
            this._material.dispose()
        }
        if (this._demTexture) {
            this._demTexture.dispose()
        }
        if (this._dopTexture) {
            this._dopTexture.dispose()
        }
    }

    static async createFromParams(params: TerrainTileParams): Promise<TerrainTile> {
        const terrainTile = new TerrainTile(params)
        const wireframe = params.wireframe
        const size = params.size

        const geo = GeometryGenerator.createRegularGridGeometry(
            size,
            params.stitchingMode
        )
        geo.rotateX(-Math.PI * 0.5)

        const dopTexture = await App.instance.textureLoader.loadAsync(params.dopTexturePath)
        dopTexture.colorSpace = THREE.SRGBColorSpace
        dopTexture.wrapS = THREE.ClampToEdgeWrapping
        dopTexture.wrapT = THREE.ClampToEdgeWrapping
        dopTexture.generateMipmaps = true
        dopTexture.anisotropy = params.anistropy
        terrainTile._dopTexture = dopTexture


        const demTexture = await App.instance.textureLoader.loadAsync(params.demTexturePath)
        demTexture.wrapS = THREE.ClampToEdgeWrapping
        demTexture.wrapT = THREE.ClampToEdgeWrapping
        demTexture.generateMipmaps = true
        demTexture.minFilter = THREE.LinearFilter
        demTexture.magFilter = THREE.LinearFilter
        terrainTile._demTexture = demTexture
        terrainTile._material = new THREE.MeshStandardNodeMaterial({
            side: THREE.DoubleSide,
            wireframe: wireframe,
            positionNode: terrainTile._positionNode(),
            colorNode: terrainTile._colorNode(),
        })

        terrainTile._uDopTexture.value = terrainTile._dopTexture;
        terrainTile._uDemTexture.value = terrainTile._demTexture;
        terrainTile._uUseDemTexture.value = params.shouldUseDemTexture;
        terrainTile._uHeightScaleMin.value = params.minHeightScale;
        terrainTile._uHeightScaleMax.value = params.maxHeightScale;

        terrainTile._mesh = new THREE.Mesh(geo, terrainTile._material)
        terrainTile.add(terrainTile._mesh)
        terrainTile._mesh.position.set(
            params.xPos,
            0,
            params.zPos,
        )


        // Important for frustum culling
        terrainTile.recomputeBoundingSphere()
        terrainTile._boxHelper = new THREE.BoxHelper(terrainTile._mesh, 0xff0000)
        terrainTile._boxHelper.visible = params.enableBoxHelper
        terrainTile.add(terrainTile._boxHelper)

        terrainTile._stitchingMode = params.stitchingMode
        terrainTile._lineMesh = terrainTile.createLineMesh(params.bounds)
        terrainTile._lineMesh.visible = !params.shouldUseDemTexture
        terrainTile.add(terrainTile._lineMesh)
        return terrainTile
    }

    constructor(params: TerrainTileParams) {
        super()
        this._params = params
        this._identifier = this._params.id
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

        const cellMin = bounds.min;
        const cellMax = bounds.max;
        const minHeight = 0.0

        // Insert lines for the 4 corners according to bounding box
        vertices.push(
            // South edge
            cellMin.x, minHeight, cellMin.y,
            cellMax.x, minHeight, cellMin.y,

            // East edge
            cellMax.x, minHeight, cellMin.y,
            cellMax.x, minHeight, cellMax.y,

            // North edge
            cellMax.x, minHeight, cellMax.y,
            cellMin.x, minHeight, cellMax.y,

            // West edge
            cellMin.x, minHeight, cellMax.y,
            cellMin.x, minHeight, cellMin.y,
        )

        const colors = []
        for (let i = 0; i < 8; i++) {
            colors.push(1, 1, 1)
        }

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
