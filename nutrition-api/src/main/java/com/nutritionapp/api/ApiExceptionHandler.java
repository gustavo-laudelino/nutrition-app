package com.nutritionapp.api;

import java.util.List;
import com.nutritionapp.shared.InvalidCalculationException;
import com.nutritionapp.food.FoodNotFoundException;
import com.nutritionapp.consultation.Consultation;
import com.nutritionapp.record.RecordTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

/** Every 400 carries an {@code errors} array; it is empty only when no field can be identified. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(ApiFailure.class)
    public ProblemDetail apiFailure(ApiFailure exception) {
        return exception.problem();
    }

    /** Concurrent update detected on flush: patients, record templates and consultations are versioned. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ProblemDetail versionConflict(OptimisticLockingFailureException exception) {
        var entity = exception instanceof ObjectOptimisticLockingFailureException failure ? failure.getPersistentClassName() : null;
        String what;
        if (RecordTemplate.class.getName().equals(entity)) what = "O modelo foi alterado";
        else if (Consultation.class.getName().equals(entity)) what = "A consulta foi alterada";
        else what = "O paciente foi alterado";
        return new ApiFailure(409, what + " em outra sessão. Recarregue.").problem();
    }

    @ExceptionHandler(FoodNotFoundException.class)
    public ProblemDetail foodNotFound(FoodNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(InvalidCalculationException.class)
    public ProblemDetail invalidCalculation(InvalidCalculationException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setProperty("errors", List.of(new FieldError(exception.field(), exception.getMessage())));
        return problem;
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        var errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage())).toList();
        return badRequest(exception, "Há campos inválidos na requisição.", errors, headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        var errors = exception.getParameterValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(error -> new FieldError(result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
                .toList();
        return badRequest(exception, "Há parâmetros inválidos na requisição.", errors, headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        var errors = List.of(new FieldError(exception.getPropertyName(), "Valor em formato inválido."));
        return badRequest(exception, "Há parâmetros inválidos na requisição.", errors, headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldError> errors = List.of();
        if (exception.getCause() instanceof JacksonException json && !json.getPath().isEmpty()) {
            var message = json instanceof UnrecognizedPropertyException
                    ? "Propriedade não reconhecida." : "Valor em formato inválido.";
            errors = List.of(new FieldError(fieldPath(json.getPath()), message));
        }
        return badRequest(exception, "O corpo da requisição é inválido ou está malformado.", errors, headers, status, request);
    }

    private ResponseEntity<Object> badRequest(Exception exception, String detail, List<FieldError> errors,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setProperty("errors", errors);
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** Same notation as bean validation: {@code foods[0].foodId}. */
    private static String fieldPath(List<JacksonException.Reference> path) {
        var field = new StringBuilder();
        for (var reference : path) {
            if (reference.getPropertyName() != null) {
                if (!field.isEmpty()) field.append('.');
                field.append(reference.getPropertyName());
            } else if (reference.getIndex() >= 0) {
                field.append('[').append(reference.getIndex()).append(']');
            }
        }
        return field.toString();
    }

    public record FieldError(String field, String message) { }
}
