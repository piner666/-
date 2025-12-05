import { GoogleGenAI } from "@google/genai";
import { UserInput, CalculationResult, AIPlanData, Meal, WorkoutTime } from "../types";
import { getFormattedFoodDBString } from "../data/foodDatabase";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("未找到 API 密钥");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry logic wrapper
const generateContentWithRetry = async (ai: GoogleGenAI, model: string, contents: any, config?: any) => {
  let lastError;
  const retries = 3;
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: { ...config, responseMimeType: 'application/json' }
      });
    } catch (error) {
      console.warn(`Gemini API request failed (attempt ${i + 1}/${retries}):`, error);
      lastError = error;
      if (i < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
};

// Robust JSON extraction and parsing
const extractAndParseJson = (text: string, type: 'array' | 'object' = 'object'): any => {
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstCurly = cleaned.indexOf('{');
  const firstSquare = cleaned.indexOf('[');
  let start = -1;
  let end = -1;
  
  if (type === 'array' || (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly))) {
    start = firstSquare;
    end = cleaned.lastIndexOf(']');
  } else {
    start = firstCurly;
    end = cleaned.lastIndexOf('}');
  }

  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("JSON parse failed, attempting sanitation:", e);
    const sanitized = cleaned.replace(/[\x00-\x1F]+/g, " ");
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error("Sanitized JSON parse failed:", e2);
      throw new Error("无法解析 AI 返回的数据格式");
    }
  }
};

// Shared Context Builders
const buildUserContext = (user: UserInput, results: CalculationResult) => {
  const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
  const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
  const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');
  
  let initialSnackName = "午加餐";
  if (user.workoutTime.includes('早晨')) initialSnackName = "早加餐";
  else if (user.workoutTime.includes('晚上')) initialSnackName = "晚加餐";

  return {
    initialSnackName,
    fullHealthConditions,
    basePrompt: `
      用户档案:
      - 性别: ${user.gender}, 年龄: ${user.age}, 体重: ${user.weight}kg
      - 目标: ${user.goal} (${user.goalDescription || ''})
      - 训练: ${user.trainingHistory}, 时间: ${user.workoutTime}
      - 健康状况: ${fullHealthConditions || '无'}
      - TDEE: ${results.tdee} kcal, 目标热量: ${results.targetCalories} kcal
      - 宏量目标: P ${results.macros.protein}g, F ${results.macros.fats}g, C ${results.macros.carbs}g
    `
  };
};

// --- Module 1: Insight (Fast) ---
export const generateInsight = async (user: UserInput, results: CalculationResult): Promise<{ insight: string }> => {
  const ai = getAIClient();
  const { basePrompt } = buildUserContext(user, results);
  
  const prompt = `
    ${basePrompt}
    请作为一个高级运动营养师，用**一句话**（约50字）给出对该用户当前状况和目标的犀利洞察。重点在于“核心矛盾”或“成功关键”。
    
    Output JSON: { "insight": "..." }
  `;

  const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);
  return extractAndParseJson(response.text!, 'object');
};

// --- Module 2: Meal Plan (Heavy) ---
export const generateMealPlanOnly = async (user: UserInput, results: CalculationResult): Promise<{ mealPlan: Meal[] }> => {
  const ai = getAIClient();
  const { basePrompt, initialSnackName, fullHealthConditions } = buildUserContext(user, results);
  const foodDBContext = getFormattedFoodDBString();

  const prompt = `
    ${basePrompt}
    **任务：设计一日中式运动餐单**
    
    **关键规则：**
    1. **参考食物库**：${foodDBContext}
    2. **功能性食物应用 (强制)**：检测到用户健康状况（如缺钙、贫血、缺锌、痛风等），**必须**在餐单中包含对应的高效食物（如牛奶、猪肝、生蚝、黑巧克力、低嘌呤食物等）。
       - 缺钙/闭经 -> 必须含奶制品/豆制品/黑芝麻。
       - 缺铁/贫血 -> 必须含红肉/动物血/肝脏。
    3. **中式烹饪**：符合中国饮食习惯。
    4. **食谱隔离**：\`recipe\` 对象只能包含该餐的食材。
    5. **结构**：必须包含 4 餐： "早餐", "午餐", "晚餐", "${initialSnackName}"。
    
    Output JSON: 
    { 
      "mealPlan": [
        {
          "name": "早餐",
          "foodItems": "...",
          "description": "...",
          "vegetableRecommendation": "...",
          "macros": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 },
          "recipe": { 
             "ingredients": ["Item Name + Quantity (String Only)", "e.g. 燕麦 50g"], 
             "instructions": ["Step 1..."], 
             "tips": "..." 
          }
        },
        ...
      ] 
    }
  `;

  const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);
  return extractAndParseJson(response.text!, 'object');
};

// --- Module 3: Guidance (Medium) ---
export const generateGuidance = async (user: UserInput, results: CalculationResult): Promise<{ weeklyAdvice: string; supplements: string; recovery: string; healthAdvice: string }> => {
  const ai = getAIClient();
  const { basePrompt, fullHealthConditions } = buildUserContext(user, results);

  const prompt = `
    ${basePrompt}
    **任务：生成营养与恢复建议**
    
    要求：
    1. **补剂建议**：基于用户目标和健康状况（${fullHealthConditions}），给出科学补剂方案（剂量/时机）。
    2. **健康改善指南**：针对用户的健康问题（如消化差、高血脂、缺微量元素等），给出5R方案或特定饮食禁忌。
    3. **周饮食策略**：一周的备餐建议或循环策略。
    4. **恢复**：睡眠与压力管理。
    
    Output JSON:
    {
      "weeklyAdvice": "...",
      "supplements": "...",
      "recovery": "...",
      "healthAdvice": "..."
    }
  `;

  const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);
  return extractAndParseJson(response.text!, 'object');
};

// --- Legacy Wrapper (Deprecated but kept for backward compatibility if needed, though UI will verify) ---
export const generateComprehensivePlan = async (user: UserInput, results: CalculationResult): Promise<AIPlanData> => {
  // Parallel execution for speed
  const [insightData, mealData, guidanceData] = await Promise.all([
    generateInsight(user, results),
    generateMealPlanOnly(user, results),
    generateGuidance(user, results)
  ]);

  return {
    ...insightData,
    ...mealData,
    ...guidanceData
  };
};

// ... (Existing meal regeneration functions: regenerateMealPlan, regenerateSingleMeal, adjustSingleMeal, modifyMealPlan remain unchanged)
// 单独重新生成餐单 (返回 Meal[])
export const regenerateMealPlan = async (user: UserInput, results: CalculationResult): Promise<Meal[]> => {
  try {
    const ai = getAIClient();
    const timestamp = new Date().getTime(); // 增加时间戳防止缓存
    const foodDBContext = getFormattedFoodDBString();
    
    // Determine Initial Snack Name based on Workout Time for consistency
    let initialSnackName = "午加餐"; 
    if (user.workoutTime.includes('早晨')) {
      initialSnackName = "早加餐";
    } else if (user.workoutTime.includes('晚上')) {
      initialSnackName = "晚加餐";
    }
    
    // Construct full health condition string for context
    const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
    const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
    const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');

    const prompt = `
      Current Timestamp: ${timestamp}
      请为以下用户设计一套**全新的、纯正中式风格**的一日饮食餐单。
      
      目标热量: ${results.targetCalories} kcal
      宏量目标: 蛋白质 ${results.macros.protein}g, 脂肪 ${results.macros.fats}g, 碳水 ${results.macros.carbs}g
      用户偏好: ${user.goal}
      健康限制条件: ${fullHealthConditions || '无'}
      训练时间: ${user.workoutTime}
      
      **参考食物数据库 (估算营养用):**
      ${foodDBContext}
      
      **要求：**
      1. **中式烹饪**：符合中国习惯。
      2. **素菜与水果**：包含 \`vegetableRecommendation\` (推荐素菜) 和水果。
      3. **数据结构**：返回严格的 JSON 数组。
      4. **健康一致性**：严格遵守健康限制。
      5. **氨基酸互补**：优先设计包含“豆类+谷物+肉/蛋”组合的餐点。
      6. **食谱范围**：每餐 \`recipe\` 只能包含该餐的食材，严禁包含其他餐的食材。
      7. **功能性食物应用**：如果用户健康条件涉及缺钙/闭经、缺铁/贫血、缺锌、缺镁等，**必须**从数据库中选取对应的高含量食物（如牛奶、猪肝、生蚝、黑巧克力等）加入餐单。
      
      **餐单结构规则:**
      - 必须且只能包含 4 餐：**"早餐"**, **"午餐"**, **"晚餐"**, 和 **"${initialSnackName}"**。
      
      **OUTPUT FORMAT RULES:**
      - JSON Array Only.
      - No literal newlines in strings. Use \\n.

      示例:
      [
        {
          "name": "早餐",
          ...
          "recipe": { 
             "ingredients": ["Item Name + Quantity (String Only)"], 
             "instructions": ["Step 1..."], 
             "tips": "..." 
          }
        },
        {
          "name": "${initialSnackName}",
          ...
        }
      ]
    `;

    const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);

    const text = response.text;
    if (!text) throw new Error("无法生成新餐单");

    const parsedData = extractAndParseJson(text, 'array');
    
    // Extra safety: if it's wrapped in an object like { meals: [...] }, extract the array
    if (!Array.isArray(parsedData) && typeof parsedData === 'object') {
       const possibleArray = Object.values(parsedData).find(val => Array.isArray(val));
       if (possibleArray) return possibleArray as Meal[];
    }
    
    return parsedData as Meal[];

  } catch (error) {
    console.error("Regenerate Meal Plan Error:", error);
    throw error;
  }
};

// 单独刷新某一餐 (返回 Meal) - 用于“换一换”单个卡片
export const regenerateSingleMeal = async (
  user: UserInput, 
  currentMeal: Meal
): Promise<Meal> => {
  try {
    const ai = getAIClient();
    const timestamp = new Date().getTime();
    const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
    const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
    const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');

    const prompt = `
      Timestamp: ${timestamp}
      Current Meal Context: ${JSON.stringify(currentMeal)}
      User Profile: Goal=${user.goal}, Health=${fullHealthConditions}
      
      Task: Regenerate this specific meal ("${currentMeal.name}") with a NEW, distinct option.
      
      Nutritional Targets:
      - Calories: ~${currentMeal.macros.calories} kcal
      - Protein: ~${currentMeal.macros.protein}g
      
      **Culinary Guidelines (High Priority):**
      1. **Protein Complementation (氨基酸互补)**: HIGHLY ENCOURAGE combinations of Whole Grains + Legumes/Beans + Lean Meat/Egg in this single meal. (e.g., Rice + Tofu + Chicken, or Porridge + Beans + Egg). This improves protein bioavailability.
      2. **Chinese Cuisine**: Authentic cooking methods.
      3. **Variety**: Different ingredients from the original meal provided above.
      4. **Include Recipe**: Provide detailed \`recipe\` object. The recipe MUST ONLY use ingredients listed in this meal's 'foodItems'. Do NOT list ingredients for other meals.
      5. **Functional Food**: If user health requires specific nutrients (Ca, Fe, Zn, Mg), try to incorporate a relevant high-nutrient food from the database if appropriate for this meal type.
      
      **Constraints:**
      - Must respect health conditions: ${fullHealthConditions || 'None'}
      
      **Output:**
      - JSON Object ONLY (Meal structure).
      - No literal newlines in strings. Use \\n.
      
      Example:
      {
        "name": "${currentMeal.name}",
        "foodItems": "...",
        "description": "...",
        "vegetableRecommendation": "...",
        "macros": { "calories": ${currentMeal.macros.calories}, "protein": ${currentMeal.macros.protein}, "fat": ${currentMeal.macros.fat}, "carbs": ${currentMeal.macros.carbs} },
        "recipe": { 
           "ingredients": ["Item Name + Quantity (String Only)"], 
           "instructions": ["..."], 
           "tips": "..." 
        }
      }
    `;

    const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);
    const text = response.text;
    if (!text) throw new Error("无法刷新餐单");

    return extractAndParseJson(text, 'object') as Meal;

  } catch (error) {
    console.error("Regenerate Single Meal Error:", error);
    throw error;
  }
};

// 单独微调某一餐 (返回 Meal)
export const adjustSingleMeal = async (
  user: UserInput, 
  results: CalculationResult, 
  currentMeal: Meal, 
  adjustmentRequest: string
): Promise<Meal> => {
  try {
    const ai = getAIClient();
    const timestamp = new Date().getTime();
    const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
    const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
    const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');

    const prompt = `
      Timestamp: ${timestamp}
      Original Meal: ${JSON.stringify(currentMeal)}
      Modification: "${adjustmentRequest}"
      User Profile: Goal=${user.goal}, Health=${fullHealthConditions}
      
      Task:
      1. Modify "foodItems", "description", "vegetableRecommendation" based on request.
      2. Recalculate "macros".
      3. Return ONLY valid JSON object.
      4. No literal newlines in strings.
      5. **Update Recipe**: Ensure \`recipe\` matches modifications. The recipe ingredients must MATCH the new 'foodItems' exactly.
      
      JSON Output Example:
      {
        "name": "午餐",
        "foodItems": "...",
        "description": "...",
        "vegetableRecommendation": "...",
        "macros": { "calories": 500, "protein": 30, "fat": 15, "carbs": 60 },
        "recipe": { 
           "ingredients": ["Item Name + Quantity (String Only)"], 
           "instructions": ["..."] 
        }
      }
    `;

    const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);

    const text = response.text;
    if (!text) throw new Error("无法微调餐单");

    return extractAndParseJson(text, 'object') as Meal;

  } catch (error) {
    console.error("Adjust Meal Error:", error);
    throw error;
  }
};

// 新增: 修改餐单结构 (添加) 并重新平衡热量
export const modifyMealPlan = async (
  user: UserInput, 
  results: CalculationResult, 
  currentMeals: Meal[], 
  action: 'add',
  targetIndex?: number,
  specificMealName?: string,
  preferredFoodTypes: string[] = [] // Optional preferred food types
): Promise<Meal[]> => {
  try {
    const ai = getAIClient();
    const timestamp = new Date().getTime();
    
    const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
    const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
    const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');
    
    let workoutStrategy = "";
    if (user.workoutTime === WorkoutTime.Morning) workoutStrategy = "Morning Workout (Breakfast is Post-workout).";
    else if (user.workoutTime === WorkoutTime.Afternoon) workoutStrategy = "Afternoon Workout (Afternoon Snack is Post-workout).";
    else if (user.workoutTime === WorkoutTime.Evening) workoutStrategy = "Evening Workout (Dinner is Post-workout).";

    let mealsContext = JSON.parse(JSON.stringify(currentMeals)) as Meal[];
    let promptTask = "";

    const hasSpecificTypes = preferredFoodTypes && preferredFoodTypes.length > 0;

    const foodTypeConstraint = hasSpecificTypes 
      ? `
        STRICT INGREDIENT CONSTRAINT: The user explicitly requested ONLY the following food types for this meal: ${preferredFoodTypes.join(', ')}. 
        - YOU MUST NOT INCLUDE any food items that do not fall into these categories.
        - Example: If only "Fruit" is selected, do NOT include nuts, yogurt, or grains.
        - Example: If "Fruit" and "Nuts" are listed, you can include both.
        - If "Dairy" is not selected, do NOT include milk or yogurt.
      ` 
      : "";

    // Disable the general amino acid rule if the user has restricted the types, 
    // because "Fruit only" naturally contradicts "Grain + Legume + Meat".
    const aminoAcidInstruction = hasSpecificTypes 
        ? "" 
        : `7. **Amino Acid Complementation**: Whenever possible, combine Grains + Legumes + Animal Protein.`;

    if (action === 'add') {
       if (specificMealName) {
         promptTask = `
            USER ACTION: Ensure the meal plan includes "${specificMealName}".
            ${foodTypeConstraint}
            
            Current Active Meals List (JSON): ${JSON.stringify(mealsContext)}
            
            TASK:
            1. Check if a meal named "${specificMealName}" already exists in the list.
            2. **IF IT EXISTS**: Do NOT create a duplicate. Instead, REVISE the EXISTING "${specificMealName}" meal to match the ingredient constraints.
            3. **IF IT DOES NOT EXIST**: Create a new meal named "${specificMealName}".
            4. Adjust portion sizes of OTHER meals slightly to keep TOTAL Daily Calories at approx ${results.targetCalories} kcal.
            5. Ensure the new food/meal fits Chinese Cuisine.
            6. **Include Recipe**: The modified or new meal MUST have a valid \`recipe\` object. This recipe MUST only contain ingredients for THIS specific meal.
            ${aminoAcidInstruction}
         `;
       } else {
         promptTask = `
            USER ACTION: ADD a new meal (e.g., "加餐", "Pre-workout Snack", or "Supper").
            ${foodTypeConstraint}
            
            Current Active Meals List (JSON): ${JSON.stringify(mealsContext)}
            
            TASK:
            1. Add ONE new realistic Chinese meal option to the list.
            2. Reduce the portion sizes of existing meals slightly so the TOTAL Daily Calories remains constant at approx ${results.targetCalories} kcal.
            3. Ensure the new meal fits the Chinese Cuisine style.
            ${aminoAcidInstruction}
            5. **Include Recipe**: The new meal MUST have a \`recipe\` object. This recipe MUST only contain ingredients for THIS specific meal.
         `;
       }
    }

    const prompt = `
      Timestamp: ${timestamp}
      User Goal: ${user.goal}
      Daily Target: ${results.targetCalories} kcal (CRITICAL)
      Macros: P ${results.macros.protein}g, F ${results.macros.fats}g, C ${results.macros.carbs}g
      Health Constraints: ${fullHealthConditions || 'None'}
      Workout Context: ${workoutStrategy}

      ${promptTask}

      Output:
      - JSON Array of Meal objects ONLY.
      - No literal newlines in strings. Use \\n.

      Example Structure:
      [
        { 
          "name": "...", 
          "foodItems": "...", 
          "description": "...", 
          "vegetableRecommendation": "...", 
          "macros": { ... },
          "recipe": { 
             "ingredients": ["Item Name + Quantity (String Only)"], 
             "instructions": ["..."] 
          }
        }
      ]
    `;

    const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);
    const text = response.text;
    if (!text) throw new Error("无法修改餐单结构");

    const parsedData = extractAndParseJson(text, 'array');
    
    if (!Array.isArray(parsedData) && typeof parsedData === 'object') {
       const possibleArray = Object.values(parsedData).find(val => Array.isArray(val));
       if (possibleArray) return possibleArray as Meal[];
    }
    
    return parsedData as Meal[];

  } catch (error) {
    console.error("Modify Meal Plan Error:", error);
    throw error;
  }
};