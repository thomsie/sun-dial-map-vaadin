import { LitElement, html, css, unsafeCSS } from 'lit';
import { Map, config, MapStyle, Marker, Popup } from '@maptiler/sdk';
import sdkStyles from '@maptiler/sdk/style.css?inline';

const STYLE_BY_NAME = {
  streets: MapStyle.STREETS,
  satellite: MapStyle.SATELLITE,
  hybrid: MapStyle.HYBRID,
  terrain: MapStyle.TOPO,
  outdoor: MapStyle.OUTDOOR,
};

class MapTilerMap extends LitElement {
  static properties = {
    lat: { type: Number },
    lng: { type: Number },
    zoom: { type: Number },
    baseStyle: { type: String },
    rays: { type: Array },
    mapTilerKey: { type: String },
  };

  constructor() {
    super();
    this.baseStyle = 'streets';
    this._menuOpen = false;
    this._rayMarkers = [];
    this._styleReady = false;
    this._terrainEnabled = false;
  }

  static styles = [
    unsafeCSS(sdkStyles),
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
      .maplibregl-popup.ray-popup .maplibregl-popup-content {
        background: rgba(30, 41, 59, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: sans-serif;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .maplibregl-popup.ray-popup .maplibregl-popup-tip {
        display: none;
      }
      .position-marker,
      .ray-marker {
        cursor: pointer;
        line-height: 0;
      }
      .position-marker svg,
      .ray-marker svg {
        display: block;
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

      /* 3D-Gelände-Umschalter */
      .terrain-switcher {
        position: absolute;
        top: 63px;
        right: 15px;
        z-index: 1000;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .terrain-btn {
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
      .terrain-btn:hover {
        background: #f4f4f5;
      }
      .terrain-btn svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: #4b5563;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .terrain-btn.active {
        background: #2563eb;
      }
      .terrain-btn.active svg {
        stroke: white;
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

  _toggleTerrain() {
    if (!this._map) return;
    this._terrainEnabled = !this._terrainEnabled;
    this.requestUpdate();

    if (this._terrainEnabled) {
      this._map.enableTerrain(1.5);
      this._map.easeTo({ pitch: 60, duration: 800 });
    } else {
      this._map.disableTerrain();
      this._map.easeTo({ pitch: 0, duration: 800 });
    }
  }

  render() {
    return html`
      <div class="map"></div>

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
          <div class="layer-option ${this.baseStyle === 'terrain' ? 'active' : ''}" @click=${(e) => this._handleUiClick(e, () => this._selectStyle('terrain'))}>
            <div class="layer-icon-preview" style="background: linear-gradient(135deg, #d6c9a8, #7a6a4f); color: #3f3524;">
              <svg viewBox="0 0 24 24">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
              </svg>
            </div>
            <span>Gelände</span>
          </div>
          <div class="layer-option ${this.baseStyle === 'outdoor' ? 'active' : ''}" @click=${(e) => this._handleUiClick(e, () => this._selectStyle('outdoor'))}>
            <div class="layer-icon-preview" style="background: linear-gradient(135deg, #a7d8a0, #3f6b4d); color: #17331f;">
              <svg viewBox="0 0 24 24">
                <path d="M3.5 21 14 3"/>
                <path d="M20.5 21 10 3"/>
                <path d="M15.5 21 12 15l-3.5 6"/>
                <path d="M2 21h20"/>
              </svg>
            </div>
            <span>Outdoor</span>
          </div>
        </div>
      </div>

      <div class="terrain-switcher">
        <button
          class="terrain-btn ${this._terrainEnabled ? 'active' : ''}"
          @click=${(e) => this._handleUiClick(e, () => this._toggleTerrain())}
          title="3D-Gelände umschalten"
        >
          <svg viewBox="0 0 24 24">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
          </svg>
        </button>
      </div>
    `;
  }

  firstUpdated() {
    this._container = this.shadowRoot.querySelector('.map');

    this._outsideClickListener = (event) => {
      if (!event.composedPath().includes(this.shadowRoot.querySelector('.layer-switcher'))) {
        this._closeMenu();
      }
    };
    document.addEventListener('click', this._outsideClickListener);

    config.apiKey = this.mapTilerKey || '';

    this._map = new Map({
      container: this._container,
      style: this._styleFor(this.baseStyle),
      center: [this.lng || 13.405, this.lat || 52.52],
      zoom: this.zoom || 10,
      navigationControl: 'top-left',
      geolocateControl: false,
    });

    this._map.on('load', () => {
      this._styleReady = true;
      this._addPositionMarker();
      this._updateRays();
    });

    this._map.on('click', (event) => {
      const { lat, lng } = event.lngLat;
      this._setMarker(lat, lng, false);
      this._emitPosition();
    });

    this._resizeObserver = new ResizeObserver(() => {
      if (this._map) this._map.resize();
    });
    this._resizeObserver.observe(this._container);
  }

  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._outsideClickListener) document.removeEventListener('click', this._outsideClickListener);
    this._clearRays();
    if (this._positionMarker) this._positionMarker.remove();
    if (this._map) this._map.remove();
    super.disconnectedCallback();
  }

  updated(changed) {
    if (!this._map) return;
    if ((changed.has('lat') || changed.has('lng')) && this._positionMarker) {
      this._positionMarker.setLngLat([this.lng, this.lat]);
      this._updateRays();
    }
    if (changed.has('zoom') && this.zoom !== undefined) this._map.setZoom(this.zoom);
    if (changed.has('baseStyle')) this._updateBaseLayer();
    if (changed.has('rays')) this._updateRays();
  }

  flyTo(lat, lng, zoom) {
    if (!this._map) return;
    this.lat = lat;
    this.lng = lng;
    this.zoom = zoom;
    this._setMarker(lat, lng, true);
    this._map.flyTo({ center: [lng, lat], zoom, duration: 800 });
  }

  _setMarker(lat, lng, moveView) {
    this.lat = lat;
    this.lng = lng;
    if (this._positionMarker) this._positionMarker.setLngLat([lng, lat]);
    if (moveView && this._map) this._map.setCenter([lng, lat]);
    this._updateRays();
  }

  _emitPosition() {
    this.dispatchEvent(new CustomEvent('position-changed', {
      detail: { lat: this.lat, lng: this.lng },
      bubbles: true,
      composed: true
    }));
  }

  _styleFor(baseStyle) {
    return STYLE_BY_NAME[baseStyle] || MapStyle.STREETS;
  }

  _updateBaseLayer() {
    if (!this._map) return;
    this._styleReady = false;
    this._map.setStyle(this._styleFor(this.baseStyle));
    this._map.once('style.load', () => {
      this._styleReady = true;
      this._updateRays();
    });
  }

  // Positions-Marker als orangener Tropfen-Pin (LocationScout-Stil) mit Kamera-Icon
  _addPositionMarker() {
    const pinWidth = 32;
    const pinHeight = 40;
    const el = document.createElement('div');
    el.className = 'position-marker';
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${pinWidth}" height="${pinHeight}" viewBox="0 0 ${pinWidth} ${pinHeight}">
      <path d="M16 2C9.373 2 4 7.373 4 14c0 9.5 12 24 12 24s12-14.5 12-24c0-6.627-5.373-12-12-12z" fill="#f97316" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="16" cy="14" r="9" fill="#ffffff"/>
      <g transform="translate(8.5, 6.5) scale(0.7)" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </g>
    </svg>`;

    this._positionMarker = new Marker({ element: el, anchor: 'bottom', draggable: true })
      .setLngLat([this.lng || 13.405, this.lat || 52.52])
      .addTo(this._map);

    this._positionMarker.on('dragend', () => {
      const { lat, lng } = this._positionMarker.getLngLat();
      this.lat = lat;
      this.lng = lng;
      this._updateRays();
      this._emitPosition();
    });
  }

  _clearRays() {
    (this._rayMarkers || []).forEach((marker) => marker.remove());
    this._rayMarkers = [];

    if (this._map && this._styleReady) {
      (this._rayLayerIds || []).forEach((id) => {
        if (this._map.getLayer(id)) this._map.removeLayer(id);
        if (this._map.getSource(id)) this._map.removeSource(id);
      });
    }
    this._rayLayerIds = [];
  }

  _updateRays() {
    if (!this._map || !this._styleReady) return;
    this._clearRays();

    const rays = this.rays || [];
    const origin = [this.lng, this.lat];

    rays.forEach((ray, index) => {
      const end = [ray.endLng, ray.endLat];
      const sourceId = `ray-line-${index}`;

      this._map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [origin, end] },
          properties: {},
        },
      });
      this._map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': ray.color || '#eab308',
          'line-width': 3,
          'line-dasharray': ray.dashed ? [2, 2] : [1, 0],
        },
      });
      this._rayLayerIds.push(sourceId);

      const marker = this._createRayEndpointMarker(ray, end);
      this._rayMarkers.push(marker);
    });
  }

  _createRayEndpointMarker(ray, end) {
    const color = ray.color || '#eab308';
    const label = ray.label || '';
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

    const el = document.createElement('div');
    el.className = 'ray-marker';

    if (!iconInnerSvg) {
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      </svg>`;
    } else {
      const markerSize = 38;
      const radius = 17;
      const center = markerSize / 2;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <g transform="translate(7, 7)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${iconInnerSvg}
        </g>
      </svg>`;
    }

    const marker = new Marker({ element: el, anchor: 'center' })
      .setLngLat(end)
      .addTo(this._map);

    if (label) {
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 20,
        className: 'ray-popup',
      }).setText(label);

      el.addEventListener('mouseenter', () => popup.setLngLat(end).addTo(this._map));
      el.addEventListener('mouseleave', () => popup.remove());
    }

    return marker;
  }
}

customElements.define('maptiler-map', MapTilerMap);
