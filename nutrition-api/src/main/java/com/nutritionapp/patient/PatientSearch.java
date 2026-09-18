package com.nutritionapp.patient;

import java.util.ArrayList;
import java.util.Collections;
import java.util.UUID;
import com.nutritionapp.shared.TextSearch;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

final class PatientSearch {
    private PatientSearch() {}

    /** Always restricted to the owner and to active or archived patients, plus every name term. */
    static Specification<Patient> specification(UUID owner, String query, boolean archived) {
        var terms = TextSearch.terms(query);
        return (root, criteriaQuery, builder) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(builder.equal(root.get("nutritionistId"), owner));
            predicates.add(archived ? builder.isNotNull(root.get("archivedAt")) : builder.isNull(root.get("archivedAt")));
            Collections.addAll(predicates, TextSearch.matchAll(builder, root.get("name"), terms));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
