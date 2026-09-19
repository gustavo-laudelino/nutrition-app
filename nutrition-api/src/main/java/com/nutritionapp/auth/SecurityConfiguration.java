package com.nutritionapp.auth;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nutritionapp.api.ApiFailure;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class SecurityConfiguration {
    // Calculator endpoints stay public; any path not listed here is denied.
    private static final String[] PUBLIC_PATHS = {
            "/api/auth/register", "/api/auth/login",
            "/api/foods/**", "/api/energy-estimates", "/api/energy-prescriptions/**",
            "/api/target-calculations/**", "/api/diet-calculations", "/api/portion-quantities", "/error"};
    private static final String[] PROTECTED_PATHS = {"/api/auth/me", "/api/patients/**",
            "/api/record-fields", "/api/record-templates/**", "/api/consultations/**"};

    /** Fails startup without a secret of at least 32 bytes; there is no default outside the test profile. */
    @Bean
    SecretKey jwtKey(@Value("${auth.jwt-secret}") String secret) {
        var bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET deve ter no mínimo 32 bytes.");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey key) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey key) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), SecurityConfiguration::requiredClaims));
        return decoder;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, JsonMapper mapper) throws Exception {
        AuthenticationEntryPoint unauthorized = (request, response, exception) ->
                writeProblem(response, mapper, new ApiFailure(401, "Autenticação necessária ou sessão expirada."));
        AccessDeniedHandler forbidden = (request, response, exception) ->
                writeProblem(response, mapper, new ApiFailure(403, "Acesso não permitido."));
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .requestMatchers(PROTECTED_PATHS).authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler(forbidden))
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> {})
                        .authenticationEntryPoint(unauthorized))
                .build();
    }

    /** Claims issued by {@link JwtTokens}: UUID subject, name, iat and exp. */
    private static OAuth2TokenValidatorResult requiredClaims(Jwt jwt) {
        try {
            UUID.fromString(jwt.getSubject());
            if (jwt.getIssuedAt() != null && jwt.getExpiresAt() != null && jwt.getClaimAsString("name") != null)
                return OAuth2TokenValidatorResult.success();
        } catch (RuntimeException exception) {
            // Missing or malformed claim: the token is invalid.
        }
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
    }

    private static void writeProblem(HttpServletResponse response, JsonMapper mapper, ApiFailure failure)
            throws IOException {
        var problem = failure.problem();
        response.setStatus(problem.getStatus());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), problem);
    }
}
