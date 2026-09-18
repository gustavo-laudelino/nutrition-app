package com.nutritionapp.record;

import java.math.BigDecimal;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A question of the system catalog. Only the settings of its {@link Type} are filled; the others stay null.
 * Codes are permanent: a field that leaves use is marked deprecated, never removed or reused.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RecordField(
        String code, String label, String help, Type type,
        Integer maxLength,
        String unit, BigDecimal min, BigDecimal max, Integer decimals,
        String detailLabel,
        List<Choice> options, Boolean allowOther,
        String minLabel, String maxLabel,
        List<Choice> columns,
        Sync sync,
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) Boolean deprecated) {

    public enum Type { SHORT_TEXT, LONG_TEXT, NUMBER, DATE, YES_NO_DETAIL, SINGLE_CHOICE, MULTI_CHOICE, SCALE, TABLE }

    /** Patient registry value the answer updates (consultations, feature 2). */
    public enum Sync { PATIENT_WEIGHT, PATIENT_HEIGHT }

    /** Option of a choice field or column of a table. */
    public record Choice(String code, String label) {}

    public boolean isDeprecated() {
        return Boolean.TRUE.equals(deprecated);
    }

    RecordField withMaxLength(int value) {
        return new RecordField(code, label, help, type, value, unit, min, max, decimals, detailLabel,
                options, allowOther, minLabel, maxLabel, columns, sync, deprecated);
    }
}
