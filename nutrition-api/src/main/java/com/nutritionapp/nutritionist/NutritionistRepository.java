package com.nutritionapp.nutritionist;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NutritionistRepository extends JpaRepository<Nutritionist, UUID> {
    Optional<Nutritionist> findByEmail(String email);

    boolean existsByEmail(String email);
}
