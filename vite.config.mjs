import { defineConfig } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import builtins from 'builtin-modules';

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src')
    }
  },
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected'
      }
    })
  ],
  build: {
    lib: {
      entry: 'main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js'
    },
    rollupOptions: {
      external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        ...builtins
      ],
      output: {
        exports: 'named'
      }
    },
    outDir: '.',
    emptyOutDir: false,
    sourcemap: 'inline'
  }
});