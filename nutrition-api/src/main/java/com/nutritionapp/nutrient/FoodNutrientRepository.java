package com.nutritionapp.nutrient;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FoodNutrientRepository extends JpaRepository<FoodNutrient, FoodNutrient.Id> {
    /** Every nutrient of the given foods with its definition, in a single query. */
    @Query("select value from FoodNutrient value join fetch value.nutrient where value.id.foodId in :foodIds")
    List<FoodNutrient> findByFoodIds(@Param("foodIds") Collection<Long> foodIds);
}
