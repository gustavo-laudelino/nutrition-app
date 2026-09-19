package com.nutritionapp.consultation;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A filled record of one patient's consultation. The template structure and the answers are JSON copies
 * (see {@link ConsultationSection}), so the record keeps what was asked and answered on that day.
 */
@Entity
@Table(name = "consultations")
public class Consultation {
    public enum Status { DRAFT, COMPLETED }

    @Id
    private UUID id;
    @Column(nullable = false)
    private UUID nutritionistId;
    @Column(nullable = false)
    private UUID patientId;
    private UUID templateId;
    @Column(nullable = false, length = 60)
    private String templateName;
    @Column(nullable = false, columnDefinition = "text")
    private String structure;
    @Column(nullable = false, columnDefinition = "text")
    private String answers;
    @Column(nullable = false)
    private LocalDate consultationDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status;
    private Instant firstCompletedAt;
    private Instant completedAt;
    private Instant reopenedAt;
    private Instant deletedAt;
    @Column(nullable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant updatedAt;
    @Version
    @Column(nullable = false)
    private Long version;

    protected Consultation() {
    }

    public Consultation(UUID nutritionistId, UUID patientId, UUID templateId, String templateName, String structure,
                        LocalDate date) {
        this.id = UUID.randomUUID();
        this.nutritionistId = nutritionistId;
        this.patientId = patientId;
        this.templateId = templateId;
        this.templateName = templateName;
        this.structure = structure;
        this.answers = "{}";
        this.consultationDate = date;
        this.status = Status.DRAFT;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public void save(LocalDate date, String answers) {
        this.consultationDate = date;
        this.answers = answers;
        this.updatedAt = Instant.now();
    }

    public void complete() {
        var now = Instant.now();
        this.status = Status.COMPLETED;
        if (firstCompletedAt == null) this.firstCompletedAt = now;
        this.completedAt = now;
        this.updatedAt = now;
    }

    /** Kept as the record that it changed after being completed. */
    public void reopen() {
        this.status = Status.DRAFT;
        this.reopenedAt = Instant.now();
        this.updatedAt = reopenedAt;
    }

    /** A consultation completed at least once is only hidden: health records must be kept. */
    public boolean mustBeKept() {
        return firstCompletedAt != null;
    }

    public void hide() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getNutritionistId() { return nutritionistId; }
    public UUID getPatientId() { return patientId; }
    public UUID getTemplateId() { return templateId; }
    public String getTemplateName() { return templateName; }
    public String getStructure() { return structure; }
    public String getAnswers() { return answers; }
    public LocalDate getConsultationDate() { return consultationDate; }
    public Status getStatus() { return status; }
    public Instant getFirstCompletedAt() { return firstCompletedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getReopenedAt() { return reopenedAt; }
    public boolean isDeleted() { return deletedAt != null; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
