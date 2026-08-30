#define SDL_MAIN_USE_CALLBACKS 1
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <SDL3_ttf/SDL_ttf.h>

#include <stdlib.h>

#include "imgui.h"
#include "imgui_impl_sdl3.h"
#include "imgui_impl_sdlgpu3.h"

struct AppContext {
    SDL_Window* window;
    SDL_Renderer* renderer;
    SDL_GPUDevice* device;
    TTF_Font* font;
    const char* base_path;
    SDL_FColor clear_color;
    int width;
    int height;
    float main_scale;
};


static AppContext* app_context = NULL;

SDL_FColor To_SDL_Color(uint32_t hex) {
    return (SDL_FColor) {
        ((hex >> 24) & 0xFF) / 255.0f,
        ((hex >> 16) & 0xFF) / 255.0f,
        ((hex >> 8) & 0xFF) / 255.0f,
        ((hex >> 0) & 0xFF) / 255.0f,
    };
}

SDL_AppResult SDL_AppInit(void** appstate, int argc, char* argv[]) {
    app_context = (AppContext*) malloc(sizeof(AppContext));
    app_context->window = NULL;
    app_context->renderer = NULL;
    app_context->device = NULL;
    app_context->font = NULL;
    app_context->clear_color = To_SDL_Color(0x161616FF);
    app_context->width = 1920;
    app_context->height = 1080;

    if(!SDL_SetAppMetadata("Swiss Terrain 3D", "0.0.1", "ch.yhutter.swissterrain3d")) {
        SDL_Log("Failed to set app metadata: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    if (!SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS)) {
        SDL_Log("Could not initialize SDL: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    app_context->main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    SDL_WindowFlags window_flags = SDL_WINDOW_HIGH_PIXEL_DENSITY | SDL_WINDOW_RESIZABLE;
    if (!SDL_CreateWindowAndRenderer("Swiss Terrain 3D", app_context->width * app_context->main_scale, app_context->height * app_context->main_scale, window_flags, &app_context->window, &app_context->renderer)) {
        SDL_Log("Could not create window/renderer: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_GPUShaderFormat shader_format = SDL_GPU_SHADERFORMAT_SPIRV | SDL_GPU_SHADERFORMAT_MSL;
    app_context->device = SDL_CreateGPUDevice(shader_format, false, NULL);
    if (!app_context->device) {
        SDL_Log("Failed to create gpu device: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    if (!SDL_ClaimWindowForGPUDevice(app_context->device, app_context->window)) {
        SDL_Log("Failed to claim window for gpu device: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    SDL_SetGPUSwapchainParameters(app_context->device, app_context->window, SDL_GPU_SWAPCHAINCOMPOSITION_SDR, SDL_GPU_PRESENTMODE_VSYNC);
    SDL_SetRenderLogicalPresentation(app_context->renderer, app_context->width, app_context->height, SDL_LOGICAL_PRESENTATION_LETTERBOX);

    if (!TTF_Init()) {
        SDL_Log("Failed to initialize SDL_ttf: %s", SDL_GetError());
        return SDL_APP_FAILURE;
    }

    // Setup dear imgui context 
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO(); (void)io;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;     // Enable Keyboard Controls
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableGamepad;      // Enable Gamepad Controls

    ImGui::StyleColorsDark();

    // Setup scaling
    ImGuiStyle& style = ImGui::GetStyle();
    style.ScaleAllSizes(app_context->main_scale);
    style.FontScaleDpi = app_context->main_scale;

    // Setup Platform/Renderer backends
    ImGui_ImplSDL3_InitForSDLGPU(app_context->window);
    ImGui_ImplSDLGPU3_InitInfo init_info = {};
    init_info.Device = app_context->device;
    init_info.ColorTargetFormat = SDL_GetGPUSwapchainTextureFormat(app_context->device, app_context->window);
    init_info.MSAASamples = SDL_GPU_SAMPLECOUNT_1;
    init_info.SwapchainComposition = SDL_GPU_SWAPCHAINCOMPOSITION_SDR;
    init_info.PresentMode = SDL_GPU_PRESENTMODE_VSYNC;
    ImGui_ImplSDLGPU3_Init(&init_info);

    // TODO: Use FREETYPE font rendering

    app_context->base_path = SDL_GetBasePath();
    return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event) {
    ImGui_ImplSDL3_ProcessEvent(event);
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
    // Start Dear ImGui frame
    ImGui_ImplSDLGPU3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();

    bool show_demo_window = true;
    ImGui::ShowDemoWindow(&show_demo_window);

    ImGui::Render();
    ImDrawData* draw_data = ImGui::GetDrawData();


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

    ImGui_ImplSDLGPU3_PrepareDrawData(draw_data, command_buffer);

    SDL_GPUColorTargetInfo target_info = {
        .texture = swapchain_texture,
        .clear_color = app_context->clear_color,

        // Clear the texture to a known color
        .load_op = SDL_GPU_LOADOP_CLEAR,

        // Keep the rendered output
        .store_op = SDL_GPU_STOREOP_STORE,

        .cycle = true,
    };

    SDL_GPURenderPass* render_pass = SDL_BeginGPURenderPass(command_buffer, &target_info, 1, NULL);

    // Render ImGui
    ImGui_ImplSDLGPU3_RenderDrawData(draw_data, command_buffer, render_pass);

    SDL_EndGPURenderPass(render_pass);

    SDL_SubmitGPUCommandBuffer(command_buffer);

    return SDL_APP_CONTINUE;
}

void SDL_AppQuit(void* appstate, SDL_AppResult result) {
    SDL_WaitForGPUIdle(app_context->device);
    ImGui_ImplSDL3_Shutdown();
    ImGui_ImplSDLGPU3_Shutdown();
    ImGui::DestroyContext();

    TTF_CloseFont(app_context->font);
    SDL_ReleaseWindowFromGPUDevice(app_context->device, app_context->window);
    SDL_DestroyGPUDevice(app_context->device);
    SDL_DestroyRenderer(app_context->renderer);
    SDL_DestroyWindow(app_context->window);
    TTF_Quit();
    SDL_Quit();
    free(app_context);
}

