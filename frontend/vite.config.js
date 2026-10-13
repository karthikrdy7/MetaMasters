import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
  },

  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'recharts',
              test: /node_modules\/recharts/,
              priority: 20,
            },
            {
              name: 'react-vendor',
              test: /node_modules\/(react|react-dom|scheduler)\//,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})