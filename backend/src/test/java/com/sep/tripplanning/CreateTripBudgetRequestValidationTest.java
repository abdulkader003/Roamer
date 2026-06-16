package com.sep.tripplanning;

import com.sep.tripplanning.dto.CreateTripBudgetRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CreateTripBudgetRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void acceptsValidBudgetStep() {
        CreateTripBudgetRequest request = new CreateTripBudgetRequest(
                "Summer in Italy",
                new BigDecimal("2500.00"),
                "EUR",
                7,
                "Mid-range"
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsInvalidBudgetStepValues() {
        CreateTripBudgetRequest request = new CreateTripBudgetRequest(
                " ",
                BigDecimal.ZERO,
                "GBP",
                0,
                "Premium"
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactlyInAnyOrder("tripName", "budget", "currency", "duration", "travelStyle");
    }
}
