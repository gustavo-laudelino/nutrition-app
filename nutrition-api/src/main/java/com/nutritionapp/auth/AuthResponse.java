package com.nutritionapp.auth;

import java.time.Instant;
import java.util.UUID;
import com.nutritionapp.nutritionist.Nutritionist;

public record AuthResponse(String accessToken, String tokenType, Instant expiresAt, Profile nutritionist) {
    @Override
    public String toString() { return "AuthResponse[redacted]"; }

    public record Profile(UUID id, String name, String email) {
        public static Profile from(Nutritionist nutritionist) {
            return new Profile(nutritionist.getId(), nutritionist.getName(), nutritionist.getEmail());
        }
    }
}
