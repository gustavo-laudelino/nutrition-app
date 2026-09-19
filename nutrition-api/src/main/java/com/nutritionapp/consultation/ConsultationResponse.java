package com.nutritionapp.consultation;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public record ConsultationResponse(
        UUID id, UUID patientId, LocalDate date, Consultation.Status status, String templateName,
        List<ConsultationSection> sections, Map<String, JsonNode> answers,
        Instant firstCompletedAt, Instant completedAt, Instant reopenedAt, Instant updatedAt, Long version) {

    /** Line of the patient's consultation list. */
    public record Summary(UUID id, LocalDate date, Consultation.Status status, String templateName,
                          Instant firstCompletedAt, Instant completedAt, Instant reopenedAt, Instant updatedAt) {
        static Summary from(Consultation consultation) {
            return new Summary(consultation.getId(), consultation.getConsultationDate(), consultation.getStatus(),
                    consultation.getTemplateName(), consultation.getFirstCompletedAt(), consultation.getCompletedAt(),
                    consultation.getReopenedAt(), consultation.getUpdatedAt());
        }
    }

    /** Completing tells whether the measurements also updated the patient's registry. */
    public record Completion(ConsultationResponse consultation, boolean patientUpdated) {}

    @Override
    public String toString() { return "ConsultationResponse[redacted]"; }
}
