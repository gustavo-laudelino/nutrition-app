package com.nutritionapp.shared;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

/** Word search ignoring accents, case and order: every term must appear in the value. */
public final class TextSearch {
    // Same transliteration in Java and PostgreSQL, without requiring an extension.
    private static final String ACCENTS = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿ";
    private static final String PLAIN = "aaaaaaeeeeiiiiooooouuuucnyy";

    private TextSearch() {}

    public static String normalize(String value) {
        var normalized = new StringBuilder(value.toLowerCase(Locale.ROOT));
        for (int i = 0; i < normalized.length(); i++) {
            int index = ACCENTS.indexOf(normalized.charAt(i));
            if (index >= 0) normalized.setCharAt(i, PLAIN.charAt(index));
        }
        return normalized.toString();
    }

    /** Punctuation separates terms, so {@code %} and {@code _} never reach LIKE as wildcards. */
    public static List<String> terms(String query) {
        return Arrays.stream(normalize(query).split("[^\\p{L}\\p{N}]+"))
                .filter(term -> !term.isBlank()).distinct().toList();
    }

    /** One LIKE predicate per term over the column normalized in the database. */
    public static Predicate[] matchAll(CriteriaBuilder builder, Expression<String> column, List<String> terms) {
        var normalized = builder.function("translate", String.class, builder.lower(column),
                builder.literal(ACCENTS), builder.literal(PLAIN));
        return terms.stream()
                .map(term -> builder.like(normalized, "%" + term + "%"))
                .toArray(Predicate[]::new);
    }
}
