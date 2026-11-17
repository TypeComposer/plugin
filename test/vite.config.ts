import { defineConfig } from "vite";
import typecomposer from "typecomposer-plugin";
import { resolve } from "path";

console.log("Vite config file path:", resolve(import.meta.dirname, 'src'));

export default defineConfig({
  plugins: [typecomposer({
    debugger: false,
    translation: {
      defaulLocale: 'en',
      Locales: ['en', 'pt', 'es'],
    },
  })],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
      },
    },
  },
  // test: {
  //   globals: true, // 👈 habilita expect, describe, it etc. como globais
  //   environment: 'jsdom', // necessário se você usa jest-dom
  //   setupFiles: ['./vitest.setup.ts'], // 👈 arquivo de setup opcional
  // },
  // build: {
  //   rollupOptions: {
  //     input: './src/entry-client.ts'
  //   }
  // },
  // ssr: {
  //   noExternal: ['typecomposer']
  // }
});
