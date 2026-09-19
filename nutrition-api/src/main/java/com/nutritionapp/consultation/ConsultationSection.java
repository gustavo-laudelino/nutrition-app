package com.nutritionapp.consultation;

import java.util.List;
import com.nutritionapp.record.RecordField;
import com.nutritionapp.record.TemplateFieldData.Width;

/**
 * A section of the template as copied into the consultation when it was opened, with each field's full catalog
 * definition. Later changes to the template or the catalog never reach it.
 */
public record ConsultationSection(String name, List<Field> fields) {
    public record Field(Width width, Integer textRows, RecordField field) {}
}
