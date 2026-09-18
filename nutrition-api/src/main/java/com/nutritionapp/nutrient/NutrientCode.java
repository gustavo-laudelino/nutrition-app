package com.nutritionapp.nutrient;

/** Known nutrient codes and units, identical to the seed of V2__create_nutrient_model.sql. */
public enum NutrientCode {
    FIBER("g"), CHOLESTEROL("mg"), SATURATED_FAT("g"), MONOUNSATURATED_FAT("g"), POLYUNSATURATED_FAT("g"),
    TRANS_FAT_18_1("g"), TRANS_FAT_18_2("g"),
    CALCIUM("mg"), COPPER("mg"), IRON("mg"), PHOSPHORUS("mg"), MAGNESIUM("mg"), MANGANESE("mg"),
    POTASSIUM("mg"), SODIUM("mg"), ZINC("mg"),
    VITAMIN_A_RAE("mcg"), RETINOL("mcg"), VITAMIN_A_RE("mcg"), THIAMIN("mg"), RIBOFLAVIN("mg"), NIACIN("mg"),
    VITAMIN_B6("mg"), VITAMIN_C("mg"),
    MOISTURE("%"), ASH("g");

    private final String unit;
    NutrientCode(String unit) { this.unit = unit; }
    public String unit() { return unit; }
}
