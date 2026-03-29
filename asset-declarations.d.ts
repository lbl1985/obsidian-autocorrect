// Allows TypeScript to accept esbuild text-loader imports of .aff and .dic files.
// esbuild inlines these as plain strings at bundle time (see esbuild.config.mjs).
declare module '*.aff' {
  const content: string;
  export default content;
}

declare module '*.dic' {
  const content: string;
  export default content;
}
