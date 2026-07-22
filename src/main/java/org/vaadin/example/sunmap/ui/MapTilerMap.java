package org.vaadin.example.sunmap.ui;

import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Synchronize;
import com.vaadin.flow.component.Tag;
import com.vaadin.flow.component.dependency.JsModule;
import com.vaadin.flow.component.dependency.NpmPackage;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.shared.Registration;


import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;


@Tag("maptiler-map")
@JsModule("./maptiler-map.js")
@NpmPackage(value = "@maptiler/sdk", version = "4.0.2")
public class MapTilerMap extends Div {

    private static final ObjectMapper mapper = new ObjectMapper();

    public MapTilerMap(String mapTilerApiKey, double lat, double lng, int zoom) {
        setSizeFull();
        getStyle().set("display", "block");

        getElement().setProperty("lat", lat);
        getElement().setProperty("lng", lng);
        getElement().setProperty("zoom", zoom);
        getElement().setProperty("baseStyle", "streets");
        getElement().setProperty("mapTilerKey", mapTilerApiKey == null ? "" : mapTilerApiKey);
    }

    @Synchronize(property = "lat", value = "position-changed")
    public double getLat() {
        return getElement().getProperty("lat", 52.52);
    }

    @Synchronize(property = "lng", value = "position-changed")
    public double getLng() {
        return getElement().getProperty("lng", 13.405);
    }

    public void setCenter(double lat, double lng) {
        getElement().setProperty("lat", lat);
        getElement().setProperty("lng", lng);
    }

    public void setZoom(int zoom) {
        getElement().setProperty("zoom", zoom);
    }

    public void flyTo(double lat, double lng, int zoom) {
        getElement().setProperty("lat", lat);
        getElement().setProperty("lng", lng);
        getElement().setProperty("zoom", zoom);
        getElement().callJsFunction("flyTo", lat, lng, zoom);
    }

    public void setBaseStyle(String baseStyle) {
        getElement().setProperty("baseStyle", baseStyle);
    }

    public void setRays(List<MapRay> rays) {
        ArrayNode array = mapper.createArrayNode();
        
        for (MapRay ray : rays) {
            ObjectNode obj = mapper.createObjectNode();
            obj.put("endLat", ray.endLat());
            obj.put("endLng", ray.endLng());
            obj.put("color", ray.color());
            obj.put("label", ray.label());
            obj.put("dashed", ray.dashed());
            array.add(obj);
        }
        getElement().setPropertyJson("rays", array);
    }

    public Registration addPositionChangeListener(ComponentEventListener<PositionChangedEvent> listener) {
        return addListener(PositionChangedEvent.class, listener);
    }

    public String getBaseStyle() {
        return getElement().getProperty("baseStyle", "streets");
    }

    // Event-Listener für serverseitige Registrierung des Umschaltens
    public com.vaadin.flow.shared.Registration addBaseStyleChangeListener(
            com.vaadin.flow.component.ComponentEventListener<BaseStyleChangeEvent> listener) {
        return getElement().addEventListener("base-style-changed", e -> {
            String style = e.getEventData().get("event.detail.style").asString("streets");
            listener.onComponentEvent(new BaseStyleChangeEvent(this, style));
        }).addEventData("event.detail.style");
    }

    public static class BaseStyleChangeEvent extends com.vaadin.flow.component.ComponentEvent<MapTilerMap> {
        private final String style;

        public BaseStyleChangeEvent(MapTilerMap source, String style) {
            super(source, false);
            this.style = style;
        }

        public String getStyle() {
            return style;
        }
    }
}