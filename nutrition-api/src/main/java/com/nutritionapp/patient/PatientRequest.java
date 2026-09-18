package com.nutritionapp.patient;

import java.math.BigDecimal;
import java.time.LocalDate;
import com.nutritionapp.api.ApiFailure;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Create and update body. Limits are technical, not nutritional; weight/height digits match {@link PatientContext}. */
public record PatientRequest(
        @NotBlank(message = "Informe o nome.")
        @Size(max = 120, message = "Use até 120 caracteres.") String name,
        @PastOrPresent(message = "A data de nascimento não pode ser futura.") LocalDate birthDate,
        Patient.Sex sex,
        @Size(max = 30, message = "Use até 30 caracteres.") String phone,
        @Email(message = "Informe um e-mail válido.")
        @Size(max = 254, message = "Use até 254 caracteres.") String email,
        @Size(max = 2000, message = "Use até 2000 caracteres.") String notes,
        @Positive(message = "Informe um peso positivo.")
        @Digits(integer = 4, fraction = 3, message = "Use até 4 inteiros e 3 decimais.") BigDecimal weightKg,
        @Positive(message = "Informe uma altura positiva.")
        @Digits(integer = 3, fraction = 2, message = "Use até 3 inteiros e 2 decimais.") BigDecimal heightCm,
        PatientContext.DriActivity driActivity,
        @PastOrPresent(message = "A data das medidas não pode ser futura.") LocalDate measuredAt,
        // Required only on update; checked by PatientService.
        @PositiveOrZero(message = "Informe uma versão válida.") Long version) {
    private static final LocalDate MIN_BIRTH_DATE = LocalDate.of(1900, 1, 1);

    public PatientRequest {
        name = name == null ? null : name.strip();
    }

    public void validateDates() {
        if (birthDate != null && birthDate.isBefore(MIN_BIRTH_DATE))
            throw new ApiFailure(400, "birthDate", "A data de nascimento não pode ser anterior a 01/01/1900.");
    }

    @Override
    public String toString() { return "PatientRequest[redacted]"; }
}
