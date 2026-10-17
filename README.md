# Traffic Planner

A route-planning web app built with **Angular 18** and **Leaflet**. Search for places, drop start/destination pins on the map, and get routes with alternatives, distance, time and turn-by-turn directions. Includes dark mode and a responsive layout.

No API keys are needed. The app uses free OpenStreetMap-based services:

| Feature | Service |
|---|---|
| Map tiles | OpenStreetMap |
| Place search and reverse lookup | Nominatim |
| Routing | OSRM (public demo server) |

> Live traffic is not included. Time estimates assume free-flow driving.

## Project structure

```
traffic-app/       Angular frontend (the actual app)
traffic-backend/   Optional minimal Express server (health check only)
```

## Run locally

Requirements: Node.js 18.19+ (or 20+) and npm.

```bash
cd traffic-app
npm install
npm start
```

Open http://localhost:4200.

Optional backend:

```bash
cd traffic-backend
npm install
cp ../.env.example ../.env   # PowerShell: Copy-Item ..\.env.example ..\.env
node index.js                # http://localhost:3000/health
```

## Scripts (in `traffic-app`)

| Command | What it does |
|---|---|
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build into `dist/` |
| `npx ng test --watch=false --browsers=ChromeHeadless` | Run unit tests once |

## Usage notes

- Click the map to set **A**, click again to set **B**. Drag pins to adjust the route.
- Use the search box, then press **A** or **B** on a result to use it as start or destination.
- Public OSM, Nominatim and OSRM servers have fair-use limits. They are fine for development and demos. For production, self-host them or use a paid provider.

## License

Add a license of your choice (for example MIT) before making the repository public.
