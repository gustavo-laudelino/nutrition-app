package com.nutritionapp.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.nutritionapp.RepositoryTestConfiguration;
import com.nutritionapp.consultation.Consultation;
import com.nutritionapp.consultation.ConsultationRepository;
import com.nutritionapp.patient.Patient;
import com.nutritionapp.patient.PatientRepository;
import com.nutritionapp.patient.PatientRequest;
import com.nutritionapp.record.RecordTemplate;
import com.nutritionapp.record.RecordTemplateRepository;
import com.nutritionapp.record.TemplateFieldData;
import com.nutritionapp.record.TemplateFieldData.Width;
import com.nutritionapp.record.TemplateSectionData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Repositories are in-memory mocks that bump versions like JPA. Fictitious patients only. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Import(RepositoryTestConfiguration.class)
class ConsultationApiTest {
    @Autowired private MockMvc mvc;
    @Autowired private ConsultationRepository consultations;
    @Autowired private PatientRepository patients;
    @Autowired private RecordTemplateRepository templates;
    @Autowired private JsonMapper json;
    private final Map<UUID, Consultation> stored = new LinkedHashMap<>();
    private final UUID owner = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private Patient patient;
    private RecordTemplate template;

    @BeforeEach
    void setUp() {
        reset(consultations, patients, templates);
        stored.clear();
        patient = new Patient(owner, new PatientRequest("Paciente Fictícia", LocalDate.of(1990, 1, 1), Patient.Sex.FEMALE,
                null, null, null, new BigDecimal("70.000"), new BigDecimal("165.00"), null, LocalDate.of(2026, 9, 1), null));
        ReflectionTestUtils.setField(patient, "version", 0L);
        template = new RecordTemplate(owner, "Retorno", List.of(
                new TemplateSectionData("Medidas", List.of(new TemplateFieldData("weight_kg", Width.THIRD, null),
                        new TemplateFieldData("height_cm", Width.THIRD, null))),
                new TemplateSectionData("Hábitos", List.of(new TemplateFieldData("appetite", Width.HALF, null),
                        new TemplateFieldData("recall_24h", Width.FULL, null)))), true);

        when(patients.findByIdAndNutritionistId(any(), any())).thenAnswer(invocation ->
                Optional.of(patient).filter(item -> item.getId().equals(invocation.getArgument(0)) && owner.equals(invocation.getArgument(1))));
        when(patients.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(templates.findByIdAndNutritionistId(any(), any())).thenAnswer(invocation ->
                Optional.of(template).filter(item -> item.getId().equals(invocation.getArgument(0)) && owner.equals(invocation.getArgument(1))));
        when(consultations.saveAndFlush(any())).thenAnswer(invocation -> {
            Consultation consultation = invocation.getArgument(0);
            ReflectionTestUtils.setField(consultation, "version", consultation.getVersion() == null ? 0L : consultation.getVersion() + 1);
            stored.put(consultation.getId(), consultation);
            return consultation;
        });
        when(consultations.findByIdAndNutritionistIdAndDeletedAtIsNull(any(), any())).thenAnswer(invocation ->
                Optional.ofNullable(stored.get(invocation.<UUID>getArgument(0)))
                        .filter(item -> item.getNutritionistId().equals(invocation.getArgument(1)) && !item.isDeleted()));
        when(consultations.findByPatientIdAndNutritionistIdAndDeletedAtIsNullOrderByConsultationDateDescCreatedAtDesc(any(), any()))
                .thenAnswer(invocation -> stored.values().stream()
                        .filter(item -> item.getPatientId().equals(invocation.getArgument(0)) && !item.isDeleted())
                        .sorted((a, b) -> b.getConsultationDate().compareTo(a.getConsultationDate())).toList());
        doAnswer(invocation -> stored.remove(invocation.<Consultation>getArgument(0).getId())).when(consultations).delete(any());
    }

    @Test
    void opensAConsultationWithACopyOfTheTemplate() throws Exception {
        mvc.perform(get(patientUrl())).andExpect(status().isUnauthorized());
        var id = open("2026-09-15");
        mvc.perform(as(owner, get("/api/consultations/" + id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.templateName").value("Retorno"))
                .andExpect(jsonPath("$.date").value("2026-09-15"))
                .andExpect(jsonPath("$.sections[0].name").value("Medidas"))
                .andExpect(jsonPath("$.sections[0].fields[0].width").value("THIRD"))
                .andExpect(jsonPath("$.sections[0].fields[0].field.label").value("Peso"))
                .andExpect(jsonPath("$.sections[0].fields[0].field.unit").value("kg"))
                .andExpect(jsonPath("$.sections[1].fields[1].field.columns.length()").value(4))
                .andExpect(jsonPath("$.answers").isEmpty());

        // Changing the template later does not reach the consultation.
        template.replace("Retorno novo", List.of(new TemplateSectionData("Outra", List.of())));
        mvc.perform(as(owner, get("/api/consultations/" + id)))
                .andExpect(jsonPath("$.templateName").value("Retorno"))
                .andExpect(jsonPath("$.sections[0].name").value("Medidas"));
        mvc.perform(as(owner, get(patientUrl())))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("DRAFT"));
    }

    @Test
    void openingChecksPatientTemplateAndDate() throws Exception {
        mvc.perform(as(owner, post(patientUrl())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + UUID.randomUUID() + "\",\"date\":\"2026-09-15\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.detail").value("Modelo não encontrado."));
        mvc.perform(as(owner, post(patientUrl())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + template.getId() + "\",\"date\":\"" + LocalDate.now().plusDays(1) + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("date"));
        mvc.perform(as(other, post(patientUrl())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + template.getId() + "\",\"date\":\"2026-09-15\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.detail").value("Paciente não encontrado."));
        patient.archive(true);
        mvc.perform(as(owner, post(patientUrl())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + template.getId() + "\",\"date\":\"2026-09-15\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Reative o paciente para registrar consultas."));
    }

    @Test
    void savingADraftNormalizesTheAnswers() throws Exception {
        var id = open("2026-09-15");
        save(id, 0, "{\"weight_kg\":72.5,\"appetite\":{\"option\":\"normal\"},\"height_cm\":null,"
                + "\"recall_24h\":[{\"time\":\" 8h \",\"meal\":\"Café\"},{\"time\":\"\"}]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.answers.weight_kg").value(72.5))
                .andExpect(jsonPath("$.answers.height_cm").doesNotExist())
                .andExpect(jsonPath("$.answers.appetite.option").value("normal"))
                .andExpect(jsonPath("$.answers.recall_24h.length()").value(1))
                .andExpect(jsonPath("$.answers.recall_24h[0].time").value("8h"));
        save(id, 0, "{}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("A consulta foi alterada em outra sessão. Recarregue."));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"stress_level\":5}|answers.stress_level|Campo fora deste prontuário.",
            "{\"weight_kg\":900}|answers.weight_kg|Informe um valor entre 1 e 500.",
            "{\"appetite\":{\"option\":\"voraz\"}}|answers.appetite.option|Opção inexistente.",
            "{\"recall_24h\":[{\"drink\":\"café\"}]}|answers.recall_24h[0].drink|Propriedade não reconhecida."})
    void invalidAnswersNameTheField(String answers, String field, String message) throws Exception {
        var id = open("2026-09-15");
        save(id, 0, answers).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value(field))
                .andExpect(jsonPath("$.errors[0].message").value(message));
    }

    @Test
    void completingSyncsNewerMeasurementsAndReopeningKeepsTheRecord() throws Exception {
        var id = open("2026-09-15");
        save(id, 0, "{\"weight_kg\":72.5}").andExpect(status().isOk());
        mvc.perform(as(owner, post("/api/consultations/" + id + "/complete")).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientUpdated").value(true))
                .andExpect(jsonPath("$.consultation.status").value("COMPLETED"))
                .andExpect(jsonPath("$.consultation.firstCompletedAt").isNotEmpty());
        assertEquals(new BigDecimal("72.5"), patient.getWeightKg());
        assertEquals(new BigDecimal("165.00"), patient.getHeightCm());
        assertEquals(LocalDate.of(2026, 9, 15), patient.getMeasuredAt());

        save(id, 2, "{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Reabra a consulta para editar."));
        mvc.perform(as(owner, post("/api/consultations/" + id + "/reopen")).contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.reopenedAt").isNotEmpty())
                .andExpect(jsonPath("$.firstCompletedAt").isNotEmpty());

        // An older consultation does not overwrite newer measurements.
        var older = open("2026-08-01");
        save(older, 0, "2026-08-01", "{\"weight_kg\":90,\"height_cm\":170}").andExpect(status().isOk());
        mvc.perform(as(owner, post("/api/consultations/" + older + "/complete")).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(jsonPath("$.patientUpdated").value(false));
        assertEquals(new BigDecimal("72.5"), patient.getWeightKg());
        assertEquals(LocalDate.of(2026, 9, 15), patient.getMeasuredAt());
    }

    @Test
    void deletingRemovesDraftsButOnlyHidesCompletedOnes() throws Exception {
        var draft = open("2026-09-10");
        var completed = open("2026-09-15");
        mvc.perform(as(owner, post("/api/consultations/" + completed + "/complete")).contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(as(other, delete("/api/consultations/" + draft))).andExpect(status().isNotFound());

        mvc.perform(as(owner, delete("/api/consultations/" + draft))).andExpect(status().isNoContent());
        assertFalse(stored.containsKey(draft));
        mvc.perform(as(owner, delete("/api/consultations/" + completed))).andExpect(status().isNoContent());
        assertTrue(stored.get(completed).isDeleted());
        mvc.perform(as(owner, get("/api/consultations/" + completed))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Consulta não encontrada."));
        mvc.perform(as(owner, get(patientUrl()))).andExpect(jsonPath("$.length()").value(0));
    }

    private String patientUrl() {
        return "/api/patients/" + patient.getId() + "/consultations";
    }

    private UUID open(String date) throws Exception {
        var body = mvc.perform(as(owner, post(patientUrl())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + template.getId() + "\",\"date\":\"" + date + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asString());
    }

    private ResultActions save(UUID id, int version, String answers) throws Exception {
        return save(id, version, "2026-09-15", answers);
    }

    private ResultActions save(UUID id, int version, String date, String answers) throws Exception {
        return mvc.perform(as(owner, put("/api/consultations/" + id)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"" + date + "\",\"version\":" + version + ",\"answers\":" + answers + "}"));
    }

    private static MockHttpServletRequestBuilder as(UUID nutritionist, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(claims -> claims.subject(nutritionist.toString())));
    }
}
