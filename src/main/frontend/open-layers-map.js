import { LitElement, html, css, unsafeCSS } from 'lit';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Style, Stroke, Circle, Fill, Icon } from 'ol/style.js'; 
import Modify from 'ol/interaction/Modify.js';
import Overlay from 'ol/Overlay.js';
import olStyles from 'ol/ol.css?inline';

class OpenLayersMap extends LitElement {
  static properties = {
    lat: { type: Number },
    lng: { type: Number },
    zoom: { type: Number },
    baseStyle: { type: String },
    rays: { type: Array },
  };

  constructor() {
    super();
    this.baseStyle = 'streets';
    this._menuOpen = false;
  }

  static styles = [
    unsafeCSS(olStyles),
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
      }
      .map {
        width: 100%;
        height: 100%;
      }
      .ol-attribution {
        bottom: 0.5em !important;
        right: 0.5em !important;
        top: auto !important;
        left: auto !important;
      }
      .map-tooltip {
        background: rgba(30, 41, 59, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: sans-serif;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 10;
      }

      /* Schwebender Google-Maps-Style Layer-Umschalter */
      .layer-switcher {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 1000;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .layer-btn {
        background: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .layer-btn:hover {
        background: #f4f4f5;
      }
      .layer-btn svg {
        width: 22px;
        height: 22px;
        fill: #4b5563;
      }
      .layer-menu {
        position: absolute;
        top: 48px;
        right: 0;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        padding: 6px;
        display: none;
        gap: 6px;
      }
      .layer-menu.open {
        display: flex;
      }
      .layer-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        width: 60px;
        font-size: 11px;
        font-weight: 500;
        color: #374151;
        transition: background 0.2s;
      }
      .layer-option:hover {
        background: #f4f4f5;
      }
      .layer-option.active {
        background: #eff6ff;
        color: #2563eb;
      }
      .layer-icon-preview {
        width: 44px;
        height: 44px;
        border-radius: 6px;
        margin-bottom: 4px;
        border: 2px solid transparent;
        background-size: cover;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .layer-icon-preview svg {
        width: 26px;
        height: 26px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.25;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
      }
      .layer-option.active .layer-icon-preview {
        border-color: #2563eb;
      }
    `
  ];

  _handleUiClick(event, action) {
    event.stopPropagation();
    event.preventDefault();
    action();
  }

  _toggleMenu() {
    this._menuOpen = !this._menuOpen;
    this.requestUpdate();
  }

  _closeMenu() {
    if (!this._menuOpen) return;
    this._menuOpen = false;
    this.requestUpdate();
  }

  _selectStyle(style) {
    this.baseStyle = style;
    this._menuOpen = false;
    this._updateBaseLayer();
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('base-style-changed', {
      detail: { style: this.baseStyle },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <div class="map"></div>
      <div id="tooltip" class="map-tooltip" style="display: none;"></div>

      <div class="layer-switcher">
        <button class="layer-btn" @click=${(e) => this._handleUiClick(e, () => this._toggleMenu())} title="Kartenstil ändern">
          <svg viewBox="0 0 24 24">
            <path d="M12 2L1 7l11 5 11-5-11-5zM2 12l10 5 10-5M2 17l10 5 10-5"/>
          </svg>
        </button>
        <div class="layer-menu ${this._menuOpen ? 'open' : ''}">
          <div class="layer-option ${this.baseStyle === 'streets' ? 'active' : ''}" @click=${(e) => this._handleUiClick(e, () => this._selectStyle('streets'))}>
            <div class="layer-icon-preview" style="background: linear-gradient(135deg, #cfe8fb, #fef3c7); color: #1e3a5f;">
              <svg viewBox="0 0 24 24">
                <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
                <path d="M15 5.764v15.236"/>
                <path d="M9 3.236v15.236"/>
              </svg>
            </div>
            <span>Straße</span>
          </div>
          <div class="layer-option ${this.baseStyle === 'satellite' ? 'active' : ''}" @click=${(e) => this._handleUiClick(e, () => this._selectStyle('satellite'))}>
            <div class="layer-icon-preview" style="background: linear-gradient(135deg, #2e7d32, #1b3a1e); color: #f4f4f5;">
              <svg viewBox="0 0 24 24">
                <path d="M13 7 9 3 4 8l4 4"/>
                <path d="m17 11 4 4-5 5-4-4"/>
                <path d="m8 12 4 4"/>
                <path d="m16 8 3-3"/>
                <path d="M9 21a6 6 0 0 0-6-6"/>
              </svg>
            </div>
            <span>Satellit</span>
          </div>
          <div class="layer-option ${this.baseStyle === 'hybrid' ? 'active' : ''}" @click=${(e) => this._handleUiClick(e, () => this._selectStyle('hybrid'))}>
            <div class="layer-icon-preview" style="background: linear-gradient(135deg, #1b5e20, #0d3b66); color: #f4f4f5;">
              <svg viewBox="0 0 24 24">
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
              </svg>
            </div>
            <span>Hybrid</span>
          </div>
        </div>
      </div>
    `;
  }

  firstUpdated() {
    this._container = this.shadowRoot.querySelector('.map');
    this._tooltipEl = this.shadowRoot.querySelector('#tooltip');

    this._outsideClickListener = (event) => {
      if (!event.composedPath().includes(this.shadowRoot.querySelector('.layer-switcher'))) {
        this._closeMenu();
      }
    };
    document.addEventListener('click', this._outsideClickListener);

    this._streets = new TileLayer({ 
      source: new OSM({
        attributions: 'Data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      }) 
    });
    
    this._satellite = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri · Data © OpenStreetMap contributors',
      }),
    });

    this._hybridOverlay = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri',
      }),
    });

    this._markerSource = new VectorSource();
    this._markerFeature = new Feature({
      geometry: new Point(fromLonLat([this.lng || 13.405, this.lat || 52.52])),
    });
    this._markerSource.addFeature(this._markerFeature);

    this._raySource = new VectorSource();
    this._rayLayer = new VectorLayer({
      source: this._raySource,
      style: (feature) => this._rayStyle(feature),
    });

    // Positions-Marker als orangener Tropfen-Pin (LocationScout-Stil) mit Kamera-Icon
    const pinWidth = 32;
    const pinHeight = 40;
    const positionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pinWidth}" height="${pinHeight}" viewBox="0 0 ${pinWidth} ${pinHeight}">
      <path d="M16 2C9.373 2 4 7.373 4 14c0 9.5 12 24 12 24s12-14.5 12-24c0-6.627-5.373-12-12-12z" fill="#f97316" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="16" cy="14" r="9" fill="#ffffff"/>
      <g transform="translate(8.5, 6.5) scale(0.7)" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </g>
    </svg>`;
    const positionMarkerUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(positionSvg);

    this._markerLayer = new VectorLayer({
      source: this._markerSource,
      style: new Style({
        image: new Icon({
          src: positionMarkerUrl,
          scale: 1,
          anchor: [0.5, 0.95]
        }),
      }),
    });

    this._map = new Map({
      target: this._container,
      layers: [this._streets, this._rayLayer, this._markerLayer],
      view: new View({
        center: fromLonLat([this.lng || 13.405, this.lat || 52.52]),
        zoom: this.zoom || 10, 
      }),
    });

    this._tooltipOverlay = new Overlay({
      element: this._tooltipEl,
      offset: [0, -20],
      positioning: 'bottom-center',
    });
    this._map.addOverlay(this._tooltipOverlay);

    this._resizeObserver = new ResizeObserver(() => {
      if (this._map) this._map.updateSize();
    });
    this._resizeObserver.observe(this._container);

    this._modify = new Modify({ source: this._markerSource });
    this._modify.on('modifyend', () => this._emitPosition());
    this._map.addInteraction(this._modify);

    this._map.on('singleclick', (event) => {
      if (event.dragging) return;
      const [lng, lat] = toLonLat(event.coordinate);
      this._setMarker(lat, lng, false);
      this._emitPosition();
    });

    this._map.on('pointermove', (event) => {
      if (event.dragging) return;
      
      const hit = this._map.forEachFeatureAtPixel(event.pixel, (feature) => {
        if (feature.get('isEndPoint') && feature.get('description')) {
          return feature;
        }
      }, {
        layerFilter: (layer) => layer === this._rayLayer
      });

      if (hit) {
        this._container.style.cursor = 'pointer';
        this._tooltipEl.style.display = 'block';
        this._tooltipEl.textContent = hit.get('description');
        this._tooltipOverlay.setPosition(hit.getGeometry().getCoordinates());
      } else {
        this._container.style.cursor = '';
        this._tooltipEl.style.display = 'none';
        this._tooltipOverlay.setPosition(undefined);
      }
    });

    this._updateBaseLayer();
    this._updateRays();
  }

  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._outsideClickListener) document.removeEventListener('click', this._outsideClickListener);
    super.disconnectedCallback();
  }

  updated(changed) {
    if (!this._map) return;
    if (changed.has('lat') || changed.has('lng')) this._setMarker(this.lat, this.lng, false);
    if (changed.has('zoom') && this.zoom !== undefined) this._map.getView().setZoom(this.zoom);
    if (changed.has('baseStyle')) this._updateBaseLayer();
    if (changed.has('rays')) this._updateRays();
  }

  flyTo(lat, lng, zoom) {
    if (!this._map) return;
    this.lat = lat;
    this.lng = lng;
    this.zoom = zoom;
    this._setMarker(lat, lng, true);
    this._map.getView().animate({ center: fromLonLat([lng, lat]), zoom, duration: 800 });
  }

  _setMarker(lat, lng, moveView) {
    if (!this._markerFeature) return;
    this.lat = lat;
    this.lng = lng;
    this._markerFeature.getGeometry().setCoordinates(fromLonLat([lng, lat]));
    if (moveView) this._map.getView().setCenter(fromLonLat([lng, lat]));
    this._updateRays();
  }

  _emitPosition() {
    const [lng, lat] = toLonLat(this._markerFeature.getGeometry().getCoordinates());
    this.lat = lat;
    this.lng = lng;
    this.dispatchEvent(new CustomEvent('position-changed', { detail: { lat, lng }, bubbles: true, composed: true }));
  }

  _updateBaseLayer() {
    if (!this._map) return;
    
    this._map.getLayers().remove(this._streets);
    this._map.getLayers().remove(this._satellite);
    this._map.getLayers().remove(this._hybridOverlay);

    if (this.baseStyle === 'hybrid') {
      this._map.getLayers().insertAt(0, this._satellite);
      this._map.getLayers().insertAt(1, this._hybridOverlay);
    } else if (this.baseStyle === 'satellite') {
      this._map.getLayers().insertAt(0, this._satellite);
    } else {
      this._map.getLayers().insertAt(0, this._streets);
    }
  }

  _updateRays() {
    if (!this._raySource) return;
    this._raySource.clear();
    const rays = this.rays || [];
    const origin = fromLonLat([this.lng, this.lat]);

    rays.forEach((ray) => {
      const end = fromLonLat([ray.endLng, ray.endLat]);
      
      const line = new Feature({
        geometry: new LineString([origin, end]),
        color: ray.color,
        dashed: ray.dashed,
      });
      this._raySource.addFeature(line);

      const endPoint = new Feature({
        geometry: new Point(end),
        color: ray.color,
        description: ray.label,
        isEndPoint: true
      });
      this._raySource.addFeature(endPoint);
    });
  }

  _rayStyle(feature) {
    const color = feature.get('color') || '#eab308';
    
    if (feature.get('isEndPoint')) {
      const label = feature.get('description') || '';
      let iconInnerSvg = '';

      // Zuordnung der Lucide-Icons (Pfade) basierend auf dem Ray-Label
      if (label.includes('Sonnenaufgang') || label.includes('Morgendämmerung') || label.includes('Goldene')) {
        iconInnerSvg = `<path d="M12 2v8"/><path d="m5.22 10.22 1.42 1.42"/><path d="m17.36 11.64 1.42-1.42"/><path d="M22 22H2"/><path d="M16 16a4 4 0 1 0-8 0"/><path d="M12 18H8"/><path d="M16 18h-4"/>`;
      } else if (label.includes('Sonnenuntergang') || label.includes('Abenddämmerung')) {
        iconInnerSvg = `<path d="M12 10V2"/><path d="m5.22 10.22 1.42-1.42"/><path d="m17.36 8.8 1.42 1.42"/><path d="M22 22H2"/><path d="M16 16a4 4 0 1 0-8 0"/><path d="M12 18H8"/><path d="M16 18h-4"/>`;
      } else if (label.includes('Aktuell')) {
        iconInnerSvg = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m16.26 16.26 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`;
      } else if (label.includes('Mond')) {
        iconInnerSvg = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
      }

      if (!iconInnerSvg) {
        return new Style({
          image: new Circle({
            radius: 12,
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: '#ffffff', width: 2 })
          })
        });
      }

      // Zusammenbau des kreisrunden Badges (Farbiger Kreis + weißer Rand + weißes Lucide-Icon)
      const markerSize = 38;
      const radius = 17; 
      const center = markerSize / 2;

      const dynamicSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <g transform="translate(7, 7)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${iconInnerSvg}
        </g>
      </svg>`;

      const svgUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(dynamicSvg);

      return new Style({
        image: new Icon({
          src: svgUrl,
          scale: 1,
          anchor: [0.5, 0.5]
        })
      });
    }

    const dashed = feature.get('dashed') || false;
    return new Style({
      stroke: new Stroke({
        color,
        width: 3,
        lineDash: dashed ? [6, 8] : undefined,
      })
    });
  }
}

customElements.define('open-layers-map', OpenLayersMap);