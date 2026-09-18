package com.nutritionapp;

import com.nutritionapp.nutritionist.NutritionistRepository;
import com.nutritionapp.patient.PatientRepository;
import com.nutritionapp.record.RecordTemplateRepository;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import static org.mockito.Mockito.mock;

/** The test profile has no database: repositories are Mockito mocks. */
@TestConfiguration
public class RepositoryTestConfiguration {
    @Bean
    NutritionistRepository nutritionistRepository() {
        return mock(NutritionistRepository.class);
    }

    @Bean
    PatientRepository patientRepository() {
        return mock(PatientRepository.class);
    }

    @Bean
    RecordTemplateRepository recordTemplateRepository() {
        return mock(RecordTemplateRepository.class);
    }
}
