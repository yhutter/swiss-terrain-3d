import * as THREE from 'three';
import { QuadTreeNode } from './QuadTreeNode';
import { IndexStitchingMode } from '../Utils/IndexStitchingMode';
import { IdGenerator } from '../Utils/IdGenerator';

const generateIdForNode = (node: QuadTreeNode): string => {
    return IdGenerator.generate(node.level, node.center.x, node.center.y);
}

const createChildNodes = (node: QuadTreeNode): QuadTreeNode[] => {
    const midPoint = node.bounds.getCenter(new THREE.Vector2());

    const bottomLeft = new THREE.Box2(node.bounds.min.clone(), midPoint.clone());
    const bottomRight = new THREE.Box2(
        new THREE.Vector2(midPoint.x, node.bounds.min.y),
        new THREE.Vector2(node.bounds.max.x, midPoint.y)
    );
    const topLeft = new THREE.Box2(
        new THREE.Vector2(node.bounds.min.x, midPoint.y),
        new THREE.Vector2(midPoint.x, node.bounds.max.y)
    );
    const topRight = new THREE.Box2(midPoint.clone(), node.bounds.max.clone());

    const quadtrants = [bottomLeft, bottomRight, topLeft, topRight];

    const children: QuadTreeNode[] = quadtrants.map((bounds) => {
        const center = bounds.getCenter(new THREE.Vector2());
        const size = bounds.getSize(new THREE.Vector2());
        const level = node.level + 1;
        const child = {
            id: "",
            bounds: bounds,
            level: level,
            children: [],
            center: center,
            size: size,
            indexStitchingMode: IndexStitchingMode.Full
        }
        child.id = generateIdForNode(child);
        return child
    });
    return children;
}

const splitNode = (node: QuadTreeNode, maxDepth: number): boolean => {
    if (node.children.length > 0) return false;
    if (node.level >= maxDepth) return false;
    node.children = createChildNodes(node);
    return true
}

const insertPosition = (node: QuadTreeNode, position: THREE.Vector2, maxDepth: number): void => {
    node.children = [];
    insertPositionRecursive(node, position, maxDepth)
}

const insertPositionRecursive = (node: QuadTreeNode, position: THREE.Vector2, maxDepth: number): void => {
    const distanceToNode = node.center.distanceTo(position);

    // Determine if we need to subdivide
    const distanceFactor = 2
    if (distanceToNode < node.size.x * distanceFactor && node.level < maxDepth) {
        splitNode(node, maxDepth);
    }

    for (const child of node.children) {
        insertPositionRecursive(child, position, maxDepth);
    }

}

const getChildrenRecursive = (node: QuadTreeNode): QuadTreeNode[] => {
    if (node.children.length === 0) {
        return [node];
    }
    let nodes: QuadTreeNode[] = [];
    for (const child of node.children) {
        nodes = nodes.concat(getChildrenRecursive(child));
    }
    return nodes;
}

const areEdgeNeighbors = (aBounds: THREE.Box2, bBounds: THREE.Box2): boolean => {
    const shareVerticalEdge =
        (aBounds.max.x === bBounds.min.x || aBounds.min.x === bBounds.max.x) &&
        aBounds.min.y < bBounds.max.y &&
        aBounds.max.y > bBounds.min.y;

    const shareHorizontalEdge =
        (aBounds.max.y === bBounds.min.y || aBounds.min.y === bBounds.max.y) &&
        aBounds.min.x < bBounds.max.x &&
        aBounds.max.x > bBounds.min.x;

    return shareVerticalEdge || shareHorizontalEdge;
}

const updateStitchingModeForNode = (node: QuadTreeNode, allNodes: QuadTreeNode[]): void => {
    let mode = IndexStitchingMode.Full;
    for (const other of allNodes) {

        // Skip self
        if (other === node) continue;

        // Only stitch toward coarser tiles
        if (other.level >= node.level) continue;

        const myBounds = node.bounds;
        const otherBounds = other.bounds;

        if (!areEdgeNeighbors(myBounds, otherBounds)) continue;

        const touchesSouthEdge = myBounds.max.y === otherBounds.min.y &&
            myBounds.min.x < otherBounds.max.x &&
            myBounds.max.x > otherBounds.min.x;

        const touchesNorthEdge = myBounds.min.y === otherBounds.max.y &&
            myBounds.min.x < otherBounds.max.x &&
            myBounds.max.x > otherBounds.min.x;

        const touchesWestEdge = myBounds.min.x === otherBounds.max.x &&
            myBounds.min.y < otherBounds.max.y &&
            myBounds.max.y > otherBounds.min.y;

        const touchesEastEdge = myBounds.max.x === otherBounds.min.x &&
            myBounds.min.y < otherBounds.max.y &&
            myBounds.max.y > otherBounds.min.y;

        if (touchesSouthEdge) {
            mode |= IndexStitchingMode.South;
        }

        else if (touchesNorthEdge) {
            mode |= IndexStitchingMode.North;
        }

        else if (touchesWestEdge) {
            mode |= IndexStitchingMode.West;
        }

        else if (touchesEastEdge) {
            mode |= IndexStitchingMode.East;
        }
    }
    node.indexStitchingMode = mode;
}

// const balance = (leaves: QuadTreeNode[], maxDepth: number): void => {
//     let changed: boolean;
//     do {
//         changed = false;
//         for (let i = 0; i < leaves.length; i++) {
//             for (let j = i + 1; j < leaves.length; j++) {
//                 const a = leaves[i];
//                 const b = leaves[j];
//
//                 if (!areEdgeNeighbors(a.bounds, b.bounds)) continue;
//
//                 const diff = Math.abs(a.level - b.level);
//                 if (diff <= 1) continue; // already OK
//
//                 // Pick the coarser (shallower) node to split
//                 const coarser = a.level < b.level ? a : b;
//                 splitNode(coarser, maxDepth);
//                 changed = true;
//             }
//         }
//     } while (changed);
// }

const balance = (leaves: QuadTreeNode[], maxDepth: number): boolean => {
    let changed = false;
    for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
            const a = leaves[i];
            const b = leaves[j];

            if (!areEdgeNeighbors(a.bounds, b.bounds)) continue;

            const diff = Math.abs(a.level - b.level);
            if (diff <= 1) continue; // already OK

            // Pick the coarser (shallower) node to split
            const coarser = a.level < b.level ? a : b;
            if (splitNode(coarser, maxDepth)) {
                changed = true
            }
        }
    }
    return changed
}

onmessage = (e: MessageEvent<[THREE.Box2, number, THREE.Vector2]>) => {
    // Reconstruct ThreeJs types from transferred data
    const bounds = new THREE.Box2().copy(e.data[0] as THREE.Box2);
    const position = new THREE.Vector2().copy(e.data[2] as THREE.Vector2);
    const maxDepth = e.data[1] as number;
    const size = bounds.getSize(new THREE.Vector2());
    const center = bounds.getCenter(new THREE.Vector2());
    const level = 0;
    const root: QuadTreeNode = {
        id: "",
        bounds: bounds,
        level: level,
        children: [],
        center: center,
        size: size,
        indexStitchingMode: IndexStitchingMode.Full,
    };
    root.id = generateIdForNode(root);
    insertPosition(root, position, maxDepth);
    let nodes = getChildrenRecursive(root);
    while (balance(nodes, maxDepth)) {
        nodes = getChildrenRecursive(root);
    }
    for (const node of nodes) {
        updateStitchingModeForNode(node, nodes)
    }
    postMessage(nodes);
}
