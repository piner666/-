import React, { useEffect, useState } from 'react';
import { UserInput, CalculationResult, AIPlanData, SubHealthCondition, Meal } from '../types';
import { calculateNutrition } from '../utils/calculations';
import { generateComprehensivePlan, regenerateMealPlan, regenerateSingleMeal, adjustSingleMeal, modifyMealPlan } from '../services/geminiService';
import { defaultChineseFoodDB, FoodItem } from '../data/foodDatabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Brain, Flame, Utensils, Zap, Clock, TrendingUp, AlertCircle, Sparkles, RefreshCw, Pill, Moon, Coffee, Stethoscope, Wheat, Calendar, CheckCircle, Edit2, Check, X, AlertTriangle, Droplet, Wind, Leaf, Activity, PlusCircle, BookOpen, ChefHat, Search, ArrowRightLeft, Sunrise, Sun } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  userData: UserInput;
  onReset: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b']; // Protein (Blue), Fat (Green), Carbs (Orange)
const MEAL_ORDER = ['早餐', '早加餐', '午餐', '午加餐', '晚餐', '晚加餐'];

const ResultsDashboard: React.FC<Props> = ({ userData, onReset }) => {
  const [results, setResults] = useState<CalculationResult | null>(null);
  
  // AI Data States
  const [aiData, setAiData] = useState<AIPlanData | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMealRefresh, setLoadingMealRefresh] = useState(false);
  const [aiError, setAiError] = useState(false);

  // Meal Adjustment States
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [refreshingMealIndex, setRefreshingMealIndex] = useState<number | null>(null);
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('');
  const [isAdjustingMeal, setIsAdjustingMeal] = useState(false);
  
  // Add Meal Modal State
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);

  // Recipe View State
  const [viewingRecipeIndex, setViewingRecipeIndex] = useState<number | null>(null);

  // Food Detail Modal State
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<{
    originalText: string;
    dbMatch: FoodItem | undefined;
    mealIndex: number;
  } | null>(null);

  useEffect(() => {
    const calc = calculateNutrition(userData);
    setResults(calc);

    const initAI = async () => {
      if (!process.env.API_KEY) {
        console.warn("无 API Key");
        return;
      }
      setLoadingInitial(true);
      setAiError(false);
      setAiData(null); // Clear previous data
      try {
        const data = await generateComprehensivePlan(userData, calc);
        setAiData(data);
      } catch (err) {
        console.error("AI Fetch Error", err);
        setAiError(true);
      } finally {
        setLoadingInitial(false);
      }
    };

    initAI();
  }, [userData]);

  // Sort meals logic
  const sortMeals = (meals: Meal[]) => {
    return [...meals].sort((a, b) => {
      const indexA = MEAL_ORDER.indexOf(a.name);
      const indexB = MEAL_ORDER.indexOf(b.name);
      // If not in list, put at end but preserve relative order if possible or just push to end
      const valA = indexA === -1 ? 99 : indexA;
      const valB = indexB === -1 ? 99 : indexB;
      return valA - valB;
    });
  };

  const handleSwapMeal = async () => {
    if (!results) return;
    setLoadingMealRefresh(true);
    try {
      const newMealPlan = await regenerateMealPlan(userData, results);
      if (aiData) {
        setAiData({ ...aiData, mealPlan: newMealPlan });
      }
    } catch (err) {
      alert("刷新餐单失败，请重试");
    } finally {
      setLoadingMealRefresh(false);
    }
  };

  const handleRefreshSingleMeal = async (index: number) => {
    if (!userData || !results || !aiData) return;
    
    setRefreshingMealIndex(index);
    try {
      // Because we sort meals for display, we need to find the correct meal in the original array
      // or just work with the sorted object reference if possible.
      // The easiest way is to find the meal by unique properties or reference in the original array.
      // Since `sortMeals` creates a new array, the objects inside are references.
      const sortedMeals = sortMeals(aiData.mealPlan);
      const targetMeal = sortedMeals[index];
      
      // Find index in original array
      const realIndex = aiData.mealPlan.findIndex(m => m === targetMeal);
      
      if (realIndex === -1) return;

      const newMeal = await regenerateSingleMeal(userData, targetMeal);
      
      const newPlan = [...aiData.mealPlan];
      newPlan[realIndex] = newMeal;
      
      setAiData({
        ...aiData,
        mealPlan: newPlan
      });
    } catch (err) {
      console.error(err);
      alert("刷新该餐单失败，请重试");
    } finally {
      setRefreshingMealIndex(null);
    }
  };

  const handleAdjustMeal = async (index: number) => {
    if (!results || !aiData || !adjustmentPrompt.trim()) return;
    
    setIsAdjustingMeal(true);
    try {
      const sortedMeals = sortMeals(aiData.mealPlan);
      const targetMeal = sortedMeals[index];
      const realIndex = aiData.mealPlan.findIndex(m => m === targetMeal);

      if (realIndex === -1) return;

      const updatedMeal = await adjustSingleMeal(userData, results, targetMeal, adjustmentPrompt);
      const newPlan = [...aiData.mealPlan];
      newPlan[realIndex] = updatedMeal;
      setAiData({ ...aiData, mealPlan: newPlan });
      setEditingMealIndex(null);
      setAdjustmentPrompt('');
    } catch (err) {
      alert("调整餐单失败，请重试");
    } finally {
      setIsAdjustingMeal(false);
    }
  };

  const handleAddMealOption = async (mealType: string) => {
    if (!aiData || !results) return;
    setIsAddMealModalOpen(false); // Close modal first
    setLoadingMealRefresh(true);
    try {
      const newPlan = await modifyMealPlan(userData, results, aiData.mealPlan, 'add', undefined, mealType);
      setAiData({ ...aiData, mealPlan: newPlan });
    } catch (err) {
      console.error(err);
      alert("添加失败，请重试");
    } finally {
      setLoadingMealRefresh(false);
    }
  };

  const cancelEdit = () => {
    setEditingMealIndex(null);
    setAdjustmentPrompt('');
  };

  // Helper to find food in DB
  const findFoodInDB = (text: string): FoodItem | undefined => {
    // Clean the text: remove numbers, units, brackets
    const keyword = text.replace(/[\d\.]+[kgml碗个勺g]+/gi, '').replace(/[()（）]/g, '').trim();
    if (!keyword) return undefined;
    
    // Fuzzy search
    return defaultChineseFoodDB.find(
      item => item.name.includes(keyword) || keyword.includes(item.name)
    );
  };

  const handleFoodClick = (text: string, mealIndex: number) => {
    const match = findFoodInDB(text);
    setSelectedFoodDetail({
      originalText: text,
      dbMatch: match,
      mealIndex: mealIndex
    });
  };

  const handleReplaceFood = () => {
    if (!selectedFoodDetail) return;
    
    const { mealIndex, originalText } = selectedFoodDetail;
    
    // Close modal
    setSelectedFoodDetail(null);
    
    // Open edit mode
    setEditingMealIndex(mealIndex);
    
    // Pre-fill prompt
    setAdjustmentPrompt(`请把 "${originalText}" 替换成其他营养价值类似的食材。`);
  };

  if (!results) return <div className="p-12 text-center text-slate-500">正在计算营养数据...</div>;

  // Calculate percentages based on calories
  const proteinPct = Math.round((results.macros.protein * 4 / results.targetCalories) * 100);
  const fatPct = Math.round((results.macros.fats * 9 / results.targetCalories) * 100);
  const carbPct = Math.round((results.macros.carbs * 4 / results.targetCalories) * 100);

  const macroData = [
    { name: '蛋白质', value: results.macros.protein, pct: proteinPct },
    { name: '脂肪', value: results.macros.fats, pct: fatPct },
    { name: '碳水', value: results.macros.carbs, pct: carbPct },
  ];

  // Logic to determine if health conditions are present (including custom input)
  const hasStandardConditions = userData.healthConditions.length > 0 && !userData.healthConditions.includes(SubHealthCondition.None);
  const hasCustomCondition = !!userData.customHealthCondition && userData.customHealthCondition.trim().length > 0;
  const hasAnyHealthConditions = hasStandardConditions || hasCustomCondition;
  
  // Health Tag Configuration Helper
  const getHealthTagConfig = (condition: SubHealthCondition) => {
    switch (condition) {
      case SubHealthCondition.HighCholesterol:
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Droplet size={14} />, label: '血脂关注' };
      case SubHealthCondition.HighUricAcid:
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertTriangle size={14} />, label: '尿酸预警' };
      case SubHealthCondition.Digestive:
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Leaf size={14} />, label: '消化系统' };
      case SubHealthCondition.Liver:
        return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Activity size={14} />, label: '肝功能' };
      case SubHealthCondition.Kidney:
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Activity size={14} />, label: '肾功能' };
      case SubHealthCondition.Adrenal:
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Zap size={14} />, label: '肾上腺' };
      case SubHealthCondition.Thyroid:
        return { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: <Wind size={14} />, label: '甲状腺' };
      case SubHealthCondition.FemaleGonad:
        return { color: 'bg-pink-100 text-pink-700 border-pink-200', icon: <Activity size={14} />, label: '女性调理' };
      case SubHealthCondition.MaleGonad:
        return { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Activity size={14} />, label: '男性调理' };
      default:
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Activity size={14} />, label: condition };
    }
  };

  // Prepare Sorted Meals for display
  const sortedMeals = aiData?.mealPlan ? sortMeals(aiData.mealPlan) : [];

  return (
    <div className="space-y-8 animate-fadeIn pb-12 relative">
      
      {/* Add Meal Selection Modal */}
      {isAddMealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full relative border border-slate-100 overflow-hidden">
            <button 
              onClick={() => setIsAddMealModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"
            >
              <X size={16} className="text-slate-600" />
            </button>
            
            <div className="p-6">
               <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">添加哪一顿加餐？</h3>
               <div className="space-y-3">
                 <button 
                   onClick={() => handleAddMealOption('早加餐')}
                   className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
                 >
                   <div className="p-2 bg-amber-100 text-amber-600 rounded-lg group-hover:bg-amber-200 mr-4">
                     <Sunrise size={24} />
                   </div>
                   <div className="text-left">
                     <span className="block font-bold text-slate-700 group-hover:text-amber-800">早加餐</span>
                     <span className="text-xs text-slate-400">早餐与午餐之间</span>
                   </div>
                 </button>

                 <button 
                   onClick={() => handleAddMealOption('午加餐')}
                   className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all group"
                 >
                   <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-200 mr-4">
                     <Sun size={24} />
                   </div>
                   <div className="text-left">
                     <span className="block font-bold text-slate-700 group-hover:text-orange-800">午加餐</span>
                     <span className="text-xs text-slate-400">午餐与晚餐之间</span>
                   </div>
                 </button>

                 <button 
                   onClick={() => handleAddMealOption('晚加餐')}
                   className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                 >
                   <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 mr-4">
                     <Moon size={24} />
                   </div>
                   <div className="text-left">
                     <span className="block font-bold text-slate-700 group-hover:text-indigo-800">晚加餐</span>
                     <span className="text-xs text-slate-400">晚餐之后</span>
                   </div>
                 </button>
               </div>
               <p className="text-xs text-slate-400 text-center mt-6">
                 * 若该餐点已存在，将自动补充食物到现有餐单中。
               </p>
            </div>
          </div>
        </div>
      )}

      {/* Food Detail Modal */}
      {selectedFoodDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full relative border border-slate-100 overflow-hidden">
            <button 
              onClick={() => setSelectedFoodDetail(null)}
              className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"
            >
              <X size={16} className="text-slate-600" />
            </button>
            
            <div className="bg-gradient-to-br from-green-50 to-white p-6 pb-4 border-b border-green-50">
               <div className="flex items-center gap-3">
                 <div className="bg-white p-2 rounded-lg shadow-sm text-green-600 border border-green-100">
                    <Search size={24} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">{selectedFoodDetail.originalText}</h3>
                   {selectedFoodDetail.dbMatch ? (
                     <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                       <CheckCircle size={10} /> 数据库匹配: {selectedFoodDetail.dbMatch.name}
                     </p>
                   ) : (
                     <p className="text-xs text-slate-400">数据库暂无精确匹配</p>
                   )}
                 </div>
               </div>
            </div>

            <div className="p-6">
              {selectedFoodDetail.dbMatch ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <span className="text-xs text-slate-400 block mb-1">热量 / 100g</span>
                      <span className="text-xl font-bold text-slate-800">{selectedFoodDetail.dbMatch.calories}</span>
                      <span className="text-xs text-slate-500 ml-1">kcal</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <span className="text-xs text-slate-400 block mb-1">蛋白质</span>
                      <span className="text-xl font-bold text-blue-600">{selectedFoodDetail.dbMatch.protein}</span>
                      <span className="text-xs text-slate-500 ml-1">g</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <span className="text-xs text-slate-400 block mb-1">脂肪</span>
                      <span className="text-xl font-bold text-green-600">{selectedFoodDetail.dbMatch.fat}</span>
                      <span className="text-xs text-slate-500 ml-1">g</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                      <span className="text-xs text-slate-400 block mb-1">碳水</span>
                      <span className="text-xl font-bold text-orange-600">{selectedFoodDetail.dbMatch.carbs}</span>
                      <span className="text-xs text-slate-500 ml-1">g</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">* 数据基于每100g可食部参考值</p>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">
                   <p>无法从本地数据库获取该特定食材的详细营养数据。</p>
                   <p className="text-xs mt-2">但这不影响总热量的计算。</p>
                </div>
              )}

              <button 
                onClick={handleReplaceFood}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl hover:bg-slate-800 transition-all font-medium text-sm shadow-lg shadow-slate-200"
              >
                <ArrowRightLeft size={16} /> 替换此食材 (AI)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal Overlay */}
      {viewingRecipeIndex !== null && sortedMeals[viewingRecipeIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto relative border border-slate-100 flex flex-col">
            <button 
              onClick={() => setViewingRecipeIndex(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"
            >
              <X size={20} className="text-slate-600" />
            </button>
            
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                 <div className="bg-amber-100 p-4 rounded-full text-amber-600 shadow-sm border border-amber-200">
                   <ChefHat size={32} />
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold text-slate-800">{sortedMeals[viewingRecipeIndex].name} 食谱</h3>
                   <p className="text-sm text-slate-500 font-medium">健康烹饪指南</p>
                 </div>
              </div>
              
              {sortedMeals[viewingRecipeIndex].recipe ? (
                <div className="space-y-6">
                   <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <Utensils size={18} className="text-amber-500" /> 准备食材
                      </h4>
                      <ul className="grid grid-cols-1 gap-2">
                         {sortedMeals[viewingRecipeIndex].recipe!.ingredients.map((item, idx) => (
                           <li key={idx} className="flex items-center gap-3 text-sm text-slate-700 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                              {item}
                           </li>
                         ))}
                      </ul>
                   </div>
                   
                   <div>
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Flame size={18} className="text-orange-500" /> 烹饪步骤
                      </h4>
                      <ol className="space-y-4">
                         {sortedMeals[viewingRecipeIndex].recipe!.instructions.map((step, idx) => (
                           <li key={idx} className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-slate-600 leading-relaxed pt-0.5">{step}</span>
                           </li>
                         ))}
                      </ol>
                   </div>
                   
                   {sortedMeals[viewingRecipeIndex].recipe!.tips && (
                     <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-800 flex items-start gap-2">
                        <span className="font-bold flex-shrink-0 mt-0.5">💡 小贴士:</span>
                        <span>{sortedMeals[viewingRecipeIndex].recipe!.tips}</span>
                     </div>
                   )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                   <p>暂无详细食谱信息</p>
                   <p className="text-xs mt-2">请尝试刷新该餐单以获取制作步骤</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
               <button 
                 onClick={() => setViewingRecipeIndex(null)}
                 className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
               >
                 关闭食谱
               </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ... existing metric cards ... */}
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={60} className="text-orange-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">每日总消耗 (TDEE)</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.tdee} <span className="text-sm font-normal text-slate-400">kcal</span></h3>
          <p className="text-xs text-orange-600 mt-2 font-medium">活动系数 {results.activityMultiplier}x</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Utensils size={60} className="text-blue-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">每日目标热量</p>
          <h3 className="text-3xl font-bold text-blue-600 mt-1">{results.targetCalories} <span className="text-sm font-normal text-slate-400">kcal</span></h3>
          <p className="text-xs text-slate-400 mt-2 truncate">{results.formulaUsed.split(' ')[0]}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={60} className="text-green-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">预计达成周期</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.timeToGoal}</h3>
          
          {results.isFeasible !== undefined ? (
            <div className={`mt-2 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full w-fit ${results.isFeasible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {!results.isFeasible ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
              {results.feasibilityMessage}
            </div>
          ) : (
             <p className="text-xs text-green-600 mt-2 font-medium">目标: {userData.goal}</p>
          )}
        </div>

         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={60} className="text-purple-500" />
          </div>
          <p className="text-sm text-slate-500 font-medium">每周体重变化</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.weeklyChange}</h3>
          <p className="text-xs text-purple-600 mt-2 font-medium">BMR: {results.bmr}</p>
        </div>
      </div>

      {/* 2. 图表与洞察区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：宏量营养素圆环图 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
           <div className="w-full flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
               <Zap size={18} className="text-yellow-500" /> 宏量营养素配比
             </h3>
           </div>
           
           <div className="w-full h-[220px] relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}g (${entry.payload.pct}%)`, name]} />
              </PieChart>
             </ResponsiveContainer>
             {/* Center Text */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="text-center">
                 <p className="text-xs text-slate-400">总计</p>
                 <p className="text-xl font-bold text-slate-700">{results.targetCalories}</p>
               </div>
             </div>
           </div>

           <div className="grid grid-cols-3 gap-3 w-full mt-2 text-center">
             <div className="p-2 bg-blue-50 rounded-lg">
               <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto mb-1"></div>
               <p className="text-xs text-slate-500">蛋白质 ({proteinPct}%)</p>
               <p className="text-base font-bold text-blue-700">{results.macros.protein}g</p>
             </div>
             <div className="p-2 bg-green-50 rounded-lg">
               <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1"></div>
               <p className="text-xs text-slate-500">脂肪 ({fatPct}%)</p>
               <p className="text-base font-bold text-green-700">{results.macros.fats}g</p>
             </div>
             <div className="p-2 bg-orange-50 rounded-lg">
               <div className="w-2 h-2 rounded-full bg-orange-500 mx-auto mb-1"></div>
               <p className="text-xs text-slate-500">碳水 ({carbPct}%)</p>
               <p className="text-base font-bold text-orange-700">{results.macros.carbs}g</p>
             </div>
           </div>
        </div>

        {/* 右侧：AI 教练洞察 */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50 to-white p-8 rounded-2xl shadow-sm border border-indigo-100 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Brain size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">教练核心洞察</h3>
          </div>
          
          <div className="prose prose-slate max-w-none">
            {loadingInitial ? (
              <div className="flex items-center gap-2 text-indigo-600 animate-pulse py-8">
                <Sparkles size={20} /> 正在分析您的生理数据...
              </div>
            ) : aiData ? (
              <p className="text-lg leading-relaxed text-slate-700 font-medium">
                {aiData.insight}
              </p>
            ) : aiError ? (
              <p className="text-red-500">无法加载 AI 数据，请检查 API 设置。</p>
            ) : (
              <p className="text-slate-400">暂无洞察数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 健康改善指南 */}
      {hasAnyHealthConditions && (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
           <div className="bg-purple-50 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-purple-100 gap-3">
             <div className="flex items-center gap-2">
               <div className="p-1 bg-purple-200 rounded text-purple-700"><Stethoscope size={20} /></div>
               <h3 className="text-lg font-bold text-purple-900">健康改善指南</h3>
             </div>
             <div className="flex flex-wrap gap-2">
                {userData.healthConditions
                  .filter(c => c !== SubHealthCondition.None)
                  .map(c => {
                    const config = getHealthTagConfig(c);
                    return (
                      <span key={c} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${config.color} shadow-sm`}>
                        {config.icon} {config.label}
                      </span>
                    );
                  })
                }
                {hasCustomCondition && (
                  <span className="flex items-center gap-1 text-xs font-bold bg-teal-100 text-teal-700 px-3 py-1 rounded-full border border-teal-200 shadow-sm">
                     <Edit2 size={12} /> {userData.customHealthCondition}
                  </span>
                )}
             </div>
           </div>
           <div className="p-6">
              <div className="prose prose-sm prose-slate max-w-none prose-headings:text-purple-800 prose-a:text-purple-600">
                {loadingInitial ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-purple-50 rounded w-full"></div>
                    <div className="h-4 bg-purple-50 rounded w-5/6"></div>
                  </div>
                ) : aiData?.healthAdvice ? (
                  <ReactMarkdown>{aiData.healthAdvice}</ReactMarkdown>
                ) : (
                  <p className="text-slate-400">暂无具体建议</p>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 3. 结构化餐单 */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Coffee className="text-amber-600" /> 今日推荐餐单 (中式)
          </h3>
          <button 
            onClick={handleSwapMeal}
            disabled={loadingMealRefresh || loadingInitial || isAdjustingMeal}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 hover:text-green-600 hover:border-green-200 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loadingMealRefresh ? "animate-spin" : ""} />
            {loadingMealRefresh ? "生成中..." : "整日换一换"}
          </button>
        </div>
        
        <div className="p-6 md:p-8 bg-slate-50/30">
          {loadingInitial || loadingMealRefresh ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {[1,2,3,4].map(i => (
                 <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm animate-pulse h-32"></div>
               ))}
             </div>
          ) : aiError ? (
             <div className="text-center text-red-400 py-4">加载餐单失败</div>
          ) : sortedMeals.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedMeals.map((meal: Meal, index: number) => {
                  const isEditing = editingMealIndex === index;
                  const isRefreshing = refreshingMealIndex === index;
                  const isUpdatingAny = isAdjustingMeal || (refreshingMealIndex !== null);
                  const canEdit = !isEditing && !isAdjustingMeal && refreshingMealIndex === null;

                  return (
                  <div key={index} className={`bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative ${isUpdatingAny && !isEditing && !isRefreshing ? 'opacity-50' : ''}`}>
                    
                    {/* Loading Overlay */}
                    {((isAdjustingMeal && editingMealIndex === index) || isRefreshing) && (
                       <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl">
                          <div className="flex flex-col items-center text-indigo-600">
                             <RefreshCw size={24} className="animate-spin mb-2" />
                             <span className="text-sm font-bold">
                               {isRefreshing ? '正在优化组合...' : '正在调整...'}
                             </span>
                          </div>
                       </div>
                    )}

                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800 text-lg border-l-4 border-amber-500 pl-3">{meal.name}</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                           <Flame size={12} /> {meal.macros.calories} kcal
                        </div>
                      </div>
                    </div>
                    
                    {isEditing ? (
                      <div className="mb-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 animate-fadeIn">
                         <label className="block text-xs font-bold text-indigo-800 mb-2">您想怎么调整 {meal.name}？</label>
                         <textarea 
                            className="w-full p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                            rows={3}
                            placeholder="例如：'把米饭换成红薯'，'把西兰花换成菠菜'..."
                            value={adjustmentPrompt}
                            onChange={(e) => setAdjustmentPrompt(e.target.value)}
                            autoFocus
                         />
                         <div className="flex gap-2 mt-3 justify-end">
                            <button 
                               onClick={cancelEdit} 
                               className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                            >
                               <X size={14} /> 取消
                            </button>
                            <button 
                               onClick={() => handleAdjustMeal(index)}
                               disabled={!adjustmentPrompt.trim()}
                               className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                               <Check size={14} /> 确认调整
                            </button>
                         </div>
                      </div>
                    ) : (
                      <>
                        {/* Interactive Food Items */}
                        <div className="text-slate-700 font-medium mb-3 leading-relaxed">
                          {meal.foodItems.split(/,|，|\n/).map(s => s.trim()).filter(s => s).map((item, idx, arr) => (
                             <span key={idx}>
                                <span 
                                  onClick={() => handleFoodClick(item, index)}
                                  className="cursor-pointer border-b border-dotted border-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-colors"
                                >
                                  {item}
                                </span>
                                {idx < arr.length - 1 && <span className="mr-1">, </span>}
                             </span>
                          ))}
                        </div>
                        
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{meal.description}</p>
                        
                        {/* Action Buttons Row */}
                        {canEdit && (
                          <div className="flex gap-2 mb-4">
                             <button
                               onClick={() => setViewingRecipeIndex(index)}
                               className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-bold text-xs border border-amber-100 shadow-sm"
                             >
                               <BookOpen size={16} /> 查看食谱
                             </button>
                             <button
                               onClick={() => handleRefreshSingleMeal(index)}
                               className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                               title="刷新此餐 (优化蛋白质搭配)"
                             >
                               <RefreshCw size={18} />
                             </button>
                             <button 
                               onClick={() => setEditingMealIndex(index)}
                               className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                               title="微调此餐"
                             >
                               <Edit2 size={18} />
                             </button>
                          </div>
                        )}
                        
                        {/* 素菜推荐 */}
                        {meal.vegetableRecommendation && (
                          <div className="bg-green-50 p-2 rounded-lg mb-3 border border-green-100">
                            <p className="text-xs text-green-800 font-medium flex items-center gap-1">
                              <Wheat size={12} /> {meal.vegetableRecommendation}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2 rounded-lg">
                      <div>
                        <span className="block text-slate-400 mb-1">蛋 (P)</span>
                        <span className="font-bold text-blue-600">{meal.macros.protein}g</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 mb-1">脂 (F)</span>
                        <span className="font-bold text-green-600">{meal.macros.fat}g</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 mb-1">碳 (C)</span>
                        <span className="font-bold text-orange-600">{meal.macros.carbs}g</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
                
                {/* Add Meal Button */}
                <button 
                  onClick={() => setIsAddMealModalOpen(true)}
                  disabled={loadingMealRefresh || isAdjustingMeal}
                  className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group min-h-[250px] text-slate-400 hover:text-indigo-600"
                >
                  <div className="p-3 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition-colors mb-3">
                    <PlusCircle size={28} />
                  </div>
                  <span className="font-bold">添加餐点</span>
                  <span className="text-xs text-slate-400 mt-1">系统将自动平衡总热量</span>
                </button>
             </div>
          ) : (
             <div className="text-center text-slate-400 py-8">暂无餐单数据</div>
          )}
        </div>
      </div>

      {/* 4. 周饮食策略、补剂与恢复 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 周饮食策略 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-teal-50">
            <Calendar className="text-teal-600" />
            <h3 className="text-lg font-bold text-slate-800">周饮食建议与备餐</h3>
          </div>
          <div className="prose prose-sm prose-slate max-w-none prose-li:marker:text-teal-400">
            {loadingInitial ? (
               <div className="space-y-3 animate-pulse">
                 <div className="h-4 bg-slate-50 rounded w-full"></div>
                 <div className="h-4 bg-slate-50 rounded w-5/6"></div>
                 <div className="h-4 bg-slate-50 rounded w-4/6"></div>
               </div>
            ) : aiData?.weeklyAdvice ? (
               <ReactMarkdown>{aiData.weeklyAdvice}</ReactMarkdown>
            ) : (
               <p className="text-slate-400">暂无周建议</p>
            )}
          </div>
        </div>

        {/* 补剂建议 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-50">
            <Pill className="text-blue-500" />
            <h3 className="text-lg font-bold text-slate-800">个性化补剂建议</h3>
          </div>
          <div className="prose prose-sm prose-slate max-w-none prose-li:marker:text-blue-400">
            {loadingInitial ? (
               <div className="space-y-3 animate-pulse">
                 <div className="h-4 bg-slate-50 rounded w-full"></div>
                 <div className="h-4 bg-slate-50 rounded w-3/4"></div>
               </div>
            ) : aiData?.supplements ? (
               <ReactMarkdown>{aiData.supplements}</ReactMarkdown>
            ) : (
               <p className="text-slate-400">暂无补剂建议</p>
            )}
          </div>
        </div>

        {/* 恢复建议 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-50">
            <Moon className="text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-800">睡眠与恢复策略</h3>
          </div>
          <div className="prose prose-sm prose-slate max-w-none prose-li:marker:text-indigo-400">
            {loadingInitial ? (
               <div className="space-y-3 animate-pulse">
                 <div className="h-4 bg-slate-50 rounded w-full"></div>
                 <div className="h-4 bg-slate-50 rounded w-3/4"></div>
               </div>
            ) : aiData?.recovery ? (
               <ReactMarkdown>{aiData.recovery}</ReactMarkdown>
            ) : (
               <p className="text-slate-400">暂无恢复建议</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <button 
          onClick={onReset}
          className="px-6 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all text-sm font-medium"
        >
          ← 重新开始计算
        </button>
      </div>
    </div>
  );
};

export default ResultsDashboard;