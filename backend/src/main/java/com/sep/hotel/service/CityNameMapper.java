package com.sep.hotel.service;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Component
public class CityNameMapper {

    private static final Map<String, String> CITY_ALIASES = Map.of(
            "dusseldorf", "Düsseldorf",
            "duesseldorf", "Düsseldorf",
            "wien", "Vienna",
            "mailand", "Milan",
            "rom", "Rome",
            "madera", "Funchal",
            "madeira", "Funchal"
    );
    private static final Set<String> KNOWN_CITY_KEYS = knownCityKeys();

    public String normalize(String location) {
        String trimmed = location == null ? "" : location.trim();
        if (trimmed.isBlank()) {
            return trimmed;
        }
        return CITY_ALIASES.getOrDefault(trimmed.toLowerCase(), capitalize(trimmed));
    }

    public boolean isKnownCity(String location) {
        String normalized = normalize(location);
        if (normalized.isBlank()) {
            return false;
        }
        return KNOWN_CITY_KEYS.contains(cityKey(location))
                || KNOWN_CITY_KEYS.contains(cityKey(normalized));
    }

    private String capitalize(String value) {
        String[] words = value.toLowerCase().split("\\s+");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (!result.isEmpty()) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }

    private static Set<String> knownCityKeys() {
        Set<String> cities = new HashSet<>();
        String[] knownCities = {
                "Aachen", "Aalborg", "Aarhus", "Aberdeen", "Alicante", "Almere", "Amersfoort", "Amsterdam",
                "Angers", "Antwerp", "Antalya", "Athens", "Auckland", "Avignon", "Baden-Baden", "Bangkok",
                "Barcelona", "Bari", "Basel", "Bath", "Beijing", "Belfast", "Berlin", "Bern", "Bergen",
                "Bergamo", "Bielefeld", "Bilbao", "Birmingham", "Bonn", "Bochum", "Bologna", "Boston",
                "Bordeaux", "Bremen", "Brighton", "Bristol", "Brisbane", "Brussels", "Bruges", "Brno",
                "Budapest", "Buenos Aires", "Cairo", "Cancun", "Cape Town", "Cardiff", "Catania", "Chicago",
                "Clermont-Ferrand", "Coimbra", "Colombo", "Copenhagen", "Cork", "Darmstadt", "Dallas",
                "Delft", "Delhi", "Doha", "Dortmund", "Dresden", "Dubai", "Dublin", "Duisburg", "Düsseldorf",
                "Eindhoven", "Edinburgh", "Essen", "Exeter", "Faro", "Florence", "Frankfurt", "Freiburg",
                "Gdansk", "Geneva", "Genoa", "Ghent", "Glasgow", "Gothenburg", "Graz", "Groningen",
                "Haarlem", "Halle", "Hamburg", "Hanover", "Hanoi", "Heidelberg", "Helsinki", "Heraklion",
                "Hong Kong", "Honolulu", "Houston", "Innsbruck", "Istanbul", "Jakarta", "Johannesburg",
                "Karlsruhe", "Kassel", "Kiel", "Klagenfurt", "Köln", "Krakow", "Kyoto", "Las Vegas",
                "La Rochelle", "Lausanne", "Leeds", "Leicester", "Leipzig", "Lille", "Limerick", "Linz",
                "Lisbon", "Liverpool", "Ljubljana", "London", "Los Angeles", "Lübeck", "Lugano", "Lyon",
                "Madrid", "Malaga", "Malmö", "Manchester", "Marseille", "Marrakech", "Melbourne", "Metz",
                "Mexico City", "Miami", "Milan", "Montreal", "Montpellier", "Moscow", "Mumbai", "Münster",
                "München", "Nantes", "Naples", "New Orleans", "New York", "Newcastle", "Nice", "Nottingham",
                "Nuremberg", "Odense", "Olomouc", "Orlando", "Osaka", "Oslo", "Oxford", "Palermo", "Paris",
                "Parma", "Pisa", "Philadelphia", "Portsmouth", "Porto", "Prague", "Reims", "Rennes",
                "Rhodes", "Rio de Janeiro", "Rome", "Rotterdam", "Salzburg", "San Diego", "San Francisco",
                "San Sebastian", "Santiago de Compostela", "Sao Paulo", "Seattle", "Seoul", "Seville",
                "Shanghai", "Sheffield", "Singapore", "Southampton", "Split", "Stockholm", "Strasbourg",
                "Stuttgart", "Sydney", "Taipei", "Tampere", "Thessaloniki", "Tokyo", "Toulouse", "Toronto",
                "Tromso", "Trondheim", "Turin", "Turku", "Utrecht", "Valencia", "Vancouver", "Venice",
                "Verona", "Vienna", "Warsaw", "Wroclaw", "Zagreb", "Zaragoza", "Zurich", "Augsburg",
                "Braunschweig", "Chemnitz", "Erfurt", "Gelsenkirchen", "Jena", "Mainz", "Magdeburg",
                "Mannheim", "Mönchengladbach", "Oberhausen", "Potsdam", "Regensburg", "Rostock",
                "Saarbrücken", "Wiesbaden", "Wuppertal", "Amiens", "Brest", "Dijon", "Grenoble",
                "Le Havre", "Nancy", "Nimes", "Orleans", "Rouen", "Saint-Etienne", "Toulon", "Tours",
                "Trieste", "Padua", "Perugia", "Rimini", "Siena", "Cordoba", "Granada", "Murcia",
                "Palma de Mallorca", "Toledo", "The Hague", "Leiden", "Maastricht", "Nijmegen", "Tilburg",
                "Arnhem", "Breda", "Leuven", "Liege", "Namur", "Ostend", "Mechelen", "Sankt Polten",
                "Villach", "Winterthur", "Lucerne", "St. Gallen", "Interlaken", "Katowice", "Lodz",
                "Poznan", "Szczecin", "Lublin", "Bydgoszcz", "Plzen", "Ceske Budejovice", "Karlovy Vary",
                "Guimaraes", "Braga", "Aveiro", "Evora", "Patras", "Volos", "Larissa", "Uppsala",
                "Lund", "Umea", "Stavanger", "Kristiansand", "Esbjerg", "Roskilde", "Vantaa", "Espoo",
                "Pecs", "Szeged", "Debrecen", "Galway", "Kilkenny", "Cambridge", "York", "Inverness",
                "Stirling", "Dubrovnik", "Rijeka", "Zadar", "Pula", "Ankara", "Izmir", "Bursa", "Konya",
                "Bodrum", "Washington", "Funchal", "Madeira",
                "Dusseldorf", "Duesseldorf", "Wien", "Mailand", "Rom", "Madera"
        };
        for (String city : knownCities) {
            cities.add(cityKey(city));
        }
        CITY_ALIASES.keySet().forEach(alias -> cities.add(cityKey(alias)));
        CITY_ALIASES.values().forEach(city -> cities.add(cityKey(city)));
        return Set.copyOf(cities);
    }

    private static String cityKey(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return ascii
                .replace("ä", "ae")
                .replace("ö", "oe")
                .replace("ü", "ue")
                .replace("ß", "ss")
                .replaceAll("[^a-z0-9]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }
}
