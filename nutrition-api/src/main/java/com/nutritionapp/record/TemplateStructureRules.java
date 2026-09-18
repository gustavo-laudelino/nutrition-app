package com.nutritionapp.record;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import com.nutritionapp.api.ApiFailure;
import com.nutritionapp.record.RecordField.Type;
import com.nutritionapp.record.TemplateFieldData.Width;

/** Catalog rules of a template structure, shared by the API and the starter template file. */
final class TemplateStructureRules {
    static final int MAX_NAME = 60;
    static final int MAX_SECTIONS = 20;
    private static final Set<Integer> TEXT_ROWS = Set.of(3, 5, 8);

    private TemplateStructureRules() {
    }

    /**
     * Each catalog field at most once per template; tables span the whole sheet; only long text has a height.
     * A deprecated field is accepted only when {@code keptDeprecated} (the saved template) already had it.
     */
    static void check(List<TemplateSectionData> sections, Function<String, Optional<RecordField>> catalog,
                      Set<String> keptDeprecated) {
        var used = new HashSet<String>();
        for (int s = 0; s < sections.size(); s++) {
            var fields = sections.get(s).fields();
            for (int f = 0; f < fields.size(); f++) {
                var path = "sections[" + s + "].fields[" + f + "].";
                var placement = fields.get(f);
                var field = catalog.apply(placement.code())
                        .filter(item -> !item.isDeprecated() || keptDeprecated.contains(item.code()))
                        .orElseThrow(() -> new ApiFailure(400, path + "code", "Campo inexistente no catálogo."));
                if (!used.add(field.code())) throw new ApiFailure(400, path + "code", "O campo já está no modelo.");
                if (field.type() == Type.TABLE && placement.width() != Width.FULL)
                    throw new ApiFailure(400, path + "width", "Tabelas ocupam a largura inteira.");
                if (field.type() == Type.LONG_TEXT) {
                    if (placement.textRows() == null || !TEXT_ROWS.contains(placement.textRows()))
                        throw new ApiFailure(400, path + "textRows", "Escolha 3, 5 ou 8 linhas.");
                } else if (placement.textRows() != null) {
                    throw new ApiFailure(400, path + "textRows", "A altura só se aplica a texto longo.");
                }
            }
        }
    }
}
