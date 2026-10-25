export const commands = [
  'npx esbuild src/index.ts --bundle --packages=external --platform=node --target=esnext --format=esm --outfile=dist/index.js',
  'npx esbuild src/index.ts --bundle --packages=external --platform=node --target=esnext --format=cjs --outfile=dist/index.cjs',
  'npx tsc --ignoreConfig src/index.ts --declaration --emitDeclarationOnly --rootDir src --outDir dist --skipLibCheck --moduleResolution bundler --module esnext --target esnext'
]
