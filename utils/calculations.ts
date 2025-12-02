
import { UserInput, CalculationResult, Gender, ActivityLevel, Goal, MacroPreference } from '../types';

export const calculateNutrition = (input: UserInput): CalculationResult => {
  const weight = Number(input.weight) || 0;
  const height = Number(input.height) || 0;
  const age = Number(input.age) || 0;
  const bodyFat = input.bodyFat ? Number(input.bodyFat) : 0;

  let bmr = 0;
  let formulaUsed = '';

  // BMR Calculation Logic
  if (bodyFat > 0) {
    // Katch-McArdle Formula
    const leanBodyMass = weight * (1 - bodyFat / 100);
    bmr = 370 + (21.6 * leanBodyMass);
    formulaUsed = 'Katch-McArdle 公式 (基于去脂体重)';
  } else {
    // Mifflin-St Jeor Formula
    if (input.gender === Gender.Male) {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    formulaUsed = 'Mifflin-St Jeor 公式 (标准)';
  }

  // Activity Multiplier
  let multiplier = 1.2;
  switch (input.activityLevel) {
    case ActivityLevel.Sedentary: multiplier = 1.2; break;
    case ActivityLevel.Light: multiplier = 1.375; break;
    case ActivityLevel.Moderate: multiplier = 1.55; break;
    case ActivityLevel.High: multiplier = 1.725; break;
    case ActivityLevel.Athlete: multiplier = 1.9; break;
  }

  const tdee = Math.round(bmr * multiplier);

  // Goal Adjustment (Calories)
  let targetCalories = tdee;
  let timeToGoal = '维持现状';
  let weeklyChange = '0 kg';

  switch (input.goal) {
    case Goal.LoseFat:
      targetCalories = Math.round(tdee * 0.85); // -15%
      timeToGoal = '12-16 周';
      weeklyChange = '-0.5 kg';
      break;
    case Goal.Maintain:
      targetCalories = tdee;
      timeToGoal = '长期保持';
      weeklyChange = '0 kg';
      break;
    case Goal.LeanGain:
      // 干净增肌: TDEE + 200
      targetCalories = tdee + 200;
      timeToGoal = '6-12 个月';
      weeklyChange = '+0.2 kg';
      break;
    case Goal.DirtyGain:
      // 脏增肌: TDEE + 500
      targetCalories = tdee + 500;
      timeToGoal = '3-6 个月';
      weeklyChange = '+0.5 kg';
      break;
    case Goal.BodyRecomp:
      // 塑形: TDEE - 500, 但不低于 BMR
      targetCalories = Math.max(Math.round(tdee - 500), Math.round(bmr));
      timeToGoal = '16-24 周';
      weeklyChange = '-0.2 kg (体脂下降)';
      break;
  }

  // ------------------------------------------------------------------
  // Macro Calculation Logic
  // ------------------------------------------------------------------

  let proteinGrams = 0;
  let fatGrams = 0;
  let carbGrams = 0;

  // Case 1: Custom User Preference (Overrides standard logic)
  if (input.macroPreference === MacroPreference.Custom && input.customMacroRatio) {
    const { p, f, c } = input.customMacroRatio;
    
    // Calculate based on percentages directly
    proteinGrams = Math.round((targetCalories * (p / 100)) / 4);
    fatGrams = Math.round((targetCalories * (f / 100)) / 9);
    carbGrams = Math.round((targetCalories * (c / 100)) / 4);

  } else {
    // Case 2: Standard Logic with Preferences
    // Constraints: Carbs 45-65%, Protein 15-35% (max 2.0g/kg), Fat 20-35%
    
    // 1. Determine Carb Ratio based on Preference and Goal
    let carbRatio = 0.50; // Default baseline

    switch(input.macroPreference) {
      case MacroPreference.HighCarb:
        carbRatio = 0.60;
        break;
      case MacroPreference.HighProtein:
        // Lower carbs to allow room for protein, but stay within healthy range
        carbRatio = 0.45;
        break;
      case MacroPreference.Balanced:
      default:
        // Goal influences balanced approach slightly
        if (input.goal === Goal.BodyRecomp || input.goal === Goal.LoseFat) {
          carbRatio = 0.45; // Lower end for fat loss/recomp
        } else {
          carbRatio = 0.50;
        }
        break;
    }

    // 2. Determine Protein Ratio
    // We set a target, but apply strict cap later
    let proteinRatio = 0.25; // Baseline

    if (input.macroPreference === MacroPreference.HighProtein) {
      proteinRatio = 0.35; // Target high end
    } else if (input.goal === Goal.BodyRecomp || input.goal === Goal.LoseFat) {
      proteinRatio = 0.30; // Higher protein for deficit/recomp
    } else {
      proteinRatio = 0.20; // Standard for maintenance/gain
    }

    // 3. Calculate Grams
    
    // A. Protein First (Capped)
    proteinGrams = Math.round((targetCalories * proteinRatio) / 4);
    const maxProteinGrams = Math.floor(weight * 2.0);
    const minProteinGrams = Math.round((targetCalories * 0.15) / 4);

    // Apply Cap and Floor
    if (proteinGrams > maxProteinGrams) proteinGrams = maxProteinGrams;
    if (proteinGrams < minProteinGrams) proteinGrams = minProteinGrams;

    // B. Carbs Second (Based on Preference Ratio)
    carbGrams = Math.round((targetCalories * carbRatio) / 4);

    // C. Fat Third (Remainder)
    const caloriesForProteinAndCarbs = (proteinGrams * 4) + (carbGrams * 4);
    let remainingCaloriesForFat = targetCalories - caloriesForProteinAndCarbs;
    fatGrams = Math.round(remainingCaloriesForFat / 9);

    // 4. Safety Check & Adjustment Loop (Enforce Fat 20-35%)
    const minFatGrams = Math.round((targetCalories * 0.20) / 9);
    const maxFatGrams = Math.round((targetCalories * 0.35) / 9);

    if (fatGrams < minFatGrams) {
      // Fat is too low, steal from Carbs
      // 1g Fat = 9 cal, 1g Carb = 4 cal.
      const calorieDeficit = (minFatGrams * 9) - (fatGrams * 9);
      carbGrams -= Math.round(calorieDeficit / 4);
      fatGrams = minFatGrams;
    } else if (fatGrams > maxFatGrams) {
      // Fat is too high, give to Carbs
      const surplusGrams = fatGrams - maxFatGrams;
      const calorieSurplus = (surplusGrams * 9);
      carbGrams += Math.round(calorieSurplus / 4);
      fatGrams = maxFatGrams;
    }
  }

  // Final Sanity Check for non-negative
  carbGrams = Math.max(0, carbGrams);
  fatGrams = Math.max(0, fatGrams);

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    formulaUsed,
    activityMultiplier: multiplier,
    macros: {
      protein: proteinGrams,
      fats: fatGrams,
      carbs: carbGrams
    },
    timeToGoal,
    weeklyChange
  };
};
