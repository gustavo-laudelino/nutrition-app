package com.nutritionapp.patient;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import com.nutritionapp.api.ApiFailure;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Every operation is scoped to the owner: another nutritionist's patient is reported as not found. */
@Service
@Transactional(readOnly = true)
public class PatientService {
    private final PatientRepository repository;

    public PatientService(PatientRepository repository) {
        this.repository = repository;
    }

    public record PatientPage(List<PatientResponse> content, int page, int size, long totalElements, int totalPages) {}

    public PatientPage list(UUID owner, String name, boolean archived, int page, int size) {
        var today = LocalDate.now();
        var result = repository.findAll(PatientSearch.specification(owner, name, archived),
                PageRequest.of(page, size, Sort.by("name").and(Sort.by("id"))));
        return new PatientPage(result.map(patient -> PatientResponse.from(patient, today)).getContent(),
                page, size, result.getTotalElements(), result.getTotalPages());
    }

    public PatientResponse get(UUID owner, UUID id) {
        return PatientResponse.from(owned(owner, id), LocalDate.now());
    }

    @Transactional
    public PatientResponse create(UUID owner, PatientRequest request) {
        request.validateDates();
        var patient = repository.saveAndFlush(new Patient(owner, request));
        return PatientResponse.from(patient, LocalDate.now());
    }

    @Transactional
    public PatientResponse update(UUID owner, UUID id, PatientRequest request) {
        var patient = owned(owner, id);
        if (request.version() == null) throw new ApiFailure(400, "version", "Informe a versão do paciente.");
        if (!Objects.equals(patient.getVersion(), request.version()))
            throw new ApiFailure(409, "O paciente foi alterado em outra sessão. Recarregue.");
        request.validateDates();
        patient.update(request);
        return PatientResponse.from(repository.saveAndFlush(patient), LocalDate.now());
    }

    @Transactional
    public PatientResponse archive(UUID owner, UUID id, boolean archived) {
        var patient = owned(owner, id);
        patient.archive(archived);
        return PatientResponse.from(repository.saveAndFlush(patient), LocalDate.now());
    }

    private Patient owned(UUID owner, UUID id) {
        return repository.findByIdAndNutritionistId(id, owner)
                .orElseThrow(() -> new ApiFailure(404, "Paciente não encontrado."));
    }
}
