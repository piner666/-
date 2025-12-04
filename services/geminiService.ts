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

// 辅助函数：清洗 JSON 字符串
const cleanJsonString = (text: string): string => {
  // 移除 Markdown 代码块标记 (```json ... ```)
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // 寻找最外层的括号，判断是对象还是数组
  const firstCurly = cleaned.indexOf('{');
  const firstSquare = cleaned.indexOf('[');
  
  let start = -1;
  let end = -1;
  
  // 如果先遇到 { 说明是对象
  if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
    start = firstCurly;
    end = cleaned.lastIndexOf('}');
  } 
  // 如果先遇到 [ 说明是数组
  else if (firstSquare !== -1) {
    start = firstSquare;
    end = cleaned.lastIndexOf(']');
  }
  
  if (start !== -1 && end !== -1) {
    return cleaned.substring(start, end + 1);
  }
  
  return cleaned;
};

// 辅助函数：明确提取 JSON 部分 (更强壮的版本)
const extractJson = (text: string, type: 'array' | 'object' = 'object'): string => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  if (type === 'array') {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      return cleaned.substring(start, end + 1);
    }
  } else {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return cleaned.substring(start, end + 1);
    }
  }
  return cleaned;
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

    const prompt = `
      扮演一位世界级的运动营养师和功能医学专家。请根据用户数据计算结果，生成一份详细的结构化建议。
      
      用户档案:
      - 性别: ${user.gender}, 年龄: ${user.age}, 体重: ${user.weight}kg
      ${targetString}
      - 训练经验: ${user.trainingHistory}
      - 压力/睡眠: ${user.appetiteStress}/10, ${user.sleepQuality}/10
      - 健康筛查(亚健康状态): ${user.healthConditions.join(', ')}
      
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
      6. **一致性 (Consistency) - 极重要**：
         - **餐单内容必须完全贯彻健康指南中的建议**。
         - AI 将严格检查餐单中的每一项食物是否符合上述健康限制。
         - 例如：如果指南建议“增加低脂乳制品”，餐单中必须包含脱脂牛奶或酸奶。
         - 例如：如果指南建议“限制饱和脂肪”，餐单中绝对不能出现红烧肉、肥羊等高脂肉类。
         - 例如：如果用户是“高尿酸”，餐单中绝对不能出现海鲜、内脏或肉汤。
      7. **周饮食策略**：请提供一周的饮食规划策略（约200字）。包括：
         - **食材采购重点**：基于推荐餐单列出核心采购清单。
         - **批量备餐 (Meal Prep)**：哪些食材可以周末提前处理（如煮好糙米饭、腌制鸡胸肉）。
         - **灵活调整**：外食如何选择（如便利店或餐厅点餐技巧）。

      请严格按照以下 JSON 格式返回 (不要使用 Markdown 代码块，直接返回 JSON 字符串):
      {
        "insight": "一段简短有力的教练洞察，总结代谢状态和核心策略（约50字）。",
        "mealPlan": [
          {
            "name": "早餐",
            "foodItems": "食物名称及分量 (如: 小米粥 1碗, 水煮蛋 2个, 苹果 1个)",
            "description": "简短的烹饪或搭配建议 (中式风格)",
            "vegetableRecommendation": "", 
            "macros": { "calories": 400, "protein": 25, "fat": 10, "carbs": 50 }
          },
          {
            "name": "午餐",
            "foodItems": "食物名称及分量",
            "description": "中式烹饪建议",
            "vegetableRecommendation": "推荐素菜：蒜蓉西兰花、凉拌海带丝",
            "macros": { "calories": 600, "protein": 40, "fat": 20, "carbs": 60 }
          },
          {
            "name": "晚餐",
            "foodItems": "食物名称及分量",
            "description": "中式烹饪建议",
            "vegetableRecommendation": "推荐素菜：清炒油麦菜、冬瓜汤",
            "macros": { "calories": 500, "protein": 35, "fat": 15, "carbs": 50 }
          },
          {
            "name": "加餐",
            "foodItems": "食物名称及分量 (包含水果)",
            "description": "健康零食建议",
            "vegetableRecommendation": "",
            "macros": { "calories": 200, "protein": 10, "fat": 5, "carbs": 20 }
          }
        ],
        "weeklyAdvice": "针对一周饮食安排的策略建议。必须包含采购清单和备餐技巧。使用 Markdown 格式。",
        "supplements": "基于'运动营养程序架构'的补剂建议，包含剂量范围。使用 Markdown 列表格式。",
        "recovery": "针对压力(${user.appetiteStress})和睡眠(${user.sleepQuality})的恢复建议。使用 Markdown 列表格式。",
        "healthAdvice": "针对亚健康状态（${user.healthConditions.join(', ')}）的详细建议。使用 Markdown 格式。无则留空。"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 未返回数据");
    
    // Use object extraction for the main plan
    const cleanedText = extractJson(text, 'object');

    try {
      return JSON.parse(cleanedText) as AIPlanData;
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw text:", text);
      throw new Error("无法解析 AI 返回的数据格式");
    }

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
    
    const prompt = `
      Current Timestamp: ${timestamp} (Please ignore this, just for randomness)
      请为以下用户设计一套**全新的、纯正中式风格**的一日饮食餐单。这必须与之前的餐单完全不同。
      
      目标热量: ${results.targetCalories} kcal
      宏量目标: 蛋白质 ${results.macros.protein}g, 脂肪 ${results.macros.fats}g, 碳水 ${results.macros.carbs}g
      用户偏好: ${user.goal}
      健康限制条件: ${user.healthConditions.join(', ')}
      
      **参考食物数据库 (估算营养用):**
      ${foodDBContext}
      
      **要求：**
      1. **中式烹饪**：食材和烹饪方式必须符合中国家庭饮食习惯（如：清蒸鱼、蒜蓉炒菜、杂粮饭、炖汤）。避免西式做法。
      2. **素菜与水果**：午餐和晚餐必须包含 \`vegetableRecommendation\` 字段，推荐 2-3 个具体的素菜。早餐或加餐中需包含水果。
      3. **数据结构**：返回严格的 JSON 数组格式，包含 \`vegetableRecommendation\` 和 \`macros\`。
      4. **健康一致性 (绝对严格)**：
         - **高血脂**：禁止红肉高脂部位、内脏、油炸。推荐深海鱼、去皮禽肉。
         - **高尿酸**：禁止海鲜（贝类、深海鱼需谨慎）、肉汤、内脏。推荐低脂奶、鸡蛋作为蛋白来源。
         - **消化问题**：食物需软烂易消化，避免粗纤维过多或辛辣。
      
      格式示例 (JSON Array Only):
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("无法生成新餐单");

    // Use array extraction for the meal plan list
    const cleanedText = extractJson(text, 'array');
    
    const parsedData = JSON.parse(cleanedText);
    
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