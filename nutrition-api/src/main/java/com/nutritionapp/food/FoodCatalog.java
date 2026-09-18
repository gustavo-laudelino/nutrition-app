package com.nutritionapp.food;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import com.nutritionapp.nutrient.FoodNutrientValue;
import com.nutritionapp.nutrient.NutrientDefinition;

/** Read-only catalog, backed by PostgreSQL or explicitly synthetic development data. */
public interface FoodCatalog {
    FoodPage search(String name, int page, int size);
    FoodResponse findById(long id);
    /** Loads all foods at once, failing with the first missing id in iteration order. */
    Map<Long, FoodResponse> findAllById(Collection<Long> ids);
    /** Every nutrient of the catalog, in display order. */
    List<NutrientDefinition> nutrientDefinitions();
    /** Nutrients per 100 g of the given foods, in a single query; a food without records has no entry. */
    Map<Long, List<FoodNutrientValue>> nutrientsOf(Collection<Long> foodIds);
}
