package com.nutritionapp.record;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecordTemplateRepository extends JpaRepository<RecordTemplate, UUID> {
    Optional<RecordTemplate> findByIdAndNutritionistId(UUID id, UUID nutritionistId);

    List<RecordTemplate> findByNutritionistId(UUID nutritionistId);

    long countByNutritionistId(UUID nutritionistId);
}
