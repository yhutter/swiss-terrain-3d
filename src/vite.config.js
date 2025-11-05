import { defineConfig } from "vite"
import path from "path"


export default defineConfig({
    server: {
        open: true
    },
    resolve: {
        alias: {
            'three/build/three.webgpu': path.resolve(__dirname, './node_modules/three/build/three.webgpu'),
            'three/build/three.tsl': path.resolve(__dirname, './node_modules/three/build/three.tsl')
        }
    },
})
