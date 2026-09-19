package com.nutritionapp.consultation;

import java.time.LocalDate;
import java.util.Map;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.PositiveOrZero;
import tools.jackson.databind.JsonNode;

/** Saving a draft: date and every answer by field code (absent or null = not answered). */
public record ConsultationRequest(
        @NotNull(message = "Informe a data da consulta.")
        @PastOrPresent(message = "A data da consulta não pode ser futura.") LocalDate date,
        @NotNull(message = "Informe a versão da consulta.")
        @PositiveOrZero(message = "Informe uma versão válida.") Long version,
        @NotNull(message = "Informe as respostas.") Map<String, JsonNode> answers) {

    /** Completing or reopening only needs the version the screen has. */
    public record Version(
            @NotNull(message = "Informe a versão da consulta.")
            @PositiveOrZero(message = "Informe uma versão válida.") Long version) {}

    @Override
    public String toString() { return "ConsultationRequest[redacted]"; }
}
