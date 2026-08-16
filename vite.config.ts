import { fileURLToPath, URL } from 'node:url';

export default {
    root: './src',
    base: process.env.VITE_BASE_PATH ?? (process.env.NETLIFY ? '/' : '/Fantasy-Map-Generator/'),
    build: {
        outDir: '../dist',
        assetsDir: './',
    },
    publicDir: '../public',
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
}
