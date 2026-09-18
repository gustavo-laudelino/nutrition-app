package com.nutritionapp.patient;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.UUID;

public record PatientResponse(
        UUID id, String name, LocalDate birthDate, Integer ageYears, Patient.Sex sex,
        String phone, String email, String notes,
        BigDecimal weightKg, BigDecimal heightCm, PatientContext.DriActivity driActivity, LocalDate measuredAt,
        boolean archived, Instant createdAt, Instant updatedAt, Long version) {

    /** Age in completed years on {@code today}; null without a birth date. */
    public static PatientResponse from(Patient patient, LocalDate today) {
        var birthDate = patient.getBirthDate();
        Integer ageYears = birthDate == null ? null : Period.between(birthDate, today).getYears();
        return new PatientResponse(patient.getId(), patient.getName(), birthDate, ageYears, patient.getSex(),
                patient.getPhone(), patient.getEmail(), patient.getNotes(),
                patient.getWeightKg(), patient.getHeightCm(), patient.getDriActivity(), patient.getMeasuredAt(),
                patient.isArchived(), patient.getCreatedAt(), patient.getUpdatedAt(), patient.getVersion());
    }

    @Override
    public String toString() { return "PatientResponse[redacted]"; }
}
