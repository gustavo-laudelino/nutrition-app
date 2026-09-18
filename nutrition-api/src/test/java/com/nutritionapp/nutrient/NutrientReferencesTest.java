package com.nutritionapp.nutrient;

import java.io.StringReader;
import com.nutritionapp.patient.PatientContext.Sex;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.*;

class NutrientReferencesTest {
    private final NutrientReferences references = new NutrientReferences();

    @ParameterizedTest
    @CsvSource({
        "IRON,FEMALE,19,18,RDA", "IRON,FEMALE,50,18,RDA", "IRON,FEMALE,51,8,RDA", "IRON,MALE,50,8,RDA",
        "MAGNESIUM,MALE,30,400,RDA", "MAGNESIUM,MALE,31,420,RDA", "MAGNESIUM,FEMALE,30,310,RDA", "MAGNESIUM,FEMALE,31,320,RDA",
        "CALCIUM,MALE,70,1000,RDA", "CALCIUM,MALE,71,1200,RDA", "CALCIUM,FEMALE,50,1000,RDA", "CALCIUM,FEMALE,51,1200,RDA",
        "FIBER,MALE,50,38,AI", "FIBER,MALE,51,30,AI", "FIBER,FEMALE,50,25,AI", "FIBER,FEMALE,130,21,AI",
        "VITAMIN_B6,MALE,51,1.7,RDA", "VITAMIN_B6,FEMALE,51,1.5,RDA", "POTASSIUM,MALE,40,3400,AI", "POTASSIUM,FEMALE,40,2600,AI",
        "COPPER,FEMALE,80,0.9,RDA", "VITAMIN_A_RAE,MALE,19,900,RDA"})
    void selectsReferenceBySexAndAgeLimits(String code, Sex sex, int age, String amount, NutrientReferences.Type type) {
        var reference = references.find(code, sex, age).orElseThrow();
        assertThat(reference.amount()).isEqualByComparingTo(amount);
        assertThat(reference.type()).isEqualTo(type);
    }

    @Test
    void noReferenceOutsideCoveredProfilesOrForNutrientsWithoutOne() {
        assertThat(references.find("CALCIUM", Sex.FEMALE, 18)).isEmpty();
        assertThat(references.find("CALCIUM", Sex.UNSPECIFIED, 30)).isEmpty();
        assertThat(references.find("CALCIUM", null, 30)).isEmpty();
        assertThat(references.find("CALCIUM", Sex.MALE, 131)).isEmpty();
        assertThat(references.find("CHOLESTEROL", Sex.MALE, 30)).isEmpty();
        assertThat(references.find("SATURATED_FAT", Sex.FEMALE, 30)).isEmpty();
        assertThat(NutrientReferences.covers(Sex.FEMALE, null)).isFalse();
    }

    @Test
    void everyReferencedNutrientHasBothSexesForEveryAdultAge() {
        for (var code : new String[] {"FIBER", "CALCIUM", "COPPER", "IRON", "PHOSPHORUS", "MAGNESIUM", "MANGANESE", "POTASSIUM",
                "SODIUM", "ZINC", "VITAMIN_A_RAE", "THIAMIN", "RIBOFLAVIN", "NIACIN", "VITAMIN_B6", "VITAMIN_C"}) {
            for (var sex : new Sex[] {Sex.FEMALE, Sex.MALE}) {
                for (int age = 19; age <= 130; age++) {
                    assertThat(references.find(code, sex, age)).as(code + " " + sex + " " + age).isPresent();
                }
            }
        }
    }

    @Test
    void describesTheLifeStageGroup() {
        assertThat(NutrientReferences.describe(Sex.FEMALE, 19)).isEqualTo("Mulher, 19–30 anos");
        assertThat(NutrientReferences.describe(Sex.MALE, 31)).isEqualTo("Homem, 31–50 anos");
        assertThat(NutrientReferences.describe(Sex.MALE, 70)).isEqualTo("Homem, 51–70 anos");
        assertThat(NutrientReferences.describe(Sex.FEMALE, 71)).isEqualTo("Mulher, 71 anos ou mais");
        assertThat(NutrientReferences.describe(Sex.FEMALE, 18)).isNull();
    }

    @Test
    void rejectsUnknownNutrientDifferentUnitAndBadHeader() {
        var header = "# comentário\nnutrient_code,sex,age_min,age_max,amount,unit,type\n";
        assertThatThrownBy(() -> new NutrientReferences(new StringReader(header + "VITAMIN_Z,MALE,19,130,1,mg,RDA")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("nutriente desconhecido").hasMessageContaining("linha 3");
        assertThatThrownBy(() -> new NutrientReferences(new StringReader(header + "CALCIUM,MALE,19,130,1,g,RDA")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("unidade");
        assertThatThrownBy(() -> new NutrientReferences(new StringReader(header + "CALCIUM,MALE,19,130,abc,mg,RDA")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new NutrientReferences(new StringReader(header + "CALCIUM,MALE,10,130,1,mg,RDA")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new NutrientReferences(new StringReader("code,sex\nCALCIUM,MALE")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("cabeçalho");
        assertThat(new NutrientReferences(new StringReader(header + "CALCIUM,MALE,19,130,1000,mg,RDA"))
                .find("CALCIUM", Sex.MALE, 40)).isPresent();
    }
}
