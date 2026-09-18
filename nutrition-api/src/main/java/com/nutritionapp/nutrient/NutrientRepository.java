package com.nutritionapp.nutrient;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NutrientRepository extends JpaRepository<Nutrient, String> {
    List<Nutrient> findAllByOrderByDisplayOrder();
}
