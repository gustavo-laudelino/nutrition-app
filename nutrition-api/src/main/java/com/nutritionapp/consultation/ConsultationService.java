package com.nutritionapp.consultation;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.patient.Patient;
import com.nutritionapp.patient.PatientRepository;
import com.nutritionapp.record.RecordField;
import com.nutritionapp.record.RecordFieldCatalog;
import com.nutritionapp.record.RecordTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Consultations of the owner's patients: another nutritionist's patient or consultation is reported as not found.
 * A draft is saved as often as needed; completing syncs the measured weight/height with the patient registry.
 */
@Service
@Transactional(readOnly = true)
public class ConsultationService {
    private static final TypeReference<List<ConsultationSection>> SECTIONS = new TypeReference<>() {};
    private static final TypeReference<LinkedHashMap<String, JsonNode>> ANSWERS = new TypeReference<>() {};

    private final ConsultationRepository repository;
    private final PatientRepository patients;
    private final RecordTemplateRepository templates;
    private final RecordFieldCatalog catalog;
    private final JsonMapper json;

    public ConsultationService(ConsultationRepository repository, PatientRepository patients,
                               RecordTemplateRepository templates, RecordFieldCatalog catalog, JsonMapper json) {
        this.repository = repository;
        this.patients = patients;
        this.templates = templates;
        this.catalog = catalog;
        this.json = json;
    }

    public List<ConsultationResponse.Summary> list(UUID owner, UUID patientId) {
        ownedPatient(owner, patientId);
        return repository.findByPatientIdAndNutritionistIdAndDeletedAtIsNullOrderByConsultationDateDescCreatedAtDesc(patientId, owner)
                .stream().map(ConsultationResponse.Summary::from).toList();
    }

    public ConsultationResponse get(UUID owner, UUID id) {
        return response(owned(owner, id));
    }

    /** Copies the template structure with each field's catalog definition, as it is today. */
    @Transactional
    public ConsultationResponse create(UUID owner, UUID patientId, NewConsultationRequest request) {
        var patient = ownedPatient(owner, patientId);
        if (patient.isArchived()) throw new ApiFailure(400, "Reative o paciente para registrar consultas.");
        var template = templates.findByIdAndNutritionistId(request.templateId(), owner)
                .orElseThrow(() -> new ApiFailure(404, "templateId", "Modelo não encontrado."));
        var sections = template.structure().stream().map(section -> new ConsultationSection(section.name(),
                section.fields().stream().map(field -> new ConsultationSection.Field(field.width(), field.textRows(),
                        catalog.find(field.code()).orElseThrow(() ->
                                new IllegalStateException("Campo do modelo ausente do catálogo: " + field.code())))).toList()))
                .toList();
        var consultation = new Consultation(owner, patientId, template.getId(), template.getName(),
                json.writeValueAsString(sections), request.date());
        return response(repository.saveAndFlush(consultation));
    }

    @Transactional
    public ConsultationResponse save(UUID owner, UUID id, ConsultationRequest request) {
        var consultation = owned(owner, id);
        checkVersion(consultation, request.version());
        if (consultation.getStatus() == Consultation.Status.COMPLETED)
            throw new ApiFailure(400, "Reabra a consulta para editar.");
        consultation.save(request.date(), json.writeValueAsString(normalize(consultation, request.answers())));
        return response(repository.saveAndFlush(consultation));
    }

    @Transactional
    public ConsultationResponse.Completion complete(UUID owner, UUID id, Long version) {
        var consultation = owned(owner, id);
        checkVersion(consultation, version);
        if (consultation.getStatus() == Consultation.Status.COMPLETED) throw new ApiFailure(400, "A consulta já está concluída.");
        consultation.complete();
        var patientUpdated = syncMeasurements(owner, consultation);
        return new ConsultationResponse.Completion(response(repository.saveAndFlush(consultation)), patientUpdated);
    }

    @Transactional
    public ConsultationResponse reopen(UUID owner, UUID id, Long version) {
        var consultation = owned(owner, id);
        checkVersion(consultation, version);
        if (consultation.getStatus() == Consultation.Status.DRAFT) throw new ApiFailure(400, "A consulta já está em rascunho.");
        consultation.reopen();
        return response(repository.saveAndFlush(consultation));
    }

    /** Never completed: deleted. Completed at least once: hidden but kept (health records must be kept). */
    @Transactional
    public void delete(UUID owner, UUID id) {
        var consultation = owned(owner, id);
        if (consultation.mustBeKept()) {
            consultation.hide();
            repository.saveAndFlush(consultation);
        } else {
            repository.delete(consultation);
        }
    }

    /** Answers in the order of the structure; codes outside it are rejected. */
    private Map<String, JsonNode> normalize(Consultation consultation, Map<String, JsonNode> answers) {
        var fields = fields(consultation);
        for (var code : answers.keySet())
            if (!fields.containsKey(code)) throw new ApiFailure(400, "answers." + code, "Campo fora deste prontuário.");
        var result = new LinkedHashMap<String, JsonNode>();
        fields.forEach((code, field) -> {
            var value = AnswerRules.normalize(field, answers.get(code), "answers." + code);
            if (value != null) result.put(code, value);
        });
        return result;
    }

    private boolean syncMeasurements(UUID owner, Consultation consultation) {
        var answers = json.readValue(consultation.getAnswers(), ANSWERS);
        BigDecimal weight = null;
        BigDecimal height = null;
        for (var field : fields(consultation).values()) {
            var value = answers.get(field.code());
            if (field.sync() == null || value == null || !value.isNumber()) continue;
            if (field.sync() == RecordField.Sync.PATIENT_WEIGHT) weight = value.decimalValue();
            else height = value.decimalValue();
        }
        var patient = ownedPatient(owner, consultation.getPatientId());
        if (!patient.updateMeasurements(weight, height, consultation.getConsultationDate())) return false;
        patients.saveAndFlush(patient);
        return true;
    }

    private Map<String, RecordField> fields(Consultation consultation) {
        var fields = new LinkedHashMap<String, RecordField>();
        for (var section : json.readValue(consultation.getStructure(), SECTIONS))
            for (var field : section.fields()) fields.put(field.field().code(), field.field());
        return fields;
    }

    private ConsultationResponse response(Consultation consultation) {
        return new ConsultationResponse(consultation.getId(), consultation.getPatientId(), consultation.getConsultationDate(),
                consultation.getStatus(), consultation.getTemplateName(), json.readValue(consultation.getStructure(), SECTIONS),
                json.readValue(consultation.getAnswers(), ANSWERS), consultation.getFirstCompletedAt(),
                consultation.getCompletedAt(), consultation.getReopenedAt(), consultation.getUpdatedAt(), consultation.getVersion());
    }

    private static void checkVersion(Consultation consultation, Long version) {
        if (!Objects.equals(consultation.getVersion(), version))
            throw new ApiFailure(409, "A consulta foi alterada em outra sessão. Recarregue.");
    }

    private Patient ownedPatient(UUID owner, UUID patientId) {
        return patients.findByIdAndNutritionistId(patientId, owner)
                .orElseThrow(() -> new ApiFailure(404, "Paciente não encontrado."));
    }

    private Consultation owned(UUID owner, UUID id) {
        return repository.findByIdAndNutritionistIdAndDeletedAtIsNull(id, owner)
                .orElseThrow(() -> new ApiFailure(404, "Consulta não encontrada."));
    }
}
