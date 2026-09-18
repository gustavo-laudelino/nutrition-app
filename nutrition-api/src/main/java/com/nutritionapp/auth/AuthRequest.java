package com.nutritionapp.auth;

import java.util.Locale;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies never print credentials: {@code toString} is redacted. */
public final class AuthRequest {
    private AuthRequest() {}

    public record Register(
            @NotBlank(message = "Informe o nome.")
            @Size(max = 120, message = "Use até 120 caracteres.") String name,
            @NotBlank(message = "Informe o e-mail.")
            @Email(message = "Informe um e-mail válido.")
            @Size(max = 254, message = "Use até 254 caracteres.") String email,
            @NotNull(message = "Informe a senha.")
            @Size(min = 8, max = 72, message = "A senha deve ter entre 8 e 72 caracteres.") String password) {
        public Register {
            name = name == null ? null : name.strip();
            email = normalizeEmail(email);
        }

        @Override
        public String toString() { return "Register[redacted]"; }
    }

    public record Login(
            @NotBlank(message = "Informe o e-mail.")
            @Email(message = "Informe um e-mail válido.")
            @Size(max = 254, message = "Use até 254 caracteres.") String email,
            @NotNull(message = "Informe a senha.") String password) {
        public Login {
            email = normalizeEmail(email);
        }

        @Override
        public String toString() { return "Login[redacted]"; }
    }

    /** Stored and compared trimmed and lower-case. */
    static String normalizeEmail(String value) {
        return value == null ? null : value.strip().toLowerCase(Locale.ROOT);
    }
}
