/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_AUTH_URL: string;
  readonly VITE_API_UPLOAD_URL: string;
  readonly VITE_PASSWORD_SECRET: string;
  readonly VITE_GITHUB_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
