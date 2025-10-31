import { App } from './app.ts'

window.onload = async () => {
    const app = new App()
    await app.initialize()
}
