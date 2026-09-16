package com.nutritionapp.food;

public class FoodNotFoundException extends RuntimeException {
    public FoodNotFoundException(long id) {
        super("Alimento não encontrado: " + id);
    }
}
