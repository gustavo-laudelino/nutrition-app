package com.nutritionapp.targets;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/target-calculations")
public class TargetCalculationController {
    private final TargetCalculator calculator;
    public TargetCalculationController(TargetCalculator calculator) { this.calculator = calculator; }
    @PostMapping
    public TargetCalculationResponse calculate(@RequestBody @Valid TargetCalculationRequest request) {
        return calculator.calculate(request);
    }
}
