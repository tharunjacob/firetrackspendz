/// <reference types="vite/client" />

// Updated to fix missing type definitions and variable redeclarations

interface ImportMetaEnv {
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
