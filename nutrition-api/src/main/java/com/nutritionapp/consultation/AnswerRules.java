package com.nutritionapp.consultation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.record.RecordField;
import com.nutritionapp.record.RecordField.Choice;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

/**
 * Checks one answer against its field (the copy kept in the consultation) and returns it normalized:
 * texts trimmed, empty values and empty table rows dropped. Null means "not answered".
 */
final class AnswerRules {
    static final int DETAIL_LENGTH = 500;
    static final int OTHER_LENGTH = 200;
    static final int TABLE_ROWS = 50;
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private AnswerRules() {
    }

    static JsonNode normalize(RecordField field, JsonNode value, String path) {
        if (value == null || value.isNull()) return null;
        return switch (field.type()) {
            case SHORT_TEXT, LONG_TEXT -> text(value, field.maxLength(), path);
            case NUMBER -> number(field, value, path);
            case DATE -> date(value, path);
            case YES_NO_DETAIL -> yesNo(value, path);
            case SINGLE_CHOICE -> single(field, value, path);
            case MULTI_CHOICE -> multi(field, value, path);
            case SCALE -> scale(field, value, path);
            case TABLE -> table(field, value, path);
        };
    }

    private static JsonNode text(JsonNode value, int limit, String path) {
        var text = string(value, path);
        if (text == null) return null;
        if (text.length() > limit) throw invalid(path, "Use até " + limit + " caracteres.");
        return NODES.stringNode(text);
    }

    private static JsonNode number(RecordField field, JsonNode value, String path) {
        if (!value.isNumber()) throw invalid(path, "Informe um número.");
        var number = value.decimalValue();
        if (number.compareTo(field.min()) < 0 || number.compareTo(field.max()) > 0)
            throw invalid(path, "Informe um valor entre " + plain(field.min()) + " e " + plain(field.max()) + ".");
        if (Math.max(number.stripTrailingZeros().scale(), 0) > field.decimals())
            throw invalid(path, switch (field.decimals()) {
                case 0 -> "Informe um número inteiro.";
                case 1 -> "Use até 1 casa decimal.";
                default -> "Use até " + field.decimals() + " casas decimais.";
            });
        var plain = number.stripTrailingZeros();
        // 80 stays 80, never 8E+1.
        return NODES.numberNode(plain.scale() < 0 ? plain.setScale(0) : plain);
    }

    private static JsonNode date(JsonNode value, String path) {
        var text = string(value, path);
        if (text == null) return null;
        try {
            return NODES.stringNode(LocalDate.parse(text).toString());
        } catch (DateTimeParseException exception) {
            throw invalid(path, "Informe uma data válida.");
        }
    }

    private static JsonNode yesNo(JsonNode value, String path) {
        requireObject(value, path, Set.of("answer", "detail"));
        var answer = value.get("answer");
        if (answer == null || !answer.isBoolean()) throw invalid(path + ".answer", "Responda sim ou não.");
        var result = NODES.objectNode().put("answer", answer.booleanValue());
        var detail = optionalText(value.get("detail"), DETAIL_LENGTH, path + ".detail");
        if (detail != null) result.put("detail", detail);
        return result;
    }

    private static JsonNode single(RecordField field, JsonNode value, String path) {
        requireObject(value, path, Set.of("option", "other"));
        var option = optionalText(value.get("option"), OTHER_LENGTH, path + ".option");
        var other = optionalText(value.get("other"), OTHER_LENGTH, path + ".other");
        if (option != null && other != null) throw invalid(path, "Escolha uma opção ou informe outra, não as duas.");
        if (option == null && other == null) return null;
        if (other != null) {
            if (!Boolean.TRUE.equals(field.allowOther())) throw invalid(path + ".other", "Esta pergunta não aceita outra opção.");
            return NODES.objectNode().put("other", other);
        }
        if (!codes(field).contains(option)) throw invalid(path + ".option", "Opção inexistente.");
        return NODES.objectNode().put("option", option);
    }

    private static JsonNode multi(RecordField field, JsonNode value, String path) {
        requireObject(value, path, Set.of("options", "other"));
        var options = value.get("options");
        var chosen = NODES.arrayNode();
        if (options != null && !options.isNull()) {
            if (!options.isArray()) throw invalid(path + ".options", "Informe uma lista de opções.");
            var valid = codes(field);
            var seen = new HashSet<String>();
            for (int i = 0; i < options.size(); i++) {
                var code = options.get(i);
                if (!code.isString() || !valid.contains(code.stringValue()))
                    throw invalid(path + ".options[" + i + "]", "Opção inexistente.");
                if (!seen.add(code.stringValue())) throw invalid(path + ".options[" + i + "]", "Opção repetida.");
                chosen.add(code.stringValue());
            }
        }
        var other = optionalText(value.get("other"), OTHER_LENGTH, path + ".other");
        if (other != null && !Boolean.TRUE.equals(field.allowOther()))
            throw invalid(path + ".other", "Esta pergunta não aceita outra opção.");
        if (chosen.isEmpty() && other == null) return null;
        var result = NODES.objectNode();
        result.set("options", chosen);
        if (other != null) result.put("other", other);
        return result;
    }

    private static JsonNode scale(RecordField field, JsonNode value, String path) {
        if (!value.isIntegralNumber()) throw invalid(path, "Escolha um valor da escala.");
        var number = value.decimalValue();
        if (number.compareTo(field.min()) < 0 || number.compareTo(field.max()) > 0)
            throw invalid(path, "Escolha um valor entre " + plain(field.min()) + " e " + plain(field.max()) + ".");
        return NODES.numberNode(value.intValue());
    }

    private static JsonNode table(RecordField field, JsonNode value, String path) {
        if (!value.isArray()) throw invalid(path, "Informe as linhas da tabela.");
        if (value.size() > TABLE_ROWS) throw invalid(path, "Use até " + TABLE_ROWS + " linhas.");
        var columns = field.columns().stream().map(Choice::code).collect(Collectors.toSet());
        var rows = NODES.arrayNode();
        for (int i = 0; i < value.size(); i++) {
            var row = value.get(i);
            var rowPath = path + "[" + i + "]";
            requireObject(row, rowPath, columns);
            var kept = NODES.objectNode();
            for (var column : field.columns()) {
                var cell = optionalText(row.get(column.code()), DETAIL_LENGTH, rowPath + "." + column.code());
                if (cell != null) kept.put(column.code(), cell);
            }
            if (!kept.isEmpty()) rows.add(kept);
        }
        return rows.isEmpty() ? null : rows;
    }

    private static void requireObject(JsonNode value, String path, Set<String> allowed) {
        if (!value.isObject()) throw invalid(path, "Resposta em formato inválido.");
        for (var name : value.propertyNames())
            if (!allowed.contains(name)) throw invalid(path + "." + name, "Propriedade não reconhecida.");
    }

    private static String optionalText(JsonNode value, int limit, String path) {
        if (value == null || value.isNull()) return null;
        var text = string(value, path);
        if (text != null && text.length() > limit) throw invalid(path, "Use até " + limit + " caracteres.");
        return text;
    }

    /** Trimmed text; blank is "not answered". */
    private static String string(JsonNode value, String path) {
        if (!value.isString()) throw invalid(path, "Informe um texto.");
        var text = value.stringValue().strip();
        return text.isEmpty() ? null : text;
    }

    private static Set<String> codes(RecordField field) {
        return field.options().stream().map(Choice::code).collect(Collectors.toSet());
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    private static ApiFailure invalid(String path, String message) {
        return new ApiFailure(400, path, message);
    }
}
