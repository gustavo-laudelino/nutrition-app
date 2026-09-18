package com.nutritionapp.nutrient;

import java.io.Serializable;
import java.math.BigDecimal;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/** Value of one nutrient for one food, per 100 g, with its source (read-only, imported by Flyway). */
@Entity
@Table(name = "food_nutrients")
public class FoodNutrient {
    @EmbeddedId
    private Id id;
    @MapsId("nutrientCode")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "nutrient_code")
    private Nutrient nutrient;
    @Column(precision = 19, scale = 6)
    private BigDecimal amount;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NutrientStatus status;
    @Column(nullable = false, length = 30)
    private String source;

    protected FoodNutrient() {
    }

    public Long foodId() { return id.foodId; }

    public FoodNutrientValue value() {
        return new FoodNutrientValue(nutrient.definition(), amount, status);
    }

    @Embeddable
    public static class Id implements Serializable {
        @Column(name = "food_id")
        private Long foodId;
        @Column(name = "nutrient_code", length = 40)
        private String nutrientCode;

        protected Id() {
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof Id id && java.util.Objects.equals(foodId, id.foodId)
                    && java.util.Objects.equals(nutrientCode, id.nutrientCode);
        }

        @Override
        public int hashCode() { return java.util.Objects.hash(foodId, nutrientCode); }
    }
}
