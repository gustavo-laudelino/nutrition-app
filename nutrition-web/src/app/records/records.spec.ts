import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { routes } from '../routes';
import { Oficina } from './oficina';
import { RecordFieldCategory, RecordTemplate, RecordTemplateSummary } from './records-api';
import { TemplateList } from './template-list';

// Fictitious catalog and template.
const catalog: { categories: RecordFieldCategory[] } = { categories: [
  { code: 'GENERAL', name: 'Geral', fields: [
    { code: 'notes', label: 'Anotações', type: 'LONG_TEXT', maxLength: 4000 },
    { code: 'weight', label: 'Peso', type: 'NUMBER', unit: 'kg', min: 1, max: 500, decimals: 3, sync: 'PATIENT_WEIGHT' },
    { code: 'diet', label: 'Padrão alimentar', type: 'SINGLE_CHOICE', options: [{ code: 'a', label: 'Onívoro' }, { code: 'b', label: 'Vegano' }] },
  ] },
  { code: 'EXAMS', name: 'Exames', fields: [
    { code: 'recall', label: 'Recordatório', type: 'TABLE', columns: [{ code: 'time', label: 'Horário' }, { code: 'food', label: 'Alimentos' }] },
    { code: 'sleep', label: 'Qualidade do sono', type: 'SCALE', min: 0, max: 10, minLabel: 'Ruim', maxLabel: 'Ótima' },
  ] },
] };
const template: RecordTemplate = {
  id: 't1', name: 'Primeira consulta', isDefault: false, version: 4, updatedAt: '2026-09-18T10:00:00Z',
  sections: [
    { name: 'Anamnese', fields: [{ code: 'notes', width: 'FULL', textRows: 3 }, { code: 'weight', width: 'HALF', textRows: null }] },
    { name: 'Medidas', fields: [] },
  ],
};

describe('Oficina de modelos de prontuário', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  function open() {
    const fixture = TestBed.createComponent(Oficina);
    fixture.detectChanges();
    http.expectOne('/api/record-fields').flush(catalog);
    http.expectOne('/api/record-templates/t1').flush(structuredClone(template));
    fixture.detectChanges();
    return { fixture, app: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  const texts = (element: HTMLElement, selector: string) =>
    Array.from(element.querySelectorAll(selector)).map(item => item.textContent!.replace(/\s+/g, ' ').trim());
  const fieldCodes = (app: Oficina) => app.sections().map(section => section.fields.map(field => field.code));

  it('opens the template: toolbox by category, used fields marked, sections as tabs and nothing to save', () => {
    const { app, element } = open();
    expect(element.querySelector('h1')!.textContent).toBe('Primeira consulta');
    expect(texts(element, '.section-label')).toEqual(['Anamnese', 'Medidas']);
    expect(texts(element, '.sheet-field .sheet-field-type')).toEqual(['Texto longo', 'Número']);
    expect(element.querySelector('.sheet-field .sync-tag')).not.toBeNull();
    // Only the first category starts open.
    expect(texts(element, '.tool-label')).toEqual(['Anotações', 'Peso', 'Padrão alimentar']);
    expect(texts(element, '.tool.used .tool-label')).toEqual(['Anotações', 'Peso']);
    expect(app.dirty()).toBe(false);
    expect((element.querySelector('.bar-button.primary') as HTMLButtonElement).disabled).toBe(true);
    expect(element.querySelector('.save-state')!.textContent).toBe('Tudo salvo');
  });

  it('adds with Enter/click at the end of the open section; a used field is selected instead of added', () => {
    const { fixture, app, element } = open();
    const tool = (label: string) => Array.from(element.querySelectorAll<HTMLButtonElement>('.tool-button'))
      .find(button => button.textContent!.includes(label))!;
    tool('Padrão alimentar').click();
    fixture.detectChanges();
    expect(app.activeSection().fields.at(-1)).toEqual({ code: 'diet', width: 'HALF', textRows: null });
    expect(app.selectedCode()).toBe('diet');
    expect(element.querySelector('[aria-live]')!.textContent).toContain('Padrão alimentar adicionado à seção Anamnese.');
    expect(element.querySelector('.save-state')!.textContent).toBe('Alterações não salvas');

    app.selectSection(app.sections()[1].key);
    tool('Peso').click();
    fixture.detectChanges();
    expect(fieldCodes(app)).toEqual([['notes', 'weight', 'diet'], []]);
    expect(app.activeSection().name).toBe('Anamnese');
    expect(app.selectedCode()).toBe('weight');
  });

  it('search filters the toolbox by words without accents and opens every matching category', () => {
    const { fixture, app, element } = open();
    app.search.set('SONO qualidade');
    fixture.detectChanges();
    expect(texts(element, '.tool-label')).toEqual(['Qualidade do sono']);
    app.search.set('nada disso');
    fixture.detectChanges();
    expect(element.querySelector('.toolbox-scroll')!.textContent).toContain('Nenhuma pergunta encontrada.');
  });

  it('dropping from the toolbox inserts at the drop position; dropping inside the sheet reorders', () => {
    const { app } = open();
    const sheet = {}; const toolbox = {};
    app.dropOnSheet({ previousContainer: toolbox, container: sheet, previousIndex: 0, currentIndex: 1, item: { data: 'recall' } } as never);
    expect(app.activeSection().fields[1]).toEqual({ code: 'recall', width: 'FULL', textRows: null });
    app.dropOnSheet({ previousContainer: sheet, container: sheet, previousIndex: 2, currentIndex: 0, item: { data: 'weight' } } as never);
    expect(fieldCodes(app)[0]).toEqual(['weight', 'notes', 'recall']);
    app.moveField('weight', 1);
    expect(fieldCodes(app)[0]).toEqual(['notes', 'weight', 'recall']);
  });

  it('properties: width, height of long text, table always full, moving to another section and removing', () => {
    const { fixture, app, element } = open();
    const radio = (legend: string, label: string) => {
      const fieldset = Array.from(element.querySelectorAll('.properties fieldset'))
        .find(set => set.querySelector('legend')!.textContent === legend)!;
      return Array.from(fieldset.querySelectorAll('label')).find(item => item.textContent!.trim() === label)!.querySelector('input')!;
    };
    (element.querySelectorAll('.sheet-field')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.properties h2')!.textContent).toBe('Peso');
    expect(element.querySelector('.sync-note')).not.toBeNull();
    expect(element.querySelector('.properties')!.textContent).not.toContain('Altura');
    radio('Largura', '1/3').dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(app.sections()[0].fields[1].width).toBe('THIRD');
    expect(element.querySelectorAll('.sheet-field')[1].classList).toContain('w-THIRD');

    app.selectField('notes');
    fixture.detectChanges();
    radio('Altura', '8 linhas').dispatchEvent(new Event('change'));
    expect(app.sections()[0].fields[0].textRows).toBe(8);

    const select = element.querySelector('.section-select select') as HTMLSelectElement;
    select.value = String(app.sections()[1].key);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fieldCodes(app)).toEqual([['weight'], ['notes']]);
    expect(app.activeSection().name).toBe('Medidas');
    expect(app.selectedCode()).toBe('notes');

    app.addField('recall');
    fixture.detectChanges();
    expect(element.querySelector('.properties')!.textContent).toContain('Tabelas ocupam a largura inteira.');
    app.setWidth('recall', 'HALF');
    expect(app.activeSection().fields[1].width).toBe('FULL');
    (element.querySelector('.properties .remove-from-template') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fieldCodes(app)).toEqual([['weight'], ['notes']]);
    expect(app.selectedCode()).toBeNull();
  });

  it('sections: "+" creates one in rename mode, Enter renames, the menu reorders and deleting returns the fields', () => {
    const { fixture, app, element } = open();
    (element.querySelector('.section-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = element.querySelector('.section-name-input') as HTMLInputElement;
    expect(input.value).toBe('Seção 3');
    input.value = '  Conduta  ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(texts(element, '.section-label')).toEqual(['Anamnese', 'Medidas', 'Conduta']);

    const tabs = () => Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    fixture.detectChanges();
    expect(texts(element, '.oficina-menu [role="menuitem"]')).toEqual(['Renomear', 'Mover para a direita', 'Excluir seção']);
    (element.querySelectorAll<HTMLButtonElement>('.oficina-menu [role="menuitem"]')[1]).click();
    fixture.detectChanges();
    expect(texts(element, '.section-label')).toEqual(['Medidas', 'Anamnese', 'Conduta']);
    expect(element.querySelector('.oficina-menu')).toBeNull();

    // A section with fields asks first; its fields go back to the toolbox.
    app.requestRemoveSection(app.sections()[1].key);
    fixture.detectChanges();
    expect(element.querySelector('.sheet .confirm')!.textContent).toContain('Excluir a seção Anamnese? Os 2 campos voltam para a caixa de ferramentas.');
    (Array.from(element.querySelectorAll<HTMLButtonElement>('.sheet .confirm button')).find(button => button.textContent === 'Excluir seção')!).click();
    fixture.detectChanges();
    expect(texts(element, '.section-label')).toEqual(['Medidas', 'Conduta']);
    expect(texts(element, '.tool.used .tool-label')).toEqual([]);
    expect(element.querySelector('[aria-live]')!.textContent).toContain('2 campos voltaram à caixa de ferramentas');

    // An empty section goes at once; the only one stays.
    app.requestRemoveSection(app.sections()[1].key);
    app.requestRemoveSection(app.sections()[0].key);
    expect(app.sections().map(section => section.name)).toEqual(['Medidas']);
  });

  it('renames the template in place; blank restores the name', () => {
    const { fixture, app, element } = open();
    (element.querySelector('h1') as HTMLElement).dispatchEvent(new MouseEvent('dblclick'));
    fixture.detectChanges();
    const input = element.querySelector('.name-input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(app.name()).toBe('Primeira consulta');
    app.startNameEdit();
    fixture.detectChanges();
    const again = element.querySelector('.name-input') as HTMLInputElement;
    again.value = 'Retorno';
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(element.querySelector('h1')!.textContent).toBe('Retorno');
    expect(app.dirty()).toBe(true);
  });

  it('saves the whole structure with the version and keeps the open section', () => {
    const { fixture, app, element } = open();
    app.selectSection(app.sections()[1].key);
    app.addField('diet');
    fixture.detectChanges();
    (element.querySelector('.bar-button.primary') as HTMLButtonElement).click();
    const request = http.expectOne('/api/record-templates/t1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Primeira consulta', version: 4, sections: [
      { name: 'Anamnese', fields: [{ code: 'notes', width: 'FULL', textRows: 3 }, { code: 'weight', width: 'HALF', textRows: null }] },
      { name: 'Medidas', fields: [{ code: 'diet', width: 'HALF', textRows: null }] },
    ] });
    request.flush({ ...template, version: 5, sections: request.request.body.sections });
    fixture.detectChanges();
    expect(app.version()).toBe(5);
    expect(app.dirty()).toBe(false);
    expect(app.activeSection().name).toBe('Medidas');
    expect(element.querySelector('.save-state')!.textContent).toBe('Tudo salvo');
  });

  it('a field error opens its section and marks the field; a conflict offers to reload', () => {
    const { fixture, app, element } = open();
    app.addField('diet');
    app.save();
    http.expectOne('/api/record-templates/t1').flush(
      { detail: 'Tabelas ocupam a largura inteira.', errors: [{ field: 'sections[0].fields[1].width', message: 'Tabelas ocupam a largura inteira.' }] },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(element.querySelector('.banner')!.textContent).toContain('Peso:');
    expect(element.querySelectorAll('.sheet-field')[1].classList).toContain('has-error');
    expect(app.selectedCode()).toBe('weight');

    app.save();
    http.expectOne('/api/record-templates/t1').flush({ detail: 'O modelo foi alterado em outra sessão. Recarregue.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(element.querySelector('.banner')!.textContent).toContain('O modelo foi alterado em outra sessão.');
    (element.querySelector('.banner button') as HTMLButtonElement).click();
    http.expectOne('/api/record-templates/t1').flush({ ...template, version: 7 });
    fixture.detectChanges();
    expect(app.version()).toBe(7);
    expect(fieldCodes(app)).toEqual([['notes', 'weight'], []]);
    expect(app.dirty()).toBe(false);
  });

  it('preview shows fillable fields without requests; default keeps the local edits with the new version', () => {
    const { fixture, app, element } = open();
    expect((element.querySelector('.sheet-field input') as HTMLInputElement | null)?.disabled ?? true).toBe(true);
    app.addField('diet');
    app.togglePreview();
    fixture.detectChanges();
    expect(element.querySelector('.oficina-workspace')).toBeNull();
    expect(texts(element, '.preview-tab')).toEqual(['Anamnese', 'Medidas']);
    const controls = Array.from(element.querySelectorAll<HTMLInputElement>('.preview-sheet input, .preview-sheet textarea'));
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every(control => !control.disabled)).toBe(true);
    app.togglePreview();
    fixture.detectChanges();

    app.selectedCode.set(null);
    fixture.detectChanges();
    (Array.from(element.querySelectorAll<HTMLButtonElement>('.properties button')).find(button => button.textContent === 'Tornar padrão')!).click();
    http.expectOne('/api/record-templates/t1/default').flush({ ...template, isDefault: true, version: 5 });
    fixture.detectChanges();
    expect(app.isDefault()).toBe(true);
    expect(app.version()).toBe(5);
    expect(app.dirty()).toBe(true);
    expect(element.querySelector('.template-title .badge')!.textContent).toBe('Padrão');
  });

  it('leaving with unsaved changes asks first; below 1024 px a notice replaces the workshop', () => {
    const { app, element } = open();
    const guard = routes[2].children!.find(route => route.path === 'prontuario')!.children!
      .find(route => route.path === 'modelos/:id')!.canDeactivate![0] as (component: Oficina) => boolean;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(guard(app)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    app.addField('diet');
    expect(guard(app)).toBe(false);
    expect(confirm).toHaveBeenCalledWith('Sair da Oficina sem salvar as alterações do modelo?');
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    app.warnBeforeUnload(event);
    expect(event.defaultPrevented).toBe(true);
    expect(element.querySelector('.narrow-notice')!.textContent).toContain('A Oficina precisa de uma tela maior.');
    confirm.mockRestore();
  });
});

describe('Lista de modelos de prontuário', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TemplateList>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const summaries: RecordTemplateSummary[] = [
    { id: 't1', name: 'Primeira consulta', isDefault: true, sectionCount: 6, fieldCount: 41, updatedAt: '2026-09-18T10:00:00Z' },
    { id: 't2', name: 'Retorno', isDefault: false, sectionCount: 1, fieldCount: 1, updatedAt: '2026-09-17T10:00:00Z' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TemplateList);
    fixture.detectChanges();
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) => Array.from(element().querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent!.trim() === label)!;

  it('without templates offers to start from the starter template and opens the new one in the Oficina', async () => {
    http.expectOne('/api/record-templates').flush([]);
    fixture.detectChanges();
    expect(element().querySelector('.empty-state')!.textContent).toContain('Você ainda não tem modelos');
    button('Começar pelo modelo inicial').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const name = element().querySelector('input[name="name"]') as HTMLInputElement;
    expect(name.value).toBe('Primeira consulta');
    expect((element().querySelector('input[value="STARTER"]') as HTMLInputElement).checked).toBe(true);
    button('Criar e abrir na Oficina').click();
    const request = http.expectOne('/api/record-templates');
    expect(request.request.body).toEqual({ name: 'Primeira consulta', source: 'STARTER' });
    request.flush({ ...template, id: 'novo' });
    expect(navigate).toHaveBeenCalledWith(['/prontuario/modelos', 'novo']);
  });

  it('shows the name error from the API', () => {
    http.expectOne('/api/record-templates').flush(summaries);
    fixture.detectChanges();
    button('Novo modelo').click();
    fixture.componentInstance.newName = 'X';
    fixture.componentInstance.create();
    http.expectOne('/api/record-templates').flush({ detail: 'Há campos inválidos.', errors: [{ field: 'name', message: 'Limite de 30 modelos atingido.' }] },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(element().querySelector('.create-card .field-error')!.textContent).toBe('Limite de 30 modelos atingido.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cards: default badge, duplicate, make default and delete after confirming, each reloading the list', () => {
    http.expectOne('/api/record-templates').flush(summaries);
    fixture.detectChanges();
    expect(texts(element(), '.card-title a')).toEqual(['Primeira consulta', 'Retorno']);
    expect(texts(element(), '.card-title .badge')).toEqual(['Padrão']);
    expect(element().querySelectorAll('.template-card')[0].textContent).not.toContain('Tornar padrão');
    expect(element().querySelector('.card-meta')!.textContent).toContain('6 seções · 41 campos');

    const card = (index: number) => element().querySelectorAll('.template-card')[index] as HTMLElement;
    const cardButton = (index: number, label: string) => Array.from(card(index).querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent!.trim() === label)!;
    cardButton(1, 'Duplicar').click();
    http.expectOne('/api/record-templates/t2/duplicate').flush({ ...template, id: 't3' });
    http.expectOne('/api/record-templates').flush(summaries);
    cardButton(1, 'Tornar padrão').click();
    http.expectOne('/api/record-templates/t2/default').flush(template);
    http.expectOne('/api/record-templates').flush(summaries);
    fixture.detectChanges();
    cardButton(1, 'Excluir').click();
    fixture.detectChanges();
    expect(card(1).querySelector('.confirm')!.textContent).toContain('Excluir o modelo Retorno?');
    http.expectNone('/api/record-templates/t2');
    cardButton(1, 'Excluir').click();
    const removal = http.expectOne('/api/record-templates/t2');
    expect(removal.request.method).toBe('DELETE');
    removal.flush(null);
    http.expectOne('/api/record-templates').flush([summaries[0]]);
    fixture.detectChanges();
    expect(element().querySelectorAll('.template-card')).toHaveLength(1);
  });

  function texts(root: HTMLElement, selector: string) {
    return Array.from(root.querySelectorAll(selector)).map(item => item.textContent!.replace(/\s+/g, ' ').trim());
  }
});
