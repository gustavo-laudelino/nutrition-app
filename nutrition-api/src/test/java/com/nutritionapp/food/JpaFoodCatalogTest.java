package com.nutritionapp.food;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class JpaFoodCatalogTest {
    private final FoodRepository repository = mock(FoodRepository.class);
    private final com.nutritionapp.nutrient.NutrientRepository nutrients = mock(com.nutritionapp.nutrient.NutrientRepository.class);
    private final com.nutritionapp.nutrient.FoodNutrientRepository foodNutrients = mock(com.nutritionapp.nutrient.FoodNutrientRepository.class);
    private final JpaFoodCatalog catalog = new JpaFoodCatalog(repository, nutrients, foodNutrients);

    @Test
    void groupsNutrientsByFoodFromASingleQuery() {
        var definition = new com.nutritionapp.nutrient.NutrientDefinition("CALCIUM", "Cálcio", "mg",
                com.nutritionapp.nutrient.NutrientCategory.MINERAL, 100, true);
        var calcium = new com.nutritionapp.nutrient.FoodNutrientValue(definition, new BigDecimal("5.2"), com.nutritionapp.nutrient.NutrientStatus.VALUE);
        var trace = new com.nutritionapp.nutrient.FoodNutrientValue(definition, BigDecimal.ZERO, com.nutritionapp.nutrient.NutrientStatus.TRACE);
        var first = mock(com.nutritionapp.nutrient.FoodNutrient.class);
        when(first.foodId()).thenReturn(10L); when(first.value()).thenReturn(calcium);
        var second = mock(com.nutritionapp.nutrient.FoodNutrient.class);
        when(second.foodId()).thenReturn(11L); when(second.value()).thenReturn(trace);
        when(foodNutrients.findByFoodIds(List.of(10L, 11L, 12L))).thenReturn(List.of(first, second));
        var result = catalog.nutrientsOf(List.of(10L, 11L, 12L));
        assertThat(result).containsOnlyKeys(10L, 11L);
        assertThat(result.get(10L)).containsExactly(calcium);
        verify(foodNutrients, times(1)).findByFoodIds(any());
        assertThat(catalog.nutrientsOf(List.of())).isEmpty();
        verifyNoMoreInteractions(foodNutrients);
    }

    @Test
    void retrievesStoredNutrientsAndSourceWithoutRecalculatingEnergy() {
        var food = storedFood();
        when(repository.findById(10L)).thenReturn(Optional.of(food));
        var result = catalog.findById(10L);
        assertThat(result).isEqualTo(new FoodResponse(10L, "Amostra de teste",
                new BigDecimal("130.123456"), new BigDecimal("3.123456"),
                new BigDecimal("28.123456"), new BigDecimal("1.123456"), "TEST_FIXTURE", "A-10"));
    }

    @Test
    void delegatesSearchWithStablePagination() {
        var pageable = PageRequest.of(0, 20, Sort.by("id"));
        var food = storedFood();
        when(repository.findAll(org.mockito.ArgumentMatchers.<org.springframework.data.jpa.domain.Specification<Food>>any(), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(food), pageable, 1));
        var result = catalog.search(" Amostra ", 0, 20);
        assertThat(result.items()).hasSize(1);
        assertThat(result.totalElements()).isEqualTo(1);
        verify(repository).findAll(org.mockito.ArgumentMatchers.<org.springframework.data.jpa.domain.Specification<Food>>any(), eq(pageable));
    }

    @Test
    void reportsMissingDatabaseItem() {
        when(repository.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> catalog.findById(999)).isInstanceOf(FoodNotFoundException.class);
    }

    @Test
    void loadsSeveralFoodsWithSingleRepositoryCall() {
        var food = storedFood();
        when(repository.findAllById(List.of(10L))).thenReturn(List.of(food));
        var result = catalog.findAllById(List.of(10L));
        assertThat(result).containsOnlyKeys(10L);
        verify(repository).findAllById(List.of(10L));
        verify(repository, never()).findById(anyLong());
    }

    @Test
    void reportsFirstMissingItemOfBatch() {
        var food = storedFood();
        when(repository.findAllById(List.of(10L, 998L, 999L))).thenReturn(List.of(food));
        assertThatThrownBy(() -> catalog.findAllById(List.of(10L, 998L, 999L)))
                .isInstanceOf(FoodNotFoundException.class).hasMessageContaining("998");
    }

    private Food storedFood() {
        var food = mock(Food.class);
        when(food.getId()).thenReturn(10L);
        when(food.getName()).thenReturn("Amostra de teste");
        when(food.getEnergyKcal()).thenReturn(new BigDecimal("130.123456"));
        when(food.getProteinG()).thenReturn(new BigDecimal("3.123456"));
        when(food.getCarbohydrateG()).thenReturn(new BigDecimal("28.123456"));
        when(food.getFatG()).thenReturn(new BigDecimal("1.123456"));
        when(food.getSource()).thenReturn("TEST_FIXTURE");
        when(food.getSourceCode()).thenReturn("A-10");
        return food;
    }
}

