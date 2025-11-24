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

    isArrowUpPressed(): boolean {
        return this.isKeyPressed("ArrowUp") || this.isKeyPressed("KeyW");
    }

    isArrowDownPressed(): boolean {
        return this.isKeyPressed("ArrowDown") || this.isKeyPressed("KeyS");
    }

    isArrowLeftPressed(): boolean {
        return this.isKeyPressed("ArrowLeft") || this.isKeyPressed("KeyA");
    }

    isArrowRightPressed(): boolean {
        return this.isKeyPressed("ArrowRight") || this.isKeyPressed("KeyD");
    }
}
