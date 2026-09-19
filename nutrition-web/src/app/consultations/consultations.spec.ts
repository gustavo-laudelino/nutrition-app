import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Patient } from '../patients/patients-api';
import { FieldControl } from '../records/field-control';
import { RecordField, RecordTemplateSummary } from '../records/records-api';
import { routes } from '../routes';
import { ConsultationList } from './consultation-list';
import { ConsultationPage } from './consultation-page';
import { Consultation, ConsultationSummary } from './consultations-api';

// Fictitious data only.
const patient: Patient = {
  id: 'p1', name: 'Paciente Fictícia', birthDate: '1990-01-01', ageYears: 36, sex: 'FEMALE', phone: null, email: null, notes: null,
  weightKg: 70, heightCm: 165, driActivity: null, measuredAt: '2026-09-01', version: 0, archived: false,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
};
const weight: RecordField = { code: 'weight_kg', label: 'Peso', type: 'NUMBER', unit: 'kg', min: 1, max: 500, decimals: 3, sync: 'PATIENT_WEIGHT' };
const appetite: RecordField = { code: 'appetite', label: 'Apetite', type: 'SINGLE_CHOICE', options: [{ code: 'normal', label: 'Normal' }, { code: 'low', label: 'Diminuído' }], allowOther: true };
const consultation: Consultation = {
  id: 'c1', patientId: 'p1', date: '2026-09-18', status: 'DRAFT', templateName: 'Retorno', version: 3,
  firstCompletedAt: null, completedAt: null, reopenedAt: null, updatedAt: '2026-09-18T10:00:00Z',
  sections: [
    { name: 'Medidas', fields: [{ width: 'THIRD', textRows: null, field: weight }] },
    { name: 'Hábitos', fields: [{ width: 'HALF', textRows: null, field: appetite }] },
  ],
  answers: { weight_kg: 70 },
};
const texts = (root: HTMLElement, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map(item => item.textContent!.replace(/\s+/g, ' ').trim());

describe('Controle de campo do prontuário', () => {
  function control(field: RecordField, value: unknown = null, mode: 'design' | 'fill' = 'fill', readonly = false) {
    const fixture = TestBed.createComponent(FieldControl);
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('readonly', readonly);
    fixture.componentInstance.value.set(value);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, value: () => fixture.componentInstance.value() };
  }

  it('fills text, number and scale; clearing gives no answer', () => {
    const text = control({ code: 't', label: 'Texto', type: 'SHORT_TEXT', maxLength: 200 });
    const input = text.element.querySelector('input')!;
    input.value = 'Rotina corrida'; input.dispatchEvent(new Event('input'));
    expect(text.value()).toBe('Rotina corrida');
    input.value = ''; input.dispatchEvent(new Event('input'));
    expect(text.value()).toBeNull();

    const number = control(weight, 70);
    const field = number.element.querySelector('input')!;
    expect(field.value).toBe('70');
    field.value = '68.4'; field.dispatchEvent(new Event('input'));
    expect(number.value()).toBe(68.4);

    const scale = control({ code: 's', label: 'Sono', type: 'SCALE', min: 0, max: 10, minLabel: 'Ruim', maxLabel: 'Ótimo' }, 3);
    expect((scale.element.querySelectorAll<HTMLInputElement>('input')[3]).checked).toBe(true);
    scale.element.querySelectorAll('input')[7].dispatchEvent(new Event('change'));
    expect(scale.value()).toBe(7);
  });

  it('choices: an option or "Outro" with its text; several options in multiple choice', () => {
    const single = control(appetite);
    single.element.querySelectorAll('input[type="radio"]')[1].dispatchEvent(new Event('change'));
    expect(single.value()).toEqual({ option: 'low' });
    single.element.querySelectorAll('input[type="radio"]')[2].dispatchEvent(new Event('change'));
    single.fixture.detectChanges();
    const other = single.element.querySelector<HTMLInputElement>('input[placeholder="Qual?"]')!;
    other.value = 'Seletivo'; other.dispatchEvent(new Event('input'));
    expect(single.value()).toEqual({ other: 'Seletivo' });

    const multi = control({ code: 'm', label: 'Sintomas', type: 'MULTI_CHOICE', options: [{ code: 'a', label: 'Azia' }, { code: 'b', label: 'Refluxo' }], allowOther: false });
    const boxes = multi.element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change'));
    boxes[1].checked = true; boxes[1].dispatchEvent(new Event('change'));
    boxes[0].checked = false; boxes[0].dispatchEvent(new Event('change'));
    expect(multi.value()).toEqual({ options: ['b'] });

    const yesNo = control({ code: 'y', label: 'Cirurgias', type: 'YES_NO_DETAIL', detailLabel: 'Quais?' });
    expect(yesNo.element.querySelector('input[type="text"]')).toBeNull();
    yesNo.element.querySelectorAll('input[type="radio"]')[0].dispatchEvent(new Event('change'));
    yesNo.fixture.detectChanges();
    const detail = yesNo.element.querySelector<HTMLInputElement>('input[type="text"]')!;
    detail.value = 'Apendicite'; detail.dispatchEvent(new Event('input'));
    expect(yesNo.value()).toEqual({ answer: true, detail: 'Apendicite' });
  });

  it('tables add and remove rows; design and read-only modes are disabled', () => {
    const table = control({ code: 'r', label: 'Recordatório', type: 'TABLE', columns: [{ code: 'time', label: 'Horário' }, { code: 'food', label: 'Alimentos' }] });
    const cell = table.element.querySelector<HTMLInputElement>('td input')!;
    cell.value = '8h'; cell.dispatchEvent(new Event('input'));
    expect(table.value()).toEqual([{ time: '8h' }]);
    (table.element.querySelector('.add-row') as HTMLButtonElement).click();
    table.fixture.detectChanges();
    expect(table.element.querySelectorAll('tbody tr')).toHaveLength(2);
    (table.element.querySelectorAll('.remove-row')[0] as HTMLButtonElement).click();
    expect(table.value()).toEqual([{}]);

    const design = control(weight, null, 'design');
    expect(design.element.querySelector('input')!.disabled).toBe(true);
    expect(design.element.querySelector('.field.static')).not.toBeNull();
    const readonly = control(table.fixture.componentInstance.field(), [{ time: '8h' }], 'fill', true);
    expect(readonly.element.querySelector<HTMLInputElement>('td input')!.disabled).toBe(true);
    expect(readonly.element.querySelector('.add-row')).toBeNull();
  });
});

describe('Consultas do paciente', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let params: Record<string, string>;
  const templates: RecordTemplateSummary[] = [
    { id: 't1', name: 'Primeira consulta', isDefault: false, sectionCount: 6, fieldCount: 41, updatedAt: '2026-09-18T10:00:00Z' },
    { id: 't2', name: 'Retorno', isDefault: true, sectionCount: 2, fieldCount: 5, updatedAt: '2026-09-18T10:00:00Z' },
  ];
  const summaries: ConsultationSummary[] = [
    { id: 'c2', date: '2026-09-10', status: 'COMPLETED', templateName: 'Primeira consulta', firstCompletedAt: '2026-09-10T12:00:00Z',
      completedAt: '2026-09-11T12:00:00Z', reopenedAt: null, updatedAt: '2026-09-11T12:00:00Z' },
    { id: 'c3', date: '2026-09-05', status: 'DRAFT', templateName: 'Retorno', firstCompletedAt: null, completedAt: null, reopenedAt: null, updatedAt: '2026-09-05T12:00:00Z' },
  ];

  beforeEach(() => {
    params = { id: 'p1' };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap(params); } } } }],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  function openList(list = summaries, person = patient) {
    const fixture = TestBed.createComponent(ConsultationList);
    fixture.detectChanges();
    http.expectOne('/api/patients/p1').flush(person);
    http.expectOne('/api/record-templates').flush(templates);
    http.expectOne('/api/patients/p1/consultations').flush(list);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function openPage(current: Consultation = consultation) {
    params = { id: 'p1', consultationId: 'c1' };
    const fixture = TestBed.createComponent(ConsultationPage);
    fixture.detectChanges();
    http.expectOne('/api/patients/p1').flush(patient);
    http.expectOne('/api/consultations/c1').flush(structuredClone(current));
    fixture.detectChanges();
    return { fixture, app: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  const button = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent!.trim() === label)!;

  it('lists the consultations with their state and opens a new one from the default template', async () => {
    const { fixture, element } = openList();
    expect(texts(element, '.patient-line')).toEqual(['Paciente Fictícia · 36 anos · Feminino']);
    expect(texts(element, '.consultation-date')).toEqual(['10/09/2026', '05/09/2026']);
    expect(texts(element, '.status')).toEqual(['Concluída em 11/09/2026', 'Rascunho']);
    button(element, 'Nova consulta').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((element.querySelector('select[name="templateId"]') as HTMLSelectElement).value).toBe('t2');
    button(element, 'Abrir consulta').click();
    const request = http.expectOne('/api/patients/p1/consultations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.templateId).toBe('t2');
    expect(request.request.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    request.flush(consultation);
    expect(navigate).toHaveBeenCalledWith(['/pacientes', 'p1', 'consultas', 'c1']);
  });

  it('deleting explains that a completed consultation is kept and a draft is erased', () => {
    const { fixture, element } = openList();
    const rows = () => element.querySelectorAll<HTMLElement>('.consultation-row');
    button(rows()[0], 'Excluir').click();
    fixture.detectChanges();
    expect(rows()[0].querySelector('.confirm')!.textContent).toContain('continua guardada');
    button(rows()[0], 'Cancelar').click();
    fixture.detectChanges();
    button(rows()[1], 'Excluir').click();
    fixture.detectChanges();
    expect(rows()[1].querySelector('.confirm')!.textContent).toContain('As respostas serão apagadas.');
    button(rows()[1].querySelector('.confirm') as HTMLElement, 'Excluir').click();
    http.expectOne(request => request.method === 'DELETE' && request.url === '/api/consultations/c3').flush(null);
    http.expectOne('/api/patients/p1/consultations').flush([summaries[0]]);
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
  });

  it('an archived patient cannot get new consultations', () => {
    const { element } = openList([], { ...patient, archived: true });
    expect(element.textContent).toContain('Paciente arquivado');
    expect(button(element, 'Nova consulta')).toBeUndefined();
    expect(element.querySelector('.empty')!.textContent).toContain('Nenhuma consulta registrada.');
  });

  it('fills by section, saves the draft and completes after saving what is on screen', () => {
    const { fixture, app, element } = openPage();
    expect(texts(element, '.section-tab')).toEqual(['Medidas 1/1', 'Hábitos 0/1']);
    expect(button(element, 'Salvar rascunho').disabled).toBe(true);
    button(element, 'Hábitos 0/1').click();
    fixture.detectChanges();
    element.querySelectorAll('.sheet input[type="radio"]')[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(app.dirty()).toBe(true);
    expect(element.querySelector('.save-state')!.textContent).toBe('Alterações não salvas');

    button(element, 'Concluir').click();
    const save = http.expectOne('/api/consultations/c1');
    expect(save.request.body).toEqual({ date: '2026-09-18', version: 3, answers: { weight_kg: 70, appetite: { option: 'normal' } } });
    save.flush({ ...consultation, version: 4, answers: save.request.body.answers });
    const complete = http.expectOne('/api/consultations/c1/complete');
    expect(complete.request.body).toEqual({ version: 4 });
    complete.flush({ consultation: { ...consultation, status: 'COMPLETED', completedAt: '2026-09-18T12:00:00Z', firstCompletedAt: '2026-09-18T12:00:00Z',
      version: 5, answers: save.request.body.answers }, patientUpdated: true });
    fixture.detectChanges();
    expect(element.querySelector('.notice')!.textContent).toContain('Peso e altura atualizados no cadastro do paciente.');
    expect(element.querySelector<HTMLInputElement>('.sheet input')!.disabled).toBe(true);
    expect(button(element, 'Concluir')).toBeUndefined();

    button(element, 'Reabrir').click();
    http.expectOne('/api/consultations/c1/reopen').flush({ ...consultation, status: 'DRAFT', reopenedAt: '2026-09-18T13:00:00Z', version: 6 });
    fixture.detectChanges();
    expect(element.querySelector('.consultation-actions .status')!.textContent).toContain('reaberta em 18/09/2026');
    expect(element.querySelector<HTMLInputElement>('.sheet input')!.disabled).toBe(false);
  });

  it('a field error opens its section; a conflict offers to reload; leaving with changes asks first', () => {
    const { fixture, app, element } = openPage();
    app.setAnswer('appetite', { option: 'normal' });
    app.save();
    http.expectOne('/api/consultations/c1').flush({ detail: 'Opção inexistente.', errors: [{ field: 'answers.appetite.option', message: 'Opção inexistente.' }] },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(app.activeIndex()).toBe(1);
    expect(element.querySelector('.grid-item.has-error')).not.toBeNull();

    app.save();
    http.expectOne('/api/consultations/c1').flush({ detail: 'A consulta foi alterada em outra sessão. Recarregue.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    const guard = routes[2].children!.find(route => route.path === 'pacientes')!.children!
      .find(route => route.path === ':id/consultas/:consultationId')!.canDeactivate![0] as (component: ConsultationPage) => boolean;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(guard(app)).toBe(false);
    expect(confirm).toHaveBeenCalledWith('Sair da consulta sem salvar as alterações?');
    confirm.mockRestore();

    button(element, 'Recarregar').click();
    http.expectOne('/api/consultations/c1').flush({ ...consultation, version: 9 });
    fixture.detectChanges();
    expect(app.dirty()).toBe(false);
    expect(app.consultation()!.version).toBe(9);
  });
});
