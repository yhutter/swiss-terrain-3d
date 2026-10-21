#include <stdio.h>
#include "raylib.h"

int main() {
    const int screenWidth = 1280;
    const int screenHeight = 720;
    Color backgroundColor = GetColor(0x000000FF);

    InitWindow(screenWidth, screenHeight, "Swiss Terrain 3D");
    SetTargetFPS(60);

    while (!WindowShouldClose()) {
        BeginDrawing();

        ClearBackground(backgroundColor);

        EndDrawing();
    }

    CloseWindow();
    return 0;
}
