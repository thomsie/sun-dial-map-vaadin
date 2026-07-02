package org.vaadin.example.sunmap.ui;

import com.vaadin.flow.component.ComponentEventListener;
import com.vaadin.flow.component.Synchronize;
import com.vaadin.flow.component.Tag;
import com.vaadin.flow.component.dependency.JsModule;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.shared.Registration;
import elemental.json.Json;
import elemental.json.JsonArray;
import elemental.json.JsonObject;

import java.util.List;

@Tag("open-layers-map")
@JsModule("./open-layers-map.js")
public class OpenLayersMap extends Div {

    public OpenLayersMap() {
        setSizeFull();
        getStyle().set("display", "block");

        getElement().setProperty("lat", 52.52);
        getElement().setProperty("lng", 13.405);
        getElement().setProperty("zoom", 11);
        getElement().setProperty("baseStyle", "streets");
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
        JsonArray array = Json.createArray();
        for (int i = 0; i < rays.size(); i++) {
            MapRay ray = rays.get(i);
            JsonObject obj = Json.createObject();
            obj.put("endLat", ray.endLat());
            obj.put("endLng", ray.endLng());
            obj.put("color", ray.color());
            obj.put("label", ray.label());
            obj.put("dashed", ray.dashed());
            array.set(i, obj);
        }
        getElement().setPropertyJson("rays", array);
    }

    public Registration addPositionChangeListener(ComponentEventListener<PositionChangedEvent> listener) {
        return addListener(PositionChangedEvent.class, listener);
    }
    // In OpenLayersMap.java hinzufügen:

    public String getBaseStyle() {
        return getElement().getProperty("baseStyle", "streets");
    }

    // Event-Listener für serverseitige Registrierung des Umschaltens
    public com.vaadin.flow.shared.Registration addBaseStyleChangeListener(
            com.vaadin.flow.component.ComponentEventListener<BaseStyleChangeEvent> listener) {
        return getElement().addEventListener("base-style-changed", e -> {
            String style = e.getEventData().getString("event.detail.style");
            listener.onComponentEvent(new BaseStyleChangeEvent(this, style));
        }).addEventData("event.detail.style");
    }

    public static class BaseStyleChangeEvent extends com.vaadin.flow.component.ComponentEvent<OpenLayersMap> {
        private final String style;

        public BaseStyleChangeEvent(OpenLayersMap source, String style) {
            super(source, false);
            this.style = style;
        }

        public String getStyle() {
            return style;
        }
    }
}