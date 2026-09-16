package com.nutritionapp.targets;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/energy-prescriptions/per-kg")
public class PerKgPrescriptionController {
    private final PerKgPrescriptionCalculator calculator;
    public PerKgPrescriptionController(PerKgPrescriptionCalculator calculator) { this.calculator = calculator; }
    @PostMapping
    public PerKgPrescriptionResponse calculate(@RequestBody @Valid PerKgPrescriptionRequest request) {
        return calculator.calculate(request);
    }
}
