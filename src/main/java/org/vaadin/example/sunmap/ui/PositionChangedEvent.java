package org.vaadin.example.sunmap.ui;

import com.vaadin.flow.component.ComponentEvent;
import com.vaadin.flow.component.DomEvent;
import com.vaadin.flow.component.EventData;


@DomEvent("position-changed")
public class PositionChangedEvent extends ComponentEvent<MapTilerMap> {

    private final double lat;
    private final double lng;



    public PositionChangedEvent(
            MapTilerMap source,
            boolean fromClient,
            @EventData("event.detail.lat") double lat,
            @EventData("event.detail.lng") double lng) {
        super(source, fromClient);
        this.lat = lat;
        this.lng = lng;
    }
    
    public double getLat() {
        return lat;
    }
    public double getLng() {
        return lng;
    }


}
