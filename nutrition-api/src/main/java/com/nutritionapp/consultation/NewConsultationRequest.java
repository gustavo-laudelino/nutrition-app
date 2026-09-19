package com.nutritionapp.consultation;

import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

public record NewConsultationRequest(
        @NotNull(message = "Escolha o modelo do prontuário.") UUID templateId,
        @NotNull(message = "Informe a data da consulta.")
        @PastOrPresent(message = "A data da consulta não pode ser futura.") LocalDate date) {
}
