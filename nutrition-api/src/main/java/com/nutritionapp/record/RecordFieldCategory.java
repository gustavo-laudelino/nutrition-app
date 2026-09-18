package com.nutritionapp.record;

import java.util.List;

public record RecordFieldCategory(String code, String name, List<RecordField> fields) {}
