package org.vaadin.example.sunmap.ui;

public record MapRay(
        double endLat,
        double endLng,
        String color,
        String label,
        boolean dashed) {
}
