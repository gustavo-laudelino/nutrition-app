package com.nutritionapp.patient;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patients")
public class PatientController {
    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @GetMapping
    public PatientService.PatientPage list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "") String name,
            @RequestParam(defaultValue = "false") boolean archived,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "A página deve ser positiva ou zero.") int page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "Informe ao menos 1 resultado.")
            @Max(value = 100, message = "Use no máximo 100 resultados.") int size) {
        return service.list(owner(jwt), name, archived, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PatientRequest request) {
        return service.create(owner(jwt), request);
    }

    @GetMapping("/{id}")
    public PatientResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(owner(jwt), id);
    }

    @PutMapping("/{id}")
    public PatientResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                  @Valid @RequestBody PatientRequest request) {
        return service.update(owner(jwt), id, request);
    }

    @PostMapping("/{id}/archive")
    public PatientResponse archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.archive(owner(jwt), id, true);
    }

    @PostMapping("/{id}/unarchive")
    public PatientResponse unarchive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.archive(owner(jwt), id, false);
    }

    /** The token subject is the authenticated nutritionist's id. */
    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
