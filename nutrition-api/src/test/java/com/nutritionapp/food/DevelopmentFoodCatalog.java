package com.nutritionapp.food;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    public DevelopmentFoodCatalog() {
        LoggerFactory.getLogger(DevelopmentFoodCatalog.class).warn(
                "Catálogo SINTÉTICO exclusivo de testes ativo. "
                        + "Dados isolados da base real.");
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
}


