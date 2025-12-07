import * as THREE from 'three';
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
            const myBounds = node.bounds;
            const otherBounds = other.bounds;

            // Skip self
            if (other === node) continue;

            // Only stitch toward coarser tiles
            if (other.level >= node.level) continue;

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
        this.insertPositionRecursive(this._root, position.clone(), 0);
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

    private insertPositionRecursive(node: QuadTreeNode, position: THREE.Vector2, depth: number): void {
        const distanceToNode = this.distanceToNode(node, position);

        // Determine if we need to subdivide
        if (distanceToNode < node.size.x && depth < this._maxDepth) {
            node.children = this.createChildNodes(node);
            depth++;
        }

        for (const child of node.children) {
            this.insertPositionRecursive(child, position, depth);
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

    private distanceToNode(child: QuadTreeNode, position: THREE.Vector2): number {
        return child.center.distanceTo(position);
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
