import { InfoTipComponent } from './info-tip';
import { DecimalPipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { CalculationResponse, CompositionTargetResponse, DriActivity, EstimateMethod, EstimateRequest, EstimateResponse, Food, FoodPage, MacroMethod, NutritionApi, PatientGoal, Sex, TargetRequest, TargetResponse } from './api';

// savedName is the last non-blank name, sent while the input is temporarily empty.
// time is a screen-only planning aid ("HH:mm" or empty); it is not sent to the calculation API.
interface Meal { key: number; time: string; name: string; savedName: string; foods: Portion[] }
interface Portion { key: number; food: Food; quantityG: number | null }
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
function sameKcal(value: number | null, expected: number) { return value !== null && Math.abs(value - expected) < 0.01; }
type Panel = 'patient' | 'estimate' | 'prescription' | 'macros';
@Component({ selector: 'app-root', standalone: true, imports: [DecimalPipe, FormsModule, ReactiveFormsModule, InfoTipComponent, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder], templateUrl: './app.html',
  host: { '(document:keydown.escape)': 'closePanel()' } })
export class AppComponent implements OnInit, OnDestroy {
  private readonly api = inject(NutritionApi);
  private readonly fb = inject(FormBuilder);
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
  // Celebration after "define composition as target": rings fill 0→value, chart shakes, confetti bursts.
  readonly celebrating = signal(false);
  readonly celebrationKcal = signal<number | null>(null);
  readonly confetti = signal<ConfettiPiece[]>([]);
  // Energy target applied from the composition; the celebration runs only when this exact target comes back.
  private celebrationTargetKcal: number | null = null;
  private celebrationTimers: ReturnType<typeof setTimeout>[] = [];
  private celebrationFrame?: number;
  readonly pendingMealRemoval = signal<number | null>(null);
  readonly mealShortcuts = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  newMealName = '';
  readonly result = signal<CalculationResponse | null>(null);
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
    { key: 'energyKcal', label: 'Energia', unit: 'kcal', css: 'energy' },
    { key: 'carbohydrateG', label: 'Carboidratos', unit: 'g', css: 'carb' },
    { key: 'proteinG', label: 'Proteínas', unit: 'g', css: 'protein' },
    { key: 'fatG', label: 'Gorduras', unit: 'g', css: 'fat' },
  ] as const;
  readonly panel = signal<Panel | null>(null);
  readonly panelTitles: Record<Panel, string> = { patient: 'Paciente', estimate: 'Estimativa energética', prescription: 'Meta energética', macros: 'Metas de macros' };
  readonly macroLabels: Record<MacroMethod, string> = { NONE: 'Nenhum método definido', PERCENTAGE: 'Percentual da meta energética' };
  query = '';
  get estimationMethod() { return this.form.controls.estimation.controls.method.value; }

  // Patient data and calculation settings live in drawers, keeping the workspace focused on the diet.
  openPanel(panel: Panel) {
    this.panel.set(panel);
    setTimeout(() => document.querySelector<HTMLElement>('.drawer input, .drawer select')?.focus());
  }
  closePanel() {
    if (this.panel() === null) return;
    // Commit a field still being edited (blur-based controls) before the drawer disappears.
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.panel.set(null);
  }
  // Visual ring progress only: consumed, target and remaining values come from the backend.
  get rings() {
    const totals = this.result()?.totals;
    return this.metrics.map((metric, index) => {
      const balance = totals?.[metric.key] ?? null;
      const radius = 110 - index * 14;
      const circumference = 2 * Math.PI * radius;
      const target = balance?.target ?? null;
      const ratio = balance && target !== null ? (target > 0 ? balance.consumed / target : balance.consumed > 0 ? 1 : 0) : 0;
      const progress = Math.min(ratio, 1);
      // Past the target, a darker second lap shows the excess (capped at one extra lap).
      const overflow = Math.min(Math.max(ratio - 1, 0), 1);
      return { ...metric, balance, radius, circumference, progress, offset: circumference * (1 - progress),
        overflow, overflowOffset: circumference * (1 - overflow),
        percent: target ? Math.round(ratio * 100) : null, exceeded: (balance?.remaining ?? 0) < 0 };
    });
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

  ngOnInit() {
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
    this.formChanges.add(this.form.controls.patient.valueChanges.subscribe(() => {
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
    this.meals.update(meals => [...meals, { key, time: '', name: trimmed, savedName: trimmed, foods: [] }]);
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
    if (meal.foods.length) this.pendingMealRemoval.set(key);
    else this.removeMeal(key);
  }
  removeMeal(key: number) {
    const index = this.meals().findIndex(meal => meal.key === key);
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
    this.meals.update(meals => meals.map(item => item.key === mealKey
      ? { ...item, foods: [...item.foods, { key: this.nextKey++, food, quantityG: 100 }] } : item));
    this.closeFoodSearch();
    this.calculate();
  }
  changeQuantity(mealKey: number, key: number, quantityG: number | null) {
    this.meals.update(meals => meals.map(meal => meal.key === mealKey
      ? { ...meal, foods: meal.foods.map(item => item.key === key ? { ...item, quantityG } : item) } : meal));
    this.calculate();
  }
  removeFood(mealKey: number, key: number) {
    const mealIndex = this.meals().findIndex(meal => meal.key === mealKey);
    const foodIndex = this.meals()[mealIndex]?.foods.findIndex(item => item.key === key) ?? -1;
    this.meals.update(meals => meals.map(meal => meal.key === mealKey
      ? { ...meal, foods: meal.foods.filter(item => item.key !== key) } : meal));
    const result = this.result();
    const calculatedMeal = result?.meals[mealIndex];
    if (result && calculatedMeal && foodIndex >= 0) {
      const meals = [...result.meals];
      meals[mealIndex] = { ...calculatedMeal, foods: calculatedMeal.foods.filter((_, i) => i !== foodIndex) };
      this.result.set({ ...result, meals });
    }
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
    const fillMs = 2400; // keep in sync with ring-fill / chart-build durations in styles.css
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
    this.calculationRequest = this.api.calculate({ targets: this.targets()?.targets ?? null,
      meals: this.meals().map(meal => ({ name: meal.name.trim() || meal.savedName, foods: meal.foods.map(item => ({ foodId: item.food.id, quantityG: item.quantityG })) })) }).subscribe({
      next: result => {
        this.result.set(result); this.calculating.set(false);
        const energy = result.totals.energyKcal;
        if (this.celebrationTargetKcal !== null && sameKcal(energy.target, this.celebrationTargetKcal)) {
          this.celebrationTargetKcal = null;
          if (sameKcal(energy.remaining, 0)) this.celebrate(energy.consumed);
        }
      },
      error: error => { this.result.set(null); this.errors.set(this.errorMessages(error)); this.calculating.set(false); },
    });
  }
  private errorMessages(error: HttpErrorResponse): string[] {
    if (error.status === 0 || error.status >= 500) return ['Não foi possível acessar o serviço. Confira se a API está em execução e tente novamente.'];
    const problem = error.error;
    if (problem && Array.isArray(problem.errors) && problem.errors.length) {
      const labels: Record<string,string> = { 'weightKg': 'Peso', 'patient.weightKg': 'Peso', 'patient.age': 'Idade', 'patient.sex': 'Sexo',
        'prescribedEnergyKcal': 'Meta prescrita', 'kcalPerKg': 'Fator kcal/kg', 'patient.driActivity': 'Atividade DRI', 'faoPal': 'PAL FAO', 'patient.heightCm': 'Altura',
        'macros': 'Metas de macros', 'macros.method': 'Método de macros', 'macros.carbohydrate': 'Carboidrato', 'macros.protein': 'Proteína', 'macros.fat': 'Gordura' };
      return problem.errors.map((item: {field:string;message:string}) => {
        const portion = /^meals\[(\d+)\]\.foods\[(\d+)\]\.quantityG$/.exec(item.field);
        const mealName = /^meals\[(\d+)\]\.name$/.exec(item.field);
        return `${labels[item.field] ?? (portion ? `Refeição ${Number(portion[1]) + 1}, quantidade da porção ${Number(portion[2]) + 1}` : mealName ? `Nome da refeição ${Number(mealName[1]) + 1}` : item.field)}: ${item.message}`;
      });
    }
    return [typeof problem?.detail === 'string' ? problem.detail : 'Não foi possível concluir a solicitação. Tente novamente.'];
  }
  ngOnDestroy() {
    this.stopCelebration();
    for (const subscription of [this.foodRequest,this.searchDelay,this.calculationRequest,this.calculationDelay,this.targetRequest,this.targetDelay,this.estimateRequest,this.estimateDelay,this.compositionTargetRequest,this.formChanges]) subscription?.unsubscribe();
  }
}

