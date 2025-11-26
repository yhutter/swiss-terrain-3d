import * as THREE from "three"
import vertexShader from '../../static/shaders/terrain.vert.glsl'
import fragmentShader from '../../static/shaders/terrain.frag.glsl'
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryGenerator } from '../Utils/GeometryGenerator';
import { App } from '../App';

export class TerrainTile {
    id: string
    mesh: THREE.Mesh | null = null
    material: CustomShaderMaterial | null = null
    demTexture: THREE.Texture | null = null
    dopTexture: THREE.Texture | null = null


    set useDemTexture(value: boolean) {
        if (this.material) {
            this.material.uniforms.uUseDemTexture.value = value
        }
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose()
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
            size
        )
        geo.rotateX(-Math.PI * 0.5)

        const randomTintColor = new THREE.Color(Math.random(), Math.random(), Math.random())

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
            baseMaterial: THREE.MeshStandardMaterial,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uDopTexture: { value: terrainTile.dopTexture },
                uTintColor: { value: randomTintColor },
                uDemTexture: { value: terrainTile.demTexture },
                uUseDemTexture: { value: params.shouldUseDemTexture },
                uHeightScaleMin: { value: params.minHeightScale },
                uHeightScaleMax: { value: params.maxHeightScale }
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
        return terrainTile
    }

    constructor(id: string) {
        this.id = id
    }
}
