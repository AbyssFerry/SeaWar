# SeaWar Development Notes

## Frontend Build Rule

**Always edit files in `client/`, never edit `public/client.js` directly.**

The frontend source code lives in the `client/` directory. The browser loads `public/client.js`, which is a compiled output produced by Bun.

```bash
bun run build
```

This executes `bun build ./client/main.ts --outfile ./public/client.js`.

### Directory roles

| Directory | Purpose |
|-----------|---------|
| `client/` | TypeScript source code (entry: `client/main.ts`) |
| `public/` | Static assets served to browsers (`index.html`, `style.css`, `client.js`) |

### Why not edit .js directly?

- `client/` is the source of truth for frontend logic
- Bun serves `public/client.js` to browsers (see `server.ts`)
- Editing `.js` directly creates drift between source and output

### Server code

Server-side TypeScript (`server.ts`, `src/server/*.ts`) is executed directly by Bun and does not need a build step.
