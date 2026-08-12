#define SDL_MAIN_USE_CALLBACKS 1
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

#include <stdlib.h>

#define WIDTH 1280
#define HEIGHT 960
#define DEBUG true

typedef struct {
    SDL_Window* window;
    SDL_Renderer* renderer;
    SDL_GPUDevice* device;
} AppContext;

static AppContext* app_context = NULL;

SDL_AppResult SDL_AppInit(void** appstate, int argc, char* argv[]) {
    app_context = malloc(sizeof(AppContext));
    app_context->window = NULL;
    app_context->renderer = NULL;
    app_context->device = NULL;

    if(!SDL_SetAppMetadata("Swiss Terrain 3D", "0.0.1", "ch.yhutter.swissterrain3d")) {
        SDL_Log("Failed to set app metadata: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS)) {
        SDL_Log("Could not initialize SDL: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_WindowFlags window_flags = SDL_WINDOW_HIGH_PIXEL_DENSITY | SDL_WINDOW_RESIZABLE;
    if (!SDL_CreateWindowAndRenderer("Swiss Terrain 3D", WIDTH, HEIGHT, window_flags, &app_context->window, &app_context->renderer)) {
        SDL_Log("Could not create window/renderer: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_GPUShaderFormat shader_format = SDL_GPU_SHADERFORMAT_SPIRV | SDL_GPU_SHADERFORMAT_MSL;
    app_context->device = SDL_CreateGPUDevice(shader_format, DEBUG, NULL);
    if (!app_context->device) {
        SDL_Log("Failed to create gpu device: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    if (!SDL_ClaimWindowForGPUDevice(app_context->device, app_context->window)) {
        SDL_Log("Failed to claim window for gpu device: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_SetRenderLogicalPresentation(app_context->renderer, WIDTH, HEIGHT, SDL_LOGICAL_PRESENTATION_LETTERBOX);
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event) {
    if (event->type == SDL_EVENT_QUIT) {
        return SDL_APP_SUCCESS;
    }
    if (event->type == SDL_EVENT_KEY_DOWN) {
        SDL_Keycode key = event->key.key;
        if (key == SDLK_ESCAPE) {
            return SDL_APP_SUCCESS;
        }
    }
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppIterate(void* appstate) {
    SDL_GPUCommandBuffer* command_buffer = SDL_AcquireGPUCommandBuffer(app_context->device);
    if (!command_buffer) {
        SDL_Log("Failed to acquire command buffer: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_GPUTexture* swapchain_texture = NULL;
    if (!SDL_WaitAndAcquireGPUSwapchainTexture(command_buffer, app_context->window, &swapchain_texture, NULL, NULL)) {
        SDL_Log("Failed to acquire swap chain texture: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_GPUColorTargetInfo target_info = {
        .texture = swapchain_texture,
        .cycle = true,
        
        // Clear the texture to a known color
        .load_op = SDL_GPU_LOADOP_CLEAR,

        // Keep the rendered output
        .store_op = SDL_GPU_STOREOP_STORE,

        .clear_color = { 0.0f, 0.0f, 0.0f, 1.0f }
    };

    SDL_GPURenderPass* render_pass = SDL_BeginGPURenderPass(command_buffer, &target_info, 1, NULL);
    SDL_EndGPURenderPass(render_pass);

    SDL_SubmitGPUCommandBuffer(command_buffer);

    return SDL_APP_CONTINUE;
}

void SDL_AppQuit(void* appstate, SDL_AppResult result) {
    SDL_ReleaseWindowFromGPUDevice(app_context->device, app_context->window);
    SDL_DestroyGPUDevice(app_context->device);
    SDL_DestroyRenderer(app_context->renderer);
    SDL_DestroyWindow(app_context->window);
    SDL_Quit();
    free(app_context);
}

