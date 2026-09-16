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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EnergyEstimateApiTest {
    @Autowired private MockMvc mvc;
    private static final String PATIENT = "\"patient\":{\"weightKg\":80,\"heightCm\":175,\"age\":30,\"sex\":\"MALE\",\"driActivity\":\"ACTIVE\",\"goal\":\"WEIGHT_LOSS\"}";
    @Test void driResponseIsAnEstimateNotATarget() throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON).content("{"+PATIENT+",\"method\":\"DRI_2023\"}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.estimatedKcal").value(3093.72))
          .andExpect(jsonPath("$.driActivity").value("ACTIVE")).andExpect(jsonPath("$.basalKcal").value(org.hamcrest.Matchers.nullValue()))
          .andExpect(jsonPath("$.targetKcal").doesNotExist());
    }
    @Test void faoIncludesBasalPalAndTotal() throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON).content("{"+PATIENT+",\"method\":\"FAO\",\"faoPal\":1.60}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.estimatedKcal").value(2865.38))
          .andExpect(jsonPath("$.basalKcal").value(1790.86)).andExpect(jsonPath("$.faoPal").value(1.60))
          .andExpect(jsonPath("$.faoActivity").value("SEDENTARY_LIGHT"));
    }
    @ParameterizedTest @ValueSource(strings={
        "\"method\":\"FAO\"", "\"method\":\"PER_KG\"",
        "\"method\":\"FAO\",\"faoPal\":1.39", "\"method\":\"FAO\",\"faoPal\":2.41",
        "\"method\":\"FAO\",\"faoPal\":1.695", "\"method\":\"PER_KG\",\"kcalPerKg\":0",
        "\"method\":\"FAO\",\"faoPal\":1.6,\"driActivity\":\"ACTIVE\"",
        "\"method\":\"DRI_2023\",\"driActivity\":\"ACTIVE\",\"faoPal\":1.6"})
    void invalidMethodParametersProduceFieldErrors(String parameters) throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON).content("{"+PATIENT+","+parameters+"}"))
          .andExpect(status().isBadRequest());
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"method\":\"DRI_2023\"}","{\"method\":\"UNKNOWN\"}","{\"method\":\"FAO\",\"patient\":{\"activity\":\"ACTIVE\"}}"})
    void rejectsMissingInputsAndUniversalPatientActivity(String body) throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
    }
    @ParameterizedTest @ValueSource(strings={"DRI_2023","FAO"})
    void rejectsAge18ForEveryEstimateMethod(String method) throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON)
          .content("{"+PATIENT.replace("30","18")+",\"method\":\""+method+"\"}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("patient.age"));
    }
    @Test void driRequiresActivityInPatientProfile() throws Exception {
        mvc.perform(post("/api/energy-estimates").contentType(MediaType.APPLICATION_JSON)
          .content("{"+PATIENT.replace(",\"driActivity\":\"ACTIVE\"","")+",\"method\":\"DRI_2023\"}"))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("patient.driActivity"));
    }
    @Test void perKgPrescribesDirectlyAndSupportsPercentageMacros() throws Exception {
        mvc.perform(post("/api/energy-prescriptions/per-kg").contentType(MediaType.APPLICATION_JSON)
          .content("{\"weightKg\":120,\"kcalPerKg\":20}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.prescribedEnergyKcal").value(2400))
          .andExpect(jsonPath("$.estimatedKcal").doesNotExist());
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON)
          .content("{\"prescribedEnergyKcal\":2400,\"macros\":{\"method\":\"PERCENTAGE\",\"carbohydrate\":50,\"protein\":20,\"fat\":30}}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.targets.carbohydrateG").value(300))
          .andExpect(jsonPath("$.prescription.referenceEstimateKcal").value(org.hamcrest.Matchers.nullValue()));
    }
    @Test void perKgRoundsOnlyTheFinalPrescription() throws Exception {
        mvc.perform(post("/api/energy-prescriptions/per-kg").contentType(MediaType.APPLICATION_JSON)
          .content("{\"weightKg\":80.003,\"kcalPerKg\":25.1234}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.prescribedEnergyKcal").value(2009.95));
    }
    @ParameterizedTest @ValueSource(strings={"{}","{\"weightKg\":120}","{\"weightKg\":0,\"kcalPerKg\":20}","{\"weightKg\":120,\"kcalPerKg\":-1}","{\"weightKg\":0.001,\"kcalPerKg\":0.0001}"})
    void rejectsInvalidPerKgPrescription(String body) throws Exception {
        mvc.perform(post("/api/energy-prescriptions/per-kg").contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors").isArray());
    }
    @Test void oldEnergyChoiceIsRejectedInsteadOfSilentlyIgnored() throws Exception {
        mvc.perform(post("/api/target-calculations").contentType(MediaType.APPLICATION_JSON).content("{\"energy\":{\"method\":\"MANUAL\",\"manualKcal\":2000}}"))
          .andExpect(status().isBadRequest());
    }
}
