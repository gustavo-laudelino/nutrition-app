package com.nutritionapp.record;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Saving a template replaces its name and whole structure; catalog rules are in {@link TemplateStructureRules}. */
public record RecordTemplateRequest(
        @NotBlank(message = "Informe o nome do modelo.")
        @Size(max = TemplateStructureRules.MAX_NAME, message = "Use até 60 caracteres.") String name,
        @NotNull(message = "Informe a versão do modelo.")
        @PositiveOrZero(message = "Informe uma versão válida.") Long version,
        @NotNull(message = "Informe as seções.")
        @Size(min = 1, max = TemplateStructureRules.MAX_SECTIONS, message = "Use de 1 a 20 seções.")
        List<@NotNull(message = "Informe a seção.") @Valid TemplateSectionData> sections) {

    public RecordTemplateRequest {
        name = name == null ? null : name.strip();
    }
}
