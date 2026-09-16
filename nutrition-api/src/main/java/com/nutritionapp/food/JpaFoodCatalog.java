package com.nutritionapp.food;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

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

    public JpaFoodCatalog(FoodRepository repository) {
        this.repository = repository;
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
}

