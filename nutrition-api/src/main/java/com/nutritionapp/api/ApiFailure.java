package com.nutritionapp.api;

import java.util.List;
import com.nutritionapp.api.ApiExceptionHandler.FieldError;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

/** Expected failure with its HTTP status, optionally tied to a request field. */
public class ApiFailure extends RuntimeException {
    private final int status;
    private final String field;

    public ApiFailure(int status, String message) {
        this(status, null, message);
    }

    public ApiFailure(int status, String field, String message) {
        super(message);
        this.status = status;
        this.field = field;
    }

    /** Same shape as the other API errors: {@code errors} is empty when no field is involved. */
    public ProblemDetail problem() {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), getMessage());
        problem.setProperty("errors", field == null ? List.of() : List.of(new FieldError(field, getMessage())));
        return problem;
    }
}
