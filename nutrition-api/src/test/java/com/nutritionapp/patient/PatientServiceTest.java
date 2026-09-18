package com.nutritionapp.patient;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientServiceTest {
    @Test
    void ageUsesBirthdayAndAllowsChildrenAndMissingDate() {
        var patient = new Patient(UUID.randomUUID(), request("Fictício", LocalDate.of(2015, 12, 25)));
        assertEquals(10, PatientResponse.from(patient, LocalDate.of(2026, 9, 17)).ageYears());
        assertEquals(11, PatientResponse.from(patient, LocalDate.of(2026, 12, 25)).ageYears());

        patient.update(request("Fictício", null));
        assertNull(PatientResponse.from(patient, LocalDate.now()).ageYears());
    }

    @Test
    @SuppressWarnings("unchecked")
    void listSpecificationAlwaysIncludesOwnerArchiveAndEveryWord() {
        var repository = mock(PatientRepository.class);
        Root<Patient> root = mock(Root.class);
        var builder = mock(CriteriaBuilder.class);
        Path<Object> ownerPath = mock(Path.class);
        Path<Object> archivePath = mock(Path.class);
        Path<Object> namePath = mock(Path.class);
        Expression<String> lower = mock(Expression.class);
        Expression<String> translated = mock(Expression.class);
        when(root.get("nutritionistId")).thenReturn(ownerPath);
        when(root.get("archivedAt")).thenReturn(archivePath);
        when(root.get("name")).thenReturn(namePath);
        when(builder.lower(any())).thenReturn(lower);
        when(builder.function(eq("translate"), eq(String.class), eq(lower), any(), any())).thenReturn(translated);
        when(repository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
        var service = new PatientService(repository);

        for (boolean archived : List.of(false, true)) {
            var owner = UUID.randomUUID();
            service.list(owner, "João FÍCTÍCIO", archived, 0, 20);
            var captor = ArgumentCaptor.forClass(Specification.class);
            verify(repository).findAll(captor.capture(), any(Pageable.class));
            captor.getValue().toPredicate(root, null, builder);

            verify(builder).equal(ownerPath, owner);
            if (archived) verify(builder).isNotNull(archivePath);
            else verify(builder).isNull(archivePath);
            verify(builder).like(translated, "%joao%");
            verify(builder).like(translated, "%ficticio%");
            clearInvocations(repository, builder);
        }
    }

    private static PatientRequest request(String name, LocalDate birthDate) {
        return new PatientRequest(name, birthDate, null, null, null, null, null, null, null, null, null);
    }
}
