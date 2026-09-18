package com.nutritionapp.api;

import com.nutritionapp.RepositoryTestConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(RepositoryTestConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CalculatorApiTest {
    @Autowired private MockMvc mvc;
    private static final String FOODS = "\"meals\":[{\"name\":\"Almoço\",\"options\":[{\"foods\":[{\"foodId\":1,\"quantityG\":150},{\"foodId\":2,\"quantityG\":100}]}]}]";
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
            .andExpect(jsonPath("$.meals[0].options[0].foods[0].nutrients.carbohydrateG").value(42));
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
        "{}", "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": null}]}]}", "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [null]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1, \"quantityG\": 0}]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1, \"quantityG\": -1}]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1, \"quantityG\": null}]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 0, \"quantityG\": 100}]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": null, \"quantityG\": 100}]}]}]}",
        "{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1, \"quantityG\": 1.0001}]}]}]}",
        "{\"targets\": {\"energyKcal\": 0}, \"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": []}]}]}",
        "{\"targets\": {\"proteinG\": -1}, \"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": []}]}]}"})
    void validatesComposition(String body) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @ParameterizedTest @ValueSource(strings={"{","null","{\"targetKcal\": 2000, \"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": []}]}]}","{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1.5, \"quantityG\": 100}]}]}]}"})
    void rejectsMalformedTypesAndObsoleteContract(String body) throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @Test void unreadableBodyIdentifiesFieldWhenPossible() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"targetKcal\": 2000, \"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": []}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("targetKcal"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 1.5, \"quantityG\": 100}]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options[0].foods[0].foodId"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isEmpty());
    }
    @Test void missingFoodReturns404() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"meals\": [{\"name\": \"Almoço\", \"options\":[{\"foods\": [{\"foodId\": 999, \"quantityG\": 100}]}]}]}"))
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
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[]}]},{\"name\":"+name+",\"options\":[{\"foods\":[]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[1].name"));
    }
    @Test void validatesMealAndDailyPortionLimits() throws Exception {
        var emptyMeal = "{\"name\":\"A\",\"options\":[{\"foods\":[]}]}";
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+String.join(",",java.util.Collections.nCopies(21,emptyMeal))+"]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\""+"a".repeat(61)+"\",\"options\":[{\"foods\":[]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].name"));
        var portions = String.join(",",java.util.Collections.nCopies(250,"{\"foodId\":1,\"quantityG\":1}"));
        var meal = "{\"name\":\"A\",\"options\":[{\"foods\":["+portions+"]}]}";
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+meal+","+meal+"]}"))
          .andExpect(status().isOk());
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":["+meal+","+meal+",{\"name\":\"C\",\"options\":[{\"foods\":[{\"foodId\":1,\"quantityG\":1}]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals"));
    }
    @Test void portionQuantityByNutrientIsPublicAndValidated() throws Exception {
        mvc.perform(post("/api/portion-quantities").contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodId\":1,\"nutrient\":\"CARBOHYDRATE\",\"amount\":40}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.quantityG").value(142.9))
          .andExpect(jsonPath("$.nutrient").value("CARBOHYDRATE")).andExpect(jsonPath("$.amount").value(40));
        mvc.perform(post("/api/portion-quantities").contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodId\":2,\"nutrient\":\"CARBOHYDRATE\",\"amount\":10}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("nutrient"))
          .andExpect(jsonPath("$.errors[0].message").value("Este alimento não tem carboidrato para dimensionar a porção."));
        mvc.perform(post("/api/portion-quantities").contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodId\":1,\"nutrient\":\"ENERGY\",\"amount\":0}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("amount"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe uma quantidade maior que zero."));
        mvc.perform(post("/api/portion-quantities").contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodId\":1,\"nutrient\":\"FIBER\",\"amount\":10}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("nutrient"));
        mvc.perform(post("/api/portion-quantities").contentType(MediaType.APPLICATION_JSON)
                .content("{\"foodId\":999,\"nutrient\":\"FAT\",\"amount\":10}"))
          .andExpect(status().isNotFound());
    }
    @Test void nestedPortionErrorsAndMissingFoodInLaterMeal() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[{\"foodId\":1,\"quantityG\":1},{\"foodId\":1,\"quantityG\":1},{\"foodId\":1,\"quantityG\":0}]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options[0].foods[2].quantityG"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe uma quantidade maior que zero."));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[]}]},{\"name\":\"B\",\"options\":[{\"foods\":[{\"foodId\":999,\"quantityG\":1}]}]}]}"))
          .andExpect(status().isNotFound());
    }
    @Test void mealOptionsAreValidatedWithNestedPaths() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe ao menos uma opção."));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\"}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options"));
        var six = String.join(",", java.util.Collections.nCopies(6, "{\"foods\":[]}"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":["+six+"]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe no máximo 5 opções por refeição."));
        var five = String.join(",", java.util.Collections.nCopies(5, "{\"foods\":[]}"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":["+five+"]}]}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.meals[0].options.length()").value(5));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[]},{\"foods\":[{\"foodId\":1,\"quantityG\":0}]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].options[1].foods[0].quantityG"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe uma quantidade maior que zero."));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"foods\":[],\"options\":[{\"foods\":[]}]}]}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("meals[0].foods"));
    }
    @Test void onlyFirstOptionCountsInTheDay() throws Exception {
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[{\"foodId\":1,\"quantityG\":100}]},{\"foods\":[{\"foodId\":3,\"quantityG\":100}]}]}]}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.totals.energyKcal.consumed").value(130))
          .andExpect(jsonPath("$.meals[0].totals.energyKcal").value(130))
          .andExpect(jsonPath("$.meals[0].options[1].totals.energyKcal").value(900))
          .andExpect(jsonPath("$.macroEnergyShares.fatPercent").value(org.hamcrest.Matchers.lessThan(10.0)));
    }
    @Test void nutrientsAndReferencesFollowTheOptionalProfile() throws Exception {
        var meal = "\"meals\":[{\"name\":\"A\",\"options\":[{\"foods\":[{\"foodId\":1,\"quantityG\":100}]}]}]";
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"referenceProfile\":{\"sex\":\"MALE\",\"age\":71}," + meal + "}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.referenceSource.profile").value("Homem, 71 anos ou mais"))
          .andExpect(jsonPath("$.nutrients[1].code").value("CALCIUM")).andExpect(jsonPath("$.nutrients[1].reference.amount").value(1200))
          .andExpect(jsonPath("$.nutrients[1].reference.type").value("RDA")).andExpect(jsonPath("$.nutrients[1].status").value("COMPLETE"))
          .andExpect(jsonPath("$.meals[0].nutrients").doesNotExist());
        for (var profile : new String[] {"", "\"referenceProfile\":null,", "\"referenceProfile\":{\"sex\":\"FEMALE\"},",
                "\"referenceProfile\":{\"sex\":\"UNSPECIFIED\",\"age\":30},", "\"referenceProfile\":{\"sex\":\"FEMALE\",\"age\":18},"}) {
            mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON).content("{" + profile + meal + "}"))
              .andExpect(status().isOk()).andExpect(jsonPath("$.referenceSource").value(org.hamcrest.Matchers.nullValue()))
              .andExpect(jsonPath("$.nutrients[1].reference").value(org.hamcrest.Matchers.nullValue()))
              .andExpect(jsonPath("$.nutrients[1].consumed").value(5));
        }
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"referenceProfile\":{\"sex\":\"FEMALE\",\"age\":131}," + meal + "}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("referenceProfile.age"))
          .andExpect(jsonPath("$.errors[0].message").value("Informe uma idade de até 130 anos."));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"referenceProfile\":{\"sex\":\"OTHER\",\"age\":30}," + meal + "}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("referenceProfile.sex"));
        mvc.perform(post("/api/diet-calculations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"referenceProfile\":{\"sex\":\"FEMALE\",\"age\":30.5}," + meal + "}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("referenceProfile.age"));
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

