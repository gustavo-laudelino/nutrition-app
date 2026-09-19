package com.nutritionapp.patient;

import java.math.BigDecimal;
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

/** Registered patient owned by one nutritionist. Measurements keep only the current values. */
@Entity
@Table(name = "patients")
public class Patient {
    public enum Sex { FEMALE, MALE }

    @Id
    private UUID id;
    @Column(nullable = false)
    private UUID nutritionistId;
    @Column(nullable = false, length = 120)
    private String name;
    private LocalDate birthDate;
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Sex sex;
    @Column(length = 30)
    private String phone;
    @Column(length = 254)
    private String email;
    @Column(length = 2000)
    private String notes;
    @Column(precision = 7, scale = 3)
    private BigDecimal weightKg;
    @Column(precision = 5, scale = 2)
    private BigDecimal heightCm;
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PatientContext.DriActivity driActivity;
    private LocalDate measuredAt;
    private Instant archivedAt;
    @Column(nullable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant updatedAt;
    @Version
    @Column(nullable = false)
    private Long version;

    protected Patient() {
    }

    public Patient(UUID nutritionistId, PatientRequest request) {
        this.id = UUID.randomUUID();
        this.nutritionistId = nutritionistId;
        this.createdAt = Instant.now();
        update(request);
    }

    public void update(PatientRequest request) {
        this.name = request.name();
        this.birthDate = request.birthDate();
        this.sex = request.sex();
        this.phone = request.phone();
        this.email = request.email();
        this.notes = request.notes();
        this.weightKg = request.weightKg();
        this.heightCm = request.heightCm();
        this.driActivity = request.driActivity();
        this.measuredAt = request.measuredAt();
        this.updatedAt = Instant.now();
    }

    /**
     * Measured in a completed consultation: only the given values change, and only when the consultation is not
     * older than the current measurements. Returns whether anything changed.
     */
    public boolean updateMeasurements(BigDecimal weightKg, BigDecimal heightCm, LocalDate measuredOn) {
        if (weightKg == null && heightCm == null) return false;
        if (measuredAt != null && measuredOn.isBefore(measuredAt)) return false;
        if (weightKg != null) this.weightKg = weightKg;
        if (heightCm != null) this.heightCm = heightCm;
        this.measuredAt = measuredOn;
        this.updatedAt = Instant.now();
        return true;
    }

    public void archive(boolean archived) {
        this.archivedAt = archived ? Instant.now() : null;
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getNutritionistId() { return nutritionistId; }
    public String getName() { return name; }
    public LocalDate getBirthDate() { return birthDate; }
    public Sex getSex() { return sex; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getNotes() { return notes; }
    public BigDecimal getWeightKg() { return weightKg; }
    public BigDecimal getHeightCm() { return heightCm; }
    public PatientContext.DriActivity getDriActivity() { return driActivity; }
    public LocalDate getMeasuredAt() { return measuredAt; }
    public boolean isArchived() { return archivedAt != null; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
