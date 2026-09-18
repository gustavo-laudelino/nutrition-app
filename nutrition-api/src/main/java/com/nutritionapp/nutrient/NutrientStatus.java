package com.nutritionapp.nutrient;

/** How a food's nutrient value was reported by the source (TACO legend). */
public enum NutrientStatus {
    /** Analyzed value. */
    VALUE,
    /** "Tr": below the quantification limit; counts as 0. */
    TRACE,
    /** "NA": not applicable (e.g. cholesterol in plants); counts as 0. */
    NOT_APPLICABLE,
    /** Blank or "*": not analyzed; no value, the day total becomes partial. */
    NOT_ANALYZED;

    /** Whether the value can be summed (as the amount, or 0 for trace/not applicable). */
    public boolean hasData() { return this != NOT_ANALYZED; }
}
