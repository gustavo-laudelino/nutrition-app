package com.nutritionapp.food;

import java.util.List;

public record FoodPage(List<FoodResponse> items, int page, int size, long totalElements) {
}
