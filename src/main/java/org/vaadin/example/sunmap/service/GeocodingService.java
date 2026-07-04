package org.vaadin.example.sunmap.service;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import tools.jackson.databind.JsonNode;


@Service
public class GeocodingService {

    private static final String PHOTON_SEARCH = "https://photon.komoot.io/api";
    private static final String PHOTON_REVERSE = "https://photon.komoot.io/reverse";

    private final RestClient client = RestClient.builder()
            .requestFactory(createRequestFactory())
            .build();

    private static SimpleClientHttpRequestFactory createRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        return factory;
    }

    public List<PlaceResult> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        try {
            JsonNode body = client.get()
                    .uri(PHOTON_SEARCH + "?q={q}&limit=8&lang=de", query.trim())
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(JsonNode.class);
            return toPlaceResults(body);
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    public Optional<String> reverseGeocode(double lat, double lng) {
        try {
            JsonNode body = client.get()
                    .uri(PHOTON_REVERSE + "?lon={lng}&lat={lat}", lng, lat)
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(JsonNode.class);
            List<PlaceResult> results = toPlaceResults(body);
            if (!results.isEmpty()) {
                return Optional.of(results.get(0).displayName());
            }
        } catch (RuntimeException ignored) {
            // ignore network errors
        }
        return Optional.empty();
    }

    private List<PlaceResult> toPlaceResults(JsonNode body) {
        if (body == null) {
            return List.of();
        }
        JsonNode features = body.path("features");
        if (!features.isArray()) {
            return List.of();
        }
        List<PlaceResult> places = new ArrayList<>();
        Set<String> seenNames = new HashSet<>();
        for (JsonNode feature : features) {
            JsonNode coordinates = feature.path("geometry").path("coordinates");
            if (!coordinates.isArray() || coordinates.size() < 2) {
                continue;
            }
            String name = displayName(feature.path("properties"));
            if (!seenNames.add(name)) {
                // Photon often returns several features (village/street/house) that render
                // identically once reduced to a display name; keep only the best-ranked one
                // so the dropdown never shows two indistinguishable entries.
                continue;
            }
            double lng = coordinates.get(0).asDouble();
            double lat = coordinates.get(1).asDouble();
            places.add(new PlaceResult(name, lat, lng));
            if (places.size() == 5) {
                break;
            }
        }
        return places;
    }

    private String displayName(JsonNode properties) {
        LinkedHashSet<String> parts = new LinkedHashSet<>();
        addIfPresent(parts, properties, "name");
        addIfPresent(parts, properties, "street");
        addIfPresent(parts, properties, "city");
        addIfPresent(parts, properties, "state");
        addIfPresent(parts, properties, "country");
        return String.join(", ", parts);
    }

    private void addIfPresent(LinkedHashSet<String> parts, JsonNode node, String field) {
        String value = node.path(field).asString(null);
        if (value != null && !value.isBlank()) {
            parts.add(value);
        }
    }

    public record PlaceResult(String displayName, double lat, double lng) {
    }
}
