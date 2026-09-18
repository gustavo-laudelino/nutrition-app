package com.nutritionapp.calculation;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portion-quantities")
public class PortionQuantityController {
    private final PortionQuantityCalculator calculator;

    public PortionQuantityController(PortionQuantityCalculator calculator) {
        this.calculator = calculator;
    }

    @PostMapping
    public PortionQuantityResponse calculate(@RequestBody @Valid PortionQuantityRequest request) {
        return calculator.calculate(request);
    }
}
