import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/CGL-Tools/', // 👈 关键：设置为 GitHub 仓库名
    plugins: [react()],
})
