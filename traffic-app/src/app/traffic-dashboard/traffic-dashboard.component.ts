import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import * as L from 'leaflet';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const DEFAULT_CENTER: L.LatLngTuple = [12.9716, 77.5946]; // Bengaluru
const ROUTE_COLOR = '#2563eb';
const ALT_ROUTE_COLOR = '#94a3b8';

type PointKind = 'start' | 'end';

export interface Suggestion {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

export interface RouteStep {
  text: string;
  icon: string;
  distance: number;
  location: L.LatLngTuple;
}

export interface RouteOption {
  distance: number; // metres
  duration: number; // seconds
  geometry: any;
  steps: RouteStep[];
}

@Component({
  selector: 'app-traffic-dashboard',
  templateUrl: './traffic-dashboard.component.html',
  styleUrls: ['./traffic-dashboard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class TrafficDashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  map: any;
  startMarker: any;
  endMarker: any;
  searchMarker: any;

  startLabel = '';
  endLabel = '';

  query = '';
  suggestions: Suggestion[] = [];
  searching = false;

  routes: RouteOption[] = [];
  selectedIndex = 0;
  routeLayers: L.GeoJSON[] = [];
  routeRequestId = 0;
  loading = false;
  message = '';

  theme: 'light' | 'dark' = this.initialTheme();

  private suggestTimer: any;
  private suggestRequestId = 0;

  get selectedRoute(): RouteOption | null {
    return this.routes[this.selectedIndex] ?? null;
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: false }).setView(DEFAULT_CENTER, 11);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => this.handleMapClick(event.latlng));

    // The container is sized by CSS grid; make sure Leaflet measures the final size.
    setTimeout(() => this.map?.invalidateSize());
  }

  ngOnDestroy(): void {
    clearTimeout(this.suggestTimer);
    this.map?.remove();
  }

  // ---------- Theme ----------

  private initialTheme(): 'light' | 'dark' {
    try {
      const saved = localStorage.getItem('traffic-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage unavailable */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('traffic-theme', this.theme); } catch { /* ignore */ }
  }

  // ---------- Map points ----------

  handleMapClick(latlng: L.LatLng): void {
    if (!this.startMarker) {
      this.setPoint('start', latlng);
    } else if (!this.endMarker) {
      this.setPoint('end', latlng);
    }
    // Further clicks are ignored until a point is cleared
  }

  setPoint(kind: PointKind, latlng: L.LatLng, label?: string): void {
    const key = kind === 'start' ? 'startMarker' : 'endMarker';
    if (this[key]) {
      this[key].setLatLng(latlng);
    } else {
      this[key] = L.marker(latlng, { draggable: true, icon: this.pinIcon(kind === 'start' ? 'A' : 'B', kind) })
        .addTo(this.map)
        .on('dragend', () => this.onMarkerDragged(kind));
    }
    this.setLabel(kind, label ?? this.coordsLabel(latlng));
    if (!label) this.reverseGeocode(kind, latlng);
    this.message = '';
    this.updateRoute();
  }

  private onMarkerDragged(kind: PointKind): void {
    const marker = kind === 'start' ? this.startMarker : this.endMarker;
    const latlng = marker.getLatLng();
    this.setLabel(kind, this.coordsLabel(latlng));
    this.reverseGeocode(kind, latlng);
    this.updateRoute();
  }

  clearPoint(kind: PointKind): void {
    const key = kind === 'start' ? 'startMarker' : 'endMarker';
    this[key]?.remove();
    this[key] = null;
    this.setLabel(kind, '');
    this.routeRequestId++; // invalidate in-flight route requests
    this.removeRoute();
    this.message = '';
  }

  swapPoints(): void {
    if (!this.startMarker || !this.endMarker) return;
    const a = this.startMarker.getLatLng();
    const b = this.endMarker.getLatLng();
    const [labelA, labelB] = [this.startLabel, this.endLabel];
    this.startMarker.setLatLng(b);
    this.endMarker.setLatLng(a);
    this.startLabel = labelB;
    this.endLabel = labelA;
    this.updateRoute();
  }

  // Remove markers and route
  clearMarkersAndRoute(): void {
    this.startMarker?.remove();
    this.startMarker = null;
    this.endMarker?.remove();
    this.endMarker = null;
    this.startLabel = '';
    this.endLabel = '';
    this.routeRequestId++;
    this.removeRoute();
    this.message = '';
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.message = 'Geolocation is not supported by this browser.';
      return;
    }
    this.message = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        this.map.flyTo(latlng, 14);
        this.setPoint('start', latlng, 'My location');
      },
      () => { this.message = 'Could not get your location. Check browser permissions.'; },
      { timeout: 10000 }
    );
  }

  private setLabel(kind: PointKind, label: string): void {
    if (kind === 'start') this.startLabel = label; else this.endLabel = label;
  }

  private coordsLabel(latlng: L.LatLng): string {
    return `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
  }

  private pinIcon(text: string, cls: string): L.DivIcon {
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin pin-${cls}"><span>${text}</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  async reverseGeocode(kind: PointKind, latlng: L.LatLng): Promise<void> {
    try {
      const res = await fetch(`${NOMINATIM_URL}/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=jsonv2&zoom=17`);
      if (!res.ok) return;
      const data = await res.json();
      const marker = kind === 'start' ? this.startMarker : this.endMarker;
      // Only apply if the marker has not moved in the meantime
      if (data?.display_name && marker && marker.getLatLng().equals(latlng)) {
        this.setLabel(kind, this.shortLabel(data.display_name));
      }
    } catch { /* keep coordinates as the label */ }
  }

  private shortLabel(displayName: string): string {
    return displayName.split(',').slice(0, 3).map(s => s.trim()).join(', ');
  }

  // ---------- Search ----------

  onQueryChange(value: string): void {
    this.query = value;
    clearTimeout(this.suggestTimer);
    if (value.trim().length < 3) {
      this.suggestions = [];
      this.searching = false;
      return;
    }
    this.suggestTimer = setTimeout(() => this.fetchSuggestions(value), 400);
  }

  private async fetchSuggestions(query: string, limit = 5): Promise<Suggestion[]> {
    const requestId = ++this.suggestRequestId;
    this.searching = true;
    try {
      const res = await fetch(`${NOMINATIM_URL}/search?q=${encodeURIComponent(query.trim())}&format=json&limit=${limit}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const results: any[] = await res.json();
      const list = results
        .map(r => {
          const parts = String(r.display_name).split(',').map((s: string) => s.trim());
          return { label: parts[0], detail: parts.slice(1, 4).join(', '), lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
        })
        .filter(s => !isNaN(s.lat) && !isNaN(s.lon));
      if (requestId === this.suggestRequestId) {
        this.suggestions = list;
        this.message = list.length ? '' : `No results for "${query.trim()}"`;
      }
      return list;
    } catch (error) {
      console.error(error);
      if (requestId === this.suggestRequestId) this.message = 'Search failed. Please try again.';
      return [];
    } finally {
      if (requestId === this.suggestRequestId) this.searching = false;
    }
  }

  // Enter key / search button: jump to the best match
  async performSearch(query: string): Promise<void> {
    query = query?.trim();
    if (!query) return;
    clearTimeout(this.suggestTimer);
    this.message = '';
    const list = await this.fetchSuggestions(query, 1);
    if (list.length) this.goTo(list[0]);
  }

  goTo(s: Suggestion): void {
    this.map.flyTo([s.lat, s.lon], 15);
    this.searchMarker?.remove();
    this.searchMarker = L.marker([s.lat, s.lon], { icon: this.pinIcon('★', 'search') }).addTo(this.map);
    this.suggestions = [];
    this.query = s.label;
  }

  useSuggestion(s: Suggestion, kind: PointKind): void {
    this.setPoint(kind, L.latLng(s.lat, s.lon), s.label);
    this.suggestions = [];
    this.query = '';
    this.searchMarker?.remove();
    this.searchMarker = null;
    if (!this.endMarker || !this.startMarker) this.map.flyTo([s.lat, s.lon], 14);
  }

  clearQuery(): void {
    this.query = '';
    this.suggestions = [];
    this.message = '';
    this.searchMarker?.remove();
    this.searchMarker = null;
  }

  // ---------- Routing ----------

  updateRoute(): void {
    if (this.startMarker && this.endMarker) {
      this.calculateRoute();
    } else {
      this.removeRoute();
    }
  }

  async calculateRoute(): Promise<void> {
    if (!this.startMarker || !this.endMarker) return;

    const start = this.startMarker.getLatLng();
    const end = this.endMarker.getLatLng();
    const requestId = ++this.routeRequestId;
    this.message = '';
    this.loading = true;

    try {
      // OSRM expects lng,lat order
      const url = `${OSRM_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Routing failed (${res.status})`);
      const data = await res.json();

      // Ignore stale responses (markers moved/cleared while the request was in flight)
      if (requestId !== this.routeRequestId || !this.startMarker || !this.endMarker) return;

      if (data.code !== 'Ok' || !data.routes?.length) {
        this.removeRoute();
        this.message = 'No route found between these points.';
        return;
      }

      this.removeRoute();
      this.routes = data.routes.map((r: any) => this.toRouteOption(r));
      this.selectedIndex = 0;
      this.drawRoutes();
      this.map.fitBounds(this.routeLayers[0].getBounds(), { padding: [60, 60] });
    } catch (error) {
      console.error(error);
      if (requestId === this.routeRequestId) this.message = 'Route calculation failed. Please try again.';
    } finally {
      if (requestId === this.routeRequestId) this.loading = false;
    }
  }

  selectRoute(index: number): void {
    if (index === this.selectedIndex || !this.routes[index]) return;
    this.selectedIndex = index;
    this.styleRoutes();
  }

  focusStep(step: RouteStep): void {
    this.map.flyTo(step.location, Math.max(this.map.getZoom(), 16));
  }

  private toRouteOption(route: any): RouteOption {
    const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      text: this.instruction(s),
      icon: this.stepIcon(s.maneuver?.type, s.maneuver?.modifier),
      distance: s.distance,
      location: [s.maneuver.location[1], s.maneuver.location[0]] as L.LatLngTuple
    }));
    return { distance: route.distance, duration: route.duration, geometry: route.geometry, steps };
  }

  private drawRoutes(): void {
    this.routeLayers = this.routes.map((route, i) =>
      L.geoJSON(route.geometry).addTo(this.map).on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        this.selectRoute(i);
      })
    );
    this.styleRoutes();
  }

  private styleRoutes(): void {
    this.routeLayers.forEach((layer, i) => {
      const active = i === this.selectedIndex;
      layer.setStyle({
        color: active ? ROUTE_COLOR : ALT_ROUTE_COLOR,
        weight: active ? 7 : 5,
        opacity: active ? 0.95 : 0.7
      });
      if (active) layer.bringToFront();
    });
  }

  private removeRoute(): void {
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];
    this.routes = [];
    this.selectedIndex = 0;
    this.loading = false;
  }

  // ---------- Formatting helpers (used by the template) ----------

  fmtDistance(m: number): string {
    return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  }

  fmtDuration(s: number): string {
    const mins = Math.max(1, Math.round(s / 60));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  private instruction(step: any): string {
    const { type, modifier, exit } = step.maneuver ?? {};
    const name = step.name ? ` onto ${step.name}` : '';
    const on = step.name ? ` on ${step.name}` : '';
    switch (type) {
      case 'depart': return `Head ${modifier ?? 'out'}${on}`;
      case 'arrive': return 'Arrive at your destination';
      case 'turn': return `Turn ${modifier ?? ''}${name}`.trim();
      case 'new name': return `Continue${name}`;
      case 'continue': return `Continue ${modifier ?? 'straight'}${on}`;
      case 'merge': return `Merge ${modifier ?? ''}${name}`.trim();
      case 'on ramp': return `Take the ramp${name}`;
      case 'off ramp': return `Take the exit${name}`;
      case 'fork': return `Keep ${modifier ?? 'straight'} at the fork${name}`;
      case 'end of road': return `At the end of the road turn ${modifier ?? ''}${name}`.trim();
      case 'roundabout':
      case 'rotary': return `At the roundabout take exit ${exit ?? ''}${name}`.replace('  ', ' ');
      default: return `Continue${name}`;
    }
  }

  private stepIcon(type?: string, modifier?: string): string {
    if (type === 'arrive') return '⚑';
    if (type === 'roundabout' || type === 'rotary') return '⟳';
    switch (modifier) {
      case 'left': return '←';
      case 'right': return '→';
      case 'slight left': return '↖';
      case 'slight right': return '↗';
      case 'sharp left': return '↙';
      case 'sharp right': return '↘';
      case 'uturn': return '↶';
      default: return '↑';
    }
  }
}
