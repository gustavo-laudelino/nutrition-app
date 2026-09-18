package com.nutritionapp.record;

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

/** Field catalog and the nutritionist's record templates (the Oficina). */
@RestController
public class RecordTemplateController {
    private final RecordTemplateService service;
    private final RecordFieldCatalog catalog;

    public RecordTemplateController(RecordTemplateService service, RecordFieldCatalog catalog) {
        this.service = service;
        this.catalog = catalog;
    }

    @GetMapping("/api/record-fields")
    public CatalogResponse fields() {
        return new CatalogResponse(catalog.available());
    }

    public record CatalogResponse(List<RecordFieldCategory> categories) {}

    @GetMapping("/api/record-templates")
    public List<RecordTemplateResponse.Summary> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(owner(jwt));
    }

    @PostMapping("/api/record-templates")
    @ResponseStatus(HttpStatus.CREATED)
    public RecordTemplateResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewRecordTemplateRequest request) {
        return service.create(owner(jwt), request);
    }

    @GetMapping("/api/record-templates/{id}")
    public RecordTemplateResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(owner(jwt), id);
    }

    @PutMapping("/api/record-templates/{id}")
    public RecordTemplateResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                         @Valid @RequestBody RecordTemplateRequest request) {
        return service.update(owner(jwt), id, request);
    }

    @PostMapping("/api/record-templates/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public RecordTemplateResponse duplicate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.duplicate(owner(jwt), id);
    }

    @PostMapping("/api/record-templates/{id}/default")
    public RecordTemplateResponse makeDefault(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.makeDefault(owner(jwt), id);
    }

    @DeleteMapping("/api/record-templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(owner(jwt), id);
    }

    /** The token subject is the authenticated nutritionist's id. */
    private static UUID owner(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
