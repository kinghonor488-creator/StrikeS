import { defineConfig } from 'vite';

// GitHub Pages serves the site from /StrikeS/; the dev server stays at the root.
// (`vite preview` reports command 'serve' with isPreview, and must use the Pages base too.)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/StrikeS/' : '/',
  server: { port: 5273, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
}));
