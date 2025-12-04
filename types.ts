
export enum Gender {
  Male = '男',
  Female = '女',
}

export enum Goal {
  LoseFat = '减脂',
  Maintain = '维持',
  LeanGain = '干净增肌',
  DirtyGain = '脏增肌',
  BodyRecomp = '塑形 (同时增肌减脂)',
}

export enum ActivityLevel {
  Sedentary = '久坐 - 极少/无运动',
  Light = '轻度活动 - 每周运动 1-3 次',
  Moderate = '中度活动 - 每周运动 3-5 次',
  High = '高度活动 - 每周运动 6-7 次',
  Athlete = '专业运动员 - 体力工作/双倍训练',
}

export enum TrainingHistory {
  Beginner = '新手 (< 1 年)',
  Intermediate = '中级 (1-3 年)',
  Advanced = '高级 (3+ 年)',
}

export enum SubHealthCondition {
  None = '无',
  Liver = '肝功能亚健康',
  Kidney = '肾功能亚健康',
  Adrenal = '肾上腺功能亚健康',
  Thyroid = '甲状腺功能亚健康',
  Digestive = '消化系统亚健康',
  FemaleGonad = '女性性腺功能亚健康',
  MaleGonad = '男性性腺功能亚健康',
  HighCholesterol = '高血脂/胆固醇偏高',
  HighUricAcid = '高尿酸/痛风风险',
}

export enum MacroPreference {
  Balanced = '均衡饮食 (标准)',
  HighCarb = '高碳水 (耐力/高能)',
  HighProtein = '较高蛋白 (饱腹/肌肉)',
  Custom = '自定义比例 (手动调整)',
}

export interface UserInput {
  height: number | ''; // cm
  weight: number | ''; // kg
  age: number | '';
  gender: Gender;
  bodyFat?: number; // percentage
  goal: Goal;
  goalDescription?: string; // Specific goal details
  targetWeight?: string; // kg
  targetDurationWeeks?: number; // weeks
  activityLevel: ActivityLevel;
  trainingHistory: TrainingHistory;
  macroPreference: MacroPreference; 
  customMacroRatio?: { p: number; f: number; c: number }; // Protein, Fat, Carbs percentages
  waterIntake: string;
  supplements: string;
  appetiteStress: number; // 1-10
  sleepQuality: number; // 1-10
  healthConditions: SubHealthCondition[];
}

export interface MacroSplit {
  protein: number;
  fats: number;
  carbs: number;
}

export interface CalculationResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  formulaUsed: string;
  activityMultiplier: number;
  macros: MacroSplit;
  timeToGoal: string; // Estimate
  weeklyChange: string; // Estimate
  // Feasibility Analysis
  requiredDeficit?: number; // Daily calorie difference needed
  isFeasible?: boolean;
  feasibilityMessage?: string;
  safeMinWeeks?: number;
}

export interface MealMacros {
  calories: number;
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
}

export interface Meal {
  name: string; // e.g., "早餐", "午餐"
  foodItems: string; // e.g., "小米粥 1碗, 水煮蛋 2个"
  description: string; // Cooking method or details
  vegetableRecommendation?: string; // New field for specific veggie suggestions
  macros: MealMacros;
}

export interface AIPlanData {
  insight: string;
  mealPlan: Meal[]; // Structured meal plan
  weeklyAdvice: string; // Weekly diet strategy and prep advice
  supplements: string;
  recovery: string;
  healthAdvice?: string;
}
