import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';

import { TrafficDashboardComponent } from './traffic-dashboard.component';

describe('TrafficDashboardComponent', () => {
  let component: TrafficDashboardComponent;
  let fixture: ComponentFixture<TrafficDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TrafficDashboardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TrafficDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // creates the Leaflet map

    // Never hit the network from tests
    spyOn(component, 'calculateRoute').and.returnValue(Promise.resolve());
    spyOn(component, 'reverseGeocode').and.returnValue(Promise.resolve());
  });

  it('should create the map', () => {
    expect(component).toBeTruthy();
    expect(component.map).toBeTruthy();
  });

  it('should place a start and end marker, then ignore further clicks', () => {
    component.handleMapClick(L.latLng(12.97, 77.59));
    expect(component.startMarker).toBeTruthy();
    component.handleMapClick(L.latLng(12.98, 77.60));
    expect(component.endMarker).toBeTruthy();
    expect(component.calculateRoute).toHaveBeenCalledTimes(1);

    const end = component.endMarker;
    component.handleMapClick(L.latLng(13, 77.7));
    expect(component.endMarker).toBe(end);
  });

  it('should swap start and destination', () => {
    component.setPoint('start', L.latLng(12.97, 77.59), 'Alpha');
    component.setPoint('end', L.latLng(12.98, 77.60), 'Beta');
    component.swapPoints();
    expect(component.startLabel).toBe('Beta');
    expect(component.endLabel).toBe('Alpha');
    expect(component.startMarker.getLatLng().lat).toBeCloseTo(12.98);
  });

  it('should clear a single point', () => {
    component.setPoint('start', L.latLng(12.97, 77.59), 'Alpha');
    component.clearPoint('start');
    expect(component.startMarker).toBeNull();
    expect(component.startLabel).toBe('');
  });

  it('should clear markers', () => {
    component.handleMapClick(L.latLng(12.97, 77.59));
    component.handleMapClick(L.latLng(12.98, 77.60));
    component.clearMarkersAndRoute();
    expect(component.startMarker).toBeNull();
    expect(component.endMarker).toBeNull();
  });

  it('should format distance and duration', () => {
    expect(component.fmtDistance(450)).toBe('450 m');
    expect(component.fmtDistance(6202)).toBe('6.2 km');
    expect(component.fmtDuration(478)).toBe('8 min');
    expect(component.fmtDuration(4500)).toBe('1 h 15 min');
  });

  it('should toggle theme', () => {
    const before = component.theme;
    component.toggleTheme();
    expect(component.theme).not.toBe(before);
  });
});
