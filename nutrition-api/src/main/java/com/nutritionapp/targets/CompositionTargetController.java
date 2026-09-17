package com.nutritionapp.targets;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/target-calculations/from-composition")
public class CompositionTargetController {
    private final CompositionTargetCalculator calculator;
    public CompositionTargetController(CompositionTargetCalculator calculator) { this.calculator = calculator; }
    @PostMapping
    public CompositionTargetResponse calculate(@RequestBody @Valid CompositionTargetRequest request) {
        return calculator.calculate(request);
    }
}
