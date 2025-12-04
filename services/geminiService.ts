import { GoogleGenAI } from "@google/genai";
import { UserInput, CalculationResult, AIPlanData, Meal } from "../types";
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
    // Strategy: Remove all control characters (0x00-0x1F) from the string. 
    // Valid JSON does not rely on newlines/tabs for syntax (they are just whitespace).
    // Note: This removes formatting newlines inside strings too, but prevents the crash.
    // We replace them with a single space to avoid concatenating words.
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
            "macros": { "calories": 400, "protein": 25, "fat": 10, "carbs": 50 }
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
      
      **参考食物数据库 (估算营养用):**
      ${foodDBContext}
      
      **要求：**
      1. **中式烹饪**：符合中国习惯。
      2. **素菜与水果**：包含 \`vegetableRecommendation\` (推荐素菜) 和水果。
      3. **数据结构**：返回严格的 JSON 数组。
      4. **健康一致性**：严格遵守健康限制（高血脂禁肥肉、高尿酸禁海鲜等）。
      5. **氨基酸互补**：优先设计包含“豆类+谷物+肉/蛋”组合的餐点，以提高营养利用率。
      
      **OUTPUT FORMAT RULES:**
      - JSON Array Only.
      - No literal newlines in strings. Use \\n.

      示例:
      [
        {
          "name": "早餐",
          "foodItems": "...",
          "description": "...",
          "vegetableRecommendation": "",
          "macros": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 }
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
        "macros": { "calories": ${currentMeal.macros.calories}, "protein": ${currentMeal.macros.protein}, "fat": ${currentMeal.macros.fat}, "carbs": ${currentMeal.macros.carbs} }
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
      
      JSON Output Example:
      {
        "name": "午餐",
        "foodItems": "...",
        "description": "...",
        "vegetableRecommendation": "...",
        "macros": { "calories": 500, "protein": 30, "fat": 15, "carbs": 60 }
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