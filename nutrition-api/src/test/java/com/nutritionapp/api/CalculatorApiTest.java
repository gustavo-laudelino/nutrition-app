package com.nutritionapp.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CalculatorApiTest {
    @Autowired private MockMvc mvc;
    private static final String FOODS = "\"meals\":[{\"name\":\"Almoço\",\"foods\":[{\"foodId\":1,\"quantityG\":150},{\"foodId\":2,\"quantityG\":100}]}]";
    @Test void exampleMatchesCompleteResponse() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
                .content(Files.readString(Path.of("examples/diet-calculation-request.json"))))
            .andExpect(status().isOk()).andExpect(content().json(Files.readString(Path.of("examples/diet-calculation-response.json")),org.springframework.test.json.JsonCompareMode.STRICT));
    }
    @Test void noTargetsOrPatientAreRequired() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{"+FOODS+"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals.energyKcal.consumed").value(360))
            .andExpect(jsonPath("$.totals.energyKcal.target").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.totals.energyKcal.remaining").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.meals[0].foods[0].nutrients.carbohydrateG").value(42));
    }
    @Test void onlyManualEnergyTarget() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"targets\":{\"energyKcal\":2000},"+FOODS+"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totals.energyKcal.remaining").value(1640))
            .andExpect(jsonPath("$.totals.proteinG.remaining").value(org.hamcrest.Matchers.nullValue()));
    }
    @Test void targetEndpointUsesPrescriptionForPercentagesAndCalculatesDifference() throws Exception {
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON).content("""
          {"prescribedEnergyKcal":2000,"referenceEstimateKcal":2437,"macros":{"method":"PERCENTAGE","carbohydrate":50,"protein":20,"fat":30}}
          """))
          .andExpect(status().isOk()).andExpect(jsonPath("$.targets.energyKcal").value(2000))
          .andExpect(jsonPath("$.prescription.differenceKcal").value(-437))
          .andExpect(jsonPath("$.targets.carbohydrateG").value(250))
          .andExpect(jsonPath("$.targets.proteinG").value(100))
          .andExpect(jsonPath("$.targets.fatG").value(66.67));
    }
    @Test void compositionCanBecomeTheTarget() throws Exception {
        mvc.perform(post("/api/target-calculations/from-composition").contentType(MediaType.APPLICATION_JSON)
            .content("{\"energyKcal\":124,\"carbohydrateG\":25.8,\"proteinG\":2.6,\"fatG\":1}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.prescribedEnergyKcal").value(124))
          .andExpect(jsonPath("$.carbohydratePercent").value(84.1762)).andExpect(jsonPath("$.fatPercent").value(7.3409));
        mvc.perform(post("/api/target-calculations/from-composition").contentType(MediaType.APPLICATION_JSON)
            .content("{\"energyKcal\":0,\"carbohydrateG\":0,\"proteinG\":0,\"fatG\":0}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("energyKcal"));
        mvc.perform(post("/api/target-calculations/from-composition").contentType(MediaType.APPLICATION_JSON)
            .content("{\"energyKcal\":124,\"carbohydrateG\":-1,\"proteinG\":2.6,\"fatG\":1}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("carbohydrateG"));
    }
    @Test void acceptsEmptyTargetRequest() throws Exception {
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON).content("{}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.targets.energyKcal").value(org.hamcrest.Matchers.nullValue()));
    }
    @Test void estimateReferenceDoesNotPrescribe() throws Exception {
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"referenceEstimateKcal\":2437}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.targets.energyKcal").value(org.hamcrest.Matchers.nullValue()))
          .andExpect(jsonPath("$.prescription.differenceKcal").value(org.hamcrest.Matchers.nullValue()));
    }
    @ParameterizedTest @ValueSource(strings={
        "{\"prescribedEnergyKcal\":0}", "{\"prescribedEnergyKcal\":-1}", "{\"referenceEstimateKcal\":0}",
        "{\"macros\":{\"method\":\"PER_KG\",\"protein\":1.8}}", "{\"patient\":{\"weightKg\":80}}",
        "{\"referenceEstimateKcal\":2437,\"macros\":{\"method\":\"PERCENTAGE\",\"carbohydrate\":50,\"protein\":20,\"fat\":30}}",
        "{\"prescribedEnergyKcal\":2000,\"macros\":{\"method\":\"PERCENTAGE\",\"carbohydrate\":50,\"protein\":20,\"fat\":29.9999}}",
        "{\"macros\":{\"method\":\"MANUAL\",\"protein\":150}}",
        "{\"macros\":{}}"})
    void rejectsIncompatibleTargetInputs(String body) throws Exception {
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
          .andExpect(jsonPath("$.errors").isArray());
    }
    @ParameterizedTest @ValueSource(strings={
        "{}", "{\"meals\": [{\"name\": \"Almoço\", \"foods\": null}]}", "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [null]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1, \"quantityG\": 0}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1, \"quantityG\": -1}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1, \"quantityG\": null}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 0, \"quantityG\": 100}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": null, \"quantityG\": 100}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1, \"quantityG\": 1.0001}]}]}",
        "{\"targets\": {\"energyKcal\": 0}, \"meals\": [{\"name\": \"Almoço\", \"foods\": []}]}",
        "{\"targets\": {\"proteinG\": -1}, \"meals\": [{\"name\": \"Almoço\", \"foods\": []}]}"})
    void validatesComposition(String body) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @ParameterizedTest @ValueSource(strings={"{","null","{\"targetKcal\": 2000, \"meals\": [{\"name\": \"Almoço\", \"foods\": []}]}","{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1.5, \"quantityG\": 100}]}]}"})
    void rejectsMalformedTypesAndObsoleteContract(String body) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @Test void unreadableBodyIdentifiesFieldWhenPossible() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"targetKcal\": 2000, \"meals\": [{\"name\": \"Almoço\", \"foods\": []}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("targetKcal"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 1.5, \"quantityG\": 100}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].foods[0].foodId"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isEmpty());
    }
    @Test void missingFoodReturns404() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"meals\": [{\"name\": \"Almoço\", \"foods\": [{\"foodId\": 999, \"quantityG\": 100}]}]}"))
          .andExpect(status().isNotFound());
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"meals\":null}","{\"meals\":[null]}","{\"foods\":[]}"})
    void rejectsMissingMealsAndOldFoodsContract(String body) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @ParameterizedTest @ValueSource(strings={"null","\"\"","\"   \""})
    void rejectsInvalidMealNameWithNestedPath(String name) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"foods\":[]},{\"name\":"+name+",\"foods\":[]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[1].name"));
    }
    @Test void validatesMealAndDailyPortionLimits() throws Exception {
        var emptyMeal = "{\"name\":\"A\",\"foods\":[]}";
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+String.join(",",java.util.Collections.nCopies(21,emptyMeal))+"]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\""+"a".repeat(61)+"\",\"foods\":[]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].name"));
        var portions = String.join(",",java.util.Collections.nCopies(250,"{\"foodId\":1,\"quantityG\":1}"));
        var meal = "{\"name\":\"A\",\"foods\":["+portions+"]}";
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+meal+","+meal+"]}"))
          .andExpect(status().isOk());
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+meal+","+meal+",{\"name\":\"C\",\"foods\":[{\"foodId\":1,\"quantityG\":1}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals"));
    }
    @Test void nestedPortionErrorsAndMissingFoodInLaterMeal() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"foods\":[{\"foodId\":1,\"quantityG\":1},{\"foodId\":1,\"quantityG\":1},{\"foodId\":1,\"quantityG\":0}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].foods[2].quantityG"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"foods\":[]},{\"name\":\"B\",\"foods\":[{\"foodId\":999,\"quantityG\":1}]}]}"))
          .andExpect(status().isNotFound());
    }
    @Test void searchesAndPaginatesReadOnlyCatalog() throws Exception {
        mvc.perform(get("/api/foods").param("name","SINTETICO alimento").param("page","1").param("size","1"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(2)).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/foods").param("name","inexistente")).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/foods/1")).andExpect(status().isOk()).andExpect(jsonPath("$.carbohydrateG").value(28));
        mvc.perform(get("/api/foods/999")).andExpect(status().isNotFound());
        mvc.perform(post("/api/foods").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/api/foods/1")).andExpect(status().isMethodNotAllowed());
    }
    @Test void validatesCatalogParameters() throws Exception {
        mvc.perform(get("/api/foods").param("size","101")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get("/api/foods").param("page","-1")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("page"));
        mvc.perform(get("/api/foods/0")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("id"));
        mvc.perform(get("/api/foods/abc")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("id"));
    }
}

