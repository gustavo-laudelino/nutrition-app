package com.nutritionapp.calculation;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/diet-calculations")
public class DietCalculationController {
    private final DietCalculator calculator;

    public DietCalculationController(DietCalculator calculator) {
        this.calculator = calculator;
    }

    @PostMapping
    public DietCalculationResponse calculate(@RequestBody @Valid DietCalculationRequest request) {
        return calculator.calculate(request);
    }
}
