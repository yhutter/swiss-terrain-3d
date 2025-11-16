import * as THREE from 'three';

export type QuadTreeNode = {
    bounds: THREE.Box2;
    children: QuadTreeNode[];
    center: THREE.Vector2;
    size: THREE.Vector2;
}
