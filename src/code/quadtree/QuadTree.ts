import * as THREE from 'three/webgpu';
import { QuadTreeNode } from './QuadTreeNode';
import { IdGenerator } from '../Utils/IdGenerator';
import { IndexStitchingMode } from '../Utils/IndexStitchingMode';


export class QuadTree {
    private _root: QuadTreeNode
    private _maxDepth = 1

    constructor(bounds: THREE.Box2, maxDepth: number = 1) {
        const size = bounds.getSize(new THREE.Vector2());
        const center = bounds.getCenter(new THREE.Vector2());
        const level = 0;
        this._maxDepth = maxDepth;
        this._root = {
            id: "",
            bounds: bounds,
            level: level,
            children: [],
            center: center,
            size: size,
            indexStitchingMode: IndexStitchingMode.Full,
        }
        this._root.id = this.generateIdForNode(this._root);
    }

    get allBounds(): THREE.Box2[] {
        return this.getBoundsRecursive(this._root);
    }

    get center(): THREE.Vector2 {
        return this._root.center;
    }

    getChildren(): QuadTreeNode[] {
        const children = this.getChildrenRecursive(this._root);
        return children;
    }

    updateStitchingModeForNode(node: QuadTreeNode, allNodes: QuadTreeNode[]): void {
        let mode = IndexStitchingMode.Full;
        for (const other of allNodes) {

            // Skip self
            if (other === node) continue;

            // Only stitch toward coarser tiles
            if (other.level >= node.level) continue;

            const myBounds = node.bounds;
            const otherBounds = other.bounds;

            if (!this.areEdgeNeighbors(myBounds, otherBounds)) continue;

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

    insertPosition(position: THREE.Vector2): void {
        // Clear existing children
        this._root.children = []
        this.insertPositionRecursive(this._root, position.clone());

        this.balance()
    }

    private balance(): void {
        let changed: boolean;
        do {
            changed = false;
            const leaves = this.getChildren(); // leaf nodes

            for (let i = 0; i < leaves.length; i++) {
                for (let j = i + 1; j < leaves.length; j++) {
                    const a = leaves[i];
                    const b = leaves[j];

                    if (!this.areEdgeNeighbors(a.bounds, b.bounds)) continue;

                    const diff = Math.abs(a.level - b.level);
                    if (diff <= 1) continue; // already OK

                    // Pick the coarser (shallower) node to split
                    const coarser = a.level < b.level ? a : b;
                    this.splitNode(coarser);
                    changed = true;
                }
            }
        } while (changed);
    }

    private splitNode(node: QuadTreeNode): void {
        if (node.children.length > 0) return;
        if (node.level >= this._maxDepth) return;
        node.children = this.createChildNodes(node);
    }

    private areEdgeNeighbors(aBounds: THREE.Box2, bBounds: THREE.Box2): boolean {
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

    private generateIdForNode(node: QuadTreeNode): string {
        return IdGenerator.generate(node.level, node.center.x, node.center.y);
    }

    private getBoundsRecursive(node: QuadTreeNode): THREE.Box2[] {
        let bounds: THREE.Box2[] = [];
        if (node.children.length === 0) {
            bounds.push(node.bounds);
        } else {
            for (const child of node.children) {
                bounds = bounds.concat(this.getBoundsRecursive(child));
            }
        }
        return bounds;
    }

    private insertPositionRecursive(node: QuadTreeNode, position: THREE.Vector2): void {
        const distanceToNode = node.center.distanceTo(position);

        // Determine if we need to subdivide
        const distanceFactor = 2
        if (distanceToNode < node.size.x * distanceFactor && node.level < this._maxDepth) {
            this.splitNode(node);
        }

        for (const child of node.children) {
            this.insertPositionRecursive(child, position);
        }
    }

    private createChildNodes(node: QuadTreeNode): QuadTreeNode[] {
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
            child.id = this.generateIdForNode(child);
            return child
        });

        return children;
    }

    private getChildrenRecursive(node: QuadTreeNode): QuadTreeNode[] {
        if (node.children.length === 0) {
            return [node];
        }

        let result: QuadTreeNode[] = [];
        for (const child of node.children) {
            result = result.concat(this.getChildrenRecursive(child));
        }
        return result;
    }
}
