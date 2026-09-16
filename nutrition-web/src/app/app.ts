import { InfoTipComponent } from './info-tip';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { CalculationResponse, DriActivity, EstimateMethod, EstimateRequest, EstimateResponse, Food, FoodPage, MacroMethod, NutritionApi, PatientGoal, Sex, TargetRequest, TargetResponse } from './api';

interface Portion { key: number; food: Food; quantityG: number | null }
type Panel = 'patient' | 'estimate' | 'prescription' | 'macros';
@Component({ selector: 'app-root', standalone: true, imports: [DecimalPipe, FormsModule, ReactiveFormsModule, InfoTipComponent], templateUrl: './app.html',
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
    patient: this.fb.group({ name: this.fb.nonNullable.control(''), weightKg: this.fb.control<number | null>(null),
      heightCm: this.fb.control<number | null>(null), age: this.fb.control<number | null>(null), sex: this.fb.nonNullable.control<Sex>('UNSPECIFIED'), goal: this.fb.control<PatientGoal | null>(null), driActivity: this.fb.control<DriActivity | null>(null) }),
    estimation: this.fb.group({ method: this.fb.nonNullable.control<EstimateMethod | 'PER_KG'>('DRI_2023'), faoPal: this.fb.control<number | null>(null), kcalPerKg: this.fb.control<number | null>(null) }),
    prescribedEnergyKcal: this.fb.control<number | null>(null),
    macros: this.fb.group({ method: this.fb.nonNullable.control<MacroMethod>('NONE'), carbohydrate: this.fb.control<number | null>(null), protein: this.fb.control<number | null>(null), fat: this.fb.control<number | null>(null) }),
  });
  readonly catalog = signal<FoodPage | null>(null);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal('');
  readonly portions = signal<Portion[]>([]);
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
  closePanel() { this.panel.set(null); }
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
    this.estimate.set(null); this.estimateErrors.set([]); this.estimateLoading.set(false);
    // Choosing the per-kg formula prescribes directly. DRI/FAO remain estimates.
    if (this.estimationMethod === 'PER_KG') {
      this.form.controls.prescribedEnergyKcal.setValue(null, { emitEvent: false });
    }
    this.scheduleTargets();
    if (this.hasEstimateInputs()) {
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
    this.targets.set(null); this.targetErrors.set([]); this.targetsLoading.set(false);
    this.calculate();
    if (this.form.controls.prescribedEnergyKcal.value !== null || this.macroMethod !== 'NONE') {
      this.targetsLoading.set(true);
      this.targetDelay = timer(300).subscribe(() => this.updateTargets());
    }
  }

  updateTargets() {
    this.targetDelay?.unsubscribe(); this.targetRequest?.unsubscribe();
    this.targetErrors.set([]);
    if (this.form.controls.prescribedEnergyKcal.value === null && this.macroMethod === 'NONE') {
      this.targets.set(null); this.targetsLoading.set(false); this.calculate(); return;
    }
    this.targetsLoading.set(true);
    this.targetRequest = this.api.calculateTargets(this.targetPayload()).subscribe({
      next: result => { this.targets.set(result); this.targetsLoading.set(false); this.calculate(); },
      error: error => {
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
  addFood(food: Food) {
    this.portions.update(items => [...items, { key: this.nextKey++, food, quantityG: 100 }]); this.calculate();
  }
  changeQuantity(key: number, quantityG: number | null) {
    this.portions.update(items => items.map(item => item.key === key ? { ...item, quantityG } : item));
    this.invalidate(); this.calculationDelay?.unsubscribe();
    this.calculationDelay = timer(200).subscribe(() => this.calculate());
  }
  removeFood(key: number) { this.portions.update(items => items.filter(item => item.key !== key)); this.calculate(); }
  invalidate() { this.calculationRequest?.unsubscribe(); this.calculating.set(false); this.result.set(null); this.errors.set([]); }
  calculate() {
    this.calculationDelay?.unsubscribe(); this.invalidate(); this.calculating.set(true);
    this.calculationRequest = this.api.calculate({ targets: this.targets()?.targets ?? null,
      foods: this.portions().map(item => ({ foodId: item.food.id, quantityG: item.quantityG })) }).subscribe({
      next: result => { this.result.set(result); this.calculating.set(false); },
      error: error => { this.errors.set(this.errorMessages(error)); this.calculating.set(false); },
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
        const portion = /^foods\[(\d+)\]\.quantityG$/.exec(item.field);
        return `${labels[item.field] ?? (portion ? `Quantidade da porção ${Number(portion[1]) + 1}` : item.field)}: ${item.message}`;
      });
    }
    return [typeof problem?.detail === 'string' ? problem.detail : 'Não foi possível concluir a solicitação. Tente novamente.'];
  }
  ngOnDestroy() {
    for (const subscription of [this.foodRequest,this.searchDelay,this.calculationRequest,this.calculationDelay,this.targetRequest,this.targetDelay,this.estimateRequest,this.estimateDelay,this.formChanges]) subscription?.unsubscribe();
  }
}

