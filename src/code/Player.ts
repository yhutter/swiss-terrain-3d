import * as THREE from 'three'
import { App } from './App';

export class Player {
    private _position: THREE.Vector3 = new THREE.Vector3()
    private _movementSpeed: number = 0.2
    private _size = 0.04
    private _mesh: THREE.Mesh

    constructor(position: THREE.Vector2) {
        this._position.set(position.x, 0.1, position.y)
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
        const geometry = new THREE.SphereGeometry(this._size, 16, 16)
        this._mesh = new THREE.Mesh(geometry, material)
        this._mesh.position.copy(this._position)
        App.instance.scene.add(this._mesh)
    }

    update(dt: number): void {
        const direction = new THREE.Vector3()
        const inputHandler = App.instance.inputHandler
        if (inputHandler.isArrowUpPressed()) {
            direction.z -= 1
        }
        if (inputHandler.isArrowDownPressed()) {
            direction.z += 1
        }
        if (inputHandler.isArrowLeftPressed()) {
            direction.x -= 1
        }
        if (inputHandler.isArrowRightPressed()) {
            direction.x += 1
        }
        direction.normalize()
        direction.multiplyScalar(this._movementSpeed * dt)
        this._position.add(direction)
        this._mesh.position.copy(this._position)
    }

}
