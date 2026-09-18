package com.nutritionapp.food;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.nutritionapp.nutrient.FoodNutrient;
import com.nutritionapp.nutrient.FoodNutrientRepository;
import com.nutritionapp.nutrient.FoodNutrientValue;
import com.nutritionapp.nutrient.Nutrient;
import com.nutritionapp.nutrient.NutrientDefinition;
import com.nutritionapp.nutrient.NutrientRepository;

import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
@Transactional(readOnly = true)
public class JpaFoodCatalog implements FoodCatalog {
    private final FoodRepository repository;
    private final NutrientRepository nutrients;
    private final FoodNutrientRepository foodNutrients;

    public JpaFoodCatalog(FoodRepository repository, NutrientRepository nutrients, FoodNutrientRepository foodNutrients) {
        this.repository = repository;
        this.nutrients = nutrients;
        this.foodNutrients = foodNutrients;
    }

    @Override
    public FoodPage search(String name, int page, int size) {
        var result = repository.findAll(FoodSearch.specification(name),
                PageRequest.of(page, size, Sort.by("id")));
        return new FoodPage(result.map(FoodResponse::from).getContent(),
                page, size, result.getTotalElements());
    }

    @Override
    public FoodResponse findById(long id) {
        return repository.findById(id).map(FoodResponse::from)
                .orElseThrow(() -> new FoodNotFoundException(id));
    }

    @Override
    public Map<Long, FoodResponse> findAllById(Collection<Long> ids) {
        Map<Long, FoodResponse> found = new HashMap<>();
        repository.findAllById(ids).forEach(food -> found.put(food.getId(), FoodResponse.from(food)));
        for (var id : ids) {
            if (!found.containsKey(id)) throw new FoodNotFoundException(id);
        }
        return found;
    }

    @Override
    public List<NutrientDefinition> nutrientDefinitions() {
        return nutrients.findAllByOrderByDisplayOrder().stream().map(Nutrient::definition).toList();
    }

    @Override
    public Map<Long, List<FoodNutrientValue>> nutrientsOf(Collection<Long> foodIds) {
        if (foodIds.isEmpty()) return Map.of();
        return foodNutrients.findByFoodIds(foodIds).stream().collect(Collectors.groupingBy(FoodNutrient::foodId,
                Collectors.mapping(FoodNutrient::value, Collectors.toList())));
    }
}

