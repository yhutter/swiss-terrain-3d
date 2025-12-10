import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
    plugins: [],
    server: {
        open: true
    },
    resolve: {
        alias: {
            "three/webgpu": path.resolve(__dirname, './node_modules/three/build/three.webgpu'),
            "three/tsl": path.resolve(__dirname, './node_modules/three/build/three.tsl'),
        }
    }
})
