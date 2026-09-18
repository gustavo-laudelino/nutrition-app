package com.nutritionapp.nutrient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Nutrient catalog entry (read-only, seeded by Flyway). */
@Entity
@Table(name = "nutrients")
public class Nutrient {
    @Id
    @Column(length = 40)
    private String code;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(nullable = false, length = 10)
    private String unit;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NutrientCategory category;
    @Column(nullable = false)
    private int displayOrder;
    @Column(nullable = false)
    private boolean inReport;

    protected Nutrient() {
    }

    public NutrientDefinition definition() {
        return new NutrientDefinition(code, name, unit, category, displayOrder, inReport);
    }
}
