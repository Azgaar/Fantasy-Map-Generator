export default {
    root: './src',
    base: './',
    build: {
        outDir: '../dist',
        assetsDir: 'assets', // Cleaner
        rollupOptions: {
            input: {
                main: './src/index.html',
                engine: './src/engine/engine.html',
            },
        },
    },
    publicDir: '../public',
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
}
