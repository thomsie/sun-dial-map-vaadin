package org.vaadin.example.sunmap.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.Optional;

@Service
public class WeatherService {

    private static final String OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

    private final RestClient client = RestClient.create();

    public Optional<CloudData> fetchCurrent(double lat, double lng) {
        try {
            JsonNode json = client.get()
                    .uri(OPEN_METEO
                            + "?latitude={lat}&longitude={lng}"
                            + "&current=cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,weather_code",
                            lat, lng)
                    .retrieve()
                    .body(JsonNode.class);
            if (json == null || !json.has("current")) {
                return Optional.empty();
            }
            JsonNode current = json.get("current");
            int visibility = current.path("visibility").asInt(20_000);
            int weatherCode = current.path("weather_code").asInt(0);
            return Optional.of(new CloudData(
                    current.path("cloud_cover_low").asInt(0),
                    current.path("cloud_cover_mid").asInt(0),
                    current.path("cloud_cover_high").asInt(0),
                    computeFog(visibility, weatherCode),
                    visibility));
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    static int computeFog(int visibility, int weatherCode) {
        if (weatherCode == 45 || weatherCode == 48) {
            return 100;
        }
        if (visibility < 1000) {
            return 90;
        }
        if (visibility < 4000) {
            return 60;
        }
        if (visibility < 8000) {
            return 25;
        }
        return 0;
    }

    public record CloudData(int low, int mid, int high, int fog, int visibility) {
    }
}
