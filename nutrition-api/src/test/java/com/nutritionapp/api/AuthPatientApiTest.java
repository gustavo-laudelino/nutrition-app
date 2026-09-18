package com.nutritionapp.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.nutritionapp.RepositoryTestConfiguration;
import com.nutritionapp.auth.JwtTokens;
import com.nutritionapp.nutritionist.Nutritionist;
import com.nutritionapp.nutritionist.NutritionistRepository;
import com.nutritionapp.patient.Patient;
import com.nutritionapp.patient.PatientRepository;
import com.nutritionapp.patient.PatientRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real JWT signing and validation; repositories are mocks (no database in the test profile). Fictitious data only. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Import(RepositoryTestConfiguration.class)
class AuthPatientApiTest {
    private static final String PATIENT_BODY = """
            {"name":"Paciente Fictício","birthDate":"2015-12-25","weightKg":40.125,"heightCm":150.25,\
            "sex":"FEMALE","driActivity":"ACTIVE"}""";
    private static final String CONFLICT = "O paciente foi alterado em outra sessão. Recarregue.";

    @Autowired private MockMvc mvc;
    @Autowired private NutritionistRepository nutritionists;
    @Autowired private PatientRepository patients;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtTokens tokens;
    @Autowired private JwtEncoder encoder;
    @Autowired private JsonMapper json;
    private Nutritionist owner;
    private Patient patient;

    @BeforeEach
    void setUp() {
        reset(nutritionists, patients);
        owner = new Nutritionist("Profissional Fictício", "ficticio@example.com", passwords.encode("senha-ficticia"));
        when(nutritionists.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(nutritionists.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(nutritionists.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        patient = new Patient(owner.getId(), json.readValue(PATIENT_BODY, PatientRequest.class));
        ReflectionTestUtils.setField(patient, "version", 0L);
        when(patients.findByIdAndNutritionistId(patient.getId(), owner.getId())).thenReturn(Optional.of(patient));
        // Simulates the JPA version increment on flush.
        when(patients.saveAndFlush(any())).thenAnswer(invocation -> {
            Patient saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "version", saved.getVersion() == null ? 0L : saved.getVersion() + 1);
            return saved;
        });
        when(patients.findAll(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
    }

    @Test
    void registrationNormalizesAndReturnsSignedToken() throws Exception {
        var result = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\" Nutri Fictício \",\"email\":\" NEW@EXAMPLE.COM \",\"password\":\"senha-ficticia\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nutritionist.email").value("new@example.com"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn();
        var body = json.readTree(result.getResponse().getContentAsString());

        var saved = ArgumentCaptor.forClass(Nutritionist.class);
        verify(nutritionists).saveAndFlush(saved.capture());
        assertTrue(passwords.matches("senha-ficticia", saved.getValue().getPasswordHash()));
        assertNotEquals("senha-ficticia", saved.getValue().getPasswordHash());
        assertTrue(Instant.parse(body.get("expiresAt").asText()).isAfter(Instant.now().plusSeconds(28700)));

        when(nutritionists.findById(saved.getValue().getId())).thenReturn(Optional.of(saved.getValue()));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + body.get("accessToken").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nutri Fictício"));
    }

    @Test
    void duplicateEmailAndConcurrentDuplicateAreConflict() throws Exception {
        String body = "{\"name\":\"Fictício\",\"email\":\"ficticio@example.com\",\"password\":\"senha-ficticia\"}";
        when(nutritionists.existsByEmail("ficticio@example.com")).thenReturn(true);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].field").value("email"));

        when(nutritionists.existsByEmail(anyString())).thenReturn(false);
        when(nutritionists.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(ints = {7, 73})
    void rejectsPasswordLength(int length) throws Exception {
        String body = "{\"name\":\"Fictício\",\"email\":\"f@example.com\",\"password\":\"" + "a".repeat(length) + "\"}";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("password"));
    }

    @Test
    void loginAndIdenticalFailures() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\" FICTICIO@EXAMPLE.COM \",\"password\":\"senha-ficticia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString());

        for (String email : List.of("ficticio@example.com", "absent@example.com")) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"errada\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                    .andExpect(jsonPath("$.detail").value("E-mail ou senha inválidos."))
                    .andExpect(jsonPath("$.errors").isEmpty());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/me", "/api/patients"})
    void verifiesActualTokens(String url) throws Exception {
        mvc.perform(get(url))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errors").isEmpty());
        mvc.perform(get(url).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());

        var expiredClaims = JwtClaimsSet.builder()
                .subject(owner.getId().toString())
                .claim("name", "Fictício")
                .issuedAt(Instant.now().minusSeconds(3600))
                .expiresAt(Instant.now().minusSeconds(10))
                .build();
        String expired = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), expiredClaims))
                .getTokenValue();
        mvc.perform(get(url).header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());

        mvc.perform(get(url).header("Authorization", bearer()))
                .andExpect(status().isOk());
    }

    @Test
    void createDetailUpdateArchiveAndReactivate() throws Exception {
        mvc.perform(post("/api/patients").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(PATIENT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.archived").value(false));

        String url = "/api/patients/" + patient.getId();
        mvc.perform(get(url).header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Paciente Fictício"));
        mvc.perform(put(url).header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Fictício Editado\",\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Fictício Editado"))
                .andExpect(jsonPath("$.version").value(1));
        mvc.perform(post(url + "/archive").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));
        mvc.perform(post(url + "/unarchive").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void listReturnsPaginationAndSort() throws Exception {
        when(patients.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(patient), PageRequest.of(1, 1), 2));

        mvc.perform(get("/api/patients?name=ficticio&archived=true&page=1&size=1").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(patient.getId().toString()));
        verify(patients).findAll(any(Specification.class), eq(PageRequest.of(1, 1, Sort.by("name").and(Sort.by("id")))));
    }

    @Test
    void otherOwnerAndMissingPatientAlways404() throws Exception {
        String other = UUID.randomUUID().toString();
        String url = "/api/patients/" + patient.getId();

        mvc.perform(get(url).with(jwt().jwt(token -> token.subject(other))))
                .andExpect(status().isNotFound());
        mvc.perform(put(url).with(jwt().jwt(token -> token.subject(other)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Fictício\",\"version\":0}"))
                .andExpect(status().isNotFound());
        for (String action : List.of("archive", "unarchive")) {
            mvc.perform(post(url + "/" + action).with(jwt().jwt(token -> token.subject(other))))
                    .andExpect(status().isNotFound());
        }
        mvc.perform(get("/api/patients/" + UUID.randomUUID()).header("Authorization", bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/patients").with(jwt().jwt(token -> token.subject(other))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        verify(patients, never()).saveAndFlush(any());
    }

    @Test
    void versionIsRequiredAndStaleVersionsConflict() throws Exception {
        String url = "/api/patients/" + patient.getId();
        mvc.perform(put(url).header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Fictício\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("version"));
        mvc.perform(put(url).header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Fictício\",\"version\":7}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(CONFLICT));

        // Same version read, but another session saved first: detected on flush.
        doThrow(new ObjectOptimisticLockingFailureException(Patient.class, patient.getId()))
                .when(patients).saveAndFlush(any());
        mvc.perform(put(url).header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Fictício\",\"version\":0}"))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"name\":\" \"", "\"birthDate\":\"1899-12-31\"", "\"birthDate\":\"2999-01-01\"",
            "\"sex\":\"UNSPECIFIED\"", "\"weightKg\":0", "\"weightKg\":10000", "\"weightKg\":1.0001",
            "\"heightCm\":1000", "\"heightCm\":1.001", "\"email\":\"invalid\"", "\"driActivity\":\"OTHER\"",
            "\"measuredAt\":\"2999-01-01\"", "\"unknown\":1", "\"version\":-1"})
    void rejectsInvalidPatientFields(String field) throws Exception {
        String body = field.startsWith("\"name\"") ? "{" + field + "}" : "{\"name\":\"Fictício\"," + field + "}";
        mvc.perform(post("/api/patients").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }

    @Test
    void acceptsPastAndCurrentDates() throws Exception {
        for (LocalDate date : List.of(LocalDate.now(), LocalDate.now().minusDays(5))) {
            String body = "{\"name\":\"Fictício\",\"birthDate\":\"1990-05-20\",\"measuredAt\":\"" + date + "\"}";
            mvc.perform(post("/api/patients").header("Authorization", bearer())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.measuredAt").value(date.toString()));
        }
    }

    @Test
    void forbiddenPathsUseProblemJson() throws Exception {
        mvc.perform(get("/api/private").header("Authorization", bearer()))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.errors").isEmpty());
    }

    private String bearer() {
        return "Bearer " + tokens.issue(owner).accessToken();
    }
}
