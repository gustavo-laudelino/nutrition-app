package com.nutritionapp.record;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A new template starts empty (one section) or as a copy of the system's starter template. */
public record NewRecordTemplateRequest(
        @NotBlank(message = "Informe o nome do modelo.")
        @Size(max = TemplateStructureRules.MAX_NAME, message = "Use até 60 caracteres.") String name,
        @NotNull(message = "Escolha como começar o modelo.") Source source) {

    public enum Source { BLANK, STARTER }

    public NewRecordTemplateRequest {
        name = name == null ? null : name.strip();
    }
}
