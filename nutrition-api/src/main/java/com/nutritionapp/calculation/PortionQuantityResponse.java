package com.nutritionapp.calculation;

import java.math.BigDecimal;

public record PortionQuantityResponse(Long foodId, PortionQuantityRequest.Nutrient nutrient, BigDecimal amount, BigDecimal quantityG) {}
