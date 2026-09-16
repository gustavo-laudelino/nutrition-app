package com.nutritionapp.energy;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/energy-estimates")
public class EnergyEstimateController {
    private final EnergyEstimator estimator;
    public EnergyEstimateController(EnergyEstimator estimator) { this.estimator = estimator; }
    @PostMapping
    public EnergyEstimateResponse estimate(@RequestBody @Valid EnergyEstimateRequest request) {
        return estimator.estimate(request);
    }
}
