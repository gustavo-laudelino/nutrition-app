package com.nutritionapp.auth;

import java.time.Duration;
import java.time.Instant;
import com.nutritionapp.nutritionist.Nutritionist;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** HS256 access token without refresh or server-side revocation; logout only discards it on the client. */
@Service
public class JwtTokens {
    private static final Duration VALIDITY = Duration.ofHours(8);
    private final JwtEncoder encoder;

    public JwtTokens(JwtEncoder encoder) {
        this.encoder = encoder;
    }

    public AuthResponse issue(Nutritionist nutritionist) {
        var issuedAt = Instant.now();
        var expiresAt = issuedAt.plus(VALIDITY);
        var claims = JwtClaimsSet.builder()
                .subject(nutritionist.getId().toString())
                .claim("name", nutritionist.getName())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        var token = encoder.encode(JwtEncoderParameters.from(header, claims));
        return new AuthResponse(token.getTokenValue(), "Bearer", expiresAt, AuthResponse.Profile.from(nutritionist));
    }
}
