import { max } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { QuadTreeNode } from './QuadTreeNode';

export class QuadTreeWorker {

    private _worker: Worker;
    private _bounds: THREE.Box2;
    private _maxDepth: number;

    constructor(bounds: THREE.Box2, maxDepth: number = 1, callback: (nodes: QuadTreeNode[]) => void) {
        this._bounds = bounds;
        this._maxDepth = maxDepth;
        this._worker = new Worker(new URL('QuadTreeWorkerScript.ts', import.meta.url), { type: 'module' });
        this._worker.onmessage = (e) => {
            const nodes: QuadTreeNode[] = e.data;
            callback(nodes);
        }
    }

    insertPosition(position: THREE.Vector2): void {
        this._worker.postMessage([this._bounds, this._maxDepth, position])
    }
}
