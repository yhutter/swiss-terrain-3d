import { IndexStitchingMode } from "./IndexStitchingMode";
import * as THREE from 'three/webgpu';

export class ColorGenerator {
    static readonly white: THREE.Color = new THREE.Color(1, 1, 1);
    static readonly colorForSitchingMode: Map<IndexStitchingMode, THREE.Color> = new Map([
        [IndexStitchingMode.Full, ColorGenerator.white], // Tint white -> leave as it is
        [IndexStitchingMode.North, new THREE.Color("#0077BB")],
        [IndexStitchingMode.East, new THREE.Color("#33BB55")],
        [IndexStitchingMode.South, new THREE.Color("#EE7733")],
        [IndexStitchingMode.West, new THREE.Color("#CC3311")],
        [IndexStitchingMode.NorthEast, new THREE.Color("#009988")],
        [IndexStitchingMode.SouthEast, new THREE.Color("#EE3377")],
        [IndexStitchingMode.SouthWest, new THREE.Color("#BBBB33")],
        [IndexStitchingMode.NorthWest, new THREE.Color("#AA4499")],
    ])

}
