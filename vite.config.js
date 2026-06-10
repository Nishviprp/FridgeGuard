import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom'],
          'supabase':      ['@supabase/supabase-js'],
          'ui':            ['lucide-react', 'react-hot-toast', 'canvas-confetti'],
          'date':          ['date-fns'],
        },
      },
    },
  },
  server: {
    // Local dev: use `npx vercel dev` (port 3000) for full-stack with API routes.
    // Or run `npm run dev` (port 5173) — API calls will hit Vercel's edge in prod.
    port: 5173,
  },
});
