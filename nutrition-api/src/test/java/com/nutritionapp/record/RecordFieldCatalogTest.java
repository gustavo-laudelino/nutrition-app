package com.nutritionapp.record;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import com.nutritionapp.record.RecordField.Type;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecordFieldCatalogTest {
    private static final String EMPTY_STARTER = """
            {"name":"Modelo","sections":[{"name":"Seção","fields":[]}]}""";
    private static final String FIELDS = """
            {"code":"notes","label":"Notas","type":"LONG_TEXT"},
            {"code":"old_notes","label":"Notas antigas","type":"SHORT_TEXT","deprecated":true},
            {"code":"weight","label":"Peso","type":"NUMBER","unit":"kg","min":1,"max":500,"decimals":3,"sync":"PATIENT_WEIGHT"},
            {"code":"diet","label":"Dieta","type":"SINGLE_CHOICE","options":[{"code":"a","label":"A"},{"code":"b","label":"B"}]},
            {"code":"recall","label":"Recordatório","type":"TABLE","columns":[{"code":"time","label":"Horário"}]}""";

    @Test
    void realFilesLoadAndTheStarterUsesOnlyAvailableFields() {
        var catalog = new RecordFieldCatalog();
        assertEquals("Primeira consulta", catalog.starter().name());
        assertEquals(6, catalog.starter().sections().size());
        var available = catalog.available().stream().flatMap(category -> category.fields().stream()).toList();
        assertTrue(available.size() >= 50);
        catalog.starter().sections().forEach(section -> section.fields().forEach(field ->
                assertTrue(available.stream().anyMatch(item -> item.code().equals(field.code())), field.code())));
        assertEquals(RecordField.Sync.PATIENT_WEIGHT, catalog.find("weight_kg").orElseThrow().sync());
    }

    @Test
    void deprecatedFieldsLeaveTheToolboxButStayFindableAndTextGetsItsDefaultLength() {
        var catalog = catalog(FIELDS, EMPTY_STARTER);
        var codes = catalog.available().getFirst().fields().stream().map(RecordField::code).toList();
        assertFalse(codes.contains("old_notes"));
        assertTrue(catalog.find("old_notes").orElseThrow().isDeprecated());
        assertEquals(4000, catalog.find("notes").orElseThrow().maxLength());
        assertEquals(200, catalog.find("old_notes").orElseThrow().maxLength());
        assertEquals(Type.TABLE, catalog.find("recall").orElseThrow().type());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"code\":\"notes\",\"label\":\"Outra\",\"type\":\"SHORT_TEXT\"}|campo repetido: notes",
            "{\"code\":\"Bad-Code\",\"label\":\"X\",\"type\":\"SHORT_TEXT\"}|código de campo inválido",
            "{\"code\":\"x\",\"label\":\" \",\"type\":\"SHORT_TEXT\"}|rótulo obrigatório",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"COLOR\"}|Catálogo do prontuário inválido",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"SHORT_TEXT\",\"unit\":\"kg\"}|unit não se aplica",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"SHORT_TEXT\",\"maxLength\":300}|maxLength deve ser de 1 a 200",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"NUMBER\",\"min\":5,\"max\":5,\"decimals\":0}|min menor que max",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"NUMBER\",\"min\":0,\"max\":5}|decimals deve ser de 0 a 3",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"SCALE\",\"min\":0,\"max\":2.5}|números inteiros",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"SINGLE_CHOICE\",\"options\":[{\"code\":\"a\",\"label\":\"A\"}]}|precisa de ao menos 2",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"MULTI_CHOICE\",\"options\":[{\"code\":\"a\",\"label\":\"A\"},{\"code\":\"a\",\"label\":\"B\"}]}|repetido ou sem rótulo",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"TABLE\"}|columns precisa de ao menos 1",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"DATE\",\"sync\":\"PATIENT_HEIGHT\"}|sync não se aplica",
            "{\"code\":\"x\",\"label\":\"X\",\"type\":\"DATE\",\"color\":\"red\"}|Catálogo do prontuário inválido"})
    void invalidCatalogFailsStartup(String extraField, String message) {
        var error = assertThrows(IllegalStateException.class, () -> catalog(FIELDS + "," + extraField, EMPTY_STARTER));
        assertTrue(error.getMessage().contains(message), error.getMessage());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"code\":\"missing\",\"width\":\"FULL\"}|sections[0].fields[0].code: Campo inexistente no catálogo.",
            "{\"code\":\"old_notes\",\"width\":\"FULL\"}|sections[0].fields[0].code: Campo inexistente no catálogo.",
            "{\"code\":\"recall\",\"width\":\"HALF\"}|sections[0].fields[0].width: Tabelas ocupam a largura inteira.",
            "{\"code\":\"notes\",\"width\":\"FULL\"}|sections[0].fields[0].textRows: Escolha 3, 5 ou 8 linhas.",
            "{\"code\":\"weight\",\"width\":\"THIRD\",\"textRows\":3}|sections[0].fields[0].textRows: A altura só se aplica a texto longo.",
            "{\"code\":\"diet\",\"width\":\"HALF\"},{\"code\":\"diet\",\"width\":\"HALF\"}|sections[0].fields[1].code: O campo já está no modelo.",
            "{\"code\":\"diet\"}|com campo sem código ou largura"})
    void invalidStarterFailsStartup(String fields, String message) {
        var starter = "{\"name\":\"Modelo\",\"sections\":[{\"name\":\"Seção\",\"fields\":[" + fields + "]}]}";
        var error = assertThrows(IllegalStateException.class, () -> catalog(FIELDS, starter));
        assertTrue(error.getMessage().contains(message), error.getMessage());
    }

    private static RecordFieldCatalog catalog(String fields, String starter) {
        var catalog = "{\"categories\":[{\"code\":\"GENERAL\",\"name\":\"Geral\",\"fields\":[" + fields + "]}]}";
        return new RecordFieldCatalog(stream(catalog), stream(starter));
    }

    private static InputStream stream(String text) {
        return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));
    }
}
