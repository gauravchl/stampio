import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative so the build works from any subpath
// (e.g. GitHub Pages at /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
});
