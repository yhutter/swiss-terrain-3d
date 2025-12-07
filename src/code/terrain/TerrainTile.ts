import * as THREE from "three"
import vertexShader from '../../static/shaders/terrain.vert.glsl'
import fragmentShader from '../../static/shaders/terrain.frag.glsl'
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { App } from '../App';
import { IndexStitchingMode } from "../Utils/IndexStitchingMode";

export class TerrainTile {
    id: string
    mesh: THREE.Mesh | null = null
    lineMesh: THREE.LineSegments | null = null
    material: CustomShaderMaterial | null = null
    demTexture: THREE.Texture | null = null
    dopTexture: THREE.Texture | null = null
    stitchingMode: IndexStitchingMode = IndexStitchingMode.Full

    set useDemTexture(value: boolean) {
        if (this.material) {
            this.material.uniforms.uUseDemTexture.value = value
        }
    }

    onStitchingModeChanged(mode: IndexStitchingMode) {
        if (this.stitchingMode === mode) {
            return
        }
        this.stitchingMode = mode
        console.log("Sitching mode is now:", IndexStitchingMode[this.stitchingMode])

        const indexBuffer = GeometryGenerator.getIndexBufferForStitchingMode(this.stitchingMode)

        if (this.mesh && indexBuffer) {
            this.mesh.geometry.setIndex(indexBuffer)
            // this.mesh.geometry.index!.needsUpdate = true;
            console.log(`Updated mesh index buffer for stitching mode:`)
        }

        const needsSitching = this.stitchingMode !== IndexStitchingMode.Full
        const tintColor = needsSitching ? new THREE.Color(1, 0, 0) : new THREE.Color(1, 1, 1)
        if (this.material) {
            this.material.uniforms.uTintColor.value.copy(tintColor);
        }
        if (this.lineMesh) {
            const colorBufferAttribute = this.getColorBufferAttributeForStitchingMode(mode)
            this.lineMesh.geometry.setAttribute('color', colorBufferAttribute)
            this.lineMesh.geometry.attributes.color.needsUpdate = true;
            console.log(`Updated line mesh colors for stitching mode:`)
        }
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose()
        }
        if (this.lineMesh) {
            this.lineMesh.geometry.dispose()
        }
        if (this.material) {
            this.material.dispose()
        }
        if (this.demTexture) {
            this.demTexture.dispose()
        }
        if (this.dopTexture) {
            this.dopTexture.dispose()
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
        terrainTile.dopTexture = dopTexture


        const demTexture = await App.instance.textureLoader.loadAsync(params.demTexturePath)
        demTexture.wrapS = THREE.ClampToEdgeWrapping
        demTexture.wrapT = THREE.ClampToEdgeWrapping
        demTexture.generateMipmaps = true
        demTexture.minFilter = THREE.LinearFilter
        demTexture.magFilter = THREE.LinearFilter
        terrainTile.demTexture = demTexture

        terrainTile.material = new CustomShaderMaterial({
            baseMaterial: new THREE.MeshStandardMaterial(),
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uDopTexture: { value: terrainTile.dopTexture },
                uTintColor: { value: new THREE.Color(1, 1, 1) },
                uDemTexture: { value: terrainTile.demTexture },
                uUseDemTexture: { value: params.shouldUseDemTexture },
                uHeightScaleMin: { value: params.minHeightScale },
                uHeightScaleMax: { value: params.maxHeightScale },
            },
            side: THREE.DoubleSide,
            wireframe: wireframe,
        })

        terrainTile.mesh = new THREE.Mesh(geo, terrainTile.material)
        terrainTile.mesh.position.set(
            params.xPos,
            0,
            params.zPos,
        )
        terrainTile.lineMesh = terrainTile.createLineMesh(params.bounds, params.stitchingMode)
        return terrainTile
    }

    constructor(id: string) {
        this.id = id
    }

    private getColorBufferAttributeForStitchingMode(stitchingMode: IndexStitchingMode): THREE.BufferAttribute {
        const colors = []
        const baseColor = [1, 1, 1]

        // South edge
        if (stitchingMode == IndexStitchingMode.South) {
            console.log("South edge stitching")
        }
        if (stitchingMode == IndexStitchingMode.East) {
            console.log("East edge stitching")
        }
        if (stitchingMode == IndexStitchingMode.North) {
            console.log("North edge stitching")
        }
        if (stitchingMode == IndexStitchingMode.West) {
            console.log("West edge stitching")
        }

        const isSouthEdgeStitching = stitchingMode === IndexStitchingMode.South || stitchingMode === IndexStitchingMode.SouthEast || stitchingMode === IndexStitchingMode.SouthWest
        const isEastEdgeStitching = stitchingMode === IndexStitchingMode.East || stitchingMode === IndexStitchingMode.NorthEast || stitchingMode === IndexStitchingMode.SouthEast
        const isNorthEdgeStitching = stitchingMode === IndexStitchingMode.North || stitchingMode === IndexStitchingMode.NorthEast || stitchingMode === IndexStitchingMode.NorthWest
        const isWestEdgeStitching = stitchingMode === IndexStitchingMode.West || stitchingMode === IndexStitchingMode.NorthWest || stitchingMode === IndexStitchingMode.SouthWest

        // South Edge
        const southEdgeColor = isSouthEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...southEdgeColor, ...southEdgeColor)

        // East edge
        const eastEdgeColor = isEastEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...eastEdgeColor, ...eastEdgeColor)

        // North edge
        const northEdgeColor = isNorthEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...northEdgeColor, ...northEdgeColor)

        // West edge
        const westEdgeColor = isWestEdgeStitching ? [1, 0, 0] : baseColor
        colors.push(...westEdgeColor, ...westEdgeColor)

        return new THREE.Float32BufferAttribute(colors, 3)
    }

    private createLineMesh(bounds: THREE.Box2, stitchingMode: IndexStitchingMode): THREE.LineSegments {
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

        const colorBufferAttribute = this.getColorBufferAttributeForStitchingMode(stitchingMode)

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geometry.setAttribute('color', colorBufferAttribute)
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
