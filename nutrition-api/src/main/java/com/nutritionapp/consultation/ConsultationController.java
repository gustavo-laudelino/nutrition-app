package com.nutritionapp.consultation;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** A patient's consultations (filled records). */
@RestController
public class ConsultationController {
    private final ConsultationService service;

    public ConsultationController(ConsultationService service) {
        this.service = service;
    }

    @GetMapping("/api/patients/{patientId}/consultations")
    public List<ConsultationResponse.Summary> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID patientId) {
        return service.list(owner(jwt), patientId);
    }

    @PostMapping("/api/patients/{patientId}/consultations")
    @ResponseStatus(HttpStatus.CREATED)
    public ConsultationResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID patientId,
                                       @Valid @RequestBody NewConsultationRequest request) {
        return service.create(owner(jwt), patientId, request);
    }

    @GetMapping("/api/consultations/{id}")
    public ConsultationResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(owner(jwt), id);
    }

    @PutMapping("/api/consultations/{id}")
    public ConsultationResponse save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                     @Valid @RequestBody ConsultationRequest request) {
        return service.save(owner(jwt), id, request);
    }

    @PostMapping("/api/consultations/{id}/complete")
    public ConsultationResponse.Completion complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                    @Valid @RequestBody ConsultationRequest.Version request) {
        return service.complete(owner(jwt), id, request.version());
    }

    @PostMapping("/api/consultations/{id}/reopen")
    public ConsultationResponse reopen(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                       @Valid @RequestBody ConsultationRequest.Version request) {
        return service.reopen(owner(jwt), id, request.version());
    }

    @DeleteMapping("/api/consultations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(owner(jwt), id);
    }

    /** The token subject is the authenticated nutritionist's id. */
    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
