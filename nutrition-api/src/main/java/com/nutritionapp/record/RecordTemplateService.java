package com.nutritionapp.record;

import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import com.nutritionapp.api.ApiFailure;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every operation is scoped to the owner: another nutritionist's template is reported as not found.
 * The first template becomes the default; there is at most one default per nutritionist.
 */
@Service
@Transactional(readOnly = true)
public class RecordTemplateService {
    static final int MAX_TEMPLATES = 30;
    private static final String COPY_PREFIX = "Cópia de ";

    private final RecordTemplateRepository repository;
    private final RecordFieldCatalog catalog;

    public RecordTemplateService(RecordTemplateRepository repository, RecordFieldCatalog catalog) {
        this.repository = repository;
        this.catalog = catalog;
    }

    /** Default first, then by name. */
    public List<RecordTemplateResponse.Summary> list(UUID owner) {
        var names = Collator.getInstance(Locale.of("pt", "BR"));
        return repository.findByNutritionistId(owner).stream()
                .sorted(Comparator.comparing((RecordTemplate template) -> !template.isDefaultTemplate())
                        .thenComparing(RecordTemplate::getName, names))
                .map(RecordTemplateResponse.Summary::from).toList();
    }

    public RecordTemplateResponse get(UUID owner, UUID id) {
        return RecordTemplateResponse.from(owned(owner, id));
    }

    @Transactional
    public RecordTemplateResponse create(UUID owner, NewRecordTemplateRequest request) {
        var structure = request.source() == NewRecordTemplateRequest.Source.STARTER
                ? catalog.starter().sections()
                : List.of(new TemplateSectionData("Seção 1", List.of()));
        return RecordTemplateResponse.from(repository.saveAndFlush(newTemplate(owner, request.name(), structure)));
    }

    @Transactional
    public RecordTemplateResponse duplicate(UUID owner, UUID id) {
        var source = owned(owner, id);
        var name = COPY_PREFIX + source.getName();
        if (name.length() > TemplateStructureRules.MAX_NAME) name = name.substring(0, TemplateStructureRules.MAX_NAME).strip();
        return RecordTemplateResponse.from(repository.saveAndFlush(newTemplate(owner, name, source.structure())));
    }

    @Transactional
    public RecordTemplateResponse update(UUID owner, UUID id, RecordTemplateRequest request) {
        var template = owned(owner, id);
        if (!Objects.equals(template.getVersion(), request.version()))
            throw new ApiFailure(409, "O modelo foi alterado em outra sessão. Recarregue.");
        TemplateStructureRules.check(request.sections(), catalog::find, template.fieldCodes());
        template.replace(request.name(), request.sections());
        return RecordTemplateResponse.from(repository.saveAndFlush(template));
    }

    /** The previous default is cleared and flushed first, so the one-default index is never violated. */
    @Transactional
    public RecordTemplateResponse makeDefault(UUID owner, UUID id) {
        var template = owned(owner, id);
        if (template.isDefaultTemplate()) return RecordTemplateResponse.from(template);
        for (var other : repository.findByNutritionistId(owner)) {
            if (other.isDefaultTemplate()) {
                other.markDefault(false);
                repository.saveAndFlush(other);
            }
        }
        template.markDefault(true);
        return RecordTemplateResponse.from(repository.saveAndFlush(template));
    }

    /** Deleting the default promotes the most recently changed remaining template. */
    @Transactional
    public void delete(UUID owner, UUID id) {
        var template = owned(owner, id);
        repository.delete(template);
        repository.flush();
        if (!template.isDefaultTemplate()) return;
        repository.findByNutritionistId(owner).stream()
                .filter(other -> !other.getId().equals(id))
                .max(Comparator.comparing(RecordTemplate::getUpdatedAt))
                .ifPresent(next -> {
                    next.markDefault(true);
                    repository.saveAndFlush(next);
                });
    }

    /** The structure is already valid: the blank section, the starter (checked on startup) or a saved template. */
    private RecordTemplate newTemplate(UUID owner, String name, List<TemplateSectionData> structure) {
        var count = repository.countByNutritionistId(owner);
        if (count >= MAX_TEMPLATES) throw new ApiFailure(400, "name", "Limite de 30 modelos atingido.");
        return new RecordTemplate(owner, name, structure, count == 0);
    }

    private RecordTemplate owned(UUID owner, UUID id) {
        return repository.findByIdAndNutritionistId(id, owner)
                .orElseThrow(() -> new ApiFailure(404, "Modelo não encontrado."));
    }
}
