import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs/promises'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
})
