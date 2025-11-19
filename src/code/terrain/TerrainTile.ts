import * as THREE from "three"
import vertexShader from '../../static/shaders/terrain.vert.glsl'
import fragmentShader from '../../static/shaders/terrain.frag.glsl'
import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { TerrainTileParams } from './TerrainTileParams';
import { GeometryHelper } from '../helpers/GeometryHelper';

export class TerrainTile {
    _mesh: THREE.Mesh | null = null
    _material: CustomShaderMaterial | null = null
    _params: TerrainTileParams

    get mesh(): THREE.Mesh | null {
        return this._mesh
    }

    get material(): CustomShaderMaterial | null {
        return this._material
    }

    get demTexture(): THREE.Texture {
        return this._params.demTexture
    }

    set useDemTexture(value: boolean) {
        if (this._material) {
            this._material.uniforms.uUseDemTexture.value = value
        }
    }

    get dopTexture(): THREE.Texture {
        return this._params.dopTexture
    }

    constructor(params: TerrainTileParams) {
        this._params = params
        const resolution = this._params.resolution
        const wireframe = this._params.wireframe
        const size = this._params.size

        const geo = GeometryHelper.createRegularGridGeometry(
            resolution,
            size
        )
        geo.rotateX(-Math.PI * 0.5)

        const randomTintColor = new THREE.Color(Math.random(), Math.random(), Math.random())

        this._material = new CustomShaderMaterial({
            baseMaterial: THREE.MeshStandardMaterial,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uDopTexture: { value: this._params.dopTexture },
                uTintColor: { value: randomTintColor },
                uDemTexture: { value: this._params.demTexture },
                uUseDemTexture: { value: true },
            },
            side: THREE.DoubleSide,
            wireframe: wireframe,
        })

        this._mesh = new THREE.Mesh(geo, this._material)
    }
}
