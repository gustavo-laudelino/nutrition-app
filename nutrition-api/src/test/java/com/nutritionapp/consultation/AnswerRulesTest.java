package com.nutritionapp.consultation;

import java.math.BigDecimal;
import java.util.List;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.record.RecordField;
import com.nutritionapp.record.RecordField.Choice;
import com.nutritionapp.record.RecordField.Type;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AnswerRulesTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final List<Choice> OPTIONS = List.of(new Choice("a", "A"), new Choice("b", "B"));

    private static RecordField field(Type type) {
        return switch (type) {
            case SHORT_TEXT -> new RecordField("f", "F", null, type, 10, null, null, null, null, null, null, null, null, null, null, null, null);
            case NUMBER -> new RecordField("f", "F", null, type, null, "kg", new BigDecimal("1"), new BigDecimal("500"), 1, null, null, null, null, null, null, null, null);
            case YES_NO_DETAIL -> new RecordField("f", "F", null, type, null, null, null, null, null, "Quais?", null, null, null, null, null, null, null);
            case SINGLE_CHOICE, MULTI_CHOICE -> new RecordField("f", "F", null, type, null, null, null, null, null, null, OPTIONS, false, null, null, null, null, null);
            case SCALE -> new RecordField("f", "F", null, type, null, null, BigDecimal.ZERO, BigDecimal.TEN, null, null, null, null, "0", "10", null, null, null);
            case TABLE -> new RecordField("f", "F", null, type, null, null, null, null, null, null, null, null, null, null, List.of(new Choice("time", "Horário"), new Choice("food", "Alimentos")), null, null);
            default -> new RecordField("f", "F", null, type, null, null, null, null, null, null, null, null, null, null, null, null, null);
        };
    }

    private static JsonNode normalize(Type type, String value) {
        return AnswerRules.normalize(field(type), JSON.readTree(value), "answers.f");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "SHORT_TEXT|\"  texto  \"|\"texto\"",
            "SHORT_TEXT|\"   \"|",
            "NUMBER|72.50|72.5",
            "NUMBER|80|80",
            "DATE|\"2026-09-18\"|\"2026-09-18\"",
            "YES_NO_DETAIL|{\"answer\":true,\"detail\":\" apendicite \"}|{\"answer\":true,\"detail\":\"apendicite\"}",
            "YES_NO_DETAIL|{\"answer\":false,\"detail\":\"  \"}|{\"answer\":false}",
            "SINGLE_CHOICE|{\"option\":\"b\"}|{\"option\":\"b\"}",
            "SINGLE_CHOICE|{}|",
            "MULTI_CHOICE|{\"options\":[\"a\",\"b\"]}|{\"options\":[\"a\",\"b\"]}",
            "MULTI_CHOICE|{\"options\":[]}|",
            "SCALE|7|7",
            "TABLE|[{\"time\":\" 8h \",\"food\":\"pão\"},{\"time\":\"\",\"food\":\" \"}]|[{\"time\":\"8h\",\"food\":\"pão\"}]",
            "TABLE|[{}]|",
            "DATE|null|"})
    void validAnswersAreNormalizedAndEmptyOnesDropped(Type type, String value, String expected) {
        var result = normalize(type, value);
        // Compared as written JSON: that is what the consultation stores.
        if (expected == null) assertNull(result);
        else assertEquals(JSON.writeValueAsString(JSON.readTree(expected)), JSON.writeValueAsString(result));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "SHORT_TEXT|\"texto longo demais\"|answers.f|Use até 10 caracteres.",
            "SHORT_TEXT|12|answers.f|Informe um texto.",
            "NUMBER|\"72\"|answers.f|Informe um número.",
            "NUMBER|0.5|answers.f|Informe um valor entre 1 e 500.",
            "NUMBER|72.55|answers.f|Use até 1 casa decimal.",
            "DATE|\"2026-02-30\"|answers.f|Informe uma data válida.",
            "YES_NO_DETAIL|{\"detail\":\"x\"}|answers.f.answer|Responda sim ou não.",
            "YES_NO_DETAIL|{\"answer\":true,\"extra\":1}|answers.f.extra|Propriedade não reconhecida.",
            "SINGLE_CHOICE|{\"option\":\"z\"}|answers.f.option|Opção inexistente.",
            "SINGLE_CHOICE|{\"other\":\"outra\"}|answers.f.other|Esta pergunta não aceita outra opção.",
            "SINGLE_CHOICE|{\"option\":\"a\",\"other\":\"x\"}|answers.f|Escolha uma opção ou informe outra, não as duas.",
            "MULTI_CHOICE|{\"options\":[\"a\",\"a\"]}|answers.f.options[1]|Opção repetida.",
            "MULTI_CHOICE|{\"options\":\"a\"}|answers.f.options|Informe uma lista de opções.",
            "SCALE|11|answers.f|Escolha um valor entre 0 e 10.",
            "SCALE|2.5|answers.f|Escolha um valor da escala.",
            "TABLE|{\"time\":\"8h\"}|answers.f|Informe as linhas da tabela.",
            "TABLE|[{\"place\":\"casa\"}]|answers.f[0].place|Propriedade não reconhecida."})
    void invalidAnswersNameTheField(Type type, String value, String field, String message) {
        var failure = assertThrows(ApiFailure.class, () -> normalize(type, value));
        assertEquals(field, failure.field());
        assertEquals(message, failure.getMessage());
    }

    @Test
    void otherIsAcceptedWhenTheFieldAllowsIt() {
        var field = new RecordField("f", "F", null, Type.MULTI_CHOICE, null, null, null, null, null, null, OPTIONS, true,
                null, null, null, null, null);
        assertEquals(JSON.readTree("{\"options\":[],\"other\":\"gastrite\"}"),
                AnswerRules.normalize(field, JSON.readTree("{\"other\":\" gastrite \"}"), "answers.f"));
    }

    @Test
    void tablesAcceptUpToFiftyRows() {
        var rows = "[" + "{\"time\":\"8h\"},".repeat(50) + "{\"time\":\"9h\"}]";
        assertEquals("Use até 50 linhas.", assertThrows(ApiFailure.class, () -> normalize(Type.TABLE, rows)).getMessage());
    }
}
