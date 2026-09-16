package com.nutritionapp.food;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

final class FoodSearch {
    // Same transliteration in Java and PostgreSQL, without requiring an extension.
    private static final String ACCENTS = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿ";
    private static final String PLAIN = "aaaaaaeeeeiiiiooooouuuucnyy";

    private FoodSearch() {}

    static String normalize(String value) {
        var normalized = new StringBuilder(value.toLowerCase(Locale.ROOT));
        for (int i = 0; i < normalized.length(); i++) {
            int index = ACCENTS.indexOf(normalized.charAt(i));
            if (index >= 0) normalized.setCharAt(i, PLAIN.charAt(index));
        }
        return normalized.toString();
    }

    static List<String> terms(String query) {
        return Arrays.stream(normalize(query).split("[^\\p{L}\\p{N}]+"))
                .filter(term -> !term.isBlank()).distinct().toList();
    }

    static Specification<Food> specification(String query) {
        var terms = terms(query);
        return (root, criteriaQuery, builder) -> {
            var name = builder.function("translate", String.class, builder.lower(root.get("name")),
                    builder.literal(ACCENTS), builder.literal(PLAIN));
            return builder.and(terms.stream()
                    .map(term -> builder.like(name, "%" + term + "%"))
                    .toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
