package com.nutritionapp.record;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RecordTemplateResponse(UUID id, String name, boolean isDefault, Long version, Instant updatedAt,
                                     List<TemplateSectionData> sections) {

    public static RecordTemplateResponse from(RecordTemplate template) {
        return new RecordTemplateResponse(template.getId(), template.getName(), template.isDefaultTemplate(),
                template.getVersion(), template.getUpdatedAt(), template.structure());
    }

    /** Card of the template list. */
    public record Summary(UUID id, String name, boolean isDefault, int sectionCount, int fieldCount, Instant updatedAt) {
        static Summary from(RecordTemplate template) {
            return new Summary(template.getId(), template.getName(), template.isDefaultTemplate(),
                    template.sectionCount(), template.fieldCount(), template.getUpdatedAt());
        }
    }
}
