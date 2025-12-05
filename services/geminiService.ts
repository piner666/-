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
  // 1. Remove Markdown code blocks
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // 2. Extract the relevant JSON block
  const firstCurly = cleaned.indexOf('{');
  const firstSquare = cleaned.indexOf('[');
  
  let start = -1;
  let end = -1;
  
  // Decide whether to look for object or array based on hint or first occurrence
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

  // 3. Try parsing
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("JSON parse failed, attempting sanitation:", e);
    
    // 4. Sanitize strategy for "Bad control character" (typically unescaped newlines in strings)
    const sanitized = cleaned.replace(/[\x00-\x1F]+/g, " ");
    
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error("Sanitized JSON parse failed:", e2);
      throw new Error("无法解析 AI 返回的数据格式 (JSON Error)");
    }
  }
};


// 生成完整的结构化计划
export const generateComprehensivePlan = async (user: UserInput, results: CalculationResult): Promise<AIPlanData> => {
  try {
    const ai = getAIClient();
    const foodDBContext = getFormattedFoodDBString();
    
    // Determine Initial Snack Name based on Workout Time
    let initialSnackName = "午加餐"; // Default to Afternoon Snack
    if (user.workoutTime.includes('早晨')) {
      initialSnackName = "早加餐"; // Morning Workout -> Morning Snack (Post-workout)
    } else if (user.workoutTime.includes('晚上')) {
      initialSnackName = "晚加餐"; // Evening Workout -> Evening Snack
    }
    // Afternoon workout or Rest day -> defaults to Afternoon Snack "午加餐"

    // Construct target string
    const targetString = `
      - 主要目标: ${user.goal}
      - 详细描述: ${user.goalDescription || '无'}
      - 具体量化: ${user.targetWeight ? `目标体重 ${user.targetWeight}kg` : ''}${user.targetDurationWeeks ? ` (用户计划 ${user.targetDurationWeeks} 周达成)` : ''}
    `;

    // Construct Health Conditions String
    const predefinedHealth = user.healthConditions.filter(c => c !== '无').join(', ');
    const customHealth = user.customHealthCondition ? user.customHealthCondition : '';
    const fullHealthConditions = [predefinedHealth, customHealth].filter(Boolean).join('; ');

    const prompt = `
      扮演一位世界级的运动营养师和功能医学专家。请根据用户数据计算结果，生成一份详细的结构化建议。
      
      用户档案:
      - 性别: ${user.gender}, 年龄: ${user.age}, 体重: ${user.weight}kg
      ${targetString}
      - 训练经验: ${user.trainingHistory}
      - 训练时间: ${user.workoutTime} (Suggested Snack: ${initialSnackName})
      - 压力/睡眠: ${user.appetiteStress}/10, ${user.sleepQuality}/10
      - 健康筛查(亚健康状态/其他): ${fullHealthConditions || '无'}
      
      计算指标:
      - TDEE: ${results.tdee} kcal
      - 目标热量: ${results.targetCalories} kcal
      - 预计达成周期: ${results.timeToGoal}
      - 预期每周变化: ${results.weeklyChange}
      - 宏量营养素: 蛋白质 ${results.macros.protein}g, 脂肪 ${results.macros.fats}g, 碳水 ${results.macros.carbs}g
      
      **参考食物数据库 (每100g参考值):**
      ${foodDBContext}
      *(请在设计餐单和计算每餐营养时，优先参考上述数据库中的数值进行估算，确保总热量和宏量营养素与目标接近)*
      
      **关键要求：**
      1. **饮食风格必须为典型的中式饮食（Chinese Cuisine）**。使用蒸、煮、炖、快炒、凉拌等中式烹饪方式。食材选用中国市场常见的蔬菜（如青菜、西兰花、冬瓜）、肉类（鸡胸、瘦牛肉、鱼、虾）和主食（米饭、糙米、红薯、玉米、面条）。**严禁**出现不符合国人习惯的西式冷沙拉、奶酪三明治等。
      2. **蔬菜摄入**：午餐和晚餐必须额外明确推荐 2-3 种具体的素菜（如：清炒时蔬、凉拌木耳）。
      3. **水果摄入**：早餐或加餐中必须包含水果推荐。
      4. 补剂建议必须包含具体的科学推荐剂量范围（例如：3-5g/天）。
      5. **健康指南 (强约束)**：
         - 如果有 **消化系统亚健康**，必须基于功能医学 **5R 方案** (Remove, Replace, Reinoculate, Repair, Rebalance) 给出建议。餐单中避免难以消化食物。
         - 如果有 **高血脂/胆固醇偏高**，请在饮食建议中明确指出：限制饱和脂肪（如肥肉、奶油）和胆固醇的摄入，建议增加富含 Omega-3 的食物（如深海鱼）和可溶性纤维。**餐单中严禁出现五花肉、肥牛等高脂肉类**。
         - 如果有 **高尿酸/痛风风险**，请在饮食建议中明确指出：严格避免含糖饮料（尤其是果糖），限制肉类总体摄入量（特别是瘦肉、内脏、海鲜），并**强烈建议增加低脂乳制品**摄入。**餐单中严禁出现海鲜、内脏、浓肉汤**。
      6. **特定营养素缺乏处理**：如果“健康筛查”中包含了用户自定义的输入（例如：缺锌、缺铁、缺钙等），你必须在餐单中**显式推荐**富含该营养素的食物（例如缺锌推荐牡蛎、瘦肉；缺铁推荐红肉、动物血等），并在补剂建议中给出具体的补充方案。
      7. **一致性 (Consistency) - 极重要**：
         - **餐单内容必须完全贯彻健康指南中的建议**。
         - AI 将严格检查餐单中的每一项食物是否符合上述健康限制。
      8. **食物利用率优化（氨基酸互补）**：在设计餐单时，请特别注意**提高蛋白质利用率**。尝试在同一餐中搭配**全谷物（如糙米、燕麦）+ 豆类（如豆腐、红豆）+ 适量肉/蛋**。这种混合搭配能实现氨基酸互补，显著提升蛋白质的生物价。
      9. **包含食谱 (重要)**：每餐必须包含 \`recipe\` 对象，提供具体的食材清单（ingredients）和烹饪步骤（instructions）。
      
      **餐单结构规则 (严格):**
      - 餐单必须且只能包含 4 餐：**"早餐"**, **"午餐"**, **"晚餐"**, 和 **"${initialSnackName}"**。
      - **不要**生成名为 "加餐" 的通用餐点，必须使用上面指定的具体名称（"${initialSnackName}"）。
      
      **周饮食策略**：请提供一周的饮食规划策略（约200字）。
      
      **OUTPUT FORMAT RULES (STRICT):**
      - Return RAW JSON only.
      - **Do NOT use literal control characters (newlines, tabs) inside string values.**
      - Use "\\n" for line breaks within strings.
      - Ensure the JSON is valid and parseable.

      JSON Structure:
      {
        "insight": "一段简短有力的教练洞察...",
        "mealPlan": [
          {
            "name": "早餐",
            "foodItems": "...",
            "description": "...",
            "vegetableRecommendation": "", 
            "macros": { "calories": 400, "protein": 25, "fat": 10, "carbs": 50 },
            "recipe": {
               "ingredients": ["燕麦 50g", "牛奶 200ml"],
               "instructions": ["1. ...", "2. ..."],
               "tips": "..."
            }
          },
          {
            "name": "${initialSnackName}",
            "foodItems": "...",
            ...
          },
          ...
        ],
        "weeklyAdvice": "...",
        "supplements": "...",
        "recovery": "...",
        "healthAdvice": "..."
      }
    `;

    const response = await generateContentWithRetry(ai, 'gemini-2.5-flash', prompt);

    const text = response.text;
    if (!text) throw new Error("AI 未返回数据");
    
    return extractAndParseJson(text, 'object') as AIPlanData;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

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
      6. **包含食谱**：每餐必须包含 \`recipe\` 对象。
      
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
      4. **Include Recipe**: Provide detailed \`recipe\` object.
      
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
        "recipe": { "ingredients": ["..."], "instructions": ["..."], "tips": "..." }
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
      5. **Update Recipe**: Ensure \`recipe\` matches modifications.
      
      JSON Output Example:
      {
        "name": "午餐",
        "foodItems": "...",
        "description": "...",
        "vegetableRecommendation": "...",
        "macros": { "calories": 500, "protein": 30, "fat": 15, "carbs": 60 },
        "recipe": { "ingredients": ["..."], "instructions": ["..."] }
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
  specificMealName?: string
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

    if (action === 'add') {
       if (specificMealName) {
         promptTask = `
            USER ACTION: Ensure the meal plan includes "${specificMealName}".
            
            Current Active Meals List (JSON): ${JSON.stringify(mealsContext)}
            
            TASK:
            1. Check if a meal named "${specificMealName}" already exists in the list.
            2. **IF IT EXISTS**: Do NOT create a duplicate. Instead, ADD one complementary food item to the EXISTING "${specificMealName}" meal to increase its portion/variety.
            3. **IF IT DOES NOT EXIST**: Create a new meal named "${specificMealName}".
            4. Adjust portion sizes of OTHER meals slightly to keep TOTAL Daily Calories at approx ${results.targetCalories} kcal.
            5. Ensure the new food/meal fits Chinese Cuisine.
            6. **Include Recipe**: The modified or new meal MUST have a valid \`recipe\` object.
         `;
       } else {
         promptTask = `
            USER ACTION: ADD a new meal (e.g., "加餐", "Pre-workout Snack", or "Supper").
            
            Current Active Meals List (JSON): ${JSON.stringify(mealsContext)}
            
            TASK:
            1. Add ONE new realistic Chinese meal option to the list.
            2. Reduce the portion sizes of existing meals slightly so the TOTAL Daily Calories remains constant at approx ${results.targetCalories} kcal.
            3. Ensure the new meal fits the Chinese Cuisine style.
            4. **Amino Acid Complementation**: The new meal MUST, whenever possible, combine **Grains + Legumes + Animal Protein**.
            5. **Include Recipe**: The new meal MUST have a \`recipe\` object.
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
          "recipe": { "ingredients": ["..."], "instructions": ["..."] }
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