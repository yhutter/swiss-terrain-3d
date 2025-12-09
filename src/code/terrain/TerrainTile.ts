import * as THREE from "three"
import vertexShader from '../../static/shaders/terrain.vert.glsl'
import fragmentShader from '../../static/shaders/terrain.frag.glsl'
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { App } from '../App';
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";
import { ColorGenerator } from "../Utils/ColorGenerator";

export class TerrainTile extends THREE.Group {
    private _identifier: string
    private _mesh: THREE.Mesh | null = null
    private _lineMesh: THREE.LineSegments | null = null
    private _material: CustomShaderMaterial | null = null
    private _demTexture: THREE.Texture | null = null
    private _dopTexture: THREE.Texture | null = null
    private _stitchingMode: IndexStitchingMode = IndexStitchingMode.Full


    get identifier(): string {
        return this._identifier
    }

    useDemTexture(value: boolean) {
        if (this._lineMesh) {
            this._lineMesh.visible = !value
        }
        if (this._material) {
            this._material.uniforms.uUseDemTexture.value = value
        }
    }

    enableStitchingColor(value: boolean) {
        if (this._material) {
            if (value) {
                const tintColor = ColorGenerator.colorForSitchingMode.get(this._stitchingMode) || new THREE.Color(1, 1, 1)
                this._material.uniforms.uTintColor.value.copy(tintColor);
            } else {
                this._material.uniforms.uTintColor.value.set(1, 1, 1);
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
            this._material.uniforms.uTintColor.value.copy(tintColor);
        }
    }

    dispose() {
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
        const terrainTile = new TerrainTile(params.id)
        const resolution = params.resolution
        const wireframe = params.wireframe
        const size = params.size

        const geo = GeometryGenerator.createRegularGridGeometry(
            resolution,
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

        terrainTile._material = new CustomShaderMaterial({
            baseMaterial: new THREE.MeshStandardMaterial(),
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uDopTexture: { value: terrainTile._dopTexture },
                uTintColor: { value: new THREE.Color(1, 1, 1) },
                uDemTexture: { value: terrainTile._demTexture },
                uUseDemTexture: { value: params.shouldUseDemTexture },
                uHeightScaleMin: { value: params.minHeightScale },
                uHeightScaleMax: { value: params.maxHeightScale },
            },
            side: THREE.DoubleSide,
            wireframe: wireframe,
        })

        terrainTile._mesh = new THREE.Mesh(geo, terrainTile._material)
        terrainTile.add(terrainTile._mesh)
        // TODO: Do frustum culling on GPU
        terrainTile._mesh.frustumCulled = false
        terrainTile._mesh.position.set(
            params.xPos,
            0,
            params.zPos,
        )
        terrainTile._lineMesh = terrainTile.createLineMesh(params.bounds)
        terrainTile._lineMesh.visible = !params.shouldUseDemTexture
        terrainTile.add(terrainTile._lineMesh)
        return terrainTile
    }

    constructor(identifier: string) {
        super()
        this._identifier = identifier
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
