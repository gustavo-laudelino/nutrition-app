package com.nutritionapp.calculation;

import java.math.BigDecimal;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Desired amount of one nutrient from a food; the portion weight is derived from it. */
public record PortionQuantityRequest(
        @NotNull(message = "Informe o alimento.")
        @Positive(message = "Informe um alimento válido.") Long foodId,
        @NotNull(message = "Informe o nutriente.") Nutrient nutrient,
        @NotNull(message = "Informe a quantidade desejada.")
        @Positive(message = "Informe uma quantidade maior que zero.")
        @Digits(integer = 7, fraction = 3, message = "Use até 7 inteiros e 3 decimais.") BigDecimal amount) {

    public enum Nutrient { ENERGY, CARBOHYDRATE, PROTEIN, FAT }
}
