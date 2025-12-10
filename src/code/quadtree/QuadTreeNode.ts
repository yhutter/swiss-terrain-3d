import * as THREE from 'three/webgpu';
import { IndexStitchingMode } from '../Utils/IndexStitchingMode';

export type QuadTreeNode = {
    id: string, // unique identifier for the node consists of level, center position and stitching mode
    level: number,
    bounds: THREE.Box2;
    children: QuadTreeNode[];
    center: THREE.Vector2;
    size: THREE.Vector2;
    indexStitchingMode: IndexStitchingMode;
}
