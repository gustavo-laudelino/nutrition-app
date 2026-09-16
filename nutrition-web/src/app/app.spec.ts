import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app';
import { CalculationResponse, EstimateResponse, Food, TargetResponse } from './api';

registerLocaleData(localePt);

const food: Food = { id:42,name:'Alimento de teste',source:'TEST',sourceCode:'42',energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1 };
const balance = { target:null,consumed:777,remaining:null };
const response: CalculationResponse = { foods:[], totals:{energyKcal:balance,carbohydrateG:balance,proteinG:balance,fatG:balance} };
const estimate: EstimateResponse = { method:'DRI_2023',estimatedKcal:2437,basalKcal:null,driActivity:'ACTIVE',faoPal:null,faoActivity:null };
const definition: TargetResponse = {
  prescription:{energyKcal:2000,referenceEstimateKcal:2437,differenceKcal:-437},
  macros:{method:'NONE',carbohydrate:null,protein:null,fat:null},
  targets:{energyKcal:2000,carbohydrateG:null,proteinG:null,fatG:null},
};
const mealResponse: CalculationResponse = { ...response,foods:[{foodId:42,name:food.name,source:food.source,sourceCode:food.sourceCode,quantityG:100,
  nutrients:{energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1}}] };
describe('Estimate, professional prescription and independent composition', () => {
  let fixture: ComponentFixture<AppComponent>; let app: AppComponent; let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:LOCALE_ID,useValue:'pt-BR'}]}).compileComponents();
    fixture=TestBed.createComponent(AppComponent); app=fixture.componentInstance; http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const initial=http.expectOne('/api/diet-calculations');
    expect(initial.request.body).toEqual({targets:null,foods:[]}); initial.flush(response);
    http.expectNone('/api/target-calculations'); http.expectNone('/api/energy-estimates');
    http.expectNone(request=>request.url==='/api/foods');
  });
  afterEach(()=>{fixture.destroy();http.verify();vi.useRealTimers();});
  function flushComposition() { http.expectOne('/api/diet-calculations').flush(response); }
  function selectDri() {
    app.form.controls.patient.patchValue({weightKg:80,heightCm:175,age:30,sex:'MALE',driActivity:'ACTIVE'}); flushComposition();
  }
  it('starts with automatic DRI and reveals alternatives only on request',()=>{
    expect(app.estimationMethod).toBe('DRI_2023');
    expect(fixture.nativeElement.querySelector('[formControlName="physiologicalState"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Método de estimativa"]')).toBeNull();
    const button:HTMLButtonElement=fixture.nativeElement.querySelector('[aria-controls="alternative-methods"]');
    button.click();fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const selector:HTMLSelectElement=fixture.nativeElement.querySelector('[aria-label="Método de estimativa"]');
    expect(Array.from(selector.options).map(option=>option.value)).toEqual(['DRI_2023','FAO','PER_KG']);
    selector.value='FAO';selector.dispatchEvent(new Event('change'));flushComposition();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="PAL FAO"]')).not.toBeNull();
    expect(app.form.controls.estimation.controls.faoPal.value).toBeNull();
  });
  it('waits for required profile fields before estimating automatically',async()=>{
    vi.useFakeTimers();
    app.form.controls.patient.patchValue({weightKg:80,heightCm:175,age:30,sex:'MALE'});flushComposition();
    await vi.advanceTimersByTimeAsync(300);http.expectNone('/api/energy-estimates');
    app.form.controls.patient.controls.driActivity.setValue('ACTIVE');flushComposition();
    await vi.advanceTimersByTimeAsync(300);
    const request=http.expectOne('/api/energy-estimates');
    expect(request.request.body.method).toBe('DRI_2023');
    expect(request.request.body.patient.driActivity).toBe('ACTIVE');
    expect(request.request.body.patient.physiologicalState).toBeUndefined();
    request.flush(estimate);flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();
  });
  it('uses the per-kg backend result directly as prescription without an estimate card',async()=>{
    vi.useFakeTimers();
    app.form.controls.patient.controls.weightKg.setValue(120);flushComposition();
    app.form.controls.estimation.patchValue({method:'PER_KG',kcalPerKg:20});flushComposition();
    await vi.advanceTimersByTimeAsync(300);
    http.expectNone('/api/energy-estimates');
    const request=http.expectOne('/api/energy-prescriptions/per-kg');
    expect(request.request.body).toEqual({weightKg:120,kcalPerKg:20});
    request.flush({prescribedEnergyKcal:2400});flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2400);
    expect(app.estimate()).toBeNull();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimate-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('.estimate-button')).toBeNull();
    app.updateTargets();const targets=http.expectOne('/api/target-calculations');
    expect(targets.request.body.prescribedEnergyKcal).toBe(2400);
    expect(targets.request.body.referenceEstimateKcal).toBeNull();
    app.form.controls.estimation.controls.method.setValue('DRI_2023');flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2400);
  });
  it('clears an obsolete per-kg target and cancels calculations when factor or weight changes',async()=>{
    vi.useFakeTimers();app.form.controls.patient.controls.weightKg.setValue(120);flushComposition();
    app.form.controls.estimation.patchValue({method:'PER_KG',kcalPerKg:20});flushComposition();
    await vi.advanceTimersByTimeAsync(300);const old=http.expectOne('/api/energy-prescriptions/per-kg');
    app.form.controls.estimation.controls.kcalPerKg.setValue(25);flushComposition();expect(old.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(300);http.expectOne('/api/energy-prescriptions/per-kg').flush({prescribedEnergyKcal:3000});flushComposition();
    app.form.controls.patient.controls.weightKg.setValue(100);flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();
    await vi.advanceTimersByTimeAsync(300);const current=http.expectOne('/api/energy-prescriptions/per-kg');
    expect(current.request.body.weightKg).toBe(100);
    current.flush({detail:'Erro de cálculo'},{status:400,statusText:'Bad Request'});flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();
    expect(app.estimateErrors().length).toBe(1);
  });
  it('preserves manual edits over pending per-kg responses and unrelated patient changes',async()=>{
    vi.useFakeTimers();app.form.controls.patient.controls.weightKg.setValue(120);flushComposition();
    app.form.controls.estimation.patchValue({method:'PER_KG',kcalPerKg:20});flushComposition();
    await vi.advanceTimersByTimeAsync(300);const pending=http.expectOne('/api/energy-prescriptions/per-kg');
    app.form.controls.prescribedEnergyKcal.setValue(2300);flushComposition();expect(pending.cancelled).toBe(true);
    app.form.controls.patient.controls.goal.setValue('WEIGHT_LOSS');
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2300);
    http.expectNone('/api/energy-prescriptions/per-kg');
  });
  it('renders temporary patient data and consumption with no required goals',()=>{
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="name"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[formControlName="goal"]')).not.toBeNull();
    const summary=fixture.nativeElement.querySelector('.summary');
    expect(summary.textContent).toContain('777');expect(summary.textContent).not.toContain('Restante');
    expect(fixture.nativeElement.querySelector('[aria-label="Meta de proteínas"]')).toBeNull();
  });
  it('adds food without estimates, prescription or patient',()=>{
    app.addFood(food);const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body).toEqual({targets:null,foods:[{foodId:42,quantityG:100}]});request.flush(mealResponse);
  });
  it('keeps a computed estimate separate until the explicit use-as-target action',()=>{
    selectDri();app.updateEstimate();http.expectOne('/api/energy-estimates').flush(estimate);flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();http.expectNone('/api/target-calculations');
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.estimate-preview').textContent).toContain('2.437');
    expect(fixture.nativeElement.querySelector('.summary').textContent).not.toContain('Restante');
    app.useEstimateAsTarget();flushComposition();expect(app.form.controls.prescribedEnergyKcal.value).toBe(2437);
    app.updateTargets();const request=http.expectOne('/api/target-calculations');
    expect(request.request.body.prescribedEnergyKcal).toBe(2437);expect(request.request.body.referenceEstimateKcal).toBe(2437);
  });
  it('supports a manual prescription without any estimate',()=>{
    app.form.controls.prescribedEnergyKcal.setValue(2000);flushComposition();app.updateTargets();
    const request=http.expectOne('/api/target-calculations');
    expect(request.request.body).toEqual({prescribedEnergyKcal:2000,referenceEstimateKcal:null,macros:{method:'NONE'}});
    request.flush({...definition,prescription:{energyKcal:2000,referenceEstimateKcal:null,differenceKcal:null}});
    expect(http.expectOne('/api/diet-calculations').request.body.targets.energyKcal).toBe(2000);
  });
  it('shows estimate and prescribed values plus the authoritative backend difference',()=>{
    app.estimate.set(estimate);app.targets.set(definition);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimate-preview').textContent).toContain('2.437');
    expect(fixture.nativeElement.querySelector('.prescription-difference').textContent).toContain('-437');
  });
  it('never overwrites prescription on patient objective changes or recalculation',()=>{
    app.form.controls.prescribedEnergyKcal.setValue(2000);flushComposition();
    app.form.controls.patient.controls.goal.setValue('WEIGHT_LOSS');flushComposition();
    selectDri();app.updateEstimate();http.expectOne('/api/energy-estimates').flush(estimate);flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2000);
    app.form.controls.patient.controls.goal.setValue('WEIGHT_GAIN');flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2000);
  });
  it('keeps DRI activity in the patient profile and sends separate FAO parameters',()=>{
    selectDri();app.updateEstimate();const dri=http.expectOne('/api/energy-estimates');
    expect(dri.request.body.patient.driActivity).toBe('ACTIVE');expect(dri.request.body.patient.activity).toBeUndefined();
    app.form.controls.estimation.patchValue({method:'FAO',faoPal:1.6});flushComposition();expect(dri.cancelled).toBe(true);
    app.updateEstimate();const fao=http.expectOne('/api/energy-estimates');
    expect(fao.request.body.faoPal).toBe(1.6);expect(fao.request.body.driActivity).toBeUndefined();
    fao.flush({method:'FAO',estimatedKcal:2865.38,basalKcal:1790.86,driActivity:null,faoPal:1.6,faoActivity:'SEDENTARY_LIGHT'});flushComposition();
    fixture.detectChanges();const preview=fixture.nativeElement.querySelector('.estimate-preview');
    expect(preview.textContent).toContain('2.865,38');expect(preview.textContent).toContain('1.790,86');
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();
  });
  it('does not infer FAO PAL or kcal/kg when changing methods',()=>{
    selectDri();app.form.controls.estimation.controls.method.setValue('FAO');flushComposition();
    app.updateEstimate();expect(http.expectOne('/api/energy-estimates').request.body.faoPal).toBeNull();
    expect(app.form.controls.estimation.controls.kcalPerKg.value).toBeNull();
  });
  it('keeps manual targets and food available when estimation fails',()=>{
    app.form.controls.prescribedEnergyKcal.setValue(2000);flushComposition();selectDri();app.updateEstimate();
    http.expectOne('/api/energy-estimates').flush({detail:'Equação indisponível para este paciente'},{status:400,statusText:'Bad Request'});
    flushComposition();
    app.updateTargets();http.expectOne('/api/target-calculations').flush(definition);flushComposition();
    app.addFood(food);const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.targets.energyKcal).toBe(2000);request.flush(mealResponse);expect(app.estimateErrors().length).toBe(1);
  });
  it('does not reuse macro numbers when their units change',()=>{
    app.form.controls.macros.controls.method.setValue('PERCENTAGE');flushComposition();
    app.form.controls.macros.patchValue({carbohydrate:50,protein:20,fat:30});flushComposition();
    app.form.controls.macros.controls.method.setValue('MANUAL');flushComposition();
    expect(app.form.controls.macros.getRawValue()).toEqual({method:'MANUAL',carbohydrate:null,protein:null,fat:null});
  });
  it('sends partial manual macros and keeps composing after a target error',()=>{
    app.form.controls.macros.controls.method.setValue('MANUAL');flushComposition();
    app.form.controls.macros.patchValue({protein:150,fat:70});flushComposition();app.updateTargets();
    const request=http.expectOne('/api/target-calculations');
    expect(request.request.body.macros).toEqual({method:'MANUAL',carbohydrate:null,protein:150,fat:70});
    request.flush({detail:'Erro de teste'},{status:400,statusText:'Bad Request'});
    flushComposition();
    app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);expect(app.targetErrors().length).toBe(1);
  });
  it('renders backend balances including negative and zero targets',()=>{
    app.targets.set(definition);app.calculate();const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.targets).toEqual(definition.targets);
    request.flush({...response,totals:{...response.totals,energyKcal:{target:999,consumed:777,remaining:222},proteinG:{target:0,consumed:10,remaining:-10}}});
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.metric-card.energy').textContent).toContain('222');
    expect(fixture.nativeElement.querySelector('.metric-card.protein .exceeded')).not.toBeNull();
  });
  it('debounces estimates and cancels obsolete responses',async()=>{
    vi.useFakeTimers();selectDri();await vi.advanceTimersByTimeAsync(299);http.expectNone('/api/energy-estimates');
    await vi.advanceTimersByTimeAsync(1);const old=http.expectOne('/api/energy-estimates');
    app.form.controls.patient.controls.driActivity.setValue(null);flushComposition();expect(old.cancelled).toBe(true);
    expect(app.estimate()).toBeNull();expect(app.estimateLoading()).toBe(false);
  });
  it('removes stale comparison after a failed estimate retry without removing prescription',()=>{
    app.form.controls.prescribedEnergyKcal.setValue(2000);flushComposition();selectDri();
    app.estimate.set(estimate);app.targets.set(definition);
    app.updateEstimate();http.expectOne('/api/energy-estimates').error(new ProgressEvent('error'));
    flushComposition();expect(app.estimate()).toBeNull();expect(app.targets()).toBeNull();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2000);
    app.updateTargets();const request=http.expectOne('/api/target-calculations');
    expect(request.request.body.referenceEstimateKcal).toBeNull();
    expect(request.request.body.prescribedEnergyKcal).toBe(2000);
  });
  it('updates quantities while typing and cancels stale calculations',async()=>{
    vi.useFakeTimers();app.addFood(food);const previous=http.expectOne('/api/diet-calculations');
    app.changeQuantity(app.portions()[0].key,150);expect(previous.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(200);const current=http.expectOne('/api/diet-calculations');
    expect(current.request.body.foods).toEqual([{foodId:42,quantityG:150}]);current.flush(mealResponse);
    app.removeFood(app.portions()[0].key);expect(http.expectOne('/api/diet-calculations').request.body.foods).toEqual([]);
  });
  it('forwards invalid portions to backend validation',()=>{
    app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.changeQuantity(app.portions()[0].key,null);app.calculate();const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.foods[0].quantityG).toBeNull();
    request.flush({errors:[{field:'foods[0].quantityG',message:'Informe quantidade'}]},{status:400,statusText:'Bad Request'});
    expect(app.errors()[0]).toContain('Quantidade da porção 1');expect(app.result()).toBeNull();
  });
  it('searches while typing and collapses when cleared',async()=>{
    expect(fixture.nativeElement.querySelector('.food-table')).toBeNull();vi.useFakeTimers();
    const input:HTMLInputElement=fixture.nativeElement.querySelector('[name="search"]');
    input.value='f';input.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(100);
    input.value='file frango';input.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(199);
    http.expectNone(request=>request.url==='/api/foods');await vi.advanceTimersByTimeAsync(1);
    http.expectOne('/api/foods?name=file%20frango&page=0&size=10').flush({items:[food],page:0,size:10,totalElements:1});
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.food-table')).not.toBeNull();
    input.value='';input.dispatchEvent(new Event('input'));fixture.detectChanges();expect(fixture.nativeElement.querySelector('.food-table')).toBeNull();
  });
  it('cancels stale food requests and resets pagination',async()=>{
    vi.useFakeTimers();app.query='arroz';app.loadFoods(2);const previous=http.expectOne('/api/foods?name=arroz&page=2&size=10');
    app.searchChanged('feijao');expect(previous.cancelled).toBe(true);await vi.advanceTimersByTimeAsync(200);
    const current=http.expectOne('/api/foods?name=feijao&page=0&size=10');app.searchChanged(' ');expect(current.cancelled).toBe(true);expect(app.catalog()).toBeNull();
  });
  it('supports retrying a catalog connection failure',()=>{
    app.query='arroz';app.loadFoods();http.expectOne('/api/foods?name=arroz&page=0&size=10').error(new ProgressEvent('error'));
    expect(app.catalogError()).toContain('API está em execução');app.loadFoods();http.expectOne('/api/foods?name=arroz&page=0&size=10').flush({items:[food],page:0,size:10,totalElements:1});expect(app.catalogError()).toBe('');
  });
});

