
import { GoogleGenAI } from "@google/genai";
import { UserInput, CalculationResult, AIPlanData, Meal } from "../types";

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
    
    const prompt = `
      扮演一位世界级的运动营养师和功能医学专家。请根据用户数据计算结果，生成一份详细的结构化建议。
      
      用户档案:
      - 性别: ${user.gender}, 年龄: ${user.age}, 体重: ${user.weight}kg
      - 目标: ${user.goal} (${results.timeToGoal})
      - 训练经验: ${user.trainingHistory}
      - 压力/睡眠: ${user.appetiteStress}/10, ${user.sleepQuality}/10
      - 健康筛查(亚健康状态): ${user.healthConditions.join(', ')}
      
      计算指标:
      - TDEE: ${results.tdee} kcal
      - 目标热量: ${results.targetCalories} kcal
      - 宏量营养素: 蛋白质 ${results.macros.protein}g, 脂肪 ${results.macros.fats}g, 碳水 ${results.macros.carbs}g
      
      **关键要求：**
      1. **饮食风格必须为典型的中式饮食（Chinese Cuisine）**。使用蒸、煮、炖、快炒、凉拌等中式烹饪方式。食材选用中国市场常见的蔬菜（如青菜、西兰花、冬瓜）、肉类（鸡胸、瘦牛肉、鱼、虾）和主食（米饭、糙米、红薯、玉米、面条）。**严禁**出现不符合国人习惯的西式冷沙拉、奶酪三明治等。
      2. **蔬菜摄入**：午餐和晚餐必须额外明确推荐 2-3 种具体的素菜（如：清炒时蔬、凉拌木耳）。
      3. **水果摄入**：早餐或加餐中必须包含水果推荐。
      4. 补剂建议必须包含具体的科学推荐剂量范围（例如：3-5g/天）。
      5. **健康指南**：
         - 如果有消化系统亚健康，必须基于功能医学 **5R 方案** (Remove, Replace, Reinoculate, Repair, Rebalance) 给出建议。
         - 如果有 **高血脂/胆固醇偏高**，请在饮食建议中明确指出：限制饱和脂肪摄入（如肥肉、奶油），严格控制胆固醇，增加可溶性纤维（如燕麦、豆类），并推荐富含 Omega-3 的食物（如深海鱼）。
         - 如果有 **高尿酸/痛风风险**，请在饮食建议中明确指出：严格避免含糖饮料（尤其是果糖），限制肉类摄入量（包括瘦肉、内脏、海鲜等高嘌呤食物），建议增加低脂乳制品、蔬菜摄入，并强调每日充足饮水。

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
        "supplements": "基于'运动营养程序架构'的补剂建议，包含剂量范围。使用 Markdown 列表格式。",
        "recovery": "针对压力(${user.appetiteStress})和睡眠(${user.sleepQuality})的恢复建议。使用 Markdown 列表格式。",
        "healthAdvice": "针对亚健康状态（${user.healthConditions.join(', ')}）的详细建议 (避免、饮食、补剂)。使用 Markdown 格式。无则留空。"
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
    
    const prompt = `
      Current Timestamp: ${timestamp} (Please ignore this, just for randomness)
      请为以下用户设计一套**全新的、纯正中式风格**的一日饮食餐单。这必须与之前的餐单完全不同。
      
      目标热量: ${results.targetCalories} kcal
      宏量目标: 蛋白质 ${results.macros.protein}g, 脂肪 ${results.macros.fats}g, 碳水 ${results.macros.carbs}g
      用户偏好: ${user.goal}
      
      **要求：**
      1. **中式烹饪**：食材和烹饪方式必须符合中国家庭饮食习惯（如：清蒸鱼、蒜蓉炒菜、杂粮饭、炖汤）。避免西式做法。
      2. **素菜与水果**：午餐和晚餐必须包含 \`vegetableRecommendation\` 字段，推荐 2-3 个具体的素菜。早餐或加餐中需包含水果。
      3. **数据结构**：返回严格的 JSON 数组格式，包含 \`vegetableRecommendation\` 和 \`macros\`。
      
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
