# Reticle Console

A standalone Next.js starter for a Reticle-style operational console.

## Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3220>.

## Routes

- `/dashboard` - overview metrics and activity
- `/dashboard/projects` - neutral project console
- `/dashboard/settings` - local configuration panels
- `/design-system` - Reticle component showcase

## Notes

- No auth and no backend fetches are included.
- Demo data lives in `lib/demo-data.ts`.
- Shell/navigation config lives in `lib/navigation.ts`.
- Theme tokens live in `app/globals.css`.
