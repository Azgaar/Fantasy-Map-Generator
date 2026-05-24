export default {
    root: './src',
    base: process.env.NETLIFY ? '/' : '/Fantasy-Map-Generator/',
    build: {
        outDir: '../dist',
        assetsDir: './',
    },
    publicDir: '../public',
    test: {
        setupFiles: ['./tests/regression.setup.ts'], 
    }
}