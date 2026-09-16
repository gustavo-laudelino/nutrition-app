package com.nutritionapp.food;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/foods")
public class FoodController {
    private final FoodCatalog catalog;

    public FoodController(FoodCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public FoodPage search(@RequestParam(defaultValue = "") @Size(max = 200) String name,
                           @RequestParam(defaultValue = "0") @Min(0) int page,
                           @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return catalog.search(name, page, size);
    }

    @GetMapping("/{id}")
    public FoodResponse findById(@PathVariable @Positive long id) {
        return catalog.findById(id);
    }
}
