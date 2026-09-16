package com.nutritionapp.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "foods")
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "energy_kcal", precision = 19, scale = 6)
    private BigDecimal energyKcal;
    @Column(name = "protein_g", precision = 19, scale = 6)
    private BigDecimal proteinG;
    @Column(name = "carbohydrate_g", precision = 19, scale = 6)
    private BigDecimal carbohydrateG;
    @Column(name = "fat_g", precision = 19, scale = 6)
    private BigDecimal fatG;

    private String source;
    private String sourceCode;

    protected Food() {
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getEnergyKcal() { return energyKcal; }
    public BigDecimal getProteinG() { return proteinG; }
    public BigDecimal getCarbohydrateG() { return carbohydrateG; }
    public BigDecimal getFatG() { return fatG; }
    public String getSource() { return source; }
    public String getSourceCode() { return sourceCode; }
}
