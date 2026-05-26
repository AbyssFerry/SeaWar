# SeaWar Development Notes

## Frontend Build Rule

**Always edit `public/client.ts`, never edit `public/client.js` directly.**

The browser loads `public/client.js`, which is a compiled output. After modifying `client.ts`, run:

```bash
bun run build
```

This executes `bun build ./public/client.ts --outfile ./public/client.js`.

### Why not edit .js directly?

- `client.ts` is the source of truth for frontend logic
- Bun serves `client.js` to browsers (see `server.ts`)
- Editing `.js` directly creates drift between source and output

### Server code

Server-side TypeScript (`server.ts`, `src/server/*.ts`) is executed directly by Bun and does not need a build step.
