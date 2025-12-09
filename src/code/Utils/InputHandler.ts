export class InputHandler {
    private keysPressed: Set<string> = new Set();

    constructor() {
        window.addEventListener('keydown', (event) => {
            this.keysPressed.add(event.code);
        });

        window.addEventListener('keyup', (event) => {
            this.keysPressed.delete(event.code);
        });
    }

    isKeyPressed(keyCode: string): boolean {
        return this.keysPressed.has(keyCode);
    }

    isForwardPressed(): boolean {
        return this.isKeyPressed("ArrowUp") || this.isKeyPressed("KeyW");
    }

    isUpPressed(): boolean {
        return this.isKeyPressed("KeyE");
    }

    isDownPressed(): boolean {
        return this.isKeyPressed("KeyR");
    }

    isBackwardPressed(): boolean {
        return this.isKeyPressed("ArrowDown") || this.isKeyPressed("KeyS");
    }

    isLeftPressed(): boolean {
        return this.isKeyPressed("ArrowLeft") || this.isKeyPressed("KeyA");
    }

    isRightPressed(): boolean {
        return this.isKeyPressed("ArrowRight") || this.isKeyPressed("KeyD");
    }
}
