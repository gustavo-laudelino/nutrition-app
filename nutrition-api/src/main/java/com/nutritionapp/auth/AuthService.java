package com.nutritionapp.auth;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.nutritionist.Nutritionist;
import com.nutritionapp.nutritionist.NutritionistRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    // BCrypt only reads the first 72 bytes: longer passwords are rejected, never silently truncated.
    private static final int BCRYPT_MAX_BYTES = 72;

    private final NutritionistRepository repository;
    private final PasswordEncoder passwords;
    private final JwtTokens tokens;
    // Checked when the e-mail does not exist, so both login failures do the same work.
    private final String dummyHash;

    public AuthService(NutritionistRepository repository, PasswordEncoder passwords, JwtTokens tokens) {
        this.repository = repository;
        this.passwords = passwords;
        this.tokens = tokens;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    public AuthResponse register(AuthRequest.Register request) {
        if (exceedsBcryptLimit(request.password()))
            throw new ApiFailure(400, "password",
                    "A senha excede o limite de 72 bytes do BCrypt (acentos podem ocupar mais de um byte).");
        if (repository.existsByEmail(request.email())) throw duplicateEmail();
        var nutritionist = new Nutritionist(request.name(), request.email(), passwords.encode(request.password()));
        try {
            repository.saveAndFlush(nutritionist);
        } catch (DataIntegrityViolationException exception) {
            // Concurrent registration with the same e-mail reached the unique constraint.
            throw duplicateEmail();
        }
        return tokens.issue(nutritionist);
    }

    /** Unknown e-mail and wrong password produce the same generic 401. */
    public AuthResponse login(AuthRequest.Login request) {
        var nutritionist = repository.findByEmail(request.email());
        var hash = nutritionist.map(Nutritionist::getPasswordHash).orElse(dummyHash);
        boolean matches = !exceedsBcryptLimit(request.password()) && passwords.matches(request.password(), hash);
        if (nutritionist.isEmpty() || !matches) throw new ApiFailure(401, "E-mail ou senha inválidos.");
        return tokens.issue(nutritionist.get());
    }

    public AuthResponse.Profile me(UUID id) {
        return repository.findById(id)
                .map(AuthResponse.Profile::from)
                .orElseThrow(() -> new ApiFailure(401, "Autenticação necessária ou sessão expirada."));
    }

    private static boolean exceedsBcryptLimit(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES;
    }

    private static ApiFailure duplicateEmail() {
        return new ApiFailure(409, "email", "Este e-mail já está cadastrado.");
    }
}
