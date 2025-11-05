import { App } from './app.js'

window.onload = async () => {
    const app = new App()
    await app.initialize()
}
