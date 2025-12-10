import * as THREE from 'three/webgpu';
import { PointerLockControls } from 'three/examples/jsm/Addons.js';
import { InputHandler } from '../Utils/InputHandler';
import { App } from '../App';

// Inspired by: https://github.com/simondevyoutube/ProceduralTerrain_Part3/blob/master/src/controls.js
export class TerrainCameraControls {

    private _pointerLockControls: PointerLockControls
    private _inputHandler: InputHandler = new InputHandler()
    private _velocity = new THREE.Vector3()
    private _enabled = true
    private _domElement: HTMLElement = document.body

    private _tweaks = {
        acceleration: 950,
        decceleration: -10,
    }
    private _decceleration = new THREE.Vector3(this._tweaks.decceleration, this._tweaks.decceleration, this._tweaks.decceleration)
    private _acceleration = new THREE.Vector3(this._tweaks.acceleration, this._tweaks.acceleration, this._tweaks.acceleration)

    constructor(camera: THREE.PerspectiveCamera, parent: THREE.Group, domElement: HTMLElement) {
        this._domElement = domElement
        this._pointerLockControls = new PointerLockControls(camera, domElement)
        parent.add(this._pointerLockControls.object)
        this.setupPointerLock()
        this.setupTweaks()
    }

    update(delta: number) {
        if (!this._enabled) {
            return;
        }


        const frameDecceleration = new THREE.Vector3(
            this._velocity.x * this._decceleration.x,
            this._velocity.y * this._decceleration.y,
            this._velocity.z * this._decceleration.z
        );
        frameDecceleration.multiplyScalar(delta);

        this._velocity.add(frameDecceleration);

        if (this._inputHandler.isForwardPressed()) {
            this._velocity.z -= this._acceleration.z * delta;
        }
        if (this._inputHandler.isBackwardPressed()) {
            this._velocity.z += this._acceleration.z * delta;
        }
        if (this._inputHandler.isLeftPressed()) {
            this._velocity.x -= this._acceleration.x * delta;
        }
        if (this._inputHandler.isRightPressed()) {
            this._velocity.x += this._acceleration.x * delta;
        }
        if (this._inputHandler.isUpPressed()) {
            this._velocity.y += this._acceleration.y * delta;
        }
        if (this._inputHandler.isDownPressed()) {
            this._velocity.y -= this._acceleration.y * delta;
        }

        const controlObject = this._pointerLockControls.object;


        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(controlObject.quaternion);
        forward.y = 0;
        forward.normalize();

        const updown = new THREE.Vector3(0, 1, 0);

        const sideways = new THREE.Vector3(1, 0, 0);
        sideways.applyQuaternion(controlObject.quaternion);
        sideways.normalize();

        sideways.multiplyScalar(this._velocity.x * delta);
        updown.multiplyScalar(this._velocity.y * delta);
        forward.multiplyScalar(this._velocity.z * delta);

        controlObject.position.add(forward);
        controlObject.position.add(sideways);
        controlObject.position.add(updown);

    }

    private setupPointerLock() {
        this._domElement.addEventListener('click', (_) => {
            this._pointerLockControls.lock()
        }, false);
        this._domElement.addEventListener("lock", (_) => {
            this._enabled = true;
        }, false);
        this._domElement.addEventListener("unlock", (_) => {
            this._enabled = false;
        }, false);
    }

    private setupTweaks() {
        const folder = App.instance.pane.addFolder({
            title: 'Terrain Camera Controls',
            expanded: true,
        })
        folder.addBinding(this._tweaks, 'acceleration', {
            label: 'Acceleration',
            min: 0,
            max: 2000,
            step: 1,

        }).on('change', (e) => {
            this._acceleration.setScalar(e.value)
        })
        folder.addBinding(this._tweaks, 'decceleration', {
            label: 'Decceleration',
            min: -20,
            max: 0,
            step: 1,

        }).on('change', (e) => {
            this._decceleration.setScalar(e.value)
        })

    }

}
