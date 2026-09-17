import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent, normalizeTime } from './app';
import { CalculationResponse, EstimateResponse, Food, TargetResponse } from './api';

registerLocaleData(localePt);

const food: Food = { id:42,name:'Alimento de teste',source:'TEST',sourceCode:'42',energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1 };
const balance = { target:null,consumed:777,remaining:null };
const response: CalculationResponse = { meals:[], totals:{energyKcal:balance,carbohydrateG:balance,proteinG:balance,fatG:balance} };
const estimate: EstimateResponse = { method:'DRI_2023',estimatedKcal:2437,basalKcal:null,driActivity:'ACTIVE',faoPal:null,faoActivity:null };
const definition: TargetResponse = {
  prescription:{energyKcal:2000,referenceEstimateKcal:2437,differenceKcal:-437},
  macros:{method:'NONE',carbohydrate:null,protein:null,fat:null},
  targets:{energyKcal:2000,carbohydrateG:null,proteinG:null,fatG:null},
};
const mealResponse: CalculationResponse = { ...response,meals:[{name:'Almoço',totals:{energyKcal:123,carbohydrateG:45,proteinG:6,fatG:7},foods:[{foodId:42,name:food.name,source:food.source,sourceCode:food.sourceCode,quantityG:100,
  nutrients:{energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1}}]}] };
describe('Estimate, professional prescription and independent composition', () => {
  let fixture: ComponentFixture<AppComponent>; let app: AppComponent; let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:LOCALE_ID,useValue:'pt-BR'}]}).compileComponents();
    fixture=TestBed.createComponent(AppComponent); app=fixture.componentInstance; http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const initial=http.expectOne('/api/diet-calculations');
    expect(initial.request.body).toEqual({targets:null,meals:[]}); initial.flush(response);
    http.expectNone('/api/target-calculations'); http.expectNone('/api/energy-estimates');
    http.expectNone(request=>request.url==='/api/foods');
  });
  // Always reset, so one failing test cannot cascade into the following ones.
  afterEach(()=>{try{fixture.destroy();http.verify();}finally{vi.useRealTimers();TestBed.resetTestingModule();}});
  function flushComposition() { http.match('/api/diet-calculations').forEach(pending=>pending.cancelled||pending.flush(response)); }
  function createMeal() { app.addMeal('Almoço');flushComposition(); }
  function selectDri() {
    app.form.controls.patient.patchValue({weightKg:80,heightCm:175,age:30,sex:'MALE',driActivity:'ACTIVE'}); flushComposition();
  }
  it('starts with no meals and creates shortcut and custom meals in order through the UI',()=>{
    fixture.detectChanges();expect(app.meals()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.meals-empty').textContent).toContain('Comece');
    const shortcuts:HTMLButtonElement[]=Array.from(fixture.nativeElement.querySelectorAll('.meal-shortcuts button'));
    expect(shortcuts).toHaveLength(6);shortcuts[0].click();
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Café da manhã',foods:[]}]);
    const input:HTMLInputElement=fixture.nativeElement.querySelector('#new-meal-name');
    input.value='Pré-treino';input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.new-meal').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Café da manhã',foods:[]},{name:'Pré-treino',foods:[]}]);
  });
  it('adds food only to the meal whose search is open',()=>{
    app.addFood(food);http.expectNone('/api/diet-calculations');
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('[name="search"]')).toBeNull();
    app.addMeal('A');flushComposition();const first=app.meals()[0].key;
    app.addMeal('B');flushComposition();fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.meal-food-search')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.meal-panel')[1].querySelector('.meal-food-search')).not.toBeNull();
    app.openFoodSearch(first);app.addFood(food);
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([
      {name:'A',foods:[{foodId:42,quantityG:100}]},{name:'B',foods:[]}]);
    expect(app.foodSearchMealKey()).toBeNull();
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.meal-food-search')).toBeNull();
  });
  it('reorders meals from the drag handle with the keyboard and keeps server totals aligned',()=>{
    createMeal();app.addFood(food);
    http.expectOne('/api/diet-calculations').flush({...response,meals:[{name:'Almoço',totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0},foods:[]}]});
    app.addMeal('Jantar');
    http.expectOne('/api/diet-calculations').flush({...response,meals:[
      {name:'Almoço',totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0},foods:[]},
      {name:'Jantar',totals:{energyKcal:222,carbohydrateG:0,proteinG:0,fatG:0},foods:[]}]});
    fixture.detectChanges();
    const handle:HTMLButtonElement=fixture.nativeElement.querySelectorAll('.meal-drag-handle')[1];
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp'}));
    expect(app.meals().map(meal=>meal.name)).toEqual(['Jantar','Almoço']);
    expect(app.result()!.meals.map(meal=>meal.totals.energyKcal)).toEqual([222,111]);
    expect(http.expectOne('/api/diet-calculations').request.body.meals.map((m:{name:string})=>m.name)).toEqual(['Jantar','Almoço']);
    app.moveMeal(app.meals()[0].key,-1);http.expectNone('/api/diet-calculations');
  });
  it('reorders meals on drop and keeps the previous server totals with their meals',()=>{
    for (const name of ['A','B','C']) { app.addMeal(name);flushComposition(); }
    const totals=(energyKcal:number)=>({energyKcal,carbohydrateG:0,proteinG:0,fatG:0});
    app.result.set({...response,meals:[{name:'A',totals:totals(1),foods:[]},{name:'B',totals:totals(2),foods:[]},{name:'C',totals:totals(3),foods:[]}]});

    app.dropMeal({previousIndex:2,currentIndex:0} as never);
    expect(app.meals().map(meal=>meal.name)).toEqual(['C','A','B']);
    expect(http.expectOne('/api/diet-calculations').request.body.meals.map((m:{name:string})=>m.name)).toEqual(['C','A','B']);
    app.dropMeal({previousIndex:1,currentIndex:1} as never);http.expectNone('/api/diet-calculations');
  });
  it('collapses meals to a summary and expands them on demand',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.addMeal('Jantar');http.expectOne('/api/diet-calculations').flush(mealResponse);fixture.detectChanges();
    const [lunch,dinner]=app.meals().map(meal=>meal.key);
    expect(app.isMealExpanded(lunch)).toBe(true);expect(app.foodSearchMealKey()).toBe(dinner);
    app.toggleMeal(dinner);fixture.detectChanges();
    expect(app.foodSearchMealKey()).toBeNull();
    const panels=fixture.nativeElement.querySelectorAll('.meal-panel');
    expect(panels[1].querySelector('.meal-body')).toBeNull();
    expect(panels[1].querySelector('.meal-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(panels[0].querySelector('.meal-summary-values').textContent).toContain('123');
    app.setAllMealsExpanded(false);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.meal-body')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.meal-summary')).toHaveLength(2);
    panels[0].querySelector('.meal-toggle').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.meal-body')).toHaveLength(1);
    app.openFoodSearch(dinner);fixture.detectChanges();expect(app.isMealExpanded(dinner)).toBe(true);
    app.setAllMealsExpanded(true);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.meal-body')).toHaveLength(2);
  });
  it('renames a meal inline from the row and restores a blank name when done',()=>{
    createMeal();const key=app.meals()[0].key;fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meal-name-input')).toBeNull();
    fixture.nativeElement.querySelector('[aria-label="Renomear refeição 1"]').click();fixture.detectChanges();
    const input:HTMLInputElement=fixture.nativeElement.querySelector('.meal-name-input');
    input.value='';input.dispatchEvent(new Event('input'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meal-name-hint').textContent).toContain('Almoço');
    app.finishEditMeal(key);fixture.detectChanges();
    expect(app.editingMealKey()).toBeNull();expect(app.meals()[0].name).toBe('Almoço');
    expect(fixture.nativeElement.querySelector('.meal-name-chip').textContent).toContain('Almoço');
  });
  it('keeps a screen-only meal time before the name without sending it to the API',()=>{
    createMeal();const key=app.meals()[0].key;fixture.detectChanges();
    const summary=fixture.nativeElement.querySelector('.meal-summary');
    const time:HTMLInputElement=summary.querySelector('.time-chip input');
    expect(time.compareDocumentPosition(summary.querySelector('.meal-name-chip'))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    time.value='0730';time.dispatchEvent(new Event('input'));expect(time.value).toBe('07:30');expect(app.meals()[0].time).toBe('07:30');
    time.value='7';time.dispatchEvent(new Event('input'));time.dispatchEvent(new Event('blur'));expect(app.meals()[0].time).toBe('07:00');
    http.expectNone('/api/diet-calculations');
    app.calculate();expect(http.expectOne('/api/diet-calculations').request.body.meals[0]).toEqual({name:'Almoço',foods:[]});
    const toggle:HTMLButtonElement=summary.querySelector('.meal-toggle');
    expect(toggle.textContent?.trim()).toBe('0 itens');expect(toggle.getAttribute('aria-label')).toContain('Almoço');
  });
  it('normalizes meal times to 24-hour HH:mm',()=>{
    expect(normalizeTime('7')).toBe('07:00');expect(normalizeTime('730')).toBe('07:30');expect(normalizeTime('0730')).toBe('07:30');
    expect(normalizeTime('23:59')).toBe('23:59');expect(normalizeTime('00:00')).toBe('00:00');
    expect(normalizeTime('24:00')).toBe('');expect(normalizeTime('12:60')).toBe('');expect(normalizeTime('')).toBe('');
  });
  it('defines the current composition as target directly when there is none',()=>{
    app.result.set({...response,totals:{energyKcal:{target:null,consumed:124,remaining:null},carbohydrateG:{target:null,consumed:25.8,remaining:null},proteinG:{target:null,consumed:2.6,remaining:null},fatG:{target:null,consumed:1,remaining:null}}});
    fixture.detectChanges();fixture.nativeElement.querySelector('.ring-action').click();
    const request=http.expectOne('/api/target-calculations/from-composition');
    expect(request.request.body).toEqual({energyKcal:124,carbohydrateG:25.8,proteinG:2.6,fatG:1});
    request.flush({prescribedEnergyKcal:124,carbohydratePercent:84.1762,proteinPercent:8.4829,fatPercent:7.3409});
    http.match('/api/diet-calculations').forEach(pending=>pending.cancelled||pending.flush(response));
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(124);
    expect(app.form.controls.macros.getRawValue()).toEqual({method:'PERCENTAGE',carbohydrate:84.1762,protein:8.4829,fat:7.3409});
    expect(app.compositionTarget()).toBeNull();
  });
  it('celebrates when the applied composition target comes back at 100%',async()=>{
    vi.useFakeTimers();
    app.result.set({...response,totals:{...response.totals,energyKcal:{target:null,consumed:777,remaining:null}}});
    app.defineCompositionAsTarget();
    http.expectOne('/api/target-calculations/from-composition').flush({prescribedEnergyKcal:777,carbohydratePercent:50,proteinPercent:20,fatPercent:30});
    http.match('/api/diet-calculations').forEach(pending=>pending.cancelled||pending.flush(response));
    expect(app.celebrating()).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    http.expectOne('/api/target-calculations').flush({...definition,targets:{energyKcal:777,carbohydrateG:null,proteinG:null,fatG:null}});
    http.expectOne('/api/diet-calculations').flush({...response,totals:{...response.totals,energyKcal:{target:777,consumed:777,remaining:0}}});
    expect(app.celebrating()).toBe(true);
    await vi.advanceTimersByTimeAsync(2400);expect(app.confetti().length).toBe(70);
    fixture.detectChanges();expect(fixture.nativeElement.querySelectorAll('.confetti i').length).toBe(70);
    await vi.advanceTimersByTimeAsync(1700);expect(app.celebrating()).toBe(false);expect(app.confetti()).toEqual([]);
  });
  it('does not celebrate later when the applied composition target never came back',async()=>{
    vi.useFakeTimers();
    app.result.set({...response,totals:{...response.totals,energyKcal:{target:null,consumed:777,remaining:null}}});
    app.defineCompositionAsTarget();
    http.expectOne('/api/target-calculations/from-composition').flush({prescribedEnergyKcal:777,carbohydratePercent:50,proteinPercent:20,fatPercent:30});
    await vi.advanceTimersByTimeAsync(300);
    http.expectOne('/api/target-calculations').flush({detail:'Percentuais inválidos'},{status:400,statusText:'Bad Request'});
    flushComposition();
    app.form.controls.macros.controls.method.setValue('NONE');await vi.advanceTimersByTimeAsync(300);
    http.expectOne('/api/target-calculations').flush({...definition,targets:{energyKcal:777,carbohydrateG:null,proteinG:null,fatG:null}});
    http.expectOne('/api/diet-calculations').flush({...response,totals:{...response.totals,energyKcal:{target:777,consumed:777,remaining:0}}});
    expect(app.celebrating()).toBe(false);
  });
  it('keeps focus in a field when Escape is pressed without an open drawer',()=>{
    createMeal();fixture.detectChanges();
    const search:HTMLInputElement=fixture.nativeElement.querySelector('[name="search"]');search.focus();
    expect(document.activeElement).toBe(search);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    expect(document.activeElement).toBe(search);
  });
  it('asks before replacing existing targets with the composition',()=>{
    app.form.controls.prescribedEnergyKcal.setValue(3000);flushComposition();
    app.result.set({...response,totals:{...response.totals,energyKcal:{target:3000,consumed:777,remaining:2223}}});
    app.defineCompositionAsTarget();
    http.expectOne('/api/target-calculations/from-composition').flush({prescribedEnergyKcal:777,carbohydratePercent:50,proteinPercent:20,fatPercent:30});
    fixture.detectChanges();
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(3000);
    const dialog=fixture.nativeElement.querySelector('.composition-confirm');
    expect(dialog.textContent).toContain('3.000');expect(dialog.textContent).toContain('777');
    dialog.querySelectorAll('button')[1].click();
    http.match('/api/diet-calculations').forEach(pending=>pending.cancelled||pending.flush(response));
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(777);
    expect(app.form.controls.macros.getRawValue()).toEqual({method:'PERCENTAGE',carbohydrate:50,protein:20,fat:30});
  });
  it('never creates or sends a meal with a blank name',async()=>{
    app.addMeal('   ');http.expectNone('/api/diet-calculations');expect(app.meals()).toEqual([]);
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.new-meal button[type="submit"]').disabled).toBe(true);
    vi.useFakeTimers();createMeal();const key=app.meals()[0].key;
    app.renameMeal(key,'  ');await vi.advanceTimersByTimeAsync(300);http.expectNone('/api/diet-calculations');
    app.addFood(food);expect(http.expectOne('/api/diet-calculations').request.body.meals[0].name).toBe('Almoço');
    app.restoreMealName(key);expect(app.meals()[0].name).toBe('Almoço');
  });
  it('renames, reorders and deletes meals while cancelling obsolete calculations',async()=>{
    vi.useFakeTimers();createMeal();app.addFood(food);const old=http.expectOne('/api/diet-calculations');
    // Renaming does not change nutrients, so it never triggers a recalculation.
    const first=app.meals()[0].key;app.renameMeal(first,'Jantar');expect(old.cancelled).toBe(false);old.flush(response);
    await vi.advanceTimersByTimeAsync(200);http.expectNone('/api/diet-calculations');expect(app.meals()[0].savedName).toBe('Jantar');
    app.addMeal('Ceia');const pending=http.expectOne('/api/diet-calculations');
    app.moveMeal(first,1);expect(pending.cancelled).toBe(true);
    expect(http.expectOne('/api/diet-calculations').request.body.meals.map((m:{name:string})=>m.name)).toEqual(['Ceia','Jantar']);
    app.requestRemoveMeal(first);expect(app.pendingMealRemoval()).toBe(first);http.expectNone('/api/diet-calculations');
    fixture.detectChanges();fixture.nativeElement.querySelector('[role="alertdialog"] button').click();
    expect(app.meals()).toHaveLength(2);expect(app.pendingMealRemoval()).toBeNull();
    app.requestRemoveMeal(first);fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('[role="alertdialog"] button')[1].click();
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Ceia',foods:[]}]);
    app.requestRemoveMeal(app.meals()[0].key);
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([]);
    expect(app.foodSearchMealKey()).toBeNull();
  });
  it('renders meal totals from the server separately from daily rings',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);fixture.detectChanges();
    const totals=fixture.nativeElement.querySelector('.meal-summary-values').textContent;
    expect(totals).toContain('123');expect(totals).toContain('45');expect(totals).toContain('6');expect(totals).toContain('7');
    expect(fixture.nativeElement.querySelector('.ring-center').textContent).toContain('777');
    expect(totals).not.toContain('Restante');
  });
  it('starts with automatic DRI and reveals alternatives only on request',()=>{
    expect(app.estimationMethod).toBe('DRI_2023');app.openPanel('estimate');fixture.detectChanges();
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
    expect(app.estimate()).toBeNull();app.openPanel('estimate');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimate-preview')).toBeNull();
    expect(fixture.nativeElement.querySelector('.config-button.prescription').textContent).toContain('2.400');
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
    // The previous per-kg prescription stays visible until the new response (or an error) arrives.
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(3000);
    await vi.advanceTimersByTimeAsync(300);const current=http.expectOne('/api/energy-prescriptions/per-kg');
    expect(current.request.body.weightKg).toBe(100);
    current.flush({detail:'Erro de cálculo'},{status:400,statusText:'Bad Request'});flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();
    expect(app.estimateErrors().length).toBe(1);
    http.match('/api/target-calculations').forEach(pending=>pending.cancelled||pending.flush(definition));flushComposition();
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
  it('does not send requests while typing, only when the value is committed',async()=>{
    vi.useFakeTimers();app.openPanel('estimate');fixture.detectChanges();app.openPanel('prescription');fixture.detectChanges();
    const input:HTMLInputElement=fixture.nativeElement.querySelector('[formControlName="prescribedEnergyKcal"]');
    for (const value of ['2','20','200','2000']) { input.value=value;input.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(400); }
    http.expectNone('/api/target-calculations');http.expectNone('/api/diet-calculations');
    input.dispatchEvent(new Event('blur'));await vi.advanceTimersByTimeAsync(300);
    expect(http.expectOne('/api/target-calculations').request.body.prescribedEnergyKcal).toBe(2000);
  });
  it('keeps the last results on screen while a committed change is recalculated',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);fixture.detectChanges();
    const quantity:HTMLInputElement=fixture.nativeElement.querySelector('.quantity-chip input');
    quantity.value='15';quantity.dispatchEvent(new Event('input'));quantity.value='150';quantity.dispatchEvent(new Event('input'));
    http.expectNone('/api/diet-calculations');
    quantity.dispatchEvent(new Event('blur'));
    const request=http.expectOne('/api/diet-calculations');expect(request.request.body.meals[0].foods[0].quantityG).toBe(150);
    fixture.detectChanges();expect(app.result()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.meal-summary-values').textContent).toContain('123');
    request.flush(mealResponse);
  });
  it('keeps temporary patient data in a drawer opened on demand',()=>{
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="weightKg"]')).toBeNull();
    fixture.nativeElement.querySelector('.patient-trigger').click();fixture.detectChanges();
    const input:HTMLInputElement=fixture.nativeElement.querySelector('[formControlName="weightKg"]');
    input.value='80';input.dispatchEvent(new Event('input'));
    expect(app.form.controls.patient.controls.weightKg.value).toBeNull();
    input.dispatchEvent(new Event('blur'));flushComposition();
    expect(app.form.controls.patient.controls.weightKg.value).toBe(80);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.drawer')).toBeNull();
    expect(fixture.nativeElement.querySelector('.patient-trigger').textContent).toContain('80 kg');
  });
  it('renders temporary patient data and consumption with no required goals',()=>{
    app.openPanel('patient');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="name"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[formControlName="goal"]')).not.toBeNull();
    const summary=fixture.nativeElement.querySelector('.summary');
    expect(summary.textContent).toContain('777');expect(summary.textContent).not.toContain('Restante');
    expect(fixture.nativeElement.querySelector('[aria-label="Meta de proteínas"]')).toBeNull();
  });
  it('adds food without estimates, prescription or patient',()=>{
    createMeal();app.addFood(food);const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body).toEqual({targets:null,meals:[{name:'Almoço',foods:[{foodId:42,quantityG:100}]}]});request.flush(mealResponse);
  });
  it('keeps a computed estimate separate until the explicit use-as-target action',()=>{
    selectDri();app.updateEstimate();http.expectOne('/api/energy-estimates').flush(estimate);flushComposition();
    expect(app.form.controls.prescribedEnergyKcal.value).toBeNull();http.expectNone('/api/target-calculations');
    app.openPanel('estimate');fixture.detectChanges();expect(fixture.nativeElement.querySelector('.estimate-preview').textContent).toContain('2.437');
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
    app.estimate.set(estimate);app.targets.set(definition);app.form.controls.prescribedEnergyKcal.setValue(2000,{emitEvent:false});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.config-button.estimate').textContent).toContain('2.437');
    expect(fixture.nativeElement.querySelector('.config-button.prescription').textContent).toContain('-437');
    app.openPanel('estimate');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estimate-preview').textContent).toContain('2.437');
    app.openPanel('prescription');fixture.detectChanges();
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
    app.openPanel('estimate');fixture.detectChanges();const preview=fixture.nativeElement.querySelector('.estimate-preview');
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
    createMeal();app.addFood(food);const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.targets.energyKcal).toBe(2000);request.flush(mealResponse);expect(app.estimateErrors().length).toBe(1);
  });
  it('offers only no macro targets or percentages with DRI reference hints',()=>{
    app.openPanel('macros');fixture.detectChanges();
    const select:HTMLSelectElement=fixture.nativeElement.querySelector('[aria-label="Método das metas de macros"]');
    expect(Array.from(select.options).map(option=>option.value)).toEqual(['NONE','PERCENTAGE']);
    app.form.controls.macros.controls.method.setValue('PERCENTAGE');flushComposition();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Meta de carboidratos"]').placeholder).toContain('45–65');
    expect(fixture.nativeElement.querySelector('[aria-label="Meta de proteínas"]').placeholder).toContain('10–35');
    expect(fixture.nativeElement.querySelector('[aria-label="Meta de gorduras"]').placeholder).toContain('20–35');
  });
  it('clears macro numbers when the method changes',()=>{
    app.form.controls.macros.controls.method.setValue('PERCENTAGE');flushComposition();
    app.form.controls.macros.patchValue({carbohydrate:50,protein:20,fat:30});flushComposition();
    app.form.controls.macros.controls.method.setValue('NONE');flushComposition();
    expect(app.form.controls.macros.getRawValue()).toEqual({method:'NONE',carbohydrate:null,protein:null,fat:null});
  });
  it('sends percentage macros and keeps composing after a target error',()=>{
    app.form.controls.macros.controls.method.setValue('PERCENTAGE');flushComposition();
    app.form.controls.macros.patchValue({carbohydrate:50,protein:20,fat:30});flushComposition();app.updateTargets();
    const request=http.expectOne('/api/target-calculations');
    expect(request.request.body.macros).toEqual({method:'PERCENTAGE',carbohydrate:50,protein:20,fat:30});
    request.flush({detail:'Erro de teste'},{status:400,statusText:'Bad Request'});
    flushComposition();
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);expect(app.targetErrors().length).toBe(1);
  });
  it('renders backend balances including negative and zero targets',()=>{
    app.targets.set(definition);app.calculate();const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.targets).toEqual(definition.targets);
    request.flush({...response,totals:{...response.totals,energyKcal:{target:999,consumed:777,remaining:222},proteinG:{target:0,consumed:10,remaining:-10}}});
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.ring-legend-row.energy').textContent).toContain('222');
    expect(fixture.nativeElement.querySelector('.ring-legend-row.protein.exceeded')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.ring-center').textContent).toContain('78%');
    const energyRing=app.rings[0];expect(energyRing.progress).toBeCloseTo(777/999);
    expect(app.rings[2].progress).toBe(1);expect(app.rings[1].progress).toBe(0);
    expect(fixture.nativeElement.querySelector('.ring-legend-row.protein').textContent).toContain('acima da meta');
    app.result.set({...response,totals:{...response.totals,carbohydrateG:{target:100,consumed:150,remaining:-50}}});fixture.detectChanges();
    expect(app.rings[1].progress).toBe(1);expect(app.rings[1].overflow).toBeCloseTo(0.5);
    expect(fixture.nativeElement.querySelector('.ring-overflow.carb')).not.toBeNull();
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
    flushComposition();expect(app.estimate()).toBeNull();expect(app.targetsLoading()).toBe(true);
    expect(app.form.controls.prescribedEnergyKcal.value).toBe(2000);
    app.updateTargets();const request=http.expectOne('/api/target-calculations');
    expect(request.request.body.referenceEstimateKcal).toBeNull();
    expect(request.request.body.prescribedEnergyKcal).toBe(2000);
  });
  it('recalculates committed quantities once and cancels stale calculations',async()=>{
    vi.useFakeTimers();createMeal();app.addFood(food);const previous=http.expectOne('/api/diet-calculations');
    app.changeQuantity(app.meals()[0].key,app.meals()[0].foods[0].key,150);expect(previous.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(200);const current=http.expectOne('/api/diet-calculations');
    expect(current.request.body.meals[0].foods).toEqual([{foodId:42,quantityG:150}]);current.flush(mealResponse);
    app.removeFood(app.meals()[0].key,app.meals()[0].foods[0].key);expect(http.expectOne('/api/diet-calculations').request.body.meals[0].foods).toEqual([]);
  });
  it('forwards invalid portions to backend validation',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.changeQuantity(app.meals()[0].key,app.meals()[0].foods[0].key,null);const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.meals[0].foods[0].quantityG).toBeNull();
    request.flush({errors:[{field:'meals[0].foods[0].quantityG',message:'Informe quantidade'}]},{status:400,statusText:'Bad Request'});
    expect(app.errors()[0]).toContain('quantidade da porção 1');expect(app.result()).toBeNull();
  });
  it('searches while typing and collapses when cleared',async()=>{
    createMeal();fixture.detectChanges();
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

