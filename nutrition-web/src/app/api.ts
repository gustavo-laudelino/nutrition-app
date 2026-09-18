import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface Food {
  id: number; name: string; energyKcal: number; carbohydrateG: number;
  proteinG: number; fatG: number; source: string; sourceCode: string | null;
}
export interface FoodPage { items: Food[]; page: number; size: number; totalElements: number }
export type Sex = 'FEMALE' | 'MALE' | 'UNSPECIFIED';
export type PatientGoal = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'WEIGHT_GAIN';
export type EstimateMethod = 'DRI_2023' | 'FAO';
export type DriActivity = 'INACTIVE' | 'LOW_ACTIVE' | 'ACTIVE' | 'VERY_ACTIVE';
export type MacroMethod = 'NONE' | 'PERCENTAGE';
export interface Patient {
  name?: string; weightKg?: number | null; heightCm?: number | null; age?: number | null;
  sex?: Sex; goal?: PatientGoal | null; driActivity?: DriActivity | null;
}
export interface EstimateRequest {
  patient: Patient; method: EstimateMethod;
  faoPal?: number | null;
}
export interface EstimateResponse {
  method: EstimateMethod; estimatedKcal: number; basalKcal: number | null;
  driActivity: DriActivity | null; faoPal: number | null;
  faoActivity: 'SEDENTARY_LIGHT' | 'ACTIVE_MODERATE' | 'VIGOROUS' | null;
}
export interface NutrientTargets { energyKcal: number | null; carbohydrateG: number | null; proteinG: number | null; fatG: number | null }
export interface TargetRequest {
  prescribedEnergyKcal: number | null;
  referenceEstimateKcal: number | null;
  macros: { method: MacroMethod; carbohydrate?: number | null; protein?: number | null; fat?: number | null };
}
export interface MacroTarget { grams: number; energyKcal: number }
export interface TargetResponse {
  prescription: { energyKcal: number | null; referenceEstimateKcal: number | null; differenceKcal: number | null };
  macros: { method: MacroMethod; carbohydrate: MacroTarget | null; protein: MacroTarget | null; fat: MacroTarget | null };
  targets: NutrientTargets;
}
export interface CompositionTargetResponse { prescribedEnergyKcal: number; carbohydratePercent: number; proteinPercent: number; fatPercent: number }
export interface CalculationRequest { targets: NutrientTargets | null; meals: { name: string; foods: { foodId: number; quantityG: number | null }[] }[] }
export interface Nutrients { energyKcal: number; carbohydrateG: number; proteinG: number; fatG: number }
export interface Balance { target: number | null; consumed: number; remaining: number | null }
export interface CalculationResponse {
  meals: { name: string; totals: Nutrients; foods: { foodId: number; name: string; source: string; sourceCode: string | null; quantityG: number; nutrients: Nutrients }[] }[];
  totals: { energyKcal: Balance; carbohydrateG: Balance; proteinG: Balance; fatG: Balance };
  // Day's macro distribution by energy (4/4/9), calculated by the backend; null without macros.
  macroEnergyShares: MacroEnergyShares | null;
}
export type PortionNutrient = 'ENERGY' | 'CARBOHYDRATE' | 'PROTEIN' | 'FAT';
export interface PortionQuantityRequest { foodId: number; nutrient: PortionNutrient; amount: number }
export interface PortionQuantityResponse extends PortionQuantityRequest { quantityG: number }
export interface MacroEnergyShares { carbohydratePercent: number; proteinPercent: number; fatPercent: number }
@Injectable({ providedIn: 'root' })
export class NutritionApi {
  private readonly http = inject(HttpClient);
  search(name: string, page: number) { return this.http.get<FoodPage>('/api/foods', { params: { name, page, size: 10 } }); }
  calculate(request: CalculationRequest) { return this.http.post<CalculationResponse>('/api/diet-calculations', request); }
  estimateEnergy(request: EstimateRequest) { return this.http.post<EstimateResponse>('/api/energy-estimates', request); }
  prescribePerKg(request: { weightKg: number | null; kcalPerKg: number | null }) {
    return this.http.post<{ prescribedEnergyKcal: number }>('/api/energy-prescriptions/per-kg', request);
  }
  calculateTargets(request: TargetRequest) { return this.http.post<TargetResponse>('/api/target-calculations', request); }
  /** Portion weight that delivers the desired amount of one nutrient (calculated by the backend). */
  portionQuantity(request: PortionQuantityRequest) {
    return this.http.post<PortionQuantityResponse>('/api/portion-quantities', request);
  }
  targetsFromComposition(request: Nutrients) {
    return this.http.post<CompositionTargetResponse>('/api/target-calculations/from-composition', request);
  }
}

