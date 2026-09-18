package com.nutritionapp.food;

import com.nutritionapp.shared.TextSearch;
import org.springframework.data.jpa.domain.Specification;

final class FoodSearch {
    private FoodSearch() {}

    static Specification<Food> specification(String query) {
        var terms = TextSearch.terms(query);
        return (root, criteriaQuery, builder) ->
                builder.and(TextSearch.matchAll(builder, root.get("name"), terms));
    }
}
