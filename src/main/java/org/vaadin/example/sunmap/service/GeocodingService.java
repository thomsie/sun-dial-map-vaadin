package org.vaadin.example.sunmap.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class GeocodingService {

    private static final String NOMINATIM = "https://nominatim.openstreetmap.org";

    private final RestClient client = RestClient.create();

    public List<PlaceResult> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        try {
            JsonNode results = client.get()
                    .uri(NOMINATIM + "/search?format=json&q={q}&limit=5",
                            UriUtils.encode(query.trim(), StandardCharsets.UTF_8))
                    .header("Accept", "application/json")
                    .header("User-Agent", "SunDialMapVaadin/1.0")
                    .retrieve()
                    .body(JsonNode.class);
            if (results == null || !results.isArray()) {
                return List.of();
            }
            List<PlaceResult> places = new ArrayList<>();
            for (JsonNode node : results) {
                places.add(new PlaceResult(
                        node.path("display_name").asText(),
                        Double.parseDouble(node.path("lat").asText()),
                        Double.parseDouble(node.path("lon").asText())));
            }
            return places;
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    public Optional<String> reverseGeocode(double lat, double lng) {
        try {
            JsonNode body = client.get()
                    .uri(NOMINATIM + "/reverse?format=json&lat={lat}&lon={lng}&zoom=10", lat, lng)
                    .header("Accept", "application/json")
                    .header("User-Agent", "SunDialMapVaadin/1.0")
                    .retrieve()
                    .body(JsonNode.class);
            if (body != null && body.hasNonNull("display_name")) {
                return Optional.of(body.get("display_name").asText());
            }
        } catch (RuntimeException ignored) {
            // ignore network errors
        }
        return Optional.empty();
    }

    public record PlaceResult(String displayName, double lat, double lng) {
    }
}
