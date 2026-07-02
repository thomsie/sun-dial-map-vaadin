import { LitElement, html, css } from 'lit';
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
import { Style, Stroke, Circle, Fill, Text } from 'ol/style.js';
import Modify from 'ol/interaction/Modify.js';
import 'ol/ol.css';

class OpenLayersMap extends LitElement {
  static properties = {
    lat: { type: Number },
    lng: { type: Number },
    zoom: { type: Number },
    baseStyle: { type: String },
    rays: { type: Array },
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .map {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return html`<div class="map"></div>`;
  }

  firstUpdated() {
    // KORREKTUR: Im Shadow DOM suchen statt im Light DOM
    this._container = this.shadowRoot.querySelector('.map');

    if (!this._container) {
      console.error("Karten-Container '.map' wurde im Shadow DOM nicht gefunden.");
      return;
    }

    this._streets = new TileLayer({ source: new OSM() });
    this._satellite = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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

    this._markerLayer = new VectorLayer({
      source: this._markerSource,
      style: new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: '#2563eb' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      }),
    });

    this._map = new Map({
      target: this._container,
      layers: [this._streets, this._rayLayer, this._markerLayer],
      view: new View({
        center: fromLonLat([this.lng || 13.405, this.lat || 52.52]),
        zoom: this.zoom || 6,
      }),
    });

    this._resizeObserver = new ResizeObserver(() => {
      if (this._map) {
        this._map.updateSize();
      }
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

    this._updateBaseLayer();
    this._updateRays();
  }

  disconnectedCallback() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    super.disconnectedCallback();
  }

  updated(changed) {
    if (!this._map) return;

    if (changed.has('lat') || changed.has('lng')) {
      this._setMarker(this.lat, this.lng, false);
    }
    if (changed.has('zoom') && this.zoom !== undefined) {
      this._map.getView().setZoom(this.zoom);
    }
    if (changed.has('baseStyle')) {
      this._updateBaseLayer();
    }
    if (changed.has('rays')) {
      this._updateRays();
    }
  }

  flyTo(lat, lng, zoom) {
    if (!this._map) return;
    this.lat = lat;
    this.lng = lng;
    this.zoom = zoom;
    this._setMarker(lat, lng, true);
    this._map.getView().animate({
      center: fromLonLat([lng, lat]),
      zoom,
      duration: 800,
    });
  }

  _setMarker(lat, lng, moveView) {
    if (!this._markerFeature) return;
    this.lat = lat;
    this.lng = lng;
    this._markerFeature.getGeometry().setCoordinates(fromLonLat([lng, lat]));
    if (moveView) {
      this._map.getView().setCenter(fromLonLat([lng, lat]));
    }
    this._updateRays();
  }

  _emitPosition() {
    const [lng, lat] = toLonLat(this._markerFeature.getGeometry().getCoordinates());
    this.lat = lat;
    this.lng = lng;
    this.dispatchEvent(
      new CustomEvent('position-changed', {
        detail: { lat, lng },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _updateBaseLayer() {
    if (!this._map) return;
    this._map.getLayers().remove(this._streets);
    this._map.getLayers().remove(this._satellite);
    const base = this.baseStyle === 'satellite' ? this._satellite : this._streets;
    this._map.getLayers().insertAt(0, base);
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
        label: ray.label,
        dashed: ray.dashed,
      });
      this._raySource.addFeature(line);
    });
  }


  _rayStyle(feature) {
    const color = feature.get('color') || '#eab308';
    const dashed = feature.get('dashed') || false;
    const label = feature.get('label') || '';
    
    return new Style({
      stroke: new Stroke({
        color,
        width: 3,
        lineDash: dashed ? [6, 8] : undefined,
      }),
      text: new Text({
        text: label,
        font: 'bold 12px sans-serif',
        fill: new Fill({ color: '#1e293b' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
        
        // --- HIER SIND DIE ANPASSUNGEN FÜR DAS LINIENENDE ---
        textAlign: 'left',        // Der Text beginnt am Punkt und wandert nach rechts
        textBaseline: 'middle',   // Der Text wird vertikal perfekt mittig zur Linie zentriert
        offsetX: 8,               // 8 Pixel Sicherheitsabstand nach rechts vom Linienende
        offsetY: 0                // Kein Versatz mehr nach oben (war vorher -12)
      }),
    });
  }
}

customElements.define('open-layers-map', OpenLayersMap);