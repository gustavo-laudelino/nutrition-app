import { InfoTipComponent } from './info-tip';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged, timer } from 'rxjs';
import { CalculatedFood, CalculationRequest, CalculationResponse, DayNutrient, CompositionTargetResponse, DriActivity, PortionNutrient, EstimateMethod, EstimateRequest, EstimateResponse, Food, FoodPage, MacroMethod, NutritionApi, PatientGoal, Sex, TargetRequest, TargetResponse } from './api';
import { apiErrors, ApiErrors, NO_ERRORS } from './api-errors';
import { Session } from './auth/session';
import { Patient, PatientsApi } from './patients/patients-api';

// savedName is the last non-blank name, sent while the input is temporarily empty.
// time is a screen-only planning aid ("HH:mm" or empty); it is not sent to the calculation API.
// options: 1 to 5 menu alternatives; only the first counts toward the day. activeOptionKey is the one on screen.
interface Meal { key: number; time: string; name: string; savedName: string; options: MealOption[]; activeOptionKey: number }
interface MealOption { key: number; foods: Portion[] }
interface Portion { key: number; food: Food; quantityG: number | null }
type CalculatedMeal = CalculationResponse['meals'][number];
type CalculatedOption = Omit<CalculatedMeal['options'][number], 'foods'> & { foods: (CalculatedFood | null)[] };
// Server result aligned with the meals on screen: a portion left out of the request is null.
type DayResult = Omit<CalculationResponse, 'meals'> & { meals: (Omit<CalculatedMeal, 'options'> & { options: CalculatedOption[] })[] };
const MAX_MEAL_OPTIONS = 5;
const PORTION_QUANTITY_FIELD = /^meals\[(\d+)\]\.options\[(\d+)\]\.foods\[(\d+)\]\.quantityG$/;
interface ConfettiPiece { id: number; x: number; y: number; rotate: number; delay: number; color: string; round: boolean }
/** "7" → 07:00, "730" → 07:30, "0730" → 07:30; out of 00:00–23:59 → empty. */
export function normalizeTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  const [hours, minutes] = digits.length <= 2 ? [Number(digits), 0]
    : digits.length === 3 ? [Number(digits[0]), Number(digits.slice(1))]
    : [Number(digits.slice(0, 2)), Number(digits.slice(2))];
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
const DONUT_MACROS = [
  { css: 'carb', letter: 'C', label: 'Carboidratos' },
  { css: 'protein', letter: 'P', label: 'Proteínas' },
  { css: 'fat', letter: 'G', label: 'Gorduras' },
] as const;
/** Arcs on a circle with pathLength 100, starting at the top, with a small gap between visible slices. */
function donutSlices(shares: number[]) {
  const gap = shares.filter(share => share > 0).length > 1 ? 0.8 : 0;
  let start = 0;
  return DONUT_MACROS.map((macro, index) => {
    const share = shares[index];
    const length = Math.max(share - gap, 0);
    const slice = { ...macro, share, length, dasharray: `${length} ${100 - length}`, dashoffset: -(start + gap / 2) };
    start += share;
    return slice;
  });
}
function sameKcal(value: number | null, expected: number) { return value !== null && Math.abs(value - expected) < 0.01; }
function alignResult(response: CalculationResponse, meals: Meal[], excluded: ReadonlyMap<number, string>): DayResult {
  if (!meals.some(meal => meal.options.some(option => option.foods.some(item => excluded.has(item.key))))) return response;
  return { ...response, meals: response.meals.map((calculated, mealIndex) => ({ ...calculated,
    options: calculated.options.map((option, optionIndex) => {
      const foods = [...option.foods];
      const portions = meals[mealIndex]?.options[optionIndex]?.foods ?? [];
      return { ...option, foods: portions.map(item => excluded.has(item.key) ? null : foods.shift() ?? null) };
    }) })) };
}
/** Changes one meal's options in the result, keeping it aligned with the screen until the recalculation arrives. */
function withMealResult(result: DayResult | null, mealIndex: number, change: (options: CalculatedOption[]) => CalculatedOption[]): DayResult | null {
  const meal = result?.meals[mealIndex];
  if (!result || !meal) return result;
  const meals = [...result.meals];
  meals[mealIndex] = { ...meal, options: change([...meal.options]) };
  return { ...result, meals };
}
type Panel = 'patient' | 'estimate' | 'prescription' | 'macros';
// Micronutrient report groups, in display order; items keep the backend order.
const REPORT_GROUPS = [
  { category: 'MINERAL', label: 'Minerais' },
  { category: 'VITAMIN', label: 'Vitaminas' },
  { category: 'LIPID', label: 'Lipídios' },
] as const;
// Report bars span 0–200% of the reference, so the reference line sits in the middle.
const REPORT_SCALE_PERCENT = 200;
// Nutrients a portion can be sized by, in the food row's column order.
const PORTION_NUTRIENTS = [
  { key: 'CARBOHYDRATE', field: 'carbohydrateG', css: 'macro carb', label: 'Carboidratos', noun: 'carboidrato', unit: 'g', format: '1.0-1' },
  { key: 'PROTEIN', field: 'proteinG', css: 'macro protein', label: 'Proteínas', noun: 'proteína', unit: 'g', format: '1.0-1' },
  { key: 'FAT', field: 'fatG', css: 'macro fat', label: 'Gorduras', noun: 'gordura', unit: 'g', format: '1.0-1' },
  { key: 'ENERGY', field: 'energyKcal', css: 'kcal', label: 'Energia', noun: 'energia', unit: ' kcal', format: '1.0-0' },
] as const;
@Component({ selector: 'app-root', standalone: true, imports: [DatePipe, DecimalPipe, NgTemplateOutlet, RouterLink, FormsModule, ReactiveFormsModule, InfoTipComponent, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder], templateUrl: './app.html',
  host: { '(document:keydown.escape)': 'closePanel()', '(document:click)': 'closePatientMenuOutside($event)' } })
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(NutritionApi);
  private readonly patients = inject(PatientsApi);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(Session);
  private foodRequest?: Subscription;
  private searchDelay?: Subscription;
  private calculationRequest?: Subscription;
  private calculationDelay?: Subscription;
  private targetRequest?: Subscription;
  private targetDelay?: Subscription;
  private readonly formChanges = new Subscription();
  private estimateRequest?: Subscription;
  private estimateDelay?: Subscription;
  private nextKey = 0;
  readonly form = this.fb.group({
    // Typed fields commit on blur/Enter (no request per keystroke); selects commit on change.
    patient: this.fb.group({ name: this.fb.nonNullable.control('', { updateOn: 'blur' }), weightKg: this.fb.control<number | null>(null, { updateOn: 'blur' }),
      heightCm: this.fb.control<number | null>(null, { updateOn: 'blur' }), age: this.fb.control<number | null>(null, { updateOn: 'blur' }), sex: this.fb.nonNullable.control<Sex>('UNSPECIFIED'), goal: this.fb.control<PatientGoal | null>(null), driActivity: this.fb.control<DriActivity | null>(null) }),
    estimation: this.fb.group({ method: this.fb.nonNullable.control<EstimateMethod | 'PER_KG'>('DRI_2023'), faoPal: this.fb.control<number | null>(null, { updateOn: 'blur' }), kcalPerKg: this.fb.control<number | null>(null, { updateOn: 'blur' }) }),
    prescribedEnergyKcal: this.fb.control<number | null>(null, { updateOn: 'blur' }),
    macros: this.fb.group({ method: this.fb.nonNullable.control<MacroMethod>('NONE'), carbohydrate: this.fb.control<number | null>(null, { updateOn: 'blur' }), protein: this.fb.control<number | null>(null, { updateOn: 'blur' }), fat: this.fb.control<number | null>(null, { updateOn: 'blur' }) }),
  });
  readonly catalog = signal<FoodPage | null>(null);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');
  readonly meals = signal<Meal[]>([]);
  readonly foodSearchMealKey = signal<number | null>(null);
  readonly expandedMealKeys = signal<ReadonlySet<number>>(new Set());
  readonly editingMealKey = signal<number | null>(null);
  readonly compositionTarget = signal<CompositionTargetResponse | null>(null);
  readonly compositionTargetLoading = signal(false);
  readonly compositionTargetErrors = signal<string[]>([]);
  private compositionTargetRequest?: Subscription;
  // Celebration after "define composition as target": bars fill 0→value, donut builds and shakes, confetti bursts.
  readonly celebrating = signal(false);
  readonly celebrationKcal = signal<number | null>(null);
  readonly confetti = signal<ConfettiPiece[]>([]);
  // Energy target applied from the composition; the celebration runs only when this exact target comes back.
  private celebrationTargetKcal: number | null = null;
  private celebrationTimers: ReturnType<typeof setTimeout>[] = [];
  private celebrationFrame?: number;
  readonly pendingMealRemoval = signal<number | null>(null);
  readonly pendingOptionRemoval = signal<{ mealKey: number; optionKey: number } | null>(null);
  readonly maxMealOptions = MAX_MEAL_OPTIONS;
  readonly mealShortcuts = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  newMealName = '';
  readonly result = signal<DayResult | null>(null);
  // Sizing a portion by a nutrient: the chip turns into a field; the backend returns the weight, applied as a quantity edit.
  readonly portionNutrients = PORTION_NUTRIENTS;
  readonly editingNutrient = signal<{ portionKey: number; nutrient: PortionNutrient } | null>(null);
  readonly nutrientError = signal('');
  private nutrientRequest?: Subscription;
  // Portions whose quantity the backend rejected, with its message: kept on screen, marked and left out of the calculation until edited.
  readonly invalidPortions = signal<ReadonlyMap<number, string>>(new Map());
  readonly calculating = signal(false);
  readonly errors = signal<string[]>([]);
  readonly alternativeMethodsVisible = signal(false);
  readonly estimate = signal<EstimateResponse | null>(null);
  readonly estimateLoading = signal(false);
  readonly estimateErrors = signal<string[]>([]);
  readonly estimateLabels = { DRI_2023: 'DRI 2023', FAO: 'FAO/WHO/UNU', PER_KG: 'Fórmula de bolso' };
  readonly driLabels = { INACTIVE: 'Inativo', LOW_ACTIVE: 'Pouco ativo', ACTIVE: 'Ativo', VERY_ACTIVE: 'Muito ativo' };
  readonly faoLabels = { SEDENTARY_LIGHT: 'Sedentário / atividade leve', ACTIVE_MODERATE: 'Ativo / moderadamente ativo', VIGOROUS: 'Vigorosamente ativo' };
  readonly targets = signal<TargetResponse | null>(null);
  readonly targetsLoading = signal(false);
  readonly targetErrors = signal<string[]>([]);
  readonly metrics = [
    { key: 'energyKcal', label: 'Valor energético', unit: 'kcal', css: 'energy' },
    { key: 'carbohydrateG', label: 'Carboidratos', unit: 'g', css: 'carb' },
    { key: 'proteinG', label: 'Proteínas', unit: 'g', css: 'protein' },
    { key: 'fatG', label: 'Gorduras', unit: 'g', css: 'fat' },
  ] as const;
  readonly panel = signal<Panel | null>(null);
  readonly panelTitles: Record<Panel, string> = { patient: 'Dados do paciente', estimate: 'Estimativa energética', prescription: 'Meta energética', macros: 'Metas de macros' };
  readonly macroLabels: Record<MacroMethod, string> = { NONE: 'Nenhum método definido', PERCENTAGE: 'Percentual da meta energética' };
  query = '';
  get estimationMethod() { return this.form.controls.estimation.controls.method.value; }

  // Patient data and calculation settings live in drawers, keeping the workspace focused on the diet.
  openPanel(panel: Panel) {
    this.patientMenuOpen.set(false);
    this.panel.set(panel);
    setTimeout(() => document.querySelector<HTMLElement>('.drawer input, .drawer select')?.focus());
  }
  closePanel() {
    if (this.patientMenuOpen()) { this.patientMenuOpen.set(false); return; }
    if (this.panel() === null) return;
    // Commit a field still being edited (blur-based controls) before the drawer disappears.
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.panel.set(null);
  }
  // Visual bar progress only (capped at the target): consumed, target and remaining values come from the backend.
  get summaryMetrics() {
    const totals = this.result()?.totals;
    return this.metrics.map(metric => {
      const balance = totals?.[metric.key] ?? null;
      const target = balance?.target ?? null;
      const ratio = balance && target !== null ? (target > 0 ? balance.consumed / target : balance.consumed > 0 ? 1 : 0) : 0;
      return { ...metric, balance, progress: Math.min(ratio, 1),
        percent: target ? Math.round(ratio * 100) : null, exceeded: (balance?.remaining ?? 0) < 0 };
    });
  }
  // Macro highlighted by pointer or keyboard, shared by the bars and the donut.
  readonly highlightedMacro = signal<string | null>(null);
  // Description position: follows the pointer; null (keyboard) anchors it under the donut.
  readonly macroTipPosition = signal<{ x: number; y: number } | null>(null);
  highlightMacro(css: string | null) { this.highlightedMacro.set(css === 'energy' ? null : css); }
  /** Keeps the description beside the cursor, inside the window. */
  trackMacro(css: string, event: MouseEvent) {
    this.highlightMacro(css);
    if (this.highlightedMacro() === null) { this.macroTipPosition.set(null); return; }
    const width = Math.min(300, window.innerWidth - 24);
    this.macroTipPosition.set({
      x: Math.max(12, Math.min(event.clientX + 16, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(event.clientY + 18, window.innerHeight - 140)),
    });
  }
  clearMacro() { this.highlightMacro(null); this.macroTipPosition.set(null); }
  get macroDetail() {
    const css = this.highlightedMacro();
    const index = DONUT_MACROS.findIndex(macro => macro.css === css);
    const metric = this.summaryMetrics.find(item => item.css === css);
    if (!metric || index < 0) return null;
    const donut = this.macroDonut;
    return { ...metric, consumedShare: donut.consumed?.[index].share ?? null, targetShare: donut.target?.[index].share ?? null };
  }
  // Inner donut: consumed macro energy shares from the backend.
  // Outer ring: one arc per macro sized by its target energy (from the backend), filled by how much of that target was consumed.
  get macroDonut() {
    const shares = this.result()?.macroEnergyShares ?? null;
    const macros = this.targets()?.macros;
    const targetEnergy = macros?.carbohydrate && macros.protein && macros.fat
      ? [macros.carbohydrate.energyKcal, macros.protein.energyKcal, macros.fat.energyKcal] : null;
    const targetTotal = targetEnergy?.reduce((sum, value) => sum + value, 0) ?? 0;
    const macroMetrics = this.summaryMetrics.slice(1);
    return {
      consumed: shares ? donutSlices([shares.carbohydratePercent, shares.proteinPercent, shares.fatPercent]) : null,
      target: targetEnergy && targetTotal > 0
        ? donutSlices(targetEnergy.map(value => value * 100 / targetTotal)).map((slice, index) => {
          const loaded = slice.length * macroMetrics[index].progress;
          return { ...slice, progress: macroMetrics[index].progress, exceeded: macroMetrics[index].exceeded, loadedDasharray: `${loaded} ${100 - loaded}` };
        })
        : null,
    };
  }
  // Fiber from the backend nutrients (absent with an older API): bar capped at the reference, as the macro bars.
  get fiber() {
    const fiber = (this.result()?.nutrients ?? []).find(item => item.code === 'FIBER') ?? null;
    return fiber && { ...fiber, progress: Math.min((fiber.reference?.percent ?? 0) / 100, 1) };
  }
  // Day's micronutrient report: only drawing positions here; sums, references and percentages come from the backend.
  readonly reportExpanded = signal(true);
  get nutrientReport() {
    const nutrients = (this.result()?.nutrients ?? []).filter(item => item.inReport);
    return REPORT_GROUPS.map(group => ({ ...group, items: nutrients.filter(item => item.category === group.category).map(item => this.reportItem(item)) }))
      .filter(group => group.items.length);
  }
  private reportItem(item: DayNutrient) {
    const percent = item.reference?.percent ?? null;
    return { ...item, fill: percent === null ? 0 : Math.min(percent, REPORT_SCALE_PERCENT) / REPORT_SCALE_PERCENT,
      over: percent !== null && percent > REPORT_SCALE_PERCENT, referenceAt: 100 / REPORT_SCALE_PERCENT };
  }
  /** Sex and age of the planning profile (typed or from the register) select the references; otherwise none is sent. */
  private referenceProfile(): CalculationRequest['referenceProfile'] {
    const { sex, age } = this.form.controls.patient.getRawValue();
    return sex !== 'UNSPECIFIED' && age !== null ? { sex, age } : undefined;
  }
  get macroSummary() {
    const macros = this.targets()?.macros;
    if (!macros) return [];
    return ([['C', macros.carbohydrate], ['P', macros.protein], ['G', macros.fat]] as const)
      .filter(([, target]) => target !== null).map(([label, target]) => ({ label, grams: target!.grams }));
  }
  get patientSummary() {
    const { name, age, weightKg } = this.form.controls.patient.getRawValue();
    return [name.trim(), age !== null ? `${age} anos` : '', weightKg !== null ? `${weightKg} kg` : ''].filter(Boolean).join(' · ');
  }
  get needsPatientData() {
    const { weightKg, heightCm, age, sex, driActivity } = this.form.controls.patient.getRawValue();
    if (weightKg === null) return true;
    if (this.estimationMethod === 'PER_KG') return false;
    if (age === null || sex === 'UNSPECIFIED') return true;
    return this.estimationMethod === 'DRI_2023' && (heightCm === null || driActivity === null);
  }
  get macroMethod() { return this.form.controls.macros.controls.method.value; }

  // Registered patient chosen for this planning: the screen reads it, and editing writes straight to the register.
  // Nothing about the planning itself is saved.
  readonly selectedPatient = signal<Patient | null>(null);
  readonly patientSearch = new FormControl('', { nonNullable: true });
  readonly patientResults = signal<Patient[] | null>(null);
  readonly patientTotal = signal(0);
  readonly patientSearchLoading = signal(false);
  readonly editingPatient = signal(false);
  readonly patientSaving = signal(false);
  readonly patientConflict = signal(false);
  readonly patientErrors = signal<ApiErrors>(NO_ERRORS);
  private patientRequest?: Subscription;
  private patientSearchSubscription?: Subscription;
  // Drop-down under the "Paciente" button: only search and the nutritionist's patient names.
  // The chosen patient's data, goal and editing live in the "Dados do paciente" drawer.
  readonly patientMenuOpen = signal(false);
  openPatientMenu() {
    this.patientMenuOpen.set(true);
    if (this.session.token() && this.patientResults() === null) this.runPatientSearch(this.patientSearch.value);
    setTimeout(() => document.querySelector<HTMLElement>('.patient-menu input')?.focus());
  }
  togglePatientMenu() {
    if (this.patientMenuOpen()) this.patientMenuOpen.set(false); else this.openPatientMenu();
  }
  /** Clicks outside the drop-down close it; composedPath survives buttons that re-render after the click. */
  closePatientMenuOutside(event: MouseEvent) {
    if (!this.patientMenuOpen()) return;
    const inside = event.composedPath().some(target => target instanceof HTMLElement && target.classList.contains('patient-menu-anchor'));
    if (!inside) this.patientMenuOpen.set(false);
  }
  /** DRI/FAO cover adults 19+: below that no automatic estimate is requested. */
  get belowEstimateAge() {
    const age = this.form.controls.patient.controls.age.value;
    return age !== null && age < 19;
  }

  searchPatients(name: string) {
    this.patientSearch.setValue(name, { emitEvent: false });
    this.runPatientSearch(name);
  }
  private runPatientSearch(name: string) {
    this.patientRequest?.unsubscribe();
    if (!this.session.token()) { this.patientResults.set(null); return; }
    this.patientSearchLoading.set(true);
    this.patientErrors.set(NO_ERRORS);
    this.patientRequest = this.patients.list(name, false, 0).subscribe({
      next: page => { this.patientResults.set(page.content); this.patientTotal.set(page.totalElements); this.patientSearchLoading.set(false); },
      error: error => { this.patientResults.set([]); this.patientSearchLoading.set(false); this.patientErrors.set(apiErrors(error)); },
    });
  }
  /** Age comes calculated from the backend; the goal is not part of the register and stays on screen. */
  choosePatient(patient: Patient) {
    if (this.editingPatient() || this.patientSaving()) return;
    this.selectedPatient.set(patient);
    this.editingPatient.set(false);
    this.patientConflict.set(false);
    this.patientErrors.set(NO_ERRORS);
    this.fillPatientFields(patient);
    this.setPatientFieldsEnabled(false);
    this.patientMenuOpen.set(false);
  }
  unlinkPatient() {
    this.selectedPatient.set(null);
    this.editingPatient.set(false);
    this.patientConflict.set(false);
    this.patientErrors.set(NO_ERRORS);
    this.setPatientFieldsEnabled(true);
  }
  editPatient() {
    if (!this.selectedPatient() || this.patientConflict()) return;
    setTimeout(() => document.querySelector<HTMLElement>('.drawer .fields input:not(:disabled)')?.focus());
    this.editingPatient.set(true);
    this.setPatientFieldsEnabled(true);
  }
  cancelEditPatient() {
    const patient = this.selectedPatient();
    if (!patient) return;
    this.editingPatient.set(false);
    this.patientErrors.set(NO_ERRORS);
    this.fillPatientFields(patient);
    this.setPatientFieldsEnabled(false);
  }
  /** Sends the whole registered patient with the edited fields on top, so fields not shown here are preserved. */
  savePatient() {
    const patient = this.selectedPatient();
    if (!patient || this.patientSaving() || this.patientConflict()) return;
    const { name, sex, weightKg, heightCm, driActivity } = this.form.controls.patient.getRawValue();
    this.patientSaving.set(true);
    this.patientErrors.set(NO_ERRORS);
    this.patientRequest?.unsubscribe();
    this.patientRequest = this.patients.save(patient.id, {
      ...patient, name: name.trim(), sex: sex === 'UNSPECIFIED' ? null : sex,
      weightKg, heightCm, driActivity, version: patient.version,
    }).subscribe({
      next: saved => {
        this.patientSaving.set(false);
        this.selectedPatient.set(saved);
        this.editingPatient.set(false);
        this.fillPatientFields(saved);
        this.setPatientFieldsEnabled(false);
      },
      error: error => {
        this.patientSaving.set(false);
        if (error.status === 409) {
          this.patientConflict.set(true);
          this.patientErrors.set({ detail: 'O paciente foi alterado em outra sessão. Recarregue.', fields: {} });
        } else this.patientErrors.set(apiErrors(error));
      },
    });
  }
  reloadPatient() {
    const patient = this.selectedPatient();
    if (!patient) return;
    this.patientRequest?.unsubscribe();
    this.patientErrors.set(NO_ERRORS);
    this.patientRequest = this.patients.get(patient.id).subscribe({
      // Reloading discards the edit that hit the conflict.
      next: current => { this.patientConflict.set(false); this.editingPatient.set(false); this.choosePatient(current); },
      error: error => this.patientErrors.set(apiErrors(error)),
    });
  }
  private fillPatientFields(patient: Patient) {
    this.form.controls.patient.patchValue({
      name: patient.name, sex: patient.sex ?? 'UNSPECIFIED', age: patient.ageYears,
      weightKg: patient.weightKg, heightCm: patient.heightCm, driActivity: patient.driActivity,
    });
  }
  // Read-only while a patient is chosen: disabled controls keep their value in getRawValue and in the requests.
  private setPatientFieldsEnabled(enabled: boolean) {
    const controls = this.form.controls.patient.controls;
    for (const control of [controls.name, controls.sex, controls.age, controls.weightKg, controls.heightCm, controls.driActivity]) {
      if (enabled) control.enable({ emitEvent: false }); else control.disable({ emitEvent: false });
    }
    // Age always comes from the register's birth date.
    if (enabled && this.selectedPatient()) controls.age.disable({ emitEvent: false });
  }

  ngOnInit() {
    this.formChanges.add(this.patientSearch.valueChanges.pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(name => this.runPatientSearch(name)));
    let previousMacroMethod = this.macroMethod;
    this.formChanges.add(this.form.controls.macros.valueChanges.subscribe(() => {
      if (this.macroMethod !== previousMacroMethod) {
        previousMacroMethod = this.macroMethod;
        this.form.controls.macros.patchValue({ carbohydrate: null, protein: null, fat: null }, { emitEvent: false });
      }
      this.scheduleTargets();
    }));
    this.formChanges.add(this.form.controls.prescribedEnergyKcal.valueChanges.subscribe(() => {
      if (this.estimationMethod === 'PER_KG') {
        this.estimateRequest?.unsubscribe(); this.estimateDelay?.unsubscribe(); this.estimateLoading.set(false);
      }
      this.scheduleTargets();
    }));
    this.formChanges.add(this.form.controls.estimation.valueChanges.subscribe(() => this.scheduleEstimate()));
    let previousWeight = this.form.controls.patient.controls.weightKg.value;
    let previousProfile = JSON.stringify(this.referenceProfile() ?? null);
    this.formChanges.add(this.form.controls.patient.valueChanges.subscribe(() => {
      // The nutrient references depend on sex and age: recalculate the day when they change.
      const profile = JSON.stringify(this.referenceProfile() ?? null);
      if (profile !== previousProfile) { previousProfile = profile; this.calculate(); }
      const weight = this.form.controls.patient.controls.weightKg.value;
      const weightChanged = weight !== previousWeight;
      previousWeight = weight;
      if (this.estimationMethod !== 'PER_KG' || weightChanged) this.scheduleEstimate();
    }));
    this.calculate();
  }

  private scheduleEstimate() {
    this.estimateRequest?.unsubscribe(); this.estimateDelay?.unsubscribe();
    this.estimateErrors.set([]); this.estimateLoading.set(false);
    const hasInputs = this.hasEstimateInputs();
    // Values stay on screen until the new response arrives; they are removed only when they no longer apply.
    const perKg = this.estimationMethod === 'PER_KG';
    if (this.estimate() && (perKg || !hasInputs)) { this.estimate.set(null); this.scheduleTargets(); }
    // Choosing the per-kg formula prescribes directly; without its inputs there is no per-kg prescription.
    if (perKg && !hasInputs && this.form.controls.prescribedEnergyKcal.value !== null) {
      this.form.controls.prescribedEnergyKcal.setValue(null, { emitEvent: false }); this.scheduleTargets();
    }
    if (hasInputs) {
      this.estimateLoading.set(true);
      this.estimateDelay = timer(300).subscribe(() => this.updateEstimate());
    }
  }

  // Only presence gates automatic requests; nutritional validation stays on the server.
  private hasEstimateInputs() {
    const { patient, estimation } = this.form.getRawValue();
    if (patient.weightKg === null) return false;
    if (estimation.method === 'PER_KG') return estimation.kcalPerKg !== null;
    if (patient.age === null || patient.sex === 'UNSPECIFIED') return false;
    // DRI/FAO cover adults 19+: no automatic request that the backend would reject.
    if (patient.age < 19) return false;
    return estimation.method === 'DRI_2023'
      ? patient.heightCm !== null && patient.driActivity !== null
      : estimation.faoPal !== null;
  }

  updateEstimate() {
    this.estimateDelay?.unsubscribe(); this.estimateRequest?.unsubscribe();
    if (this.estimationMethod === 'PER_KG') { this.updatePerKgPrescription(); return; }
    this.estimateLoading.set(true); this.estimateErrors.set([]);
    const { patient, estimation } = this.form.getRawValue();
    const request: EstimateRequest = { patient, method: this.estimationMethod };
    if (request.method === 'FAO') request.faoPal = estimation.faoPal;
    this.estimateRequest = this.api.estimateEnergy(request).subscribe({
      next: result => { this.estimate.set(result); this.estimateLoading.set(false); this.scheduleTargets(); },
      error: error => {
        this.estimate.set(null); this.estimateLoading.set(false); this.estimateErrors.set(this.errorMessages(error));
        this.scheduleTargets();
      },
    });
  }

  private updatePerKgPrescription() {
    const { patient, estimation } = this.form.getRawValue();
    this.estimateLoading.set(true); this.estimateErrors.set([]);
    this.estimateRequest = this.api.prescribePerKg({ weightKg: patient.weightKg, kcalPerKg: estimation.kcalPerKg }).subscribe({
      next: result => {
        this.estimateLoading.set(false);
        this.form.controls.prescribedEnergyKcal.setValue(result.prescribedEnergyKcal);
      },
      error: error => {
        this.estimateLoading.set(false); this.estimateErrors.set(this.errorMessages(error));
        this.form.controls.prescribedEnergyKcal.setValue(null);
      },
    });
  }

  useEstimateAsTarget() {
    const estimate = this.estimate();
    if (estimate && !this.estimateLoading()) this.form.controls.prescribedEnergyKcal.setValue(estimate.estimatedKcal);
  }

  private scheduleTargets() {
    this.targetRequest?.unsubscribe(); this.targetDelay?.unsubscribe();
    this.targetErrors.set([]); this.targetsLoading.set(false);
    if (this.form.controls.prescribedEnergyKcal.value === null && this.macroMethod === 'NONE') {
      if (this.targets() !== null) { this.targets.set(null); this.calculate(); }
      return;
    }
    this.targetsLoading.set(true);
    this.targetDelay = timer(300).subscribe(() => this.updateTargets());
  }

  updateTargets() {
    this.targetDelay?.unsubscribe(); this.targetRequest?.unsubscribe();
    this.targetErrors.set([]);
    if (this.form.controls.prescribedEnergyKcal.value === null && this.macroMethod === 'NONE') {
      this.celebrationTargetKcal = null;
      this.targets.set(null); this.targetsLoading.set(false); this.calculate(); return;
    }
    this.targetsLoading.set(true);
    this.targetRequest = this.api.calculateTargets(this.targetPayload()).subscribe({
      next: result => {
        // The applied target was replaced before it came back (manual edit): no celebration.
        if (this.celebrationTargetKcal !== null && !sameKcal(result.targets.energyKcal, this.celebrationTargetKcal)) this.celebrationTargetKcal = null;
        this.targets.set(result); this.targetsLoading.set(false); this.calculate();
      },
      error: error => {
        this.celebrationTargetKcal = null;
        this.targets.set(null); this.targetsLoading.set(false); this.targetErrors.set(this.errorMessages(error));
        this.calculate();
      },
    });
  }

  private targetPayload(): TargetRequest {
    const { prescribedEnergyKcal, macros } = this.form.getRawValue();
    const request: TargetRequest = {
      prescribedEnergyKcal, referenceEstimateKcal: this.estimate()?.estimatedKcal ?? null,
      macros: { method: macros.method },
    };
    if (macros.method !== 'NONE') {
      request.macros.carbohydrate = macros.carbohydrate; request.macros.protein = macros.protein; request.macros.fat = macros.fat;
    }
    return request;
  }
  searchChanged(value: string) {
    this.query = value; this.searchDelay?.unsubscribe(); this.foodRequest?.unsubscribe();
    this.catalog.set(null); this.catalogError.set(''); this.catalogLoading.set(false);
    if (value.trim()) { this.catalogLoading.set(true); this.searchDelay = timer(200).subscribe(() => this.loadFoods()); }
  }
  loadFoods(page = 0) {
    this.searchDelay?.unsubscribe(); this.foodRequest?.unsubscribe();
    if (!this.query.trim()) { this.catalog.set(null); this.catalogLoading.set(false); this.catalogError.set(''); return; }
    this.catalogLoading.set(true); this.catalogError.set('');
    this.foodRequest = this.api.search(this.query.trim(), page).subscribe({
      next: result => { this.catalog.set(result); this.catalogLoading.set(false); },
      error: error => { this.catalog.set(null); this.catalogLoading.set(false); this.catalogError.set(this.errorMessages(error).join(' ')); },
    });
  }
  addMeal(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = this.nextKey++;
    const optionKey = this.nextKey++;
    this.meals.update(meals => [...meals, { key, time: '', name: trimmed, savedName: trimmed, options: [{ key: optionKey, foods: [] }], activeOptionKey: optionKey }]);
    this.setMealExpanded(key, true);
    this.newMealName = '';
    this.openFoodSearch(key);
    this.calculate();
  }
  setMealTime(key: number, time: string | null) {
    this.meals.update(meals => meals.map(meal => meal.key === key ? { ...meal, time: time ?? '' } : meal));
  }
  // 24-hour HH:mm text mask: the native time picker follows the OS locale and may show AM/PM.
  onMealTimeInput(key: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    this.setMealTime(key, input.value);
  }
  commitMealTime(key: number, event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = normalizeTime(input.value);
    this.setMealTime(key, input.value);
  }
  renameMeal(key: number, name: string) {
    const trimmed = name.trim();
    this.meals.update(meals => meals.map(meal => meal.key === key ? { ...meal, name, savedName: trimmed || meal.savedName } : meal));
    // The name does not change nutrients: no recalculation; a blank name is never sent.
  }
  startEditMeal(key: number) {
    this.editingMealKey.set(key);
    setTimeout(() => document.querySelector<HTMLInputElement>('.meal-name-input')?.focus());
  }
  finishEditMeal(key: number) {
    this.restoreMealName(key);
    this.editingMealKey.set(null);
  }
  restoreMealName(key: number) {
    this.meals.update(meals => meals.map(meal => meal.key === key && !meal.name.trim() ? { ...meal, name: meal.savedName } : meal));
  }
  moveMeal(key: number, direction: -1 | 1) {
    const index = this.meals().findIndex(meal => meal.key === key);
    if (this.reorderMeals(index, index + direction)) this.calculate();
  }
  // Drag and drop (Angular CDK): the preview follows the pointer and siblings slide; recalculates once on drop.
  dropMeal(event: CdkDragDrop<Meal[]>) {
    if (this.reorderMeals(event.previousIndex, event.currentIndex)) this.calculate();
  }
  // Keeps the last server result aligned with the new order until the recalculation arrives.
  private reorderMeals(from: number, to: number) {
    const meals = [...this.meals()];
    if (from === to || from < 0 || to < 0 || from >= meals.length || to >= meals.length) return false;
    moveItemInArray(meals, from, to);
    this.meals.set(meals);
    const result = this.result();
    if (result && result.meals.length === meals.length) {
      const calculated = [...result.meals];
      moveItemInArray(calculated, from, to);
      this.result.set({ ...result, meals: calculated });
    }
    return true;
  }
  requestRemoveMeal(key: number) {
    const meal = this.meals().find(item => item.key === key);
    if (!meal) return;
    if (meal.options.some(option => option.foods.length)) this.pendingMealRemoval.set(key);
    else this.removeMeal(key);
  }
  removeMeal(key: number) {
    const index = this.meals().findIndex(meal => meal.key === key);
    this.forgetInvalidPortions(this.meals()[index]?.options.flatMap(option => option.foods.map(item => item.key)) ?? []);
    this.meals.update(meals => meals.filter(meal => meal.key !== key));
    const result = this.result();
    if (result && index >= 0 && index < result.meals.length) this.result.set({ ...result, meals: result.meals.filter((_, i) => i !== index) });
    if (this.foodSearchMealKey() === key) this.closeFoodSearch();
    this.setMealExpanded(key, false);
    this.pendingMealRemoval.set(null); this.calculate();
  }
  // Meals collapse to a summary line; details, editing and food search live in the expanded body.
  isMealExpanded(key: number) { return this.expandedMealKeys().has(key); }
  toggleMeal(key: number) { this.setMealExpanded(key, !this.isMealExpanded(key)); }
  setAllMealsExpanded(expanded: boolean) {
    this.expandedMealKeys.set(new Set(expanded ? this.meals().map(meal => meal.key) : []));
    if (!expanded && this.foodSearchMealKey() !== null) this.closeFoodSearch();
  }
  private setMealExpanded(key: number, expanded: boolean) {
    const keys = new Set(this.expandedMealKeys());
    if (expanded) keys.add(key); else keys.delete(key);
    this.expandedMealKeys.set(keys);
    if (!expanded && this.foodSearchMealKey() === key) this.closeFoodSearch();
  }
  // Foods are always added from inside a meal; only one meal search is open at a time.
  openFoodSearch(key: number) {
    this.setMealExpanded(key, true);
    if (this.foodSearchMealKey() !== key) this.searchChanged('');
    this.foodSearchMealKey.set(key);
    setTimeout(() => document.querySelector<HTMLInputElement>('.meal-food-search [name="search"]')?.focus());
  }
  closeFoodSearch() {
    this.foodSearchMealKey.set(null);
    this.searchChanged('');
  }
  addFood(food: Food) {
    const mealKey = this.foodSearchMealKey();
    if (mealKey === null) return;
    // Added to the option on screen.
    this.meals.update(meals => meals.map(item => item.key === mealKey
      ? { ...item, options: item.options.map(option => option.key === item.activeOptionKey
        ? { ...option, foods: [...option.foods, { key: this.nextKey++, food, quantityG: 100 }] } : option) } : item));
    this.closeFoodSearch();
    this.calculate();
  }
  changeQuantity(mealKey: number, key: number, quantityG: number | null, input?: HTMLInputElement) {
    // Portion keys are unique on the whole screen: the portion is found in whichever option holds it.
    const portion = this.meals().find(meal => meal.key === mealKey)?.options.flatMap(option => option.foods).find(item => item.key === key);
    if (!portion) return;
    // Empty or unreadable input: the last quantity comes back and nothing is sent.
    if (quantityG === null) {
      if (input) input.value = portion.quantityG === null ? '' : String(portion.quantityG);
      return;
    }
    this.forgetInvalidPortions([key]);
    this.meals.update(meals => meals.map(meal => meal.key === mealKey
      ? { ...meal, options: meal.options.map(option => ({ ...option, foods: option.foods.map(item => item.key === key ? { ...item, quantityG } : item) })) } : meal));
    this.calculate();
  }
  /** Only a presence check on the catalog value per 100 g; the weight itself comes from the backend. */
  canSizeBy(food: Food, field: typeof PORTION_NUTRIENTS[number]['field']) { return (food[field] ?? 0) > 0; }
  editNutrient(portionKey: number, nutrient: PortionNutrient) {
    this.nutrientRequest?.unsubscribe();
    this.nutrientError.set('');
    this.editingNutrient.set({ portionKey, nutrient });
    setTimeout(() => { const input = document.querySelector<HTMLInputElement>('.nutrient-edit input'); input?.focus(); input?.select(); });
  }
  cancelNutrientEdit() {
    this.nutrientRequest?.unsubscribe();
    this.editingNutrient.set(null);
    this.nutrientError.set('');
  }
  /** Empty, unreadable or unchanged values cancel without a request; anything else is validated by the backend. */
  confirmNutrient(mealKey: number, portion: Portion, nutrient: PortionNutrient, raw: string, current: number | null) {
    const editing = this.editingNutrient();
    if (!editing || editing.portionKey !== portion.key || editing.nutrient !== nutrient) return;
    const amount = raw.trim() === '' ? NaN : Number(raw);
    if (Number.isNaN(amount) || amount === current) { this.cancelNutrientEdit(); return; }
    this.nutrientRequest?.unsubscribe();
    this.nutrientError.set('');
    this.nutrientRequest = this.api.portionQuantity({ foodId: portion.food.id, nutrient, amount }).subscribe({
      next: result => {
        this.editingNutrient.set(null);
        this.changeQuantity(mealKey, portion.key, result.quantityG);
      },
      error: (error: HttpErrorResponse) => this.nutrientError.set(
        error.error?.errors?.[0]?.message ?? error.error?.detail ?? 'Não foi possível calcular a porção. Tente novamente.'),
    });
  }
  private forgetInvalidPortions(keys: number[]) {
    if (!keys.some(key => this.invalidPortions().has(key))) return;
    const invalid = new Map(this.invalidPortions());
    keys.forEach(key => invalid.delete(key));
    this.invalidPortions.set(invalid);
  }
  removeFood(mealKey: number, key: number) {
    this.forgetInvalidPortions([key]);
    const mealIndex = this.meals().findIndex(meal => meal.key === mealKey);
    const options = this.meals()[mealIndex]?.options ?? [];
    const optionIndex = options.findIndex(option => option.foods.some(item => item.key === key));
    if (optionIndex < 0) return;
    const foodIndex = options[optionIndex].foods.findIndex(item => item.key === key);
    this.meals.update(meals => meals.map(meal => meal.key === mealKey
      ? { ...meal, options: meal.options.map(option => ({ ...option, foods: option.foods.filter(item => item.key !== key) })) } : meal));
    this.result.set(withMealResult(this.result(), mealIndex, calculated => {
      const option = calculated[optionIndex];
      if (option) calculated[optionIndex] = { ...option, foods: option.foods.filter((_, i) => i !== foodIndex) };
      return calculated;
    }));
    this.calculate();
  }
  // Meal options: the tabs show one option at a time; only option 1 counts toward the day (backend rule).
  activeOption(meal: Meal) { return meal.options.find(option => option.key === meal.activeOptionKey) ?? meal.options[0]; }
  activeOptionIndex(meal: Meal) { return Math.max(meal.options.findIndex(option => option.key === meal.activeOptionKey), 0); }
  selectOption(mealKey: number, optionKey: number) {
    this.pendingOptionRemoval.set(null);
    this.meals.update(meals => meals.map(meal => meal.key === mealKey ? { ...meal, activeOptionKey: optionKey } : meal));
  }
  /** Left/right arrows move between the tabs and focus the new one. */
  stepOption(meal: Meal, direction: -1 | 1) {
    const count = meal.options.length;
    const next = meal.options[(this.activeOptionIndex(meal) + direction + count) % count];
    this.selectOption(meal.key, next.key);
    setTimeout(() => document.getElementById('option-tab-' + next.key)?.focus());
  }
  /** "+" copies the option on screen (same foods and quantities, new portions) and opens the copy. */
  addOption(mealKey: number) {
    const meal = this.meals().find(item => item.key === mealKey);
    if (!meal || meal.options.length >= MAX_MEAL_OPTIONS) return;
    this.pendingOptionRemoval.set(null);
    const invalid = new Map(this.invalidPortions());
    const foods = this.activeOption(meal).foods.map(item => {
      const copy = { ...item, key: this.nextKey++ };
      const message = invalid.get(item.key);
      if (message !== undefined) invalid.set(copy.key, message);
      return copy;
    });
    const option = { key: this.nextKey++, foods };
    if (invalid.size !== this.invalidPortions().size) this.invalidPortions.set(invalid);
    this.meals.update(meals => meals.map(item => item.key === mealKey ? { ...item, options: [...item.options, option], activeOptionKey: option.key } : item));
    this.calculate();
  }
  /** Moves the option to the first position (it starts counting toward the day); the others keep their order. */
  makeFirstOption(mealKey: number, optionKey: number) {
    const from = this.meals().find(meal => meal.key === mealKey)?.options.findIndex(option => option.key === optionKey) ?? -1;
    this.moveOption(mealKey, from, 0);
  }
  /** Dragging a tab reorders the options, like browser tabs; whichever lands first counts toward the day. */
  dropOption(mealKey: number, event: CdkDragDrop<unknown>) {
    this.moveOption(mealKey, event.previousIndex, event.currentIndex);
  }
  private moveOption(mealKey: number, from: number, to: number) {
    const mealIndex = this.meals().findIndex(meal => meal.key === mealKey);
    const count = this.meals()[mealIndex]?.options.length ?? 0;
    if (from === to || from < 0 || to < 0 || from >= count || to >= count) return;
    this.pendingOptionRemoval.set(null);
    this.meals.update(meals => meals.map(meal => {
      if (meal.key !== mealKey) return meal;
      const options = [...meal.options];
      moveItemInArray(options, from, to);
      return { ...meal, options };
    }));
    this.result.set(withMealResult(this.result(), mealIndex, options => { moveItemInArray(options, from, to); return options; }));
    this.calculate();
  }
  /** Closing a tab: an empty option closes at once; one with foods is opened and asks for confirmation. */
  requestRemoveOption(mealKey: number, optionKey: number) {
    const meal = this.meals().find(item => item.key === mealKey);
    const option = meal?.options.find(item => item.key === optionKey);
    if (!meal || !option || meal.options.length <= 1) return;
    if (!option.foods.length) { this.removeOption(mealKey, optionKey); return; }
    this.selectOption(mealKey, optionKey);
    this.pendingOptionRemoval.set({ mealKey, optionKey });
  }
  /** Any option can go except the only one; when option 1 goes, the next one starts counting. */
  removeOption(mealKey: number, optionKey: number) {
    this.pendingOptionRemoval.set(null);
    const mealIndex = this.meals().findIndex(meal => meal.key === mealKey);
    const meal = this.meals()[mealIndex];
    const index = meal?.options.findIndex(option => option.key === optionKey) ?? -1;
    if (!meal || index < 0 || meal.options.length <= 1) return;
    this.forgetInvalidPortions(meal.options[index].foods.map(item => item.key));
    const options = meal.options.filter(option => option.key !== optionKey);
    const activeOptionKey = meal.activeOptionKey === optionKey ? options[Math.min(index, options.length - 1)].key : meal.activeOptionKey;
    this.meals.update(meals => meals.map(item => item.key === mealKey ? { ...item, options, activeOptionKey } : item));
    this.result.set(withMealResult(this.result(), mealIndex, calculated => calculated.filter((_, i) => i !== index)));
    this.calculate();
  }
  // Cancels the running calculation; the last result stays visible until the new one arrives.
  invalidate() {
    this.calculationRequest?.unsubscribe(); this.calculating.set(false); this.errors.set([]);
    // A pending "define as target" proposal refers to the previous composition.
    this.compositionTargetRequest?.unsubscribe(); this.compositionTargetLoading.set(false); this.compositionTarget.set(null);
  }
  get hasTargets() { return this.form.controls.prescribedEnergyKcal.value !== null || this.macroMethod !== 'NONE'; }
  // Explicit professional action: the backend turns consumed totals into an energy target and macro percentages.
  defineCompositionAsTarget() {
    const totals = this.result()?.totals;
    if (!totals) return;
    this.compositionTargetRequest?.unsubscribe();
    this.compositionTargetErrors.set([]); this.compositionTargetLoading.set(true);
    this.compositionTargetRequest = this.api.targetsFromComposition({ energyKcal: totals.energyKcal.consumed,
      carbohydrateG: totals.carbohydrateG.consumed, proteinG: totals.proteinG.consumed, fatG: totals.fatG.consumed }).subscribe({
      next: proposal => {
        this.compositionTargetLoading.set(false);
        if (this.hasTargets) this.compositionTarget.set(proposal); else this.applyCompositionTarget(proposal);
      },
      error: error => { this.compositionTargetLoading.set(false); this.compositionTargetErrors.set(this.errorMessages(error)); },
    });
  }
  private celebrate(kcal: number) {
    this.stopCelebration();
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    const fillMs = 2400; // keep in sync with meter-fill / donut-build / chart-build durations in styles.css
    this.celebrating.set(true);
    const start = performance.now();
    const count = (now: number) => {
      const t = Math.min((now - start) / fillMs, 1);
      this.celebrationKcal.set(Math.round(kcal * (1 - Math.pow(1 - t, 3))));
      this.celebrationFrame = t < 1 ? requestAnimationFrame(count) : undefined;
    };
    this.celebrationFrame = requestAnimationFrame(count);
    const colors = ['#3f7d62', '#4a84c4', '#d65a52', '#e3b53a', '#8cc4aa', '#f0c75e'];
    this.celebrationTimers.push(setTimeout(() => this.confetti.set(Array.from({ length: 70 }, (_, id) => {
      const angle = Math.random() * Math.PI * 2, distance = 90 + Math.random() * 130;
      return { id, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 40, rotate: Math.random() * 720 - 360,
        delay: Math.random() * 120, color: colors[id % colors.length], round: id % 3 === 0 };
    })), fillMs));
    this.celebrationTimers.push(setTimeout(() => this.stopCelebration(), fillMs + 1600));
  }
  private stopCelebration() {
    this.celebrationTimers.forEach(clearTimeout); this.celebrationTimers = [];
    if (this.celebrationFrame !== undefined) cancelAnimationFrame(this.celebrationFrame);
    this.celebrationFrame = undefined;
    this.celebrating.set(false); this.celebrationKcal.set(null); this.confetti.set([]);
  }
  applyCompositionTarget(proposal = this.compositionTarget()) {
    if (!proposal) return;
    this.compositionTarget.set(null);
    this.celebrationTargetKcal = proposal.prescribedEnergyKcal;
    this.form.controls.prescribedEnergyKcal.setValue(proposal.prescribedEnergyKcal);
    if (this.macroMethod !== 'PERCENTAGE') this.form.controls.macros.controls.method.setValue('PERCENTAGE');
    this.form.controls.macros.patchValue({ carbohydrate: proposal.carbohydratePercent, protein: proposal.proteinPercent, fat: proposal.fatPercent });
  }
  calculate() {
    this.calculationDelay?.unsubscribe(); this.invalidate(); this.calculating.set(true);
    const meals = this.meals();
    const invalid = this.invalidPortions();
    const sent = meals.map(meal => meal.options.map(option => option.foods.filter(item => !invalid.has(item.key))));
    const request: CalculationRequest = { targets: this.targets()?.targets ?? null, meals: [] };
    const referenceProfile = this.referenceProfile();
    if (referenceProfile) request.referenceProfile = referenceProfile;
    this.calculationRequest = this.api.calculate({ ...request,
      meals: meals.map((meal, index) => ({ name: meal.name.trim() || meal.savedName,
        options: sent[index].map(foods => ({ foods: foods.map(item => ({ foodId: item.food.id, quantityG: item.quantityG })) })) })) }).subscribe({
      next: response => {
        const result = alignResult(response, meals, invalid);
        this.result.set(result); this.calculating.set(false);
        const energy = result.totals.energyKcal;
        if (this.celebrationTargetKcal !== null && sameKcal(energy.target, this.celebrationTargetKcal)) {
          this.celebrationTargetKcal = null;
          if (sameKcal(energy.remaining, 0)) this.celebrate(energy.consumed);
        }
      },
      error: error => {
        // Only quantity errors: mark those portions and recalculate the rest of the day without them.
        const rejected = this.rejectedPortions(error, sent);
        if (rejected.size) { this.invalidPortions.set(new Map([...invalid, ...rejected])); this.calculate(); return; }
        this.result.set(null); this.errors.set(this.errorMessages(error)); this.calculating.set(false);
      },
    });
  }
  private rejectedPortions(error: HttpErrorResponse, sent: Portion[][][]): Map<number, string> {
    const rejected = new Map<number, string>();
    const items: { field: string; message: string }[] = error.status === 400 && Array.isArray(error.error?.errors) ? error.error.errors : [];
    for (const item of items) {
      const match = PORTION_QUANTITY_FIELD.exec(item.field);
      const portion = match ? sent[Number(match[1])]?.[Number(match[2])]?.[Number(match[3])] : undefined;
      if (!portion) return new Map(); // any other error blocks the whole calculation
      rejected.set(portion.key, item.message);
    }
    return rejected;
  }
  private errorMessages(error: HttpErrorResponse): string[] {
    if (error.status === 0 || error.status >= 500) return ['Não foi possível acessar o serviço. Confira se a API está em execução e tente novamente.'];
    const problem = error.error;
    if (problem && Array.isArray(problem.errors) && problem.errors.length) {
      const labels: Record<string,string> = { 'weightKg': 'Peso', 'patient.weightKg': 'Peso', 'patient.age': 'Idade', 'patient.sex': 'Sexo',
        'prescribedEnergyKcal': 'Meta prescrita', 'kcalPerKg': 'Fator kcal/kg', 'patient.driActivity': 'Atividade DRI', 'faoPal': 'PAL FAO', 'patient.heightCm': 'Altura',
        'macros': 'Metas de macros', 'macros.method': 'Método de macros', 'macros.carbohydrate': 'Carboidrato', 'macros.protein': 'Proteína', 'macros.fat': 'Gordura' };
      return problem.errors.map((item: {field:string;message:string}) => {
        const portion = PORTION_QUANTITY_FIELD.exec(item.field);
        const mealName = /^meals\[(\d+)\]\.name$/.exec(item.field);
        const mealOptions = /^meals\[(\d+)\]\.options$/.exec(item.field);
        return `${labels[item.field] ?? (portion ? `Refeição ${Number(portion[1]) + 1}, opção ${Number(portion[2]) + 1}, quantidade da porção ${Number(portion[3]) + 1}`
          : mealName ? `Nome da refeição ${Number(mealName[1]) + 1}` : mealOptions ? `Opções da refeição ${Number(mealOptions[1]) + 1}` : item.field)}: ${item.message}`;
      });
    }
    return [typeof problem?.detail === 'string' ? problem.detail : 'Não foi possível concluir a solicitação. Tente novamente.'];
  }
  ngOnDestroy() {
    this.stopCelebration();
    for (const subscription of [this.foodRequest,this.searchDelay,this.calculationRequest,this.calculationDelay,this.targetRequest,this.targetDelay,this.estimateRequest,this.estimateDelay,this.compositionTargetRequest,this.patientRequest,this.nutrientRequest,this.formChanges]) subscription?.unsubscribe();
  }
}

