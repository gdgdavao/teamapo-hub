/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_USE_FIREBASE_EMULATORS: string
  readonly VITE_USE_EMULATOR?: string
  readonly VITE_APP_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_ORGANIZATION: string
  /**
   * Email of the one administrator who may delete other admins' accounts.
   * Declared here because AdminUsersPage read it through `import.meta.env`
   * with no type, and because it is the client half of the tier that
   * functions/main.py enforces from its own SUPERUSER_EMAIL. Client-side
   * only: it decides what the UI offers, never what the server allows.
   */
  readonly VITE_SUPERUSER_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
