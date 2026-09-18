package com.nutritionapp.nutrient;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import com.nutritionapp.patient.PatientContext.Sex;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Daily reference intakes (RDA or AI) for adults, by sex and age, from the versioned file
 * {@code nutrient-references/iom-fnb-dri-adults.csv}. Validated on startup: unknown codes or units fail.
 */
@Component
public class NutrientReferences {
    public static final String SOURCE_NAME = "Food and Nutrition Board / IOM (DRI)";
    static final String RESOURCE = "nutrient-references/iom-fnb-dri-adults.csv";
    private static final String HEADER = "nutrient_code,sex,age_min,age_max,amount,unit,type";
    /** DRI life-stage groups for adults, used to describe the profile. */
    private static final int[][] AGE_GROUPS = {{19, 30}, {31, 50}, {51, 70}, {71, 130}};

    public enum Type { RDA, AI }
    public record Reference(BigDecimal amount, Type type) {}
    private record Row(NutrientCode code, Sex sex, int ageMin, int ageMax, Reference reference) {}

    private final List<Row> rows;

    public NutrientReferences() {
        this(read());
    }

    NutrientReferences(Reader csv) {
        this.rows = parse(csv);
    }

    private static Reader read() {
        try {
            return new InputStreamReader(new ClassPathResource(RESOURCE).getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException("Arquivo de referências não encontrado: " + RESOURCE, exception);
        }
    }

    /** Adults 19+ with a known sex; anything else has no reference. */
    public static boolean covers(Sex sex, Integer age) {
        return sex != null && sex != Sex.UNSPECIFIED && age != null && age >= 19 && age <= 130;
    }

    public Optional<Reference> find(String code, Sex sex, int age) {
        if (!covers(sex, age)) return Optional.empty();
        return rows.stream().filter(row -> row.code().name().equals(code) && row.sex() == sex
                        && age >= row.ageMin() && age <= row.ageMax())
                .map(Row::reference).findFirst();
    }

    /** E.g. "Mulher, 19–30 anos"; null outside the covered profiles. */
    public static String describe(Sex sex, Integer age) {
        if (!covers(sex, age)) return null;
        for (int[] group : AGE_GROUPS) {
            if (age >= group[0] && age <= group[1]) {
                var ages = group[1] >= 130 ? group[0] + " anos ou mais" : group[0] + "–" + group[1] + " anos";
                return (sex == Sex.FEMALE ? "Mulher, " : "Homem, ") + ages;
            }
        }
        return null;
    }

    private static List<Row> parse(Reader csv) {
        var rows = new ArrayList<Row>();
        try (var reader = new BufferedReader(csv)) {
            boolean header = false;
            int number = 0;
            for (String line; (line = reader.readLine()) != null; ) {
                number++;
                var text = line.strip();
                if (text.isEmpty() || text.startsWith("#")) continue;
                if (!header) {
                    if (!text.equals(HEADER)) throw invalid(number, "cabeçalho esperado: " + HEADER);
                    header = true;
                    continue;
                }
                rows.add(row(text.split(",", -1), number));
            }
            if (!header) throw invalid(number, "arquivo sem cabeçalho");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
        return List.copyOf(rows);
    }

    private static Row row(String[] cells, int line) {
        if (cells.length != 7) throw invalid(line, "esperadas 7 colunas");
        NutrientCode code;
        try {
            code = NutrientCode.valueOf(cells[0].strip());
        } catch (IllegalArgumentException exception) {
            throw invalid(line, "nutriente desconhecido: " + cells[0]);
        }
        if (!code.unit().equals(cells[5].strip())) {
            throw invalid(line, "unidade " + cells[5] + " diferente da unidade do nutriente " + code + " (" + code.unit() + ")");
        }
        try {
            var sex = Sex.valueOf(cells[1].strip());
            if (sex == Sex.UNSPECIFIED) throw invalid(line, "sexo deve ser FEMALE ou MALE");
            var ageMin = Integer.parseInt(cells[2].strip());
            var ageMax = Integer.parseInt(cells[3].strip());
            var amount = new BigDecimal(cells[4].strip());
            if (ageMin < 19 || ageMax > 130 || ageMin > ageMax || amount.signum() <= 0) {
                throw invalid(line, "faixa etária ou valor fora do esperado");
            }
            return new Row(code, sex, ageMin, ageMax, new Reference(amount, Type.valueOf(cells[6].strip())));
        } catch (IllegalArgumentException exception) {
            throw invalid(line, "valor em formato inválido (" + exception.getMessage() + ")");
        }
    }

    private static IllegalStateException invalid(int line, String message) {
        return new IllegalStateException("Referências de nutrientes inválidas (" + RESOURCE + ", linha " + line + "): " + message);
    }
}
