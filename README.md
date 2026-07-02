# Sonne · Karte (Vaadin Flow + OpenLayers)

Vaadin-24-Portierung der React-Komponente **SunMap** — mit **kostenlosen Vaadin-Komponenten** (`vaadin-core`) und **OpenLayers** statt der kommerziellen Vaadin Map.

## Voraussetzungen

- Java 17+
- Maven (Wrapper enthalten)

## Starten

```bash
cd sun-dial-map-vaadin
./mvnw spring-boot:run
```

Die App läuft unter [http://localhost:8080](http://localhost:8080).

## Technologie

| Bereich | Lösung |
|---|---|
| UI-Framework | Vaadin 24 Flow (`vaadin-core`, Apache 2.0) |
| Karte | OpenLayers 10 via Custom Web Component |
| Sonnen/Mond | commons-suncalc (Java) |
| Geocoding | Nominatim (serverseitig) |
| Wetter | Open-Meteo (serverseitig) |

## Projektstruktur

```
src/main/java/org/vaadin/example/
├── Application.java              # @NpmPackage("ol")
└── sunmap/
    ├── service/
    │   ├── GeocodingService.java
    │   └── WeatherService.java
    └── ui/
        ├── OpenLayersMap.java    # Java-Wrapper für Web Component
        ├── MapRay.java
        ├── PositionChangedEvent.java
        └── SunMapView.java

src/main/frontend/
└── open-layers-map.js            # Lit + OpenLayers
```

## Hinweise

- OpenStreetMap-Tiles sind nur für leichte Nutzung gedacht.
- Das Wolken-Heatmap-Overlay aus der React-Version ist nicht enthalten; Punkt-Wetterdaten erscheinen in der Sidebar.

## Production Build

```bash
./mvnw clean package -Pproduction
java -jar target/sun-dial-map-vaadin-1.0-SNAPSHOT.jar
```
