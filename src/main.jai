main :: () {
    success := SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMEPAD | SDL_INIT_AUDIO);
    print("Hello World");
}

#import "Basic";
#import "jai-sdl3";
