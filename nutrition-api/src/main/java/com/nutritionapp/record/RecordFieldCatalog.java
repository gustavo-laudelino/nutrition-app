package com.nutritionapp.record;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.record.RecordField.Choice;
import com.nutritionapp.record.RecordField.Type;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * System catalog of record fields and the starter template, from the versioned files under {@code records/}.
 * Both are validated on startup: any inconsistency fails the application instead of reaching a nutritionist.
 */
@Component
public class RecordFieldCatalog {
    static final String CATALOG = "records/field-catalog.json";
    static final String STARTER = "records/starter-template.json";
    private static final Pattern FIELD_CODE = Pattern.compile("[a-z][a-z0-9_]*");
    private static final Pattern CATEGORY_CODE = Pattern.compile("[A-Z][A-Z_]*");
    private static final int SHORT_TEXT_LENGTH = 200;
    private static final int LONG_TEXT_LENGTH = 4000;
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    public record StarterTemplate(String name, List<TemplateSectionData> sections) {}
    record CatalogFile(List<RecordFieldCategory> categories) {}

    private final Map<String, RecordField> fields = new LinkedHashMap<>();
    private final List<RecordFieldCategory> available;
    private final StarterTemplate starter;

    public RecordFieldCatalog() {
        this(open(CATALOG), open(STARTER));
    }

    RecordFieldCatalog(InputStream catalog, InputStream starter) {
        this.available = List.copyOf(categories(read(catalog, CatalogFile.class, CATALOG)));
        this.starter = checkStarter(read(starter, StarterTemplate.class, STARTER));
    }

    /** Categories in file order, without deprecated fields (they only stay valid in templates that have them). */
    public List<RecordFieldCategory> available() {
        return available;
    }

    /** Any catalog field, deprecated included. */
    public Optional<RecordField> find(String code) {
        return Optional.ofNullable(fields.get(code));
    }

    public StarterTemplate starter() {
        return starter;
    }

    private List<RecordFieldCategory> categories(CatalogFile file) {
        if (file.categories() == null || file.categories().isEmpty()) throw invalid(CATALOG, "nenhuma categoria");
        var codes = new HashSet<String>();
        var result = new ArrayList<RecordFieldCategory>();
        for (var category : file.categories()) {
            if (category.code() == null || !CATEGORY_CODE.matcher(category.code()).matches() || !codes.add(category.code()))
                throw invalid(CATALOG, "código de categoria inválido ou repetido: " + category.code());
            if (blank(category.name())) throw invalid(CATALOG, "categoria " + category.code() + " sem nome");
            if (category.fields() == null || category.fields().isEmpty())
                throw invalid(CATALOG, "categoria " + category.code() + " sem campos");
            var visible = new ArrayList<RecordField>();
            for (var raw : category.fields()) {
                var field = checkField(raw);
                if (fields.putIfAbsent(field.code(), field) != null) throw invalid(CATALOG, "campo repetido: " + field.code());
                if (!field.isDeprecated()) visible.add(field);
            }
            if (!visible.isEmpty()) result.add(new RecordFieldCategory(category.code(), category.name(), List.copyOf(visible)));
        }
        return result;
    }

    /** Only the settings of the field's type may be present; text fields get their default length. */
    private static RecordField checkField(RecordField field) {
        if (field == null) throw invalid(CATALOG, "campo vazio");
        if (field.code() == null || !FIELD_CODE.matcher(field.code()).matches())
            throw invalid(CATALOG, "código de campo inválido: " + field.code());
        var where = "campo " + field.code() + ": ";
        if (blank(field.label())) throw invalid(CATALOG, where + "rótulo obrigatório");
        if (field.type() == null) throw invalid(CATALOG, where + "tipo obrigatório");
        var type = field.type();
        var text = type == Type.SHORT_TEXT || type == Type.LONG_TEXT;
        var number = type == Type.NUMBER;
        var scale = type == Type.SCALE;
        var choice = type == Type.SINGLE_CHOICE || type == Type.MULTI_CHOICE;
        only(field.maxLength(), text, where + "maxLength");
        only(field.unit(), number, where + "unit");
        only(field.decimals(), number, where + "decimals");
        only(field.min(), number || scale, where + "min");
        only(field.max(), number || scale, where + "max");
        only(field.detailLabel(), type == Type.YES_NO_DETAIL, where + "detailLabel");
        only(field.options(), choice, where + "options");
        only(field.allowOther(), choice, where + "allowOther");
        only(field.minLabel(), scale, where + "minLabel");
        only(field.maxLabel(), scale, where + "maxLabel");
        only(field.columns(), type == Type.TABLE, where + "columns");
        only(field.sync(), number, where + "sync");
        if (number || scale) {
            if (field.min() == null || field.max() == null || field.min().compareTo(field.max()) >= 0)
                throw invalid(CATALOG, where + "informe min menor que max");
        }
        if (number && (field.decimals() == null || field.decimals() < 0 || field.decimals() > 3))
            throw invalid(CATALOG, where + "decimals deve ser de 0 a 3");
        if (scale && (!integer(field.min()) || !integer(field.max())))
            throw invalid(CATALOG, where + "a escala usa números inteiros");
        if (choice) choices(field.options(), 2, where + "options");
        if (type == Type.TABLE) choices(field.columns(), 1, where + "columns");
        if (text) {
            var limit = type == Type.SHORT_TEXT ? SHORT_TEXT_LENGTH : LONG_TEXT_LENGTH;
            if (field.maxLength() == null) return field.withMaxLength(limit);
            if (field.maxLength() < 1 || field.maxLength() > limit)
                throw invalid(CATALOG, where + "maxLength deve ser de 1 a " + limit);
        }
        return field;
    }

    private StarterTemplate checkStarter(StarterTemplate template) {
        if (blank(template.name()) || template.name().strip().length() > TemplateStructureRules.MAX_NAME)
            throw invalid(STARTER, "nome obrigatório, até 60 caracteres");
        var sections = template.sections();
        if (sections == null || sections.isEmpty() || sections.size() > TemplateStructureRules.MAX_SECTIONS)
            throw invalid(STARTER, "de 1 a 20 seções");
        for (var section : sections) {
            if (section == null || blank(section.name()) || section.name().length() > TemplateStructureRules.MAX_NAME)
                throw invalid(STARTER, "seção sem nome ou com mais de 60 caracteres");
            if (section.fields() == null || section.fields().stream().anyMatch(field ->
                    field == null || field.code() == null || field.width() == null))
                throw invalid(STARTER, "seção " + section.name() + " com campo sem código ou largura");
        }
        try {
            TemplateStructureRules.check(sections, this::find, Set.of());
        } catch (ApiFailure failure) {
            throw invalid(STARTER, failure.field() + ": " + failure.getMessage());
        }
        return new StarterTemplate(template.name().strip(), List.copyOf(sections));
    }

    private static void choices(List<Choice> choices, int minimum, String where) {
        if (choices == null || choices.size() < minimum) throw invalid(CATALOG, where + " precisa de ao menos " + minimum);
        var codes = new HashSet<String>();
        for (var choice : choices) {
            if (choice == null || choice.code() == null || !FIELD_CODE.matcher(choice.code()).matches()
                    || !codes.add(choice.code()) || blank(choice.label()))
                throw invalid(CATALOG, where + " com código inválido, repetido ou sem rótulo");
        }
    }

    private static void only(Object value, boolean allowed, String setting) {
        if (!allowed && value != null) throw invalid(CATALOG, setting + " não se aplica a este tipo");
    }

    private static boolean integer(BigDecimal value) {
        return value.stripTrailingZeros().scale() <= 0;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static <T> T read(InputStream input, Class<T> type, String resource) {
        try (input) {
            return JSON.readValue(input, type);
        } catch (JacksonException exception) {
            throw invalid(resource, exception.getOriginalMessage());
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static InputStream open(String resource) {
        try {
            return new ClassPathResource(resource).getInputStream();
        } catch (IOException exception) {
            throw new UncheckedIOException("Arquivo do prontuário não encontrado: " + resource, exception);
        }
    }

    private static IllegalStateException invalid(String resource, String message) {
        return new IllegalStateException("Catálogo do prontuário inválido (" + resource + "): " + message);
    }
}
