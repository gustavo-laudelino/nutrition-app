package com.nutritionapp.record;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A section of a template, in the request, the response and the starter template file. */
public record TemplateSectionData(
        @NotBlank(message = "Informe o nome da seção.")
        @Size(max = TemplateStructureRules.MAX_NAME, message = "Use até 60 caracteres.") String name,
        @NotNull(message = "Informe os campos da seção.") List<@NotNull(message = "Informe o campo.") @Valid TemplateFieldData> fields) {

    public TemplateSectionData {
        name = name == null ? null : name.strip();
    }
}
