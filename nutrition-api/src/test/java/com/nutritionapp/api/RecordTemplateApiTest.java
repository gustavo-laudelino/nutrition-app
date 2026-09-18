package com.nutritionapp.api;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.nutritionapp.RepositoryTestConfiguration;
import com.nutritionapp.record.RecordTemplate;
import com.nutritionapp.record.RecordTemplateRepository;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.json.JsonMapper;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
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

/** The repository mock keeps templates in memory and bumps the version on save, like JPA. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("test")
@Import(RepositoryTestConfiguration.class)
class RecordTemplateApiTest {
    private static final String URL = "/api/record-templates";

    @Autowired private MockMvc mvc;
    @Autowired private RecordTemplateRepository repository;
    @Autowired private JsonMapper json;
    private final Map<UUID, RecordTemplate> stored = new LinkedHashMap<>();
    private final UUID owner = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        reset(repository);
        stored.clear();
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> {
            RecordTemplate template = invocation.getArgument(0);
            ReflectionTestUtils.setField(template, "version", template.getVersion() == null ? 0L : template.getVersion() + 1);
            stored.put(template.getId(), template);
            return template;
        });
        when(repository.findByIdAndNutritionistId(any(), any())).thenAnswer(invocation -> Optional.ofNullable(
                stored.get(invocation.<UUID>getArgument(0))).filter(template -> template.getNutritionistId().equals(invocation.getArgument(1))));
        when(repository.findByNutritionistId(any())).thenAnswer(invocation -> stored.values().stream()
                .filter(template -> template.getNutritionistId().equals(invocation.getArgument(0))).toList());
        when(repository.countByNutritionistId(any())).thenAnswer(invocation -> stored.values().stream()
                .filter(template -> template.getNutritionistId().equals(invocation.getArgument(0))).count());
        doAnswer(invocation -> stored.remove(invocation.<RecordTemplate>getArgument(0).getId())).when(repository).delete(any());
    }

    @Test
    void catalogRequiresLoginAndListsCategoriesWithTypeSettings() throws Exception {
        mvc.perform(get("/api/record-fields")).andExpect(status().isUnauthorized());
        mvc.perform(as(owner, get("/api/record-fields")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].code").value("CONSULTATION"))
                .andExpect(jsonPath("$.categories[5].fields[0].code").value("weight_kg"))
                .andExpect(jsonPath("$.categories[5].fields[0].unit").value("kg"))
                .andExpect(jsonPath("$.categories[5].fields[0].sync").value("PATIENT_WEIGHT"))
                .andExpect(jsonPath("$.categories[5].fields[0].options").doesNotExist())
                .andExpect(jsonPath("$.categories[5].fields[0].deprecated").doesNotExist());
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    void firstTemplateStartsFromTheStarterAndBecomesDefault() throws Exception {
        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Primeira consulta  \",\"source\":\"STARTER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Primeira consulta"))
                .andExpect(jsonPath("$.isDefault").value(true))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.sections.length()").value(6))
                .andExpect(jsonPath("$.sections[0].name").value("Anamnese"))
                .andExpect(jsonPath("$.sections[0].fields[0].code").value("consultation_reason"))
                .andExpect(jsonPath("$.sections[0].fields[0].textRows").value(3))
                .andExpect(jsonPath("$.sections[0].fields[2].width").value("HALF"));

        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Retorno\",\"source\":\"BLANK\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isDefault").value(false))
                .andExpect(jsonPath("$.sections.length()").value(1))
                .andExpect(jsonPath("$.sections[0].name").value("Seção 1"))
                .andExpect(jsonPath("$.sections[0].fields.length()").value(0));

        mvc.perform(as(owner, get(URL)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Primeira consulta"))
                .andExpect(jsonPath("$[0].isDefault").value(true))
                .andExpect(jsonPath("$[0].sectionCount").value(6))
                .andExpect(jsonPath("$[1].name").value("Retorno"))
                .andExpect(jsonPath("$[1].fieldCount").value(0));
    }

    @Test
    void createValidatesNameSourceAndTheLimit() throws Exception {
        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"source\":\"BLANK\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));
        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("source"));
        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"X\",\"source\":\"BLANK\",\"extra\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("extra"));
        for (int i = 0; i < 30; i++) create(owner, "Modelo " + i);
        mvc.perform(as(owner, post(URL)).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Excedente\",\"source\":\"BLANK\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"))
                .andExpect(jsonPath("$.errors[0].message").value("Limite de 30 modelos atingido."));
    }

    @Test
    void savingReplacesTheStructureAndChecksTheVersion() throws Exception {
        var id = create(owner, "Retorno");
        var body = """
                {"name":"Retorno ajustado","version":0,"sections":[
                  {"name":" Medidas ","fields":[{"code":"weight_kg","width":"THIRD"},{"code":"height_cm","width":"THIRD"}]},
                  {"name":"Notas","fields":[{"code":"conduct","width":"FULL","textRows":8},{"code":"lab_results","width":"FULL"}]}]}""";
        mvc.perform(as(owner, put(URL + "/" + id)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Retorno ajustado"))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.sections[0].name").value("Medidas"))
                .andExpect(jsonPath("$.sections[0].fields[1].code").value("height_cm"))
                .andExpect(jsonPath("$.sections[1].fields[0].textRows").value(8))
                .andExpect(jsonPath("$.sections[1].fields[1].code").value("lab_results"));
        mvc.perform(as(owner, put(URL + "/" + id)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("O modelo foi alterado em outra sessão. Recarregue."));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "\"name\":\"\",\"sections\":[{\"name\":\"S\",\"fields\":[]}]|name|Informe o nome do modelo.",
            "\"name\":\"M\",\"sections\":[]|sections|Use de 1 a 20 seções.",
            "\"name\":\"M\",\"sections\":[{\"name\":\" \",\"fields\":[]}]|sections[0].name|Informe o nome da seção.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\"}]|sections[0].fields|Informe os campos da seção.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"weight_kg\"}]}]|sections[0].fields[0].width|Informe a largura.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"nope\",\"width\":\"FULL\"}]}]|sections[0].fields[0].code|Campo inexistente no catálogo.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"A\",\"fields\":[{\"code\":\"weight_kg\",\"width\":\"FULL\"}]},{\"name\":\"B\",\"fields\":[{\"code\":\"weight_kg\",\"width\":\"HALF\"}]}]|sections[1].fields[0].code|O campo já está no modelo.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"recall_24h\",\"width\":\"HALF\"}]}]|sections[0].fields[0].width|Tabelas ocupam a largura inteira.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"conduct\",\"width\":\"FULL\",\"textRows\":4}]}]|sections[0].fields[0].textRows|Escolha 3, 5 ou 8 linhas.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"weight_kg\",\"width\":\"FULL\",\"textRows\":3}]}]|sections[0].fields[0].textRows|A altura só se aplica a texto longo.",
            "\"name\":\"M\",\"sections\":[{\"name\":\"S\",\"fields\":[{\"code\":\"weight_kg\",\"width\":\"WIDE\"}]}]|sections[0].fields[0].width|Valor em formato inválido."})
    void savingReportsTheInvalidField(String content, String field, String message) throws Exception {
        var id = create(owner, "Modelo");
        mvc.perform(as(owner, put(URL + "/" + id)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0," + content + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value(field))
                .andExpect(jsonPath("$.errors[0].message").value(message));
    }

    @Test
    void anotherNutritionistsTemplateIsNotFound() throws Exception {
        var id = create(owner, "Meu modelo");
        var url = URL + "/" + id;
        mvc.perform(as(other, get(url))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Modelo não encontrado."));
        mvc.perform(as(other, put(url)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"X\",\"version\":0,\"sections\":[{\"name\":\"S\",\"fields\":[]}]}")).andExpect(status().isNotFound());
        mvc.perform(as(other, post(url + "/duplicate"))).andExpect(status().isNotFound());
        mvc.perform(as(other, post(url + "/default"))).andExpect(status().isNotFound());
        mvc.perform(as(other, delete(url))).andExpect(status().isNotFound());
        mvc.perform(as(other, get(URL))).andExpect(jsonPath("$.length()").value(0));
        assertTrue(stored.containsKey(id));
    }

    @Test
    void duplicateCopiesTheStructureWithATrimmedName() throws Exception {
        var id = create(owner, "Modelo com um nome bem comprido para passar do limite de 60");
        var copy = json.readTree(mvc.perform(as(owner, post(URL + "/" + id + "/duplicate")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isDefault").value(false))
                .andReturn().getResponse().getContentAsString());
        var name = copy.get("name").asText();
        assertTrue(name.startsWith("Cópia de Modelo com um nome"));
        assertEquals(60, name.length());
        assertEquals(json.readTree(mvc.perform(as(owner, get(URL + "/" + id))).andReturn().getResponse().getContentAsString()).get("sections"),
                copy.get("sections"));
    }

    @Test
    void defaultIsUniqueAndDeletingItPromotesTheLatestChanged() throws Exception {
        var first = create(owner, "Primeiro");
        var second = create(owner, "Segundo");
        var third = create(owner, "Terceiro");
        mvc.perform(as(owner, post(URL + "/" + third + "/default")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isDefault").value(true));
        assertFalse(stored.get(first).isDefaultTemplate());
        mvc.perform(as(owner, get(URL))).andExpect(jsonPath("$[0].name").value("Terceiro"))
                .andExpect(jsonPath("$[?(@.isDefault == true)].name").value(not(hasItem("Primeiro"))));

        ReflectionTestUtils.setField(stored.get(first), "updatedAt", stored.get(second).getUpdatedAt().plusSeconds(60));
        mvc.perform(as(owner, delete(URL + "/" + third))).andExpect(status().isNoContent());
        assertFalse(stored.containsKey(third));
        assertTrue(stored.get(first).isDefaultTemplate());
        assertFalse(stored.get(second).isDefaultTemplate());

        mvc.perform(as(owner, delete(URL + "/" + second))).andExpect(status().isNoContent());
        assertTrue(stored.get(first).isDefaultTemplate());
    }

    private UUID create(UUID nutritionist, String name) throws Exception {
        var body = mvc.perform(as(nutritionist, post(URL)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"source\":\"BLANK\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(body).get("id").asText());
    }

    private static MockHttpServletRequestBuilder as(UUID nutritionist, MockHttpServletRequestBuilder request) {
        RequestPostProcessor token = jwt().jwt(claims -> claims.subject(nutritionist.toString()));
        return request.with(token);
    }
}
