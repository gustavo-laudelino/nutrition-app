package com.nutritionapp.record;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** A catalog field placed in a section: its width on the sheet and, for long text, its height in lines. */
public record TemplateFieldData(
        @NotBlank(message = "Informe o campo.") String code,
        @NotNull(message = "Informe a largura.") Width width,
        Integer textRows) {

    /** Share of the sheet's 12-column grid. */
    public enum Width { THIRD, HALF, TWO_THIRDS, FULL }
}
