// The frontend (Leaflet + OpenStreetMap + Nominatim + OSRM) no longer needs this server.
// It is kept as a minimal health-check API in case you want to add your own endpoints later.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
