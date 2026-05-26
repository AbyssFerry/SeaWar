# SeaWar

SeaWar is a browser-based multiplayer battleship game served by a Bun WebSocket backend.

## Run From Source

Install dependencies:

```powershell
bun install
```

Build the browser bundle:

```powershell
bun run build
```

Start the server:

```powershell
bun run start
```

Open `http://localhost:3000` in a browser.

## Windows Release Build

Build a standalone Windows executable and zip package:

```powershell
bun run build:release
```

The release artifact is written to `release/SeaWar-1.0.0-windows-x64.zip`.
After extracting it, run `SeaWar.exe` and open `http://localhost:3000`.
