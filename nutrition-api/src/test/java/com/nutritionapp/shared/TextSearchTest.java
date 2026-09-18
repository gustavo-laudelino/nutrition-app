package com.nutritionapp.shared;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class TextSearchTest {
    @Test
    void matchesReorderedAccentedAndPartialKeywords() {
        var name = TextSearch.normalize("Frango, filé, sem pele");
        assertThat(TextSearch.terms("  FILÉ frang  ")).containsExactly("file", "frang");
        assertThat(TextSearch.terms("file frango").stream().allMatch(name::contains)).isTrue();
        assertThat(TextSearch.terms("file bovino").stream().allMatch(name::contains)).isFalse();
    }

    @Test
    void treatsPunctuationAsSeparatorsAndNeverAsSqlWildcards() {
        assertThat(TextSearch.terms("frango,%_file frango")).containsExactly("frango", "file");
        assertThat(TextSearch.terms("  ANA%_teste  ")).containsExactly("ana", "teste");
        assertThat(TextSearch.terms("  ")).isEmpty();
    }

    @Test
    void repeatedTermsWithDifferentAccentsOrCaseCountOnce() {
        assertThat(TextSearch.terms("FÍCTÍCIO João fíctício")).containsExactly("ficticio", "joao");
    }
}
