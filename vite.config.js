import { defineConfig } from "vite"
export default defineConfig({
    build: {
        rollupOptions: {
            input:  ['./devtools.html', './src/devtools.js', './apexAction.html', 'src/apexAction.js'],
        },
        
    }
})