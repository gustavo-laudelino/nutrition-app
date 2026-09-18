import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent, normalizeTime } from './app';
import { Session } from './auth/session';
import { Patient } from './patients/patients-api';
import { CalculationResponse, DayNutrient, EstimateResponse, Food, TargetResponse } from './api';

registerLocaleData(localePt);

const food: Food = { id:42,name:'Alimento de teste',source:'TEST',sourceCode:'42',energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1 };
const balance = { target:null,consumed:777,remaining:null };
const response: CalculationResponse = { meals:[], totals:{energyKcal:balance,carbohydrateG:balance,proteinG:balance,fatG:balance}, macroEnergyShares:null, nutrients:[], referenceSource:null };
const estimate: EstimateResponse = { method:'DRI_2023',estimatedKcal:2437,basalKcal:null,driActivity:'ACTIVE',faoPal:null,faoActivity:null };
const definition: TargetResponse = {
  prescription:{energyKcal:2000,referenceEstimateKcal:2437,differenceKcal:-437},
  macros:{method:'NONE',carbohydrate:null,protein:null,fat:null},
  targets:{energyKcal:2000,carbohydrateG:null,proteinG:null,fatG:null},
};
const mealTotals = {energyKcal:123,carbohydrateG:45,proteinG:6,fatG:7};
const mealResponse: CalculationResponse = { ...response,meals:[{name:'Almoço',totals:mealTotals,options:[{totals:mealTotals,foods:[{foodId:42,name:food.name,source:food.source,sourceCode:food.sourceCode,quantityG:100,
  nutrients:{energyKcal:100,carbohydrateG:20,proteinG:4,fatG:1}}]}]}] };
describe('Estimate, professional prescription and independent composition', () => {
  let fixture: ComponentFixture<AppComponent>; let app: AppComponent; let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:LOCALE_ID,useValue:'pt-BR'}]}).compileComponents();
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
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Café da manhã',options:[{foods:[]}]}]);
    const input:HTMLInputElement=fixture.nativeElement.querySelector('#new-meal-name');
    input.value='Pré-treino';input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.new-meal').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Café da manhã',options:[{foods:[]}]},{name:'Pré-treino',options:[{foods:[]}]}]);
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
      {name:'A',options:[{foods:[{foodId:42,quantityG:100}]}]},{name:'B',options:[{foods:[]}]}]);
    expect(app.foodSearchMealKey()).toBeNull();
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.meal-food-search')).toBeNull();
  });
  it('reorders meals from the drag handle with the keyboard and keeps server totals aligned',()=>{
    createMeal();app.addFood(food);
    http.expectOne('/api/diet-calculations').flush({...response,meals:[{name:'Almoço',totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0},options:[{foods:[],totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0}}]}]});
    app.addMeal('Jantar');
    http.expectOne('/api/diet-calculations').flush({...response,meals:[
      {name:'Almoço',totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0},options:[{foods:[],totals:{energyKcal:111,carbohydrateG:0,proteinG:0,fatG:0}}]},
      {name:'Jantar',totals:{energyKcal:222,carbohydrateG:0,proteinG:0,fatG:0},options:[{foods:[],totals:{energyKcal:222,carbohydrateG:0,proteinG:0,fatG:0}}]}]});
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
    app.result.set({...response,meals:[{name:'A',totals:totals(1),options:[{foods:[],totals:totals(1)}]},{name:'B',totals:totals(2),options:[{foods:[],totals:totals(2)}]},{name:'C',totals:totals(3),options:[{foods:[],totals:totals(3)}]}]});

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
    app.calculate();expect(http.expectOne('/api/diet-calculations').request.body.meals[0]).toEqual({name:'Almoço',options:[{foods:[]}]});
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
    fixture.detectChanges();fixture.nativeElement.querySelector('.summary-action').click();
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
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([{name:'Ceia',options:[{foods:[]}]}]);
    app.requestRemoveMeal(app.meals()[0].key);
    expect(http.expectOne('/api/diet-calculations').request.body.meals).toEqual([]);
    expect(app.foodSearchMealKey()).toBeNull();
  });
  it('renders meal totals from the server separately from the daily analysis',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);fixture.detectChanges();
    const totals=fixture.nativeElement.querySelector('.meal-summary-values').textContent;
    expect(totals).toContain('123');expect(totals).toContain('45');expect(totals).toContain('6');expect(totals).toContain('7');
    expect(fixture.nativeElement.querySelector('.analysis-metric.energy').textContent).toContain('777');
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
    const request=http.expectOne('/api/diet-calculations');expect(request.request.body.meals[0].options[0].foods[0].quantityG).toBe(150);
    fixture.detectChanges();expect(app.result()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.meal-summary-values').textContent).toContain('123');
    request.flush(mealResponse);
  });
  it('keeps temporary patient data in a drawer opened on demand',()=>{
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="weightKg"]')).toBeNull();
    app.openPanel('patient');fixture.detectChanges();
    const input:HTMLInputElement=fixture.nativeElement.querySelector('.drawer [formControlName="weightKg"]');
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
    expect(request.request.body).toEqual({targets:null,meals:[{name:'Almoço',options:[{foods:[{foodId:42,quantityG:100}]}]}]});request.flush(mealResponse);
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
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.analysis-metric.energy').textContent).toContain('222');
    expect(fixture.nativeElement.querySelector('.analysis-metric.protein.exceeded')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.analysis-metric.energy').textContent).toContain('78%');
    const energy=app.summaryMetrics[0];expect(energy.progress).toBeCloseTo(777/999);
    expect(app.summaryMetrics[2].progress).toBe(1);expect(app.summaryMetrics[1].progress).toBe(0);
    expect(fixture.nativeElement.querySelector('.analysis-metric.protein').textContent).toContain('Acima da meta em 10 g');
    expect(fixture.nativeElement.querySelector('.analysis-metric.carb').textContent).toContain('Sem meta');
    const energyFill:HTMLElement=fixture.nativeElement.querySelector('.analysis-metric.energy .meter-fill');
    expect(Number(energyFill.style.getPropertyValue('--fill'))).toBeCloseTo(777/999);
    app.result.set({...response,totals:{...response.totals,carbohydrateG:{target:100,consumed:150,remaining:-50}}});fixture.detectChanges();
    expect(app.summaryMetrics[1].progress).toBe(1);
    expect(fixture.nativeElement.querySelector('.analysis-metric.carb.exceeded')).not.toBeNull();
  });
  it('highlights a macro and describes it on hover, from the bar or from the slice',()=>{
    app.result.set({...response,macroEnergyShares:{carbohydratePercent:50,proteinPercent:20,fatPercent:30},
      totals:{...response.totals,carbohydrateG:{target:100,consumed:50,remaining:50}}});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.macro-tip')).toBeNull();

    const carbRow:HTMLElement=fixture.nativeElement.querySelector('.analysis-macros .analysis-metric.carb');
    carbRow.dispatchEvent(new MouseEvent('mouseenter',{clientX:400,clientY:300}));fixture.detectChanges();
    expect(app.highlightedMacro()).toBe('carb');
    expect(fixture.nativeElement.querySelector('.analysis-card').classList).toContain('has-highlight');
    expect(fixture.nativeElement.querySelector('.donut-slice.carb').classList).toContain('active');
    expect(fixture.nativeElement.querySelector('.donut-slice.protein').classList).not.toContain('active');
    const tip=fixture.nativeElement.querySelector('.macro-tip');
    expect(tip.textContent).toContain('Carboidratos');
    expect(tip.textContent).toContain('50');expect(tip.textContent).toContain('% da energia dos macros');
    expect(tip.textContent.replace(/\s+/g,' ')).toContain('Meta 100 g Restante 50 g · 50% da meta');
    // Follows the cursor, kept inside the window.
    expect(tip.classList).toContain('following');
    expect([tip.style.left,tip.style.top]).toEqual(['416px','318px']);
    carbRow.dispatchEvent(new MouseEvent('mousemove',{clientX:10,clientY:10}));fixture.detectChanges();
    expect([tip.style.left,tip.style.top]).toEqual(['26px','28px']);
    carbRow.dispatchEvent(new MouseEvent('mousemove',{clientX:99999,clientY:99999}));fixture.detectChanges();
    expect(Number(tip.style.left.replace('px',''))).toBeLessThanOrEqual(window.innerWidth-12);
    expect(Number(tip.style.top.replace('px',''))).toBeLessThanOrEqual(window.innerHeight-12);

    carbRow.dispatchEvent(new MouseEvent('mouseleave'));fixture.detectChanges();
    expect(app.highlightedMacro()).toBeNull();expect(fixture.nativeElement.querySelector('.macro-tip')).toBeNull();

    fixture.nativeElement.querySelector('.donut-slice.fat').dispatchEvent(new MouseEvent('mouseenter'));fixture.detectChanges();
    expect(app.highlightedMacro()).toBe('fat');
    expect(fixture.nativeElement.querySelector('.analysis-metric.fat').classList).toContain('active');
    expect(fixture.nativeElement.querySelector('.macro-tip').textContent).toContain('Sem meta definida');

    // With the keyboard there is no cursor: the description stays anchored under the donut.
    fixture.nativeElement.querySelector('.donut-slice.fat').dispatchEvent(new MouseEvent('mouseleave'));fixture.detectChanges();
    fixture.nativeElement.querySelector('.analysis-metric.protein').dispatchEvent(new FocusEvent('focus'));fixture.detectChanges();
    const anchored=fixture.nativeElement.querySelector('.macro-tip');
    expect(anchored.classList).not.toContain('following');
    expect(anchored.style.left).toBe('');
    fixture.nativeElement.querySelector('.analysis-metric.protein').dispatchEvent(new FocusEvent('blur'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.macro-tip')).toBeNull();

    // The energy row is not part of the donut and never highlights.
    fixture.nativeElement.querySelector('.analysis-energy .analysis-metric').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();expect(app.highlightedMacro()).toBeNull();
  });
  it('draws the consumed macro distribution from the backend and the target distribution around it',()=>{
    fixture.detectChanges();
    expect(app.macroDonut).toEqual({consumed:null,target:null});
    expect(fixture.nativeElement.querySelectorAll('.donut-slice')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.donut-shares').textContent).toContain('Sem macros');

    app.result.set({...response,macroEnergyShares:{carbohydratePercent:50,proteinPercent:20,fatPercent:30},
      totals:{...response.totals,carbohydrateG:{target:100,consumed:50,remaining:50},proteinG:{target:100,consumed:150,remaining:-50}}});
    app.targets.set({...definition,macros:{method:'PERCENTAGE',carbohydrate:{grams:100,energyKcal:400},protein:{grams:100,energyKcal:400},fat:{grams:22.22,energyKcal:200}}});
    fixture.detectChanges();
    const donut=app.macroDonut;
    expect(donut.consumed!.map(slice=>slice.share)).toEqual([50,20,30]);
    expect(donut.target!.map(slice=>slice.share)).toEqual([40,40,20]);
    // Slices follow each other from the top, separated by a small gap.
    expect(donut.consumed![0].dashoffset).toBeCloseTo(-0.4);expect(donut.consumed![1].dashoffset).toBeCloseTo(-50.4);
    expect(donut.consumed![2].dasharray).toBe('29.2 70.8');
    expect(fixture.nativeElement.querySelectorAll('.donut-slice')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.donut-target')).toHaveLength(3);
    // Outer ring loads each target arc by consumed / target: carb half, protein full (exceeded), fat without target.
    expect(donut.target!.map(slice=>slice.progress)).toEqual([0.5,1,0]);
    expect(donut.target![0].loadedDasharray).toBe(`${(40-0.8)*0.5} ${100-(40-0.8)*0.5}`);
    expect(donut.target![2].loadedDasharray).toBe('0 100');
    expect(fixture.nativeElement.querySelector('.donut-loaded.protein.exceeded')).not.toBeNull();
    const shares=fixture.nativeElement.querySelector('.donut-shares');
    expect(shares.textContent).toContain('50%');expect(shares.querySelector('li.carb').getAttribute('title')).toBe('Meta: 40%');

    app.result.set({...response,macroEnergyShares:{carbohydratePercent:0,proteinPercent:0,fatPercent:100}});app.targets.set(definition);
    fixture.detectChanges();
    expect(app.macroDonut.consumed![2].dasharray).toBe('100 0');expect(app.macroDonut.target).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.donut-slice')).toHaveLength(1);
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
    app.changeQuantity(app.meals()[0].key,app.meals()[0].options[0].foods[0].key,150);expect(previous.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(200);const current=http.expectOne('/api/diet-calculations');
    expect(current.request.body.meals[0].options[0].foods).toEqual([{foodId:42,quantityG:150}]);current.flush(mealResponse);
    app.removeFood(app.meals()[0].key,app.meals()[0].options[0].foods[0].key);expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options[0].foods).toEqual([]);
  });
  it('restores the last quantity when the field is left empty, without recalculating',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    const input=document.createElement('input');input.value='';
    app.changeQuantity(app.meals()[0].key,app.meals()[0].options[0].foods[0].key,null,input);
    http.expectNone('/api/diet-calculations');
    expect(input.value).toBe('100');expect(app.meals()[0].options[0].foods[0].quantityG).toBe(100);expect(app.result()).not.toBeNull();
  });
  it('keeps a portion rejected for its quantity marked and calculates the rest of the day without it',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.openFoodSearch(app.meals()[0].key);app.addFood({...food,id:7});http.expectOne('/api/diet-calculations').flush(response);
    const [zeroed,kept]=app.meals()[0].options[0].foods;
    app.changeQuantity(app.meals()[0].key,zeroed.key,0);
    const rejected=http.expectOne('/api/diet-calculations');
    expect(rejected.request.body.meals[0].options[0].foods).toEqual([{foodId:42,quantityG:0},{foodId:7,quantityG:100}]);
    rejected.flush({errors:[{field:'meals[0].options[0].foods[0].quantityG',message:'Informe uma quantidade maior que zero.'}]},{status:400,statusText:'Bad Request'});

    const retry=http.expectOne('/api/diet-calculations');
    expect(retry.request.body.meals[0].options[0].foods).toEqual([{foodId:7,quantityG:100}]);
    retry.flush({...mealResponse,meals:[{...mealResponse.meals[0],options:[{...mealResponse.meals[0].options[0],foods:[{...mealResponse.meals[0].options[0].foods[0],foodId:7}]}]}]});
    expect(app.errors()).toEqual([]);expect(app.meals()[0].options[0].foods).toHaveLength(2);
    expect(app.invalidPortions().get(zeroed.key)).toBe('Informe uma quantidade maior que zero.');
    expect(app.result()!.meals[0].options[0].foods.map(item=>item?.foodId ?? null)).toEqual([null,7]);
    fixture.detectChanges();
    const rows=fixture.nativeElement.querySelectorAll('.meal-body .food-row');
    expect(rows[0].classList).toContain('invalid-portion');expect(rows[1].classList).not.toContain('invalid-portion');
    expect(rows[0].querySelector('input').getAttribute('aria-invalid')).toBe('true');
    expect(rows[1].textContent).toContain('100 kcal');

    app.changeQuantity(app.meals()[0].key,zeroed.key,50);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options[0].foods).toEqual([{foodId:42,quantityG:50},{foodId:7,quantityG:100}]);
    expect(app.invalidPortions().has(zeroed.key)).toBe(false);expect(kept.quantityG).toBe(100);
  });
  it('other validation errors still block the whole calculation',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.changeQuantity(app.meals()[0].key,app.meals()[0].options[0].foods[0].key,150);
    http.expectOne('/api/diet-calculations').flush({errors:[{field:'meals[0].options[0].foods[0].quantityG',message:'Quantidade'},{field:'meals',message:'Limite'}]},{status:400,statusText:'Bad Request'});
    http.expectNone('/api/diet-calculations');
    expect(app.result()).toBeNull();expect(app.errors()).toHaveLength(2);expect(app.invalidPortions().size).toBe(0);
  });

  // Meal options: only option 1 counts toward the day (backend rule); the screen sends every option.
  const optionTotals = (kcal: number) => ({energyKcal:kcal,carbohydrateG:kcal/10,proteinG:1,fatG:2});
  function twoOptionResponse(): CalculationResponse {
    const first = mealResponse.meals[0].options[0];
    return {...mealResponse,meals:[{name:'Almoço',totals:first.totals,options:[first,
      {totals:optionTotals(300),foods:[{...first.foods[0],foodId:7,nutrients:{energyKcal:300,carbohydrateG:30,proteinG:1,fatG:2}}]}]}]};
  }
  function mealWithTwoOptions() {
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.addOption(app.meals()[0].key);http.expectOne('/api/diet-calculations').flush(response);
    const [first]=app.meals()[0].options;
    app.openFoodSearch(app.meals()[0].key);app.addFood({...food,id:7});
    http.expectOne('/api/diet-calculations').flush(twoOptionResponse());
    return {first,second:app.meals()[0].options[1]};
  }
  it('starts every meal with one option and "+" opens a new empty option, up to five',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    const meal=app.meals()[0];expect(meal.options).toHaveLength(1);expect(meal.activeOptionKey).toBe(meal.options[0].key);
    app.changeQuantity(meal.key,meal.options[0].foods[0].key,150);http.expectOne('/api/diet-calculations').flush(mealResponse);
    app.addOption(meal.key);
    const request=http.expectOne('/api/diet-calculations');
    expect(request.request.body.meals[0].options).toEqual([{foods:[{foodId:42,quantityG:150}]},{foods:[]}]);
    request.flush(response);
    const [first,added]=app.meals()[0].options;
    expect(app.meals()[0].activeOptionKey).toBe(added.key);
    expect(added.foods).toEqual([]);expect(first.foods[0].quantityG).toBe(150);
    for (let i=0;i<3;i++) { app.addOption(meal.key);flushComposition(); }
    expect(app.meals()[0].options).toHaveLength(5);
    app.addOption(meal.key);http.expectNone('/api/diet-calculations');expect(app.meals()[0].options).toHaveLength(5);
    fixture.detectChanges();
    const tabs=fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs as NodeListOf<HTMLElement>).map(tab=>tab.querySelector('.option-label')!.textContent!.replace(/\s+/g,' ').trim()))
      .toEqual(['Opção 1, conta na meta','Opção 2','Opção 3','Opção 4','Opção 5']);
    expect(fixture.nativeElement.querySelectorAll('[role="tab"] .option-close')).toHaveLength(5);
    expect(tabs[4].getAttribute('aria-selected')).toBe('true');expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(fixture.nativeElement.querySelector('.option-add').disabled).toBe(true);
  });
  it('adds, edits and removes foods only in the open option',()=>{
    const {first,second}=mealWithTwoOptions();
    const mealKey=app.meals()[0].key;
    expect(app.meals()[0].options[0].foods.map(item=>item.food.id)).toEqual([42]);
    expect(second.foods.map(item=>item.food.id)).toEqual([7]);
    app.changeQuantity(mealKey,second.foods[0].key,80);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:42,quantityG:100}]},{foods:[{foodId:7,quantityG:80}]}]);
    app.selectOption(mealKey,first.key);app.openFoodSearch(mealKey);app.addFood({...food,id:9});
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:42,quantityG:100},{foodId:9,quantityG:100}]},{foods:[{foodId:7,quantityG:80}]}]);
  });
  it('shows option 1 in the summary line with "+N opções" and the open option totals as not counting',()=>{
    mealWithTwoOptions();
    fixture.detectChanges();
    const panel: HTMLElement=fixture.nativeElement.querySelector('.meal-panel');
    expect(panel.querySelector('.meal-count')!.textContent).toContain('1 item');
    expect(panel.querySelector('.meal-options-count')!.textContent!.trim()).toBe('+1 opção');
    expect(panel.querySelector('.meal-summary')!.textContent).toContain('123 kcal');
    expect(panel.querySelector('.option-totals')!.textContent!.replace(/\s+/g,' ')).toContain('Totais de Opção 2');
    expect(panel.querySelector('.option-totals')!.textContent).toContain('300 kcal');
    expect(panel.querySelector('.option-totals')!.textContent).toContain('não conta na meta');
    expect(panel.querySelector('.meal-body .food-row')!.textContent).toContain('300 kcal');
    app.selectOption(app.meals()[0].key,app.meals()[0].options[0].key);fixture.detectChanges();
    expect(panel.querySelector('.option-totals')).toBeNull();
    expect(panel.querySelector('.meal-body .food-row')!.textContent).toContain('100 kcal');
  });
  it('"Definir como principal" moves the option to the first position and recalculates',()=>{
    const {first,second}=mealWithTwoOptions();
    fixture.detectChanges();
    const action=Array.from(fixture.nativeElement.querySelectorAll('.option-actions button') as NodeListOf<HTMLButtonElement>).find(button=>button.textContent!.includes('Definir como principal'))!;
    action.click();
    expect(app.meals()[0].options.map(option=>option.key)).toEqual([second.key,first.key]);
    expect(app.meals()[0].activeOptionKey).toBe(second.key);
    expect(app.result()!.meals[0].options[0].totals.energyKcal).toBe(300);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:7,quantityG:100}]},{foods:[{foodId:42,quantityG:100}]}]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.option-actions').textContent).not.toContain('Definir como principal');
  });
  it('removes an option with foods after confirmation, renumbers and never removes the only option',()=>{
    const {first,second}=mealWithTwoOptions();
    const mealKey=app.meals()[0].key;
    app.selectOption(mealKey,first.key);
    app.requestRemoveOption(mealKey,first.key);http.expectNone('/api/diet-calculations');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meal-body .meal-confirmation').textContent).toContain('Opção 2 passará a contar na meta.');
    app.removeOption(mealKey,first.key);
    expect(app.meals()[0].options.map(option=>option.key)).toEqual([second.key]);
    expect(app.meals()[0].activeOptionKey).toBe(second.key);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:7,quantityG:100}]}]);
    app.removeOption(mealKey,second.key);http.expectNone('/api/diet-calculations');expect(app.meals()[0].options).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.option-close')).toBeNull();
    expect(fixture.nativeElement.querySelector('.meal-options-count')).toBeNull();
  });
  it('removes an empty option without confirmation and asks before removing a meal with foods in any option',()=>{
    createMeal();app.addOption(app.meals()[0].key);flushComposition();
    const mealKey=app.meals()[0].key;
    app.requestRemoveOption(mealKey,app.meals()[0].options[1].key);
    expect(app.pendingOptionRemoval()).toBeNull();expect(app.meals()[0].options).toHaveLength(1);flushComposition();
    app.addOption(mealKey);flushComposition();
    app.openFoodSearch(mealKey);app.addFood(food);flushComposition();
    expect(app.meals()[0].options[0].foods).toHaveLength(0);
    app.requestRemoveMeal(mealKey);expect(app.pendingMealRemoval()).toBe(mealKey);
  });
  it('closes tabs like a browser: × or middle click, an empty tab at once, one with foods after confirming',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(mealResponse);
    const mealKey=app.meals()[0].key;
    app.addOption(mealKey);flushComposition();
    const empty=app.meals()[0].options[1];
    app.selectOption(mealKey,app.meals()[0].options[0].key);app.addOption(mealKey);flushComposition();
    app.openFoodSearch(mealKey);app.addFood(food);flushComposition();
    app.selectOption(mealKey,app.meals()[0].options[0].key);fixture.detectChanges();
    const tabs=()=>Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>);
    // × on the empty second tab closes it without leaving the open tab.
    (tabs()[1].querySelector('.option-close') as HTMLButtonElement).click();
    expect(app.meals()[0].options.map(option=>option.key)).not.toContain(empty.key);
    expect(app.meals()[0].activeOptionKey).toBe(app.meals()[0].options[0].key);flushComposition();fixture.detectChanges();
    // Middle click on a tab with foods opens it and asks before closing.
    tabs()[1].dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true}));fixture.detectChanges();
    expect(app.meals()[0].activeOptionKey).toBe(app.meals()[0].options[1].key);
    expect(fixture.nativeElement.querySelector('.meal-body .meal-confirmation').textContent).toContain('Fechar Opção 2 e seus alimentos?');
    http.expectNone('/api/diet-calculations');
    (Array.from(fixture.nativeElement.querySelectorAll('.meal-body .meal-confirmation button') as NodeListOf<HTMLButtonElement>).find(button=>button.textContent!.includes('Fechar opção'))!).click();
    expect(app.meals()[0].options).toHaveLength(1);flushComposition();
  });
  it('drags a tab to reorder the options; the one dropped first counts toward the day',()=>{
    const {first,second}=mealWithTwoOptions();
    app.dropOption(app.meals()[0].key,{previousIndex:1,currentIndex:0} as never);
    expect(app.meals()[0].options.map(option=>option.key)).toEqual([second.key,first.key]);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:7,quantityG:100}]},{foods:[{foodId:42,quantityG:100}]}]);
    app.dropOption(app.meals()[0].key,{previousIndex:0,currentIndex:0} as never);http.expectNone('/api/diet-calculations');
  });
  it('renames a tab by double click: Enter saves on screen only, Esc cancels, blank restores the position name',()=>{
    const {first,second}=mealWithTwoOptions();
    const mealKey=app.meals()[0].key;
    fixture.detectChanges();
    const tabs=()=>Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>);
    const nameInput=()=>fixture.nativeElement.querySelector('.option-name-input') as HTMLInputElement;
    tabs()[1].dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));fixture.detectChanges();
    expect(nameInput().value).toBe('Opção 2');
    nameInput().value='  Sem glúten  ';nameInput().dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));fixture.detectChanges();
    expect(app.meals()[0].options[1].name).toBe('Sem glúten');
    expect(tabs()[1].querySelector('.option-label')!.textContent!.trim()).toBe('Sem glúten');
    expect(fixture.nativeElement.querySelector('.option-totals').textContent).toContain('Totais de Sem glúten');
    http.expectNone('/api/diet-calculations');
    // Moving keeps the name; the unnamed option follows its new position.
    app.makeFirstOption(mealKey,second.key);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options).toEqual([{foods:[{foodId:7,quantityG:100}]},{foods:[{foodId:42,quantityG:100}]}]);
    fixture.detectChanges();
    expect(tabs().map(tab=>tab.querySelector('.option-label')!.textContent!.replace(/\s+/g,' ').trim())).toEqual(['Sem glúten, conta na meta','Opção 2']);
    // Esc cancels; blank clears the name.
    app.startRenameOption(mealKey,first.key);fixture.detectChanges();
    nameInput().value='Outro';nameInput().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
    expect(app.meals()[0].options[1].name).toBe('');expect(nameInput()).toBeNull();
    app.startRenameOption(mealKey,second.key);fixture.detectChanges();
    nameInput().value='   ';nameInput().dispatchEvent(new Event('blur'));fixture.detectChanges();
    expect(tabs()[0].querySelector('.option-label')!.textContent!.replace(/\s+/g,' ').trim()).toBe('Opção 1, conta na meta');
  });
  it('right click opens the tab menu: Renomear, Definir como principal and Fechar opção',()=>{
    const {first,second}=mealWithTwoOptions();
    fixture.detectChanges();
    const tabs=()=>Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>);
    const items=()=>Array.from(fixture.nativeElement.querySelectorAll('.option-menu [role="menuitem"]') as NodeListOf<HTMLButtonElement>);
    const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:40});
    tabs()[0].dispatchEvent(event);fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(app.meals()[0].activeOptionKey).toBe(first.key);
    expect(items().map(item=>item.textContent!.trim())).toEqual(['Renomear','Fechar opção']);
    (fixture.nativeElement.querySelector('.option-menu') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.option-menu')).toBeNull();
    tabs()[1].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:80,clientY:40}));fixture.detectChanges();
    expect(items().map(item=>item.textContent!.trim())).toEqual(['Renomear','Definir como principal','Fechar opção']);
    items()[1].click();
    expect(app.meals()[0].options.map(option=>option.key)).toEqual([second.key,first.key]);
    expect(app.optionMenu()).toBeNull();flushComposition();fixture.detectChanges();
    tabs()[1].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:80,clientY:40}));fixture.detectChanges();
    items()[0].click();fixture.detectChanges();
    expect(app.editingOptionKey()).toBe(first.key);expect(fixture.nativeElement.querySelector('.option-name-input')).not.toBeNull();
  });
  it('arrow keys move between option tabs',()=>{
    mealWithTwoOptions();fixture.detectChanges();
    const tabs=fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
    expect(app.meals()[0].activeOptionKey).toBe(app.meals()[0].options[0].key);
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('[role="tab"]')[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'}));
    expect(app.meals()[0].activeOptionKey).toBe(app.meals()[0].options[1].key);
  });
  it('marks a rejected portion in an option other than the first',()=>{
    const {second}=mealWithTwoOptions();
    app.changeQuantity(app.meals()[0].key,second.foods[0].key,0);
    http.expectOne('/api/diet-calculations').flush({errors:[{field:'meals[0].options[1].foods[0].quantityG',message:'Informe uma quantidade maior que zero.'}]},{status:400,statusText:'Bad Request'});
    const retry=http.expectOne('/api/diet-calculations');
    expect(retry.request.body.meals[0].options).toEqual([{foods:[{foodId:42,quantityG:100}]},{foods:[]}]);
    const first=mealResponse.meals[0].options[0];
    retry.flush({...mealResponse,meals:[{name:'Almoço',totals:first.totals,options:[first,{totals:optionTotals(0),foods:[]}]}]});
    expect(app.invalidPortions().get(second.foods[0].key)).toBe('Informe uma quantidade maior que zero.');
    expect(app.result()!.meals[0].options[1].foods).toEqual([null]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.meal-body .food-row').classList).toContain('invalid-portion');
    expect(app.errors()).toEqual([]);
  });

  // Fiber and the micronutrient report: every value comes from the backend.
  const dayNutrient = (code: string, name: string, category: DayNutrient['category'], consumed: number | null, extra: Partial<DayNutrient> = {}): DayNutrient =>
    ({code,name,unit:'mg',category,inReport:category !== 'FIBER',consumed,status:consumed === null ? 'NO_DATA' : 'COMPLETE',foodsWithoutData:consumed === null ? 1 : 0,reference:null,...extra});
  const reportResponse: CalculationResponse = {...mealResponse,
    nutrients:[
      dayNutrient('FIBER','Fibra alimentar','FIBER',12.5,{unit:'g',reference:{amount:25,type:'AI',percent:50}}),
      dayNutrient('CALCIUM','Cálcio','MINERAL',500,{reference:{amount:1000,type:'RDA',percent:50}}),
      dayNutrient('SODIUM','Sódio','MINERAL',4500,{reference:{amount:1500,type:'AI',percent:300}}),
      dayNutrient('VITAMIN_C','Vitamina C','VITAMIN',30,{status:'PARTIAL',foodsWithoutData:2,reference:{amount:75,type:'RDA',percent:40}}),
      dayNutrient('CHOLESTEROL','Colesterol','LIPID',120),
      dayNutrient('TRANS_FAT_18_1','Gordura trans (18:1t)','LIPID',null,{unit:'g'}),
      dayNutrient('MOISTURE','Umidade','OTHER',80,{inReport:false}),
    ],
    referenceSource:{name:'Food and Nutrition Board / IOM (DRI)',profile:'Mulher, 19–30 anos'}};
  it('sends the reference profile only with sex and age, and recalculates when they change',()=>{
    createMeal();
    app.form.controls.patient.patchValue({sex:'FEMALE'});
    http.expectNone('/api/diet-calculations');
    app.form.controls.patient.patchValue({age:30});
    const withProfile=http.expectOne('/api/diet-calculations');
    expect(withProfile.request.body.referenceProfile).toEqual({sex:'FEMALE',age:30});withProfile.flush(response);
    app.form.controls.patient.patchValue({weightKg:70});http.expectNone('/api/diet-calculations');
    app.form.controls.patient.patchValue({sex:'UNSPECIFIED'});
    const without=http.expectOne('/api/diet-calculations');
    expect('referenceProfile' in without.request.body).toBe(false);without.flush(response);
  });
  it('shows fiber in the analysis card with and without a reference',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(reportResponse);fixture.detectChanges();
    const fiber=()=>fixture.nativeElement.querySelector('.analysis-metric.fiber') as HTMLElement;
    expect(fiber().textContent!.replace(/\s+/g,' ')).toContain('12,5 / 25 g');
    expect(fiber().textContent).toContain('50% da referência (AI)');
    expect((fiber().querySelector('.meter-fill') as HTMLElement).style.getPropertyValue('--fill')).toBe('0.5');
    app.calculate();http.expectOne('/api/diet-calculations').flush({...reportResponse,referenceSource:null,
      nutrients:[dayNutrient('FIBER','Fibra alimentar','FIBER',3,{unit:'g',status:'PARTIAL',foodsWithoutData:1})]});
    fixture.detectChanges();
    expect(fiber().textContent).toContain('Sem referência');
    expect(fiber().querySelector('.partial-mark')!.getAttribute('title')).toBe('Sem dado em 1 alimento');
    expect(fixture.nativeElement.querySelector('.donut-shares').textContent).not.toContain('Fibra');
  });
  it('lists the report by group with the reference line, 200% scale, partial and missing values',()=>{
    createMeal();app.addFood(food);http.expectOne('/api/diet-calculations').flush(reportResponse);fixture.detectChanges();
    const report: HTMLElement=fixture.nativeElement.querySelector('.nutrient-report');
    expect(Array.from(report.querySelectorAll('h3')).map(item=>item.textContent!.trim())).toEqual(['Minerais','Vitaminas','Lipídios']);
    const rows=Array.from(report.querySelectorAll('.report-row')) as HTMLElement[];
    expect(rows.map(row=>row.querySelector('.report-name')!.textContent!.replace('*','').replace(/sem dado.*/,'').trim()))
      .toEqual(['Cálcio','Sódio','Vitamina C','Colesterol','Gordura trans (18:1t)']);
    expect(report.textContent).not.toContain('Fibra');expect(report.textContent).not.toContain('Umidade');
    const [calcium,sodium,vitaminC,cholesterol,trans]=rows;
    expect(calcium.querySelector('.report-value')!.textContent!.replace(/\s+/g,' ')).toContain('500,0 / 1.000,0 mg');
    expect((calcium.querySelector('.report-fill') as HTMLElement).style.getPropertyValue('--fill')).toBe('0.25');
    expect((calcium.querySelector('.report-reference') as HTMLElement).style.getPropertyValue('--at')).toBe('0.5');
    expect(calcium.querySelector('.report-over')).toBeNull();
    expect((sodium.querySelector('.report-fill') as HTMLElement).style.getPropertyValue('--fill')).toBe('1');
    expect(sodium.querySelector('.report-over')!.textContent).toBe('›');
    expect(vitaminC.querySelector('.partial-mark')!.getAttribute('title')).toBe('Sem dado em 2 alimentos');
    expect(cholesterol.querySelector('.report-bar')).toBeNull();
    expect(cholesterol.querySelector('.report-value')!.textContent).toContain('120,0');
    expect(trans.classList).toContain('no-data');expect(trans.querySelector('.report-value strong')!.textContent).toBe('—');
    expect(report.querySelector('.report-source')!.textContent).toContain('Referência: Food and Nutrition Board / IOM (DRI) · Mulher, 19–30 anos');
    expect(report.querySelector('.report-source')!.textContent).toContain('a validar com o nutricionista');
    expect(fixture.nativeElement.querySelector('.meals-panel').textContent).not.toContain('Cálcio');
    const toggle=report.querySelector('.report-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();fixture.detectChanges();
    expect(report.querySelector('.report-list')).toBeNull();expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();fixture.detectChanges();expect(report.querySelectorAll('.report-row')).toHaveLength(5);
  });
  it('asks for sex and age without a profile and survives an older API without nutrients',()=>{
    createMeal();app.addFood(food);
    const {nutrients,referenceSource,...older}=reportResponse;
    expect(nutrients.length).toBeGreaterThan(0);expect(referenceSource).not.toBeNull();
    http.expectOne('/api/diet-calculations').flush(older);fixture.detectChanges();
    const report: HTMLElement=fixture.nativeElement.querySelector('.nutrient-report');
    expect(report.querySelector('.report-empty')!.textContent).toContain('Adicione alimentos');
    expect(report.querySelector('.report-source')!.textContent).toContain('Informe sexo e idade do paciente');
    expect(fixture.nativeElement.querySelector('.analysis-metric.fiber .analysis-value').textContent.trim()).toBe('—');
    expect(app.errors()).toEqual([]);
  });

  // Registered patient chosen for the planning (the planning itself is never saved).
  const registered: Patient = { id:'patient-ficticio', name:'Paciente Fictício', birthDate:'1990-05-20', ageYears:36, sex:'FEMALE',
    phone:'(11) 90000-0000', email:'ficticio@example.com', notes:'Observação fictícia', weightKg:68.5, heightCm:165,
    driActivity:'LOW_ACTIVE', measuredAt:'2026-09-10', version:3, archived:false, createdAt:'2026-09-10T00:00:00Z', updatedAt:'2026-09-10T00:00:00Z' };
  function signIn() { TestBed.inject(Session).token.set('test-only-token'); }
  const page = (content: Patient[]) => ({content,page:0,size:20,totalElements:content.length,totalPages:1});
  function openPatientMenu(list: Patient[] = [registered]) {
    app.openPatientMenu(); fixture.detectChanges();
    if (TestBed.inject(Session).token()) { http.expectOne(request=>request.url==='/api/patients').flush(page(list)); fixture.detectChanges(); }
  }
  function choose(patient: Patient = registered) {
    app.searchPatients('ficticio');
    http.expectOne(request=>request.url==='/api/patients').flush(page([patient]));
    app.choosePatient(patient); fixture.detectChanges();
    expect(app.patientMenuOpen()).toBe(false);
  }
  it('opens a compact drop-down of patient names under the button and closes it on an outside click',()=>{
    signIn();
    fixture.nativeElement.querySelector('.patient-trigger').click();fixture.detectChanges();
    http.expectOne(request=>request.url==='/api/patients').flush(page([registered]));fixture.detectChanges();
    const menu=fixture.nativeElement.querySelector('.patient-menu');
    expect(menu).not.toBeNull();expect(fixture.nativeElement.querySelector('.drawer')).toBeNull();
    expect(menu.closest('.patient-menu-anchor')).not.toBeNull();
    // Only the search and the names: no data, goal or form in the drop-down.
    expect(Array.from(menu.querySelectorAll('.patient-names button')).map((button:any)=>button.textContent.trim())).toEqual(['Paciente Fictício']);
    expect(menu.querySelector('[formControlName]')).toBeNull();
    expect(menu.textContent).not.toContain('anos');
    // A click inside keeps it open; a click elsewhere closes it.
    menu.querySelector('input').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patient-menu')).not.toBeNull();
    fixture.nativeElement.querySelector('.summary').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patient-menu')).toBeNull();
    // Reopening reuses the loaded list.
    fixture.nativeElement.querySelector('.patient-trigger').click();fixture.detectChanges();
    http.expectNone(request=>request.url==='/api/patients');
    expect(fixture.nativeElement.querySelectorAll('.patient-names button')).toHaveLength(1);
  });
  it('shows an empty state with a link to register the first patient',()=>{
    signIn();openPatientMenu([]);
    const empty=fixture.nativeElement.querySelector('.patient-names li.empty');
    expect(empty.textContent).toContain('Nenhum paciente cadastrado');
    expect(empty.querySelector('a').getAttribute('href')).toBe('/pacientes/novo');
  });
  it('without a session the drop-down offers login and never queries patients',()=>{
    openPatientMenu();
    expect(fixture.nativeElement.querySelector('.patient-menu').textContent).toContain('Entre na sua conta');
    app.searchPatients('ficticio');
    http.expectNone(request=>request.url==='/api/patients');
    expect(app.patientResults()).toBeNull();
  });
  it('choosing a registered patient fills the planning data; data and goal live in the patient drawer',async()=>{
    vi.useFakeTimers();signIn();openPatientMenu();
    app.patientSearch.setValue('fic');await vi.advanceTimersByTimeAsync(249);
    http.expectNone(request=>request.url==='/api/patients');await vi.advanceTimersByTimeAsync(1);
    const search=http.expectOne(request=>request.url==='/api/patients');
    expect(search.request.params.get('name')).toBe('fic');expect(search.request.params.get('archived')).toBe('false');
    search.flush(page([registered]));fixture.detectChanges();

    fixture.nativeElement.querySelector('.patient-names button').click();fixture.detectChanges();
    // Choosing closes the drop-down and never opens the side drawer.
    expect(fixture.nativeElement.querySelector('.patient-menu')).toBeNull();
    expect(fixture.nativeElement.querySelector('.drawer')).toBeNull();
    expect(fixture.nativeElement.querySelector('.patient-trigger').textContent).toContain('Paciente Fictício');
    fixture.nativeElement.querySelector('.patient-trigger').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patient-names button').classList).toContain('selected');
    fixture.nativeElement.querySelector('.summary').click();fixture.detectChanges();

    // "Dados do paciente": read-only fields from the register, plus the goal (screen only).
    app.openPanel('patient');fixture.detectChanges();
    const drawer=fixture.nativeElement.querySelector('.drawer');
    expect(drawer.querySelector('.patient-chosen').textContent).toContain('Paciente Fictício');
    expect(drawer.querySelector('[formControlName="weightKg"]').disabled).toBe(true);
    expect(drawer.querySelector('[formControlName="goal"]').disabled).toBe(false);
    expect(app.form.controls.patient.getRawValue()).toEqual({name:'Paciente Fictício',sex:'FEMALE',age:36,weightKg:68.5,heightCm:165,driActivity:'LOW_ACTIVE',goal:null});
    expect(app.selectedPatient()?.id).toBe(registered.id);
    // Age comes calculated from the backend; the screen never derives it from the birth date.
    expect(app.form.controls.patient.controls.age.value).toBe(registered.ageYears);
    await vi.advanceTimersByTimeAsync(400);
    http.expectOne('/api/energy-estimates').flush(estimate);
    await vi.advanceTimersByTimeAsync(400);flushComposition();
    http.match('/api/target-calculations').forEach(pending=>pending.cancelled||pending.flush(definition));
    flushComposition();
  });
  it('saves the edited fields straight to the register, keeping the fields not shown here',()=>{
    signIn();openPatientMenu();choose();
    app.openPanel('patient');app.editPatient();fixture.detectChanges();
    expect(app.form.controls.patient.controls.weightKg.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.drawer [formControlName="weightKg"]').disabled).toBe(false);
    app.form.controls.patient.patchValue({weightKg:70,driActivity:'ACTIVE'});flushComposition();
    app.savePatient();
    const request=http.expectOne('/api/patients/'+registered.id);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({...registered,weightKg:70,driActivity:'ACTIVE',version:3});
    request.flush({...registered,weightKg:70,driActivity:'ACTIVE',version:4});
    fixture.detectChanges();
    expect(app.editingPatient()).toBe(false);
    expect(app.selectedPatient()?.version).toBe(4);
    expect(app.form.controls.patient.controls.weightKg.disabled).toBe(true);
    flushComposition();
  });
  it('shows the version conflict and reloads the patient',()=>{
    signIn();openPatientMenu();choose();
    app.openPanel('patient');app.editPatient();app.form.controls.patient.patchValue({weightKg:70});flushComposition();
    app.savePatient();
    http.expectOne('/api/patients/'+registered.id).flush({detail:'Conflict'},{status:409,statusText:'Conflict'});
    fixture.detectChanges();
    expect(app.patientConflict()).toBe(true);
    expect(fixture.nativeElement.querySelector('.drawer .patient-error').textContent).toContain('alterado em outra sessão');
    app.savePatient();http.expectNone('/api/patients/'+registered.id);

    app.reloadPatient();
    http.expectOne('/api/patients/'+registered.id).flush({...registered,weightKg:72,version:9});
    fixture.detectChanges();
    expect(app.patientConflict()).toBe(false);expect(app.form.controls.patient.controls.weightKg.value).toBe(72);
    flushComposition();
  });
  it('unlinking keeps the values on screen and frees the fields',()=>{
    signIn();openPatientMenu();choose();
    app.openPanel('patient');fixture.detectChanges();
    app.unlinkPatient();fixture.detectChanges();
    expect(app.selectedPatient()).toBeNull();
    expect(app.form.controls.patient.controls.weightKg.disabled).toBe(false);
    expect(app.form.controls.patient.getRawValue().weightKg).toBe(68.5);
    expect(fixture.nativeElement.querySelector('.drawer .patient-chosen')).toBeNull();
    expect(fixture.nativeElement.querySelector('.drawer').textContent).toContain('Nenhum paciente escolhido');
    flushComposition();
  });
  it('does not estimate for a patient under 19 and explains why',async()=>{
    vi.useFakeTimers();signIn();openPatientMenu();
    choose({...registered,ageYears:15,birthDate:'2011-05-20'});
    await vi.advanceTimersByTimeAsync(600);
    http.expectNone('/api/energy-estimates');
    expect(app.belowEstimateAge).toBe(true);
    app.openPanel('estimate');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patient-missing').textContent).toContain('19 anos ou mais');
    // The professional can still prescribe manually.
    app.form.controls.prescribedEnergyKcal.setValue(1800);await vi.advanceTimersByTimeAsync(400);
    http.expectOne('/api/target-calculations').flush(definition);flushComposition();
  });
  // Sizing a portion by a nutrient: the backend returns the weight; the screen never calculates it.
  function foodRow() { return fixture.nativeElement.querySelector('.meal-body .food-row') as HTMLElement; }
  function withCalculatedFood(item: Food = food) {
    createMeal();app.addFood(item);
    http.expectOne('/api/diet-calculations').flush({...mealResponse,meals:[{...mealResponse.meals[0],options:[{...mealResponse.meals[0].options[0],foods:[{...mealResponse.meals[0].options[0].foods[0],foodId:item.id}]}]}]});
    fixture.detectChanges();
  }
  it('sizes a portion by the desired carbohydrate and recalculates with the weight from the backend',()=>{
    withCalculatedFood();
    const chip:HTMLButtonElement=foodRow().querySelector('.nutrient-chip.carb')!;
    expect(chip.textContent).toContain('20g');
    chip.click();fixture.detectChanges();
    const input:HTMLInputElement=foodRow().querySelector('.nutrient-edit.carb input')!;
    expect(Number(input.value)).toBe(20);
    input.value='40';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));input.dispatchEvent(new Event('blur'));
    const request=http.expectOne('/api/portion-quantities');
    expect(request.request.body).toEqual({foodId:42,nutrient:'CARBOHYDRATE',amount:40});
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({foodId:42,nutrient:'CARBOHYDRATE',amount:40,quantityG:200});
    // Applied as a normal weight edit: same recalculation as typing 200 g.
    expect(app.meals()[0].options[0].foods[0].quantityG).toBe(200);
    expect(http.expectOne('/api/diet-calculations').request.body.meals[0].options[0].foods).toEqual([{foodId:42,quantityG:200}]);
    fixture.detectChanges();
    expect(foodRow().querySelector('.nutrient-edit')).toBeNull();
  });
  it('sizes by energy too, and cancels without a request on Escape, empty or unchanged values',()=>{
    withCalculatedFood();
    const open=(css:string)=>{(foodRow().querySelector('.nutrient-chip.'+css) as HTMLButtonElement).click();fixture.detectChanges();
      return foodRow().querySelector('.nutrient-edit input') as HTMLInputElement;};
    let input=open('kcal');
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
    expect(app.editingNutrient()).toBeNull();input.dispatchEvent(new Event('blur'));
    input=open('kcal');input.value='';input.dispatchEvent(new Event('blur'));fixture.detectChanges();
    input=open('kcal');input.dispatchEvent(new Event('blur'));fixture.detectChanges();
    http.expectNone('/api/portion-quantities');
    input=open('kcal');input.value='150';input.dispatchEvent(new Event('blur'));
    const request=http.expectOne('/api/portion-quantities');
    expect(request.request.body).toEqual({foodId:42,nutrient:'ENERGY',amount:150});
    request.flush({foodId:42,nutrient:'ENERGY',amount:150,quantityG:150});
    flushComposition();
  });
  it('does not offer sizing by a nutrient the food does not have',()=>{
    withCalculatedFood({...food,proteinG:0});
    expect(foodRow().querySelector('.nutrient-chip.protein')).toBeNull();
    expect(foodRow().querySelector('.meal-chip.protein')!.tagName).toBe('SPAN');
    expect(foodRow().querySelector('.nutrient-chip.carb')).not.toBeNull();
  });
  it('keeps the portion and shows the backend message when sizing fails',()=>{
    withCalculatedFood();
    (foodRow().querySelector('.nutrient-chip.fat') as HTMLButtonElement).click();fixture.detectChanges();
    const input:HTMLInputElement=foodRow().querySelector('.nutrient-edit input')!;
    input.value='0.0001';input.dispatchEvent(new Event('blur'));
    http.expectOne('/api/portion-quantities').flush(
      {detail:'Há campos inválidos.',errors:[{field:'amount',message:'Quantidade muito pequena: a porção ficaria com menos de 0,1 g.'}]},
      {status:400,statusText:'Bad Request'});
    fixture.detectChanges();
    expect(app.meals()[0].options[0].foods[0].quantityG).toBe(100);
    http.expectNone('/api/diet-calculations');
    const edit=foodRow().querySelector('.nutrient-edit.fat')!;
    expect(edit.classList).toContain('invalid');
    expect(edit.getAttribute('title')).toContain('menos de 0,1 g');
    expect(foodRow().querySelector('[role="alert"]')!.textContent).toContain('menos de 0,1 g');
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

