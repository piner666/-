
export interface FoodItem {
  name: string;
  calories: number; // kcal per 100g (通常指可食部生重，除非特别标注)
  protein: number;  // grams
  fat: number;      // grams
  carbs: number;    // grams
  unit?: string;    // e.g., '100g' unless specified
}

// 默认的中式食物营养数据库 (Mock Data)
// 数据来源参考：中国食物成分表 (标准参考值)
export const defaultChineseFoodDB: FoodItem[] = [
  // ==================== 1. 主食与粗杂粮 ====================
  // 细粮
  { name: '米饭(蒸)', calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9 },
  { name: '馒头', calories: 223, protein: 7.0, fat: 1.1, carbs: 47.0 },
  { name: '面条(煮)', calories: 110, protein: 4.0, fat: 0.5, carbs: 23.0 },
  
  // 粗粮/杂粮 (推荐)
  { name: '糙米(生)', calories: 348, protein: 7.2, fat: 2.5, carbs: 74.0 },
  { name: '燕麦片', calories: 377, protein: 15.0, fat: 6.7, carbs: 61.6 },
  { name: '小米', calories: 361, protein: 9.0, fat: 3.1, carbs: 75.1 },
  { name: '荞麦面(干)', calories: 340, protein: 11.0, fat: 2.0, carbs: 70.0 },
  { name: '藜麦(生)', calories: 368, protein: 14.1, fat: 6.1, carbs: 64.2 },
  { name: '玉米(鲜)', calories: 112, protein: 4.0, fat: 1.2, carbs: 22.8 },
  
  // 根茎类主食
  { name: '红薯', calories: 86, protein: 1.6, fat: 0.2, carbs: 20.1 },
  { name: '紫薯', calories: 106, protein: 1.5, fat: 0.2, carbs: 25.0 },
  { name: '山药', calories: 57, protein: 1.9, fat: 0.2, carbs: 12.4 },
  { name: '芋头', calories: 81, protein: 2.2, fat: 0.2, carbs: 18.1 },
  { name: '土豆', calories: 77, protein: 2.0, fat: 0.2, carbs: 17.2 },

  // ==================== 2. 豆类 (植物蛋白/慢碳) ====================
  { name: '黄豆(干)', calories: 390, protein: 35.0, fat: 16.0, carbs: 34.0 },
  { name: '黑豆(干)', calories: 381, protein: 36.0, fat: 15.9, carbs: 33.3 },
  { name: '红豆/赤小豆', calories: 324, protein: 20.2, fat: 0.6, carbs: 63.4 },
  { name: '绿豆', calories: 329, protein: 21.6, fat: 0.8, carbs: 62.0 },
  { name: '鹰嘴豆(干)', calories: 364, protein: 19.0, fat: 6.0, carbs: 61.0 },
  { name: '扁豆(干)', calories: 353, protein: 25.8, fat: 1.1, carbs: 60.1 },
  { name: '腰豆/红芸豆', calories: 333, protein: 24.0, fat: 0.8, carbs: 60.0 },
  { name: '豆腐(北)', calories: 98, protein: 12.2, fat: 4.8, carbs: 1.5 },
  { name: '豆腐(南)', calories: 57, protein: 6.2, fat: 2.5, carbs: 2.4 },
  { name: '豆干', calories: 140, protein: 15.0, fat: 6.0, carbs: 5.0 },
  { name: '纳豆', calories: 212, protein: 18.0, fat: 11.0, carbs: 14.0 },

  // ==================== 3. 蔬菜类 (微量元素/纤维) ====================
  // 十字花科 (甲状腺/排毒关注)
  { name: '西兰花', calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6 },
  { name: '花菜/菜花', calories: 25, protein: 2.1, fat: 0.2, carbs: 4.6 },
  { name: '卷心菜/包菜', calories: 24, protein: 1.5, fat: 0.2, carbs: 3.6 },
  { name: '羽衣甘蓝', calories: 49, protein: 4.3, fat: 0.9, carbs: 8.8 },
  { name: '紫甘蓝', calories: 25, protein: 1.4, fat: 0.2, carbs: 5.3 },
  { name: '白萝卜', calories: 21, protein: 0.9, fat: 0.1, carbs: 5.0 },
  
  // 深绿色叶菜 (镁/叶酸)
  { name: '菠菜', calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6 },
  { name: '油麦菜', calories: 15, protein: 1.4, fat: 0.4, carbs: 2.1 },
  { name: '空心菜', calories: 20, protein: 2.2, fat: 0.3, carbs: 3.6 },
  { name: '芥蓝', calories: 22, protein: 2.8, fat: 0.4, carbs: 3.7 },
  { name: '茼蒿', calories: 24, protein: 1.9, fat: 0.3, carbs: 4.6 },
  
  // 红色/橙色蔬菜 (抗氧化)
  { name: '西红柿', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
  { name: '红甜椒', calories: 30, protein: 1.0, fat: 0.2, carbs: 6.0 },
  { name: '胡萝卜', calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6 },
  { name: '南瓜', calories: 26, protein: 1.0, fat: 0.1, carbs: 6.5 },
  
  // 富含硫的食物 (肝脏排毒)
  { name: '洋葱', calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3 },
  { name: '大蒜', calories: 128, protein: 6.4, fat: 0.5, carbs: 33.0 },
  { name: '韭菜', calories: 29, protein: 2.4, fat: 0.4, carbs: 5.2 },
  { name: '芦笋', calories: 20, protein: 2.2, fat: 0.1, carbs: 3.9 },
  
  // 菌藻类
  { name: '黑木耳(水发)', calories: 27, protein: 1.5, fat: 0.2, carbs: 6.0 },
  { name: '海带(鲜)', calories: 13, protein: 1.1, fat: 0.1, carbs: 2.8 },
  { name: '紫菜(干)', calories: 265, protein: 26.7, fat: 1.1, carbs: 48.3 },
  { name: '香菇(鲜)', calories: 26, protein: 2.2, fat: 0.3, carbs: 5.2 },
  { name: '平菇', calories: 20, protein: 1.9, fat: 0.3, carbs: 4.6 },
  { name: '金针菇', calories: 32, protein: 2.7, fat: 0.4, carbs: 6.0 },
  { name: '杏鲍菇', calories: 31, protein: 2.5, fat: 0.1, carbs: 6.3 },

  // ==================== 4. 肉类与禽蛋 (优质蛋白) ====================
  // 禽蛋
  { name: '鸡蛋(全蛋)', calories: 144, protein: 13.3, fat: 8.8, carbs: 2.8 },
  { name: '鸡蛋白', calories: 50, protein: 11.0, fat: 0.1, carbs: 1.0 },
  { name: '鸡胸肉', calories: 133, protein: 19.4, fat: 5.0, carbs: 2.5 },
  { name: '鸡腿(带皮)', calories: 181, protein: 18.0, fat: 11.0, carbs: 0.0 },
  { name: '鸡翅中', calories: 210, protein: 19.0, fat: 14.0, carbs: 0.0 },
  { name: '鸭胸肉', calories: 128, protein: 19.0, fat: 5.0, carbs: 0.0 },
  { name: '鸭肉(带皮)', calories: 240, protein: 15.5, fat: 19.7, carbs: 0.2 },
  { name: '鹅肉', calories: 251, protein: 17.9, fat: 19.9, carbs: 0.0 },
  { name: '鸽子肉', calories: 201, protein: 17.0, fat: 14.0, carbs: 0.0 },
  
  // 畜肉 (猪牛羊)
  { name: '瘦牛肉', calories: 106, protein: 20.2, fat: 2.3, carbs: 0.0 },
  { name: '黄牛肉', calories: 106, protein: 20.2, fat: 2.3, carbs: 0.0 },
  { name: '牛腱子', calories: 98, protein: 20.0, fat: 2.0, carbs: 0.0 },
  { name: '肥牛卷', calories: 330, protein: 14.0, fat: 30.0, carbs: 0.0 },
  
  { name: '瘦猪肉', calories: 143, protein: 20.3, fat: 6.2, carbs: 1.5 },
  { name: '五花肉', calories: 349, protein: 13.2, fat: 32.8, carbs: 0.0 },
  { name: '猪排骨', calories: 278, protein: 16.0, fat: 23.0, carbs: 0.0 },
  { name: '猪肉糜(半肥瘦)', calories: 330, protein: 15.0, fat: 30.0, carbs: 0.0 },
  
  { name: '羊腿肉', calories: 111, protein: 19.0, fat: 3.9, carbs: 0.0 },
  
  // ==================== 5. 海产品 (Omega-3/碘/锌) ====================
  // 鱼类
  { name: '三文鱼', calories: 139, protein: 19.8, fat: 6.3, carbs: 0.0 },
  { name: '鳕鱼', calories: 82, protein: 17.8, fat: 0.7, carbs: 0.0 },
  { name: '鲈鱼', calories: 105, protein: 18.6, fat: 3.4, carbs: 0.0 },
  { name: '带鱼', calories: 159, protein: 17.7, fat: 9.8, carbs: 0.0 },
  { name: '黄花鱼', calories: 97, protein: 17.7, fat: 2.5, carbs: 0.0 },
  
  // 虾蟹贝类
  { name: '基围虾', calories: 93, protein: 18.2, fat: 1.0, carbs: 0.0 },
  { name: '鱿鱼(鲜)', calories: 75, protein: 15.6, fat: 1.0, carbs: 0.0 },
  { name: '蛤蜊', calories: 62, protein: 10.0, fat: 1.0, carbs: 3.0 },
  { name: '花甲', calories: 62, protein: 10.8, fat: 1.1, carbs: 2.4 },
  { name: '花螺', calories: 92, protein: 16.0, fat: 1.2, carbs: 3.5 },
  { name: '生蚝/牡蛎', calories: 73, protein: 9.0, fat: 2.0, carbs: 4.0 },

  // ==================== 6. 水果 (低GI/抗氧化) ====================
  // 浆果类 (推荐)
  { name: '蓝莓', calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5 },
  { name: '草莓', calories: 32, protein: 1.0, fat: 0.2, carbs: 7.1 },
  { name: '树莓', calories: 52, protein: 1.2, fat: 0.6, carbs: 11.9 },
  { name: '桑葚', calories: 49, protein: 1.7, fat: 0.4, carbs: 12.9 },
  
  // 常见水果
  { name: '苹果', calories: 52, protein: 0.3, fat: 0.2, carbs: 13.8 },
  { name: '梨', calories: 51, protein: 0.4, fat: 0.2, carbs: 13.5 },
  { name: '橘子', calories: 44, protein: 0.9, fat: 0.1, carbs: 10.2 },
  { name: '葡萄', calories: 45, protein: 0.5, fat: 0.2, carbs: 10.3 },
  { name: '鲜枣/冬枣', calories: 125, protein: 3.2, fat: 0.3, carbs: 30.5 },
  { name: '猕猴桃', calories: 61, protein: 1.1, fat: 0.5, carbs: 14.7 },
  { name: '香蕉', calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  { name: '葡萄柚', calories: 33, protein: 0.7, fat: 0.2, carbs: 8.4 },
  { name: '牛油果', calories: 160, protein: 2.0, fat: 14.7, carbs: 8.5 },

  // ==================== 7. 油脂与坚果 ====================
  { name: '橄榄油', calories: 884, protein: 0.0, fat: 100.0, carbs: 0.0 },
  { name: '亚麻籽油', calories: 898, protein: 0.0, fat: 99.8, carbs: 0.0 },
  { name: '菜籽油', calories: 899, protein: 0.0, fat: 99.9, carbs: 0.0 },
  { name: '猪油', calories: 897, protein: 0.0, fat: 99.6, carbs: 0.0 },
  { name: '核桃', calories: 654, protein: 15.0, fat: 65.0, carbs: 13.7 },
  { name: '巴旦木/扁桃仁', calories: 579, protein: 21.0, fat: 50.0, carbs: 21.0 },
  { name: '奇亚籽', calories: 486, protein: 16.5, fat: 30.7, carbs: 42.1 },
  { name: '亚麻籽', calories: 534, protein: 18.0, fat: 42.0, carbs: 29.0 },
  { name: '南瓜籽', calories: 574, protein: 29.0, fat: 49.0, carbs: 15.0 }
];

export const getFoodDatabase = (): FoodItem[] => {
  if (typeof window === 'undefined') return defaultChineseFoodDB;
  
  // 尝试从 localStorage 获取自定义数据 (预留功能)
  try {
    const localData = localStorage.getItem('neurofit_food_db');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed)) {
        return [...defaultChineseFoodDB, ...parsed];
      }
    }
  } catch (e) {
    console.warn("Failed to load local food DB", e);
  }
  
  return defaultChineseFoodDB;
};

// 格式化数据库为 Prompt 字符串
export const getFormattedFoodDBString = (): string => {
  const db = getFoodDatabase();
  return db.map(f => `${f.name}:${f.calories}kcal`).join(';');
};
