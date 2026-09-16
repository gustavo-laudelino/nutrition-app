package com.nutritionapp.shared;

public class InvalidCalculationException extends RuntimeException {
    private final String field;
    public InvalidCalculationException(String field, String message) {
        super(message);
        this.field = field;
    }
    public String field() { return field; }
}
