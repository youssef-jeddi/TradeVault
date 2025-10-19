Combined app for the Confidential Signal Market UI with iExec Starter logic.

Quick start
- cd app
- npm install
- cp .env.example .env and set VITE_PRIVY_APP_ID
- npm run dev

Notes
- The default screen is the marketplace UI (src/App.jsx).
- IExec Starter’s demo screen is available in src/AppIExec.tsx; you can wire it via a router later if desired.
- The app uses Tailwind v3 (from the original frontend) and includes minimal CSS helpers for IExec demo components in src/index.css.

