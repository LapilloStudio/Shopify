import { defineConfig } from 'vite';

// Due modalità:
// - `vite` (serve): server di sviluppo; apri /dev/ per l'anteprima con geometria segnaposto.
// - `vite build`: bundle IIFE unico (Three.js + logica) in shopify/assets/, pronto per il tema.
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      server: { open: '/dev/' },
    };
  }

  return {
    build: {
      lib: {
        entry: 'src/main.js',
        name: 'SandalConfigurator',
        formats: ['iife'],
        fileName: () => 'sandal-configurator.js',
      },
      outDir: 'shopify/assets',
      emptyOutDir: false,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          assetFileNames: (info) => {
            const name = info.name || (info.names && info.names[0]) || '';
            if (name.endsWith('.css')) return 'sandal-configurator.css';
            return '[name][extname]';
          },
        },
      },
    },
  };
});
