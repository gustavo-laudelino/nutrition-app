package com.nutritionapp.food;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FoodSearchTest {
    @Test
    void developmentCatalogUsesTheSameKeywordSemantics() {
        var catalog = new DevelopmentFoodCatalog();
        assertThat(catalog.search("SINTETICO alimento", 0, 2).totalElements()).isEqualTo(3);
        assertThat(catalog.search("sintetico inexistente", 0, 2).items()).isEmpty();
    }
}
