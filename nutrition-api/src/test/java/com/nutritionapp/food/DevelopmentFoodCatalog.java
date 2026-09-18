package com.nutritionapp.food;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.nutritionapp.nutrient.FoodNutrientValue;
import com.nutritionapp.nutrient.NutrientCategory;
import com.nutritionapp.nutrient.NutrientDefinition;
import com.nutritionapp.nutrient.NutrientStatus;
import com.nutritionapp.shared.TextSearch;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("test")
public class DevelopmentFoodCatalog implements FoodCatalog {
    private final List<FoodResponse> foods = List.of(
            sample(1L, "Alimento sintético A", "130", "3", "28", "1"),
            sample(2L, "Alimento sintético B", "165", "31", "0", "4"),
            sample(3L, "Alimento sintético C", "900", "0", "0", "100"));

    // Synthetic nutrient subset covering the four statuses; food 3 has no nutrient records at all.
    static final NutrientDefinition FIBER = new NutrientDefinition("FIBER", "Fibra alimentar", "g", NutrientCategory.FIBER, 10, false);
    static final NutrientDefinition CALCIUM = new NutrientDefinition("CALCIUM", "Cálcio", "mg", NutrientCategory.MINERAL, 100, true);
    static final NutrientDefinition IRON = new NutrientDefinition("IRON", "Ferro", "mg", NutrientCategory.MINERAL, 120, true);
    static final NutrientDefinition VITAMIN_C = new NutrientDefinition("VITAMIN_C", "Vitamina C", "mg", NutrientCategory.VITAMIN, 250, true);
    static final NutrientDefinition CHOLESTEROL = new NutrientDefinition("CHOLESTEROL", "Colesterol", "mg", NutrientCategory.LIPID, 300, true);
    private final Map<Long, List<FoodNutrientValue>> nutrients = Map.of(
            1L, List.of(value(FIBER, "2.7"), value(CALCIUM, "5"), status(IRON, NutrientStatus.TRACE),
                    status(VITAMIN_C, NutrientStatus.NOT_ANALYZED), status(CHOLESTEROL, NutrientStatus.NOT_APPLICABLE)),
            2L, List.of(status(FIBER, NutrientStatus.NOT_APPLICABLE), value(CALCIUM, "10"), value(IRON, "1.2"),
                    status(VITAMIN_C, NutrientStatus.TRACE), value(CHOLESTEROL, "80")));

    public DevelopmentFoodCatalog() {
        LoggerFactory.getLogger(DevelopmentFoodCatalog.class).warn(
                "Catálogo SINTÉTICO exclusivo de testes ativo. "
                        + "Dados isolados da base real.");
    }

    private static FoodNutrientValue value(NutrientDefinition nutrient, String amount) {
        return new FoodNutrientValue(nutrient, new BigDecimal(amount), NutrientStatus.VALUE);
    }

    private static FoodNutrientValue status(NutrientDefinition nutrient, NutrientStatus status) {
        return new FoodNutrientValue(nutrient, status.hasData() ? BigDecimal.ZERO : null, status);
    }

    private static FoodResponse sample(long id, String name, String kcal,
                                       String protein, String carbohydrate, String fat) {
        return new FoodResponse(id, name,
                new BigDecimal(kcal), new BigDecimal(protein), new BigDecimal(carbohydrate),
                new BigDecimal(fat), "SYNTHETIC_DEVELOPMENT", null);
    }

    @Override
    public FoodPage search(String name, int page, int size) {
        var terms = TextSearch.terms(name);
        var matching = foods.stream()
                .filter(food -> terms.stream().allMatch(TextSearch.normalize(food.name())::contains)).toList();
        var items = matching.stream().skip((long) page * size).limit(size).toList();
        return new FoodPage(items, page, size, matching.size());
    }

    @Override
    public FoodResponse findById(long id) {
        return foods.stream().filter(food -> food.id() == id).findFirst()
                .orElseThrow(() -> new FoodNotFoundException(id));
    }

    @Override
    public Map<Long, FoodResponse> findAllById(Collection<Long> ids) {
        Map<Long, FoodResponse> found = new HashMap<>();
        for (var id : ids) found.put(id, findById(id));
        return found;
    }

    @Override
    public List<NutrientDefinition> nutrientDefinitions() {
        return List.of(FIBER, CALCIUM, IRON, VITAMIN_C, CHOLESTEROL);
    }

    @Override
    public Map<Long, List<FoodNutrientValue>> nutrientsOf(Collection<Long> foodIds) {
        Map<Long, List<FoodNutrientValue>> found = new HashMap<>();
        for (var id : foodIds) if (nutrients.containsKey(id)) found.put(id, nutrients.get(id));
        return found;
    }
}


