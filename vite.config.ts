import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path, otherwise assets 404 and the page is blank
export default defineConfig({
  plugins: [react()],
  base: '/warehouse-layout-planner/',
})
