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
    private final JpaFoodCatalog catalog = new JpaFoodCatalog(repository);

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

