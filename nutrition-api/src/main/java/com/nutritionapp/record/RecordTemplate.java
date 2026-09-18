package com.nutritionapp.record;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.nutritionapp.record.TemplateFieldData.Width;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A nutritionist's record template: named sections holding catalog fields in order. Sections and fields are
 * rows of the template (no identity of their own); saving replaces the whole structure.
 */
@Entity
@Table(name = "record_templates")
public class RecordTemplate {
    @Id
    private UUID id;
    @Column(nullable = false)
    private UUID nutritionistId;
    @Column(nullable = false, length = TemplateStructureRules.MAX_NAME)
    private String name;
    @Column(name = "is_default", nullable = false)
    private boolean defaultTemplate;
    @ElementCollection
    @CollectionTable(name = "record_template_sections", joinColumns = @JoinColumn(name = "template_id"))
    @OrderBy("displayOrder")
    private List<Section> sections = new ArrayList<>();
    @ElementCollection
    @CollectionTable(name = "record_template_fields", joinColumns = @JoinColumn(name = "template_id"))
    @OrderBy("sectionOrder, displayOrder")
    private List<Field> fields = new ArrayList<>();
    @Column(nullable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant updatedAt;
    @Version
    @Column(nullable = false)
    private Long version;

    @Embeddable
    public static class Section {
        @Column(nullable = false)
        private int displayOrder;
        @Column(nullable = false, length = TemplateStructureRules.MAX_NAME)
        private String name;

        protected Section() {
        }

        Section(int displayOrder, String name) {
            this.displayOrder = displayOrder;
            this.name = name;
        }
    }

    @Embeddable
    public static class Field {
        @Column(nullable = false, length = 60)
        private String fieldCode;
        @Column(nullable = false)
        private int sectionOrder;
        @Column(nullable = false)
        private int displayOrder;
        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 12)
        private Width width;
        private Integer textRows;

        protected Field() {
        }

        Field(String fieldCode, int sectionOrder, int displayOrder, Width width, Integer textRows) {
            this.fieldCode = fieldCode;
            this.sectionOrder = sectionOrder;
            this.displayOrder = displayOrder;
            this.width = width;
            this.textRows = textRows;
        }
    }

    protected RecordTemplate() {
    }

    public RecordTemplate(UUID nutritionistId, String name, List<TemplateSectionData> structure, boolean defaultTemplate) {
        this.id = UUID.randomUUID();
        this.nutritionistId = nutritionistId;
        this.defaultTemplate = defaultTemplate;
        this.createdAt = Instant.now();
        replace(name, structure);
    }

    /** Validated by the caller; positions follow the list order. */
    public void replace(String name, List<TemplateSectionData> structure) {
        this.name = name;
        sections.clear();
        fields.clear();
        for (int s = 0; s < structure.size(); s++) {
            var section = structure.get(s);
            sections.add(new Section(s, section.name()));
            for (int f = 0; f < section.fields().size(); f++) {
                var field = section.fields().get(f);
                fields.add(new Field(field.code(), s, f, field.width(), field.textRows()));
            }
        }
        this.updatedAt = Instant.now();
    }

    public List<TemplateSectionData> structure() {
        var result = new ArrayList<TemplateSectionData>();
        for (var section : sections) {
            var placed = fields.stream().filter(field -> field.sectionOrder == section.displayOrder)
                    .map(field -> new TemplateFieldData(field.fieldCode, field.width, field.textRows)).toList();
            result.add(new TemplateSectionData(section.name, placed));
        }
        return result;
    }

    public Set<String> fieldCodes() {
        return fields.stream().map(field -> field.fieldCode).collect(Collectors.toSet());
    }

    /** Becoming (or ceasing to be) the default is not an edit of the template: updatedAt stays. */
    public void markDefault(boolean value) {
        this.defaultTemplate = value;
    }

    public UUID getId() { return id; }
    public UUID getNutritionistId() { return nutritionistId; }
    public String getName() { return name; }
    public boolean isDefaultTemplate() { return defaultTemplate; }
    public int sectionCount() { return sections.size(); }
    public int fieldCount() { return fields.size(); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
