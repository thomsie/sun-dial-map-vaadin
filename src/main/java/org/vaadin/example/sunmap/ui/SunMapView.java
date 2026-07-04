package org.vaadin.example.sunmap.ui;

import com.vaadin.flow.component.AttachEvent;
import com.vaadin.flow.component.Component;
import com.vaadin.flow.component.DetachEvent;
import com.vaadin.flow.component.checkbox.Checkbox;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.datepicker.DatePicker.DatePickerI18n;
import com.vaadin.flow.component.html.Div;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.html.H3;
import com.vaadin.flow.component.html.Header;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.html.Span;
import com.vaadin.flow.component.listbox.ListBox;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.progressbar.ProgressBar;
import com.vaadin.flow.component.radiobutton.RadioButtonGroup;
import com.vaadin.flow.component.select.Select;
import com.vaadin.flow.component.splitlayout.SplitLayout;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.data.value.ValueChangeMode;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import org.shredzone.commons.suncalc.MoonIllumination;
import org.shredzone.commons.suncalc.MoonPosition;
import org.shredzone.commons.suncalc.MoonTimes;
import org.shredzone.commons.suncalc.SunPosition;
import org.shredzone.commons.suncalc.SunTimes;
import org.vaadin.example.sunmap.service.GeocodingService;
import org.vaadin.example.sunmap.service.GeocodingService.PlaceResult;
import org.vaadin.example.sunmap.service.WeatherService;
import org.vaadin.example.sunmap.service.WeatherService.CloudData;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Route("")
@PageTitle("Sonne · Karte")
public class SunMapView extends VerticalLayout {

    private enum DisplayMode {
        SUN, MOON, CLOUDS
    }

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm")
            .withLocale(Locale.GERMANY);

    private final GeocodingService geocoding;
    private final WeatherService weather;

    private double lat = 52.52;
    private double lng = 13.405;
    private LocalDate selectedDate = LocalDate.now();
    private String placeName = "Berlin, Deutschland";
    private ZonedDateTime now = ZonedDateTime.now();
    private DisplayMode mode = DisplayMode.SUN;
    private CloudData cloudData;

    private final OpenLayersMap map = new OpenLayersMap();

    private final H2 placeTitle = new H2();
    private final Span coordsLabel = new Span();
    private final TextField searchField = new TextField("Ort suchen");
    private final ListBox<PlaceResult> searchResults = new ListBox<>();
    private final ProgressBar searchProgress = new ProgressBar();
    private long searchRequestId = 0;
    private boolean applyingSelectedPlace = false;
    private final DatePicker datePicker = new DatePicker("Datum");
    private final Select<String> mapStyleSelect = new Select<>();
    private final RadioButtonGroup<DisplayMode> modeGroup = new RadioButtonGroup<>();
    private final VerticalLayout sunPanel = new VerticalLayout();
    private final VerticalLayout moonPanel = new VerticalLayout();
    private final VerticalLayout cloudPanel = new VerticalLayout();
    private final Div cloudStatsGrid = new Div();
    private final H3 cloudVisibility = new H3("—");
    private final Span cloudStatus = new Span();

    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> reverseGeocodeTask;

    public SunMapView(GeocodingService geocoding, WeatherService weather) {
        this.geocoding = geocoding;
        this.weather = weather;

        setSizeFull();
        setPadding(false);
        setSpacing(false);

        add(buildHeader(), buildMainContent());
        bindEvents();
        refreshAll();
    }

    private Component buildHeader() {
        Header header = new Header();
        header.getStyle()
                .set("border-bottom", "1px solid var(--lumo-contrast-10pct)")
                .set("background", "var(--lumo-base-color)");

        VerticalLayout wrapper = new VerticalLayout(
                new H1("Sonne · Karte"),
                new Paragraph(
                        "Klicke auf die Karte oder ziehe die Markierung, um Sonnenauf- und -untergang für jeden Ort zu sehen."));
        wrapper.setPadding(true);
        wrapper.setSpacing(false);
        wrapper.setWidthFull();
        wrapper.setMaxWidth("72rem");
        wrapper.getStyle().set("margin", "0 auto");
        header.add(wrapper);
        return header;
    }

    private Component buildMainContent() {
        SplitLayout split = new SplitLayout();
        split.setSizeFull();
        split.setOrientation(SplitLayout.Orientation.HORIZONTAL);
        split.setSplitterPosition(70);

        map.setSizeFull();
        map.setHeight("100%");
        split.addToPrimary(map);

        VerticalLayout sidebar = new VerticalLayout();
        sidebar.setWidth("320px");
        sidebar.setPadding(true);
        sidebar.setSpacing(true);
        sidebar.getStyle().set("overflow", "auto");

        placeTitle.getStyle().set("margin", "0");
        coordsLabel.getStyle()
                .set("font-size", "var(--lumo-font-size-xs)")
                .set("color", "var(--lumo-secondary-text-color)");

        searchField.setPlaceholder("z. B. München, Paris, Tokio...");
        searchField.setValueChangeMode(ValueChangeMode.LAZY);
        searchField.setValueChangeTimeout(400);
        searchField.setWidthFull();

        searchResults.setWidthFull();
        searchResults.setVisible(false);
        searchResults.setMaxHeight("12rem");
        searchResults.setItemLabelGenerator(PlaceResult::displayName);

        searchProgress.setIndeterminate(true);
        searchProgress.setVisible(false);
        searchProgress.setWidthFull();

        datePicker.setValue(selectedDate);
        datePicker.setLocale(Locale.of("de", "CH"));
        datePicker.setWidthFull();

        DatePickerI18n chI18n = new DatePickerI18n()
        .setDateFormat("dd.MM.yyyy");
        
        datePicker.setI18n(chI18n);


        mapStyleSelect.setLabel("Kartenstil");
        mapStyleSelect.setItems("Strassen", "Satellit","Hybrid");
        mapStyleSelect.setValue("Strassen");
        mapStyleSelect.setWidthFull();

        modeGroup.setLabel("Anzeige");
        modeGroup.setItems(DisplayMode.SUN, DisplayMode.MOON, DisplayMode.CLOUDS);
        modeGroup.setItemLabelGenerator(m -> switch (m) {
            case SUN -> "☀️ Sonne";
            case MOON -> "🌙 Mond";
            case CLOUDS -> "☁️ Wolken";
        });
        modeGroup.setValue(DisplayMode.SUN);
        modeGroup.setWidthFull();

        buildCloudPanel();
        moonPanel.setVisible(false);
        cloudPanel.setVisible(false);
        sunPanel.setPadding(false);
        sunPanel.setSpacing(true);
        moonPanel.setPadding(false);
        moonPanel.setSpacing(true);

        sidebar.add(
                placeTitle,
                coordsLabel,
                searchField,
                searchProgress,
                searchResults,
                datePicker,
                mapStyleSelect,
                modeGroup,
                sunPanel,
                moonPanel,
                cloudPanel);
        split.addToSecondary(sidebar);
        return split;
    }

    private void bindEvents() {
        map.addPositionChangeListener(e -> updatePosition(e.getLat(), e.getLng()));
        map.getStyle().setHeight("100%");

        searchField.addValueChangeListener(e -> searchPlaces(e.getValue()));

        searchResults.addValueChangeListener(e -> {
            PlaceResult result = e.getValue();
            if (result != null) {
                selectPlace(result);
            }
        });

        datePicker.addValueChangeListener(e -> {
            if (e.getValue() != null) {
                selectedDate = e.getValue();
                refreshAll();
            }
        });

        mapStyleSelect.addValueChangeListener(e -> {
            if ("Hybrid".equals(e.getValue())) { 
                map.setBaseStyle("hybrid");
            }
            else {
            map.setBaseStyle("Satellit".equals(e.getValue()) ? "satellite" : "streets");
            }
        });

        modeGroup.addValueChangeListener(e -> {
            mode = e.getValue();
            refreshAll();
        });
    }

    private void updatePosition(double newLat, double newLng) {
        lat = newLat;
        lng = newLng;
        scheduleReverseGeocode();
        refreshAll();
    }

    private void selectPlace(PlaceResult place) {
        lat = place.lat();
        lng = place.lng();
        placeName = place.displayName();
        applyingSelectedPlace = true;
        searchField.setValue(place.displayName());
        applyingSelectedPlace = false;
        searchResults.setVisible(false);
        searchResults.clear();
        map.flyTo(lat, lng, 11);
        refreshAll();
    }

    private void searchPlaces(String query) {
        if (applyingSelectedPlace) {
            // the field was just updated to the chosen place, no need to search again
            return;
        }
        if (query == null || query.isBlank()) {
            searchResults.setVisible(false);
            searchProgress.setVisible(false);
            return;
        }
        long requestId = ++searchRequestId;
        getUI().ifPresent(ui -> {
            searchProgress.setVisible(true);
            CompletableFuture
                    .supplyAsync(() -> geocoding.search(query))
                    .thenAccept(results -> ui.access(() -> {
                        if (requestId != searchRequestId) {
                            // a newer search was started in the meantime, ignore this stale result
                            return;
                        }
                        searchProgress.setVisible(false);
                        searchResults.setItems(results);
                        searchResults.setVisible(!results.isEmpty());
                    }));
        });
    }

    private void scheduleReverseGeocode() {
        if (reverseGeocodeTask != null) {
            reverseGeocodeTask.cancel(false);
        }
        if (scheduler == null) {
            return;
        }
        reverseGeocodeTask = scheduler.schedule(() -> getUI().ifPresent(ui -> {
            CompletableFuture
                    .supplyAsync(() -> geocoding.reverseGeocode(lat, lng))
                    .thenAccept(opt -> ui.access(() -> opt.ifPresent(name -> {
                        placeName = name;
                        placeTitle.setText(name);
                    })));
        }), 400, TimeUnit.MILLISECONDS);
    }

    private void refreshAll() {
        placeTitle.setText(placeName);
        coordsLabel.setText("%.4f, %.4f".formatted(lat, lng));
        map.setCenter(lat, lng);
        updateSunMoonRays();
        updateModePanels();
        if (mode == DisplayMode.CLOUDS) {
            loadCloudData();
        }
    }

    private void updateSunMoonRays() {
        List<MapRay> rays = new ArrayList<>();
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime noon = selectedDate.atTime(12, 0).atZone(zone);
        boolean isToday = selectedDate.equals(LocalDate.now());
        ZonedDateTime reference = isToday ? now : noon;

        if (mode == DisplayMode.SUN) {
            SunTimes times = SunTimes.compute().on(selectedDate).at(lat, lng).execute();
            if (times.getRise() != null) {
                SunPosition risePos = SunPosition.compute().on(times.getRise()).at(lat, lng).execute();
                rays.add(
                        ray(risePos.getAzimuth(), "#f59e0b", "🌅 Sonnenaufgang " + formatTime(times.getRise()), false));
            }
            if (times.getSet() != null) {
                SunPosition setPos = SunPosition.compute().on(times.getSet()).at(lat, lng).execute();
                rays.add(
                        ray(setPos.getAzimuth(), "#ef4444", "🌇 Sonnenuntergang " + formatTime(times.getSet()), false));
            }
            SunPosition nowPos = SunPosition.compute().on(reference).at(lat, lng).execute();
            boolean above = nowPos.getAltitude() > 0;
            rays.add(ray(nowPos.getAzimuth(), above ? "#eab308" : "#64748b",
            "☀️ Aktuell" + formatTime(reference) + " · %.1f°".formatted(nowPos.getAltitude()), !above));

        } else if (mode == DisplayMode.MOON) {
            MoonTimes moonTimes = MoonTimes.compute().on(selectedDate).at(lat, lng).execute();
            if (moonTimes.getRise() != null) {
                MoonPosition risePos = MoonPosition.compute().on(moonTimes.getRise()).at(lat, lng).execute();
                rays.add(ray(risePos.getAzimuth(), "#60a5fa", "🌙 Mondaufgang " + formatTime(moonTimes.getRise()),
                        false));
            }
            if (moonTimes.getSet() != null) {
                MoonPosition setPos = MoonPosition.compute().on(moonTimes.getSet()).at(lat, lng).execute();
                rays.add(ray(setPos.getAzimuth(), "#7c3aed", "🌒 Monduntergang " + formatTime(moonTimes.getSet()),
                        false));
            }
            MoonPosition moonNow = MoonPosition.compute().on(reference).at(lat, lng).execute();
            boolean above = moonNow.getAltitude() > 0;
            rays.add(ray(moonNow.getAzimuth(), above ? "#a78bfa" : "#475569",
                    "🌝 Mond aktuell · %.1f°".formatted(moonNow.getAltitude()), !above));
        }
        map.setRays(rays);
    }

    private MapRay ray(double azimuthDeg, String color, String label, boolean dashed) {
        double[] end = rayEndpoint(lat, lng, azimuthDeg, 10);
        return new MapRay(end[0], end[1], color, label, dashed);
    }

    private static double[] rayEndpoint(double lat, double lng, double azimuthDeg, double distKm) {
        double earthRadiusKm = 6371;
        double angularDistance = distKm / earthRadiusKm;
        double latRad = Math.toRadians(lat);
        double lngRad = Math.toRadians(lng);
        double bearingRad = Math.toRadians(azimuthDeg);
        double lat2 = Math.asin(Math.sin(latRad) * Math.cos(angularDistance)
                + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad));
        double lng2 = lngRad + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
                Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2));
        return new double[] { Math.toDegrees(lat2), Math.toDegrees(lng2) };
    }

    private void updateModePanels() {
        sunPanel.setVisible(mode == DisplayMode.SUN);
        moonPanel.setVisible(mode == DisplayMode.MOON);
        cloudPanel.setVisible(mode == DisplayMode.CLOUDS);

        if (mode == DisplayMode.SUN) {
            updateSunPanel();
        } else if (mode == DisplayMode.MOON) {
            updateMoonPanel();
        } else {
            updateCloudPanel();
        }
    }

    private void updateSunPanel() {
        sunPanel.removeAll();

        SunTimes visual = SunTimes.compute().on(selectedDate).at(lat, lng).execute();
        SunTimes dawn = SunTimes.compute().on(selectedDate).at(lat, lng).twilight(SunTimes.Twilight.CIVIL)
                .execute();
        SunTimes golden = SunTimes.compute().on(selectedDate).at(lat, lng)
                .twilight(SunTimes.Twilight.GOLDEN_HOUR).execute();

        sunPanel.add(createStatGrid(
                stat("🌅 Sonnenaufgang", formatTime(visual.getRise())),
                stat("🌇 Sonnenuntergang", formatTime(visual.getSet())),
                stat("☀️ Sonnenhöchststand", formatTime(visual.getNoon())),
                stat("🌄 Goldene Stunde", formatTime(golden.getRise())),
                stat("🌫️ Morgendämmerung", formatTime(dawn.getRise())),
                stat("🌌 Abenddämmerung", formatTime(dawn.getSet()))));

        if (visual.getRise() != null && visual.getSet() != null) {
            Duration dayLength = Duration.between(visual.getRise(), visual.getSet());
            Div dayLengthBox = new Div(
                    new Span("Tageslänge"),
                    new H3("%dh %dmin".formatted(dayLength.toHours(), dayLength.toMinutesPart())));
            dayLengthBox.getStyle()
                    .set("background", "var(--lumo-contrast-5pct)")
                    .set("border-radius", "var(--lumo-border-radius-m)")
                    .set("padding", "var(--lumo-space-m)");
            sunPanel.add(dayLengthBox);
        }

        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime reference = selectedDate.equals(LocalDate.now()) ? now
                : selectedDate.atTime(12, 0).atZone(zone);
        SunPosition current = SunPosition.compute().on(reference).at(lat, lng).execute();
        sunPanel.add(new Paragraph(selectedDate.equals(LocalDate.now())
                ? "Aktuell: Höhe %.1f° · Azimut %.0f°".formatted(current.getAltitude(), current.getAzimuth())
                : "Aktuelle Linie zeigt Sonnenstand zum Mittag (anderes Datum gewählt)."));
    }

    private void updateMoonPanel() {
        moonPanel.removeAll();
        ZoneId zone = ZoneId.systemDefault();

        MoonTimes moonTimes = MoonTimes.compute().on(selectedDate).at(lat, lng).execute();
        MoonIllumination illum = MoonIllumination.compute().on(selectedDate).execute();

        moonPanel.add(createStatGrid(
                stat("🌙 Mondaufgang", formatTime(moonTimes.getRise())),
                stat("🌒 Monduntergang", formatTime(moonTimes.getSet())),
                stat("✨ Beleuchtet", Math.round(illum.getFraction() * 100) + " %"),
                stat("🌖 Phase", moonPhaseLabel(illum.getPhase()))));

        ZonedDateTime reference = selectedDate.equals(LocalDate.now()) ? now
                : selectedDate.atTime(12, 0).atZone(zone);
        MoonPosition current = MoonPosition.compute().on(reference).at(lat, lng).execute();
        String details = selectedDate.equals(LocalDate.now())
                ? "Aktuell: Höhe %.1f° · Azimut %.0f°".formatted(current.getAltitude(), current.getAzimuth())
                : "Aktuelle Linie zeigt Mondstand zum Mittag (anderes Datum gewählt).";
        if (current.getAltitude() <= 0) {
            details += " · Mond unter Horizont";
        }
        moonPanel.add(new Paragraph(details));
    }

    private void buildCloudPanel() {
        cloudPanel.setPadding(false);
        cloudPanel.setSpacing(true);

        VerticalLayout layerBox = new VerticalLayout();
        layerBox.setPadding(false);
        layerBox.add(new Span("Layer ein-/ausblenden"));
        layerBox.add(
                cloudCheckbox("Tiefe Wolken (< 2 km)"),
                cloudCheckbox("Mittelhohe Wolken (2–6 km)"),
                cloudCheckbox("Hohe Wolken (> 6 km)"),
                cloudCheckbox("Nebel / Bodensicht"));

        cloudStatsGrid.getStyle()
                .set("display", "grid")
                .set("grid-template-columns", "1fr 1fr")
                .set("gap", "var(--lumo-space-s)");

        Div visibilityBox = new Div(new Span("Sichtweite"), cloudVisibility);
        visibilityBox.getStyle()
                .set("background", "var(--lumo-contrast-5pct)")
                .set("border-radius", "var(--lumo-border-radius-m)")
                .set("padding", "var(--lumo-space-m)");

        cloudStatus.getStyle()
                .set("font-size", "var(--lumo-font-size-xs)")
                .set("color", "var(--lumo-secondary-text-color)");

        cloudPanel.add(layerBox, cloudStatsGrid, visibilityBox, cloudStatus);
    }

    private Checkbox cloudCheckbox(String label) {
        Checkbox checkbox = new Checkbox(label, true);
        checkbox.setEnabled(false);
        checkbox.setHelperText("Wolken-Heatmap: optional per Canvas-Layer erweiterbar");
        return checkbox;
    }

    private void loadCloudData() {
        cloudStatus.setText("Lade Wetterdaten…");
        getUI().ifPresent(ui -> CompletableFuture
                .supplyAsync(() -> weather.fetchCurrent(lat, lng))
                .thenAccept(opt -> ui.access(() -> {
                    cloudData = opt.orElse(null);
                    updateCloudPanel();
                })));
    }

    private void updateCloudPanel() {
        if (cloudData == null) {
            cloudStatsGrid.removeAll();
            cloudVisibility.setText("—");
            cloudStatus.setText("Keine Daten verfügbar");
            return;
        }
        cloudStatsGrid.removeAll();
        cloudStatsGrid.add(
                stat("🟢 Tief", cloudData.low() + " %"),
                stat("🔵 Mittel", cloudData.mid() + " %"),
                stat("⚪ Hoch", cloudData.high() + " %"),
                stat("🟫 Nebel", cloudData.fog() + " %"));
        cloudVisibility.setText("%.1f km".formatted(cloudData.visibility() / 1000.0));
        cloudStatus.setText("Daten: Open-Meteo (aktuell, kostenlos)");
    }

    @Override
    protected void onAttach(AttachEvent attachEvent) {
        super.onAttach(attachEvent);
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> getUI().ifPresent(ui -> ui.access(() -> {
            now = ZonedDateTime.now();
            if (selectedDate.equals(LocalDate.now())) {
                updateSunMoonRays();
                if (mode == DisplayMode.SUN) {
                    updateSunPanel();
                } else if (mode == DisplayMode.MOON) {
                    updateMoonPanel();
                }
            }
        })), 1, 1, TimeUnit.MINUTES);
    }

    @Override
    protected void onDetach(DetachEvent detachEvent) {
        if (reverseGeocodeTask != null) {
            reverseGeocodeTask.cancel(false);
        }
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        super.onDetach(detachEvent);
    }

    private static String formatTime(ZonedDateTime time) {
        return time == null ? "—" : time.format(TIME_FMT);
    }

    private static String moonPhaseLabel(double phase) {
        if (phase < 0.03 || phase > 0.97) {
            return "Neumond";
        }
        if (phase < 0.22) {
            return "Zunehmende Sichel";
        }
        if (phase < 0.28) {
            return "Erstes Viertel";
        }
        if (phase < 0.47) {
            return "Zunehmender Mond";
        }
        if (phase < 0.53) {
            return "Vollmond";
        }
        if (phase < 0.72) {
            return "Abnehmender Mond";
        }
        if (phase < 0.78) {
            return "Letztes Viertel";
        }
        return "Abnehmende Sichel";
    }

    private static Div stat(String label, String value) {
        Span valueSpan = new Span(value);
        valueSpan.getStyle().set("font-weight", "600");
        Div div = new Div(new Span(label), valueSpan);
        div.getStyle()
                .set("border", "1px solid var(--lumo-contrast-10pct)")
                .set("border-radius", "var(--lumo-border-radius-m)")
                .set("padding", "var(--lumo-space-s)");
        return div;
    }

    private static Component createStatGrid(Div... stats) {
        Div grid = new Div(stats);
        grid.getStyle()
                .set("display", "grid")
                .set("grid-template-columns", "1fr 1fr")
                .set("gap", "var(--lumo-space-s)");
        return grid;
    }
}
