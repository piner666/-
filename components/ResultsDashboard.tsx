import React, { useEffect, useState } from 'react';
import { UserInput, CalculationResult, AIPlanData, SubHealthCondition, Meal } from '../types';
import { calculateNutrition } from '../utils/calculations';
import { generateInsight, generateMealPlanOnly, generateGuidance, regenerateMealPlan, regenerateSingleMeal, adjustSingleMeal, modifyMealPlan } from '../services/geminiService';
import { defaultChineseFoodDB, FoodItem } from '../data/foodDatabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Brain, Flame, Utensils, Zap, Clock, TrendingUp, AlertCircle, Sparkles, RefreshCw, Pill, Moon, Coffee, Stethoscope, Wheat, Calendar, CheckCircle, Edit2, Check, X, AlertTriangle, Droplet, Wind, Leaf, Activity, PlusCircle, BookOpen, ChefHat, Search, ArrowRightLeft, Sunrise, Sun, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  userData: UserInput;
  onReset: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b']; // Protein (Blue), Fat (Green), Carbs (Orange)
const MEAL_ORDER = ['早餐', '早加餐', '午餐', '午加餐', '晚餐', '晚加餐'];
const FOOD_TYPE_OPTIONS = ['水果', '主食', '蔬菜', '乳制品', '肉蛋', '坚果'];

const ResultsDashboard: React.FC<Props> = ({ userData, onReset }) => {
  const [results, setResults] = useState<CalculationResult | null>(null);
  
  // AI Data States - Now Modular
  const [aiData, setAiData] = useState<Partial<AIPlanData>>({});
  const [loadingStates, setLoadingStates] = useState({
    insight: false,
    mealPlan: false,
    guidance: false
  });
  const [aiError, setAiError] = useState(false);

  // Meal Adjustment States
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [refreshingMealIndex, setRefreshingMealIndex] = useState<number | null>(null);
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('');
  const [isAdjustingMeal, setIsAdjustingMeal] = useState(false);
  
  // Add Meal Modal State
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<string[]>([]);

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
      
      // Reset States
      setAiData({});
      setAiError(false);
      setLoadingStates({ insight: true, mealPlan: true, guidance: true });

      // Parallel Fetching for Speed
      // 1. Insight (Fastest)
      generateInsight(userData, calc)
        .then(data => {
           setAiData(prev => ({ ...prev, insight: data.insight }));
           setLoadingStates(prev => ({ ...prev, insight: false }));
        })
        .catch(err => {
           console.error("Insight Error", err);
           setLoadingStates(prev => ({ ...prev, insight: false }));
        });

      // 2. Meal Plan (Heavy)
      generateMealPlanOnly(userData, calc)
        .then(data => {
           setAiData(prev => ({ ...prev, mealPlan: data.mealPlan }));
           setLoadingStates(prev => ({ ...prev, mealPlan: false }));
        })
        .catch(err => {
           console.error("MealPlan Error", err);
           setLoadingStates(prev => ({ ...prev, mealPlan: false }));
           setAiError(true);
        });

      // 3. Guidance (Medium)
      generateGuidance(userData, calc)
        .then(data => {
           setAiData(prev => ({ ...prev, ...data }));
           setLoadingStates(prev => ({ ...prev, guidance: false }));
        })
        .catch(err => {
           console.error("Guidance Error", err);
           setLoadingStates(prev => ({ ...prev, guidance: false }));
        });
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
    setLoadingStates(prev => ({ ...prev, mealPlan: true }));
    try {
      const newMealPlan = await regenerateMealPlan(userData, results);
      setAiData(prev => ({ ...prev, mealPlan: newMealPlan }));
    } catch (err) {
      alert("刷新餐单失败，请重试");
    } finally {
      setLoadingStates(prev => ({ ...prev, mealPlan: false }));
    }
  };

  const handleRefreshSingleMeal = async (index: number) => {
    if (!userData || !results || !aiData.mealPlan) return;
    
    setRefreshingMealIndex(index);
    try {
      const sortedMeals = sortMeals(aiData.mealPlan);
      const targetMeal = sortedMeals[index];
      const realIndex = aiData.mealPlan.findIndex(m => m === targetMeal);
      
      if (realIndex === -1) return;

      const newMeal = await regenerateSingleMeal(userData, targetMeal);
      
      const newPlan = [...aiData.mealPlan];
      newPlan[realIndex] = newMeal;
      
      setAiData(prev => ({ ...prev, mealPlan: newPlan }));
    } catch (err) {
      console.error(err);
      alert("刷新该餐单失败，请重试");
    } finally {
      setRefreshingMealIndex(null);
    }
  };

  const handleAdjustMeal = async (index: number) => {
    if (!results || !aiData.mealPlan || !adjustmentPrompt.trim()) return;
    
    setIsAdjustingMeal(true);
    try {
      const sortedMeals = sortMeals(aiData.mealPlan);
      const targetMeal = sortedMeals[index];
      const realIndex = aiData.mealPlan.findIndex(m => m === targetMeal);

      if (realIndex === -1) return;

      const updatedMeal = await adjustSingleMeal(userData, results, targetMeal, adjustmentPrompt);
      const newPlan = [...aiData.mealPlan];
      newPlan[realIndex] = updatedMeal;
      setAiData(prev => ({ ...prev, mealPlan: newPlan }));
      setEditingMealIndex(null);
      setAdjustmentPrompt('');
    } catch (err) {
      alert("调整餐单失败，请重试");
    } finally {
      setIsAdjustingMeal(false);
    }
  };

  const handleDeleteMeal = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (!aiData.mealPlan) return;
    if (window.confirm('确定要删除这一餐吗？')) {
      const sortedMeals = sortMeals(aiData.mealPlan);
      const targetMeal = sortedMeals[index];
      
      const originalIndex = aiData.mealPlan.findIndex(m => m === targetMeal);
      
      if (originalIndex !== -1) {
        const newPlan = [...aiData.mealPlan];
        newPlan.splice(originalIndex, 1);
        setAiData(prev => ({ ...prev, mealPlan: newPlan }));
      }
    }
  };

  const handleAddMealOption = async (mealType: string) => {
    if (!aiData.mealPlan || !results) return;
    setIsAddMealModalOpen(false); // Close modal first
    setLoadingStates(prev => ({ ...prev, mealPlan: true }));
    try {
      const newPlan = await modifyMealPlan(userData, results, aiData.mealPlan, 'add', undefined, mealType, selectedFoodTypes);
      setAiData(prev => ({ ...prev, mealPlan: newPlan }));
      setSelectedFoodTypes([]); // Reset selection
    } catch (err) {
      console.error(err);
      alert("添加失败，请重试");
    } finally {
      setLoadingStates(prev => ({ ...prev, mealPlan: false }));
    }
  };

  const toggleFoodType = (type: string) => {
    if (selectedFoodTypes.includes(type)) {
      setSelectedFoodTypes(selectedFoodTypes.filter(t => t !== type));
    } else {
      setSelectedFoodTypes([...selectedFoodTypes, type]);
    }
  };

  const closeAddMealModal = () => {
    setIsAddMealModalOpen(false);
    setSelectedFoodTypes([]);
  };

  const cancelEdit = () => {
    setEditingMealIndex(null);
    setAdjustmentPrompt('');
  };

  // Helper to find food in DB
  const findFoodInDB = (text: string): FoodItem | undefined => {
    const keyword = text.replace(/[\d\.]+[kgml碗个勺g]+/gi, '').replace(/[()（）]/g, '').trim();
    if (!keyword) return undefined;
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
    setSelectedFoodDetail(null);
    setEditingMealIndex(mealIndex);
    setAdjustmentPrompt(`请把 "${originalText}" 替换成其他营养价值类似的食材。`);
  };

  if (!results) return <div className="p-12 text-center text-slate-500">正在计算营养数据...</div>;

  const proteinPct = Math.round((results.macros.protein * 4 / results.targetCalories) * 100);
  const fatPct = Math.round((results.macros.fats * 9 / results.targetCalories) * 100);
  const carbPct = Math.round((results.macros.carbs * 4 / results.targetCalories) * 100);

  const macroData = [
    { name: '蛋白质', value: results.macros.protein, pct: proteinPct },
    { name: '脂肪', value: results.macros.fats, pct: fatPct },
    { name: '碳水', value: results.macros.carbs, pct: carbPct },
  ];

  const hasStandardConditions = userData.healthConditions.length > 0 && !userData.healthConditions.includes(SubHealthCondition.None);
  const hasCustomCondition = !!userData.customHealthCondition && userData.customHealthCondition.trim().length > 0;
  const hasAnyHealthConditions = hasStandardConditions || hasCustomCondition;
  
  const getHealthTagConfig = (condition: SubHealthCondition) => {
    switch (condition) {
      case SubHealthCondition.HighCholesterol: return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Droplet size={14} />, label: '血脂关注' };
      case SubHealthCondition.HighUricAcid: return { color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertTriangle size={14} />, label: '尿酸预警' };
      case SubHealthCondition.Digestive: return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Leaf size={14} />, label: '消化系统' };
      case SubHealthCondition.Liver: return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Activity size={14} />, label: '肝功能' };
      case SubHealthCondition.Kidney: return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Activity size={14} />, label: '肾功能' };
      case SubHealthCondition.Adrenal: return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Zap size={14} />, label: '肾上腺' };
      case SubHealthCondition.Thyroid: return { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: <Wind size={14} />, label: '甲状腺' };
      case SubHealthCondition.FemaleGonad: return { color: 'bg-pink-100 text-pink-700 border-pink-200', icon: <Activity size={14} />, label: '女性调理' };
      case SubHealthCondition.MaleGonad: return { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Activity size={14} />, label: '男性调理' };
      default: return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Activity size={14} />, label: condition };
    }
  };

  const sortedMeals = aiData.mealPlan ? sortMeals(aiData.mealPlan) : [];

  return (
    <div className="space-y-8 animate-fadeIn pb-12 relative">
      
      {/* Add Meal Selection Modal */}
      {isAddMealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full relative border border-slate-100 overflow-hidden">
            <button onClick={closeAddMealModal} className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"><X size={16} className="text-slate-600" /></button>
            <div className="p-6">
               <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">添加哪一顿加餐？</h3>
               <div className="mb-6">
                 <p className="text-xs text-slate-500 text-center mb-3">包含哪些种类？(可多选)</p>
                 <div className="flex flex-wrap gap-2 justify-center">
                   {FOOD_TYPE_OPTIONS.map(type => (
                     <button key={type} onClick={() => toggleFoodType(type)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${selectedFoodTypes.includes(type) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{type}{selectedFoodTypes.includes(type) && <Check size={12} />}</button>
                   ))}
                 </div>
               </div>
               <div className="space-y-3">
                 {['早加餐', '午加餐', '晚加餐'].map((m) => (
                   <button key={m} onClick={() => handleAddMealOption(m)} className="w-full flex items-center p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                     <span className="block font-bold text-slate-700 group-hover:text-indigo-800">{m}</span>
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Food Detail Modal */}
      {selectedFoodDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full relative border border-slate-100 overflow-hidden">
            <button onClick={() => setSelectedFoodDetail(null)} className="absolute top-3 right-3 p-1.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"><X size={16} className="text-slate-600" /></button>
            <div className="p-6">
               <h3 className="text-lg font-bold text-slate-800">{selectedFoodDetail.originalText}</h3>
               {selectedFoodDetail.dbMatch && <div className="mt-4 text-sm text-slate-600">热量: {selectedFoodDetail.dbMatch.calories} kcal/100g</div>}
               <button onClick={handleReplaceFood} className="w-full mt-6 bg-slate-900 text-white py-3 rounded-xl font-medium text-sm">替换此食材 (AI)</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal Overlay */}
      {viewingRecipeIndex !== null && sortedMeals[viewingRecipeIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto relative border border-slate-100 flex flex-col">
            <button onClick={() => setViewingRecipeIndex(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors z-10"><X size={20} className="text-slate-600" /></button>
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">{sortedMeals[viewingRecipeIndex].name} 食谱</h3>
              {sortedMeals[viewingRecipeIndex].recipe ? (
                <div className="space-y-6">
                   <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 mb-3">准备食材</h4>
                      <ul className="grid grid-cols-1 gap-2">
                         {sortedMeals[viewingRecipeIndex].recipe!.ingredients.map((item: any, idx) => (
                           <li key={idx} className="text-sm text-slate-700">
                             • {typeof item === 'object' ? `${item.item || ''} ${item.quantity || ''}` : item}
                           </li>
                         ))}
                      </ul>
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-700 mb-3">烹饪步骤</h4>
                      <ol className="space-y-4">
                         {sortedMeals[viewingRecipeIndex].recipe!.instructions.map((step, idx) => <li key={idx} className="flex gap-3"><span className="text-xs font-bold bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span><span className="text-sm text-slate-600">{step}</span></li>)}
                      </ol>
                   </div>
                   {sortedMeals[viewingRecipeIndex].recipe!.tips && <div className="text-sm text-indigo-800 bg-indigo-50 p-4 rounded-xl">💡 {sortedMeals[viewingRecipeIndex].recipe!.tips}</div>}
                </div>
              ) : (
                <p className="text-slate-400">暂无详细食谱</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. 核心指标卡片 (Static Calculation Results) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Flame size={60} className="text-orange-500" /></div>
          <p className="text-sm text-slate-500 font-medium">每日总消耗 (TDEE)</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.tdee} <span className="text-sm font-normal text-slate-400">kcal</span></h3>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Utensils size={60} className="text-blue-500" /></div>
          <p className="text-sm text-slate-500 font-medium">每日目标热量</p>
          <h3 className="text-3xl font-bold text-blue-600 mt-1">{results.targetCalories} <span className="text-sm font-normal text-slate-400">kcal</span></h3>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={60} className="text-green-500" /></div>
          <p className="text-sm text-slate-500 font-medium">预计达成周期</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.timeToGoal}</h3>
        </div>
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={60} className="text-purple-500" /></div>
          <p className="text-sm text-slate-500 font-medium">每周体重变化</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{results.weeklyChange}</h3>
        </div>
      </div>

      {/* 2. 图表与洞察区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：宏量营养素圆环图 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
           <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Zap size={18} className="text-yellow-500" /> 宏量营养素配比</h3>
           <div className="w-full h-[220px] relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={macroData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}g (${entry.payload.pct}%)`, name]} />
              </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="text-center">
                 <p className="text-xs text-slate-400">总计</p>
                 <p className="text-xl font-bold text-slate-700">{results.targetCalories}</p>
               </div>
             </div>
           </div>
           <div className="grid grid-cols-3 gap-3 w-full mt-2 text-center">
             <div className="p-2 bg-blue-50 rounded-lg"><p className="text-xs text-slate-500">蛋白质</p><p className="text-base font-bold text-blue-700">{results.macros.protein}g</p></div>
             <div className="p-2 bg-green-50 rounded-lg"><p className="text-xs text-slate-500">脂肪</p><p className="text-base font-bold text-green-700">{results.macros.fats}g</p></div>
             <div className="p-2 bg-orange-50 rounded-lg"><p className="text-xs text-slate-500">碳水</p><p className="text-base font-bold text-orange-700">{results.macros.carbs}g</p></div>
           </div>
        </div>

        {/* 右侧：AI 教练洞察 (Fast Loading) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50 to-white p-8 rounded-2xl shadow-sm border border-indigo-100 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200"><Brain size={24} /></div>
            <h3 className="text-xl font-bold text-slate-800">教练核心洞察</h3>
          </div>
          <div className="prose prose-slate max-w-none">
            {loadingStates.insight ? (
              <div className="flex items-center gap-2 text-indigo-600 animate-pulse py-8"><Sparkles size={20} /> 正在分析您的生理数据...</div>
            ) : aiData.insight ? (
              <p className="text-lg leading-relaxed text-slate-700 font-medium animate-fadeIn">{aiData.insight}</p>
            ) : (
              <p className="text-red-400">无法加载洞察数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 健康改善指南 (Medium Loading) */}
      {hasAnyHealthConditions && (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
           <div className="bg-purple-50 px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b border-purple-100 gap-3">
             <div className="flex items-center gap-2"><div className="p-1 bg-purple-200 rounded text-purple-700"><Stethoscope size={20} /></div><h3 className="text-lg font-bold text-purple-900">健康改善指南</h3></div>
             <div className="flex flex-wrap gap-2">
                {userData.healthConditions.filter(c => c !== SubHealthCondition.None).map(c => <span key={c} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${getHealthTagConfig(c).color}`}>{getHealthTagConfig(c).icon} {getHealthTagConfig(c).label}</span>)}
                {hasCustomCondition && <span className="flex items-center gap-1 text-xs font-bold bg-teal-100 text-teal-700 px-3 py-1 rounded-full border border-teal-200"><Edit2 size={12} /> {userData.customHealthCondition}</span>}
             </div>
           </div>
           <div className="p-6">
              <div className="prose prose-sm prose-slate max-w-none">
                {loadingStates.guidance ? (
                  <div className="space-y-3 animate-pulse"><div className="h-4 bg-purple-50 rounded w-full"></div><div className="h-4 bg-purple-50 rounded w-5/6"></div></div>
                ) : aiData.healthAdvice ? (
                  <div className="animate-fadeIn"><ReactMarkdown>{aiData.healthAdvice}</ReactMarkdown></div>
                ) : (
                  <p className="text-slate-400">...</p>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 3. 结构化餐单 (Heavy Loading - displays last) */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Coffee className="text-amber-600" /> 今日推荐餐单 (中式)</h3>
          <button onClick={handleSwapMeal} disabled={loadingStates.mealPlan || isAdjustingMeal} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loadingStates.mealPlan ? "animate-spin" : ""} /> {loadingStates.mealPlan ? "生成中..." : "整日换一换"}
          </button>
        </div>
        
        <div className="p-6 md:p-8 bg-slate-50/30">
          {loadingStates.mealPlan ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {[1,2,3,4].map(i => <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm animate-pulse h-32 flex items-center justify-center text-slate-300">正在精心设计食谱...</div>)}
             </div>
          ) : aiError ? (
             <div className="text-center text-red-400 py-4">加载餐单失败</div>
          ) : sortedMeals.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                {sortedMeals.map((meal: Meal, index: number) => {
                  const isEditing = editingMealIndex === index;
                  const isRefreshing = refreshingMealIndex === index;
                  return (
                  <div key={index} className={`bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative`}>
                    {isRefreshing && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl"><RefreshCw size={24} className="animate-spin text-indigo-600" /></div>}
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800 text-lg border-l-4 border-amber-500 pl-3">{meal.name}</h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full"><Flame size={12} /> {meal.macros.calories} kcal</div>
                    </div>
                    
                    {isEditing ? (
                      <div className="mb-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                         <textarea className="w-full p-3 border border-indigo-200 rounded-lg outline-none text-sm bg-white" rows={3} placeholder="例如：'把米饭换成红薯'..." value={adjustmentPrompt} onChange={(e) => setAdjustmentPrompt(e.target.value)} autoFocus />
                         <div className="flex gap-2 mt-3 justify-end">
                            <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-slate-500 border rounded-lg">取消</button>
                            <button onClick={() => handleAdjustMeal(index)} disabled={!adjustmentPrompt.trim()} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg">确认调整</button>
                         </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-slate-700 font-medium mb-3 leading-relaxed">
                          {meal.foodItems.split(/,|，|\n/).map((item, idx, arr) => (
                             <span key={idx}><span onClick={() => handleFoodClick(item, index)} className="cursor-pointer border-b border-dotted border-slate-400 hover:text-indigo-600 hover:border-indigo-600">{item.trim()}</span>{idx < arr.length - 1 && ", "}</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{meal.description}</p>
                        <div className="flex gap-2 mb-4">
                             <button onClick={() => setViewingRecipeIndex(index)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-bold text-xs border border-amber-100"><BookOpen size={16} /> 查看食谱</button>
                             <button onClick={() => handleRefreshSingleMeal(index)} className="p-2 text-slate-400 hover:text-green-600 bg-slate-50 hover:bg-green-50 rounded-lg"><RefreshCw size={18} /></button>
                             <button onClick={() => setEditingMealIndex(index)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg"><Edit2 size={18} /></button>
                             <button onClick={(e) => handleDeleteMeal(e, index)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                        </div>
                        {meal.vegetableRecommendation && <div className="bg-green-50 p-2 rounded-lg mb-3 border border-green-100"><p className="text-xs text-green-800 font-medium flex items-center gap-1"><Wheat size={12} /> {meal.vegetableRecommendation}</p></div>}
                      </>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2 rounded-lg">
                      <div><span className="block text-slate-400 mb-1">蛋</span><span className="font-bold text-blue-600">{meal.macros.protein}g</span></div>
                      <div><span className="block text-slate-400 mb-1">脂</span><span className="font-bold text-green-600">{meal.macros.fat}g</span></div>
                      <div><span className="block text-slate-400 mb-1">碳</span><span className="font-bold text-orange-600">{meal.macros.carbs}g</span></div>
                    </div>
                  </div>
                  );
                })}
                <button onClick={() => setIsAddMealModalOpen(true)} disabled={loadingStates.mealPlan || isAdjustingMeal} className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-slate-400 hover:text-indigo-600">
                  <PlusCircle size={28} className="mb-2" /><span className="font-bold">添加餐点</span>
                </button>
             </div>
          ) : (
             <div className="text-center text-slate-400 py-8">暂无餐单数据</div>
          )}
        </div>
      </div>

      {/* 4. 周饮食策略、补剂与恢复 (Medium Loading) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-teal-50"><Calendar className="text-teal-600" /><h3 className="text-lg font-bold text-slate-800">周饮食建议</h3></div>
          <div className="prose prose-sm prose-slate max-w-none">
            {loadingStates.guidance ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-50 rounded w-full"></div></div> : aiData.weeklyAdvice ? <div className="animate-fadeIn"><ReactMarkdown>{aiData.weeklyAdvice}</ReactMarkdown></div> : <p className="text-slate-400">...</p>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-50"><Pill className="text-blue-500" /><h3 className="text-lg font-bold text-slate-800">补剂建议</h3></div>
          <div className="prose prose-sm prose-slate max-w-none">
            {loadingStates.guidance ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-50 rounded w-full"></div></div> : aiData.supplements ? <div className="animate-fadeIn"><ReactMarkdown>{aiData.supplements}</ReactMarkdown></div> : <p className="text-slate-400">...</p>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-50"><Moon className="text-indigo-500" /><h3 className="text-lg font-bold text-slate-800">恢复策略</h3></div>
          <div className="prose prose-sm prose-slate max-w-none">
            {loadingStates.guidance ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-50 rounded w-full"></div></div> : aiData.recovery ? <div className="animate-fadeIn"><ReactMarkdown>{aiData.recovery}</ReactMarkdown></div> : <p className="text-slate-400">...</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <button onClick={onReset} className="px-6 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all text-sm font-medium">← 重新开始计算</button>
      </div>
    </div>
  );
};

export default ResultsDashboard;