package com.nutritionapp.food;

import java.util.Collection;
import java.util.Map;

/** Read-only catalog, backed by PostgreSQL or explicitly synthetic development data. */
public interface FoodCatalog {
    FoodPage search(String name, int page, int size);
    FoodResponse findById(long id);
    /** Loads all foods at once, failing with the first missing id in iteration order. */
    Map<Long, FoodResponse> findAllById(Collection<Long> ids);
}
