import * as THREE from 'three';

export type QuadTreeNode = {
    id: string, // unique identifier for the node consists of level and center position
    level: number,
    bounds: THREE.Box2;
    children: QuadTreeNode[];
    center: THREE.Vector2;
    size: THREE.Vector2;
}
