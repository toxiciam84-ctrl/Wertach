import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Baut ein einzelnes, eigenständiges Bundle nach ../js/reactbits-animationen.js
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../js',
    emptyOutDir: false,
    lib: {
      entry: 'src/main.jsx',
      name: 'WertachAnimationen',
      formats: ['iife'],
      fileName: () => 'reactbits-animationen.js'
    }
  }
});
