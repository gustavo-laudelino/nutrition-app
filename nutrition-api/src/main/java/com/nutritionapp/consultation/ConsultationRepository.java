package com.nutritionapp.consultation;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationRepository extends JpaRepository<Consultation, UUID> {
    Optional<Consultation> findByIdAndNutritionistIdAndDeletedAtIsNull(UUID id, UUID nutritionistId);

    List<Consultation> findByPatientIdAndNutritionistIdAndDeletedAtIsNullOrderByConsultationDateDescCreatedAtDesc(
            UUID patientId, UUID nutritionistId);
}
