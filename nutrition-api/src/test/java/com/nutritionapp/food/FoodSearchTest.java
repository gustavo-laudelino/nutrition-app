package com.nutritionapp.food;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FoodSearchTest {
    @Test
    void matchesReorderedAccentedAndPartialKeywords() {
        var name = FoodSearch.normalize("Frango, filé, sem pele");
        assertThat(FoodSearch.terms("  FILÉ frang  ")).containsExactly("file", "frang");
        assertThat(FoodSearch.terms("file frango").stream().allMatch(name::contains)).isTrue();
        assertThat(FoodSearch.terms("file bovino").stream().allMatch(name::contains)).isFalse();
    }

    @Test
    void treatsPunctuationAsSeparatorsAndNeverAsSqlWildcards() {
        assertThat(FoodSearch.terms("frango,%_file frango")).containsExactly("frango", "file");
        assertThat(FoodSearch.terms("  ")).isEmpty();
    }

    @Test
    void developmentCatalogUsesTheSameKeywordSemantics() {
        var catalog = new DevelopmentFoodCatalog();
        assertThat(catalog.search("SINTETICO alimento", 0, 2).totalElements()).isEqualTo(3);
        assertThat(catalog.search("sintetico inexistente", 0, 2).items()).isEmpty();
    }
}
