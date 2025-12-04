import React, { useEffect, useState } from 'react';
import { UserInput, CalculationResult, AIPlanData, SubHealthCondition, Meal } from '../types';
import { calculateNutrition } from '../utils/calculations';
import { generateComprehensivePlan, regenerateMealPlan } from '../services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Brain, Flame, Utensils, Zap, Clock, TrendingUp, AlertCircle, Sparkles, RefreshCw, Pill, Moon, Coffee, Stethoscope, Droplet, Wheat, Beef, Calendar, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  userData: UserInput;
  onReset: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b']; // Protein (Blue), Fat (Green), Carbs (Orange)

const ResultsDashboard: React.FC<Props> = ({ userData, onReset }) => {
  const [results, setResults] = useState<CalculationResult | null>(null);
  
  // AI Data States
  const [aiData, setAiData] = useState<AIPlanData | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMealRefresh, setLoadingMealRefresh] = useState(false);
  const [aiError, setAiError] = useState(false);

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

  const hasHealthConditions = userData.healthConditions.length > 0 && !userData.healthConditions.includes(SubHealthCondition.None);
  
  // Specific warnings
  const isHighUric = userData.healthConditions.includes(SubHealthCondition.HighUricAcid);
  const isHighLipid = userData.healthConditions.includes(SubHealthCondition.HighCholesterol);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* 1. 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* 2.5 健康改善指南 (更美观的展示) */}
      {hasHealthConditions && (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
           <div className="bg-purple-50 px-6 py-4 flex justify-between items-center border-b border-purple-100">
             <div className="flex items-center gap-2">
               <div className="p-1 bg-purple-200 rounded text-purple-700"><Stethoscope size={20} /></div>
               <h3 className="text-lg font-bold text-purple-900">健康改善指南</h3>
             </div>
             <div className="flex gap-2">
                {isHighUric && <span className="text-xs font-bold bg-red-100 text-red-600 px-3 py-1 rounded-full border border-red-200">高尿酸预警</span>}
                {isHighLipid && <span className="text-xs font-bold bg-orange-100 text-orange-600 px-3 py-1 rounded-full border border-orange-200">血脂关注</span>}
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

      {/* 3. 结构化餐单 (带“换一换”功能) */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Coffee className="text-amber-600" /> 今日推荐餐单 (中式)
          </h3>
          <button 
            onClick={handleSwapMeal}
            disabled={loadingMealRefresh || loadingInitial}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 hover:text-green-600 hover:border-green-200 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loadingMealRefresh ? "animate-spin" : ""} />
            {loadingMealRefresh ? "生成中..." : "换一换"}
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
          ) : aiData?.mealPlan && Array.isArray(aiData.mealPlan) ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aiData.mealPlan.map((meal: Meal, index: number) => (
                  <div key={index} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-slate-800 text-lg border-l-4 border-amber-500 pl-3">{meal.name}</h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        <Flame size={12} /> {meal.macros.calories} kcal
                      </div>
                    </div>
                    <p className="text-slate-700 font-medium mb-2">{meal.foodItems}</p>
                    <p className="text-xs text-slate-500 mb-4 line-clamp-2">{meal.description}</p>
                    
                    {/* 素菜推荐 */}
                    {meal.vegetableRecommendation && (
                      <div className="bg-green-50 p-2 rounded-lg mb-3 border border-green-100">
                        <p className="text-xs text-green-800 font-medium flex items-center gap-1">
                          <Wheat size={12} /> {meal.vegetableRecommendation}
                        </p>
                      </div>
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
                ))}
             </div>
          ) : (
             <div className="text-center text-slate-400 py-8">暂无餐单数据</div>
          )}
        </div>
      </div>

      {/* 4. 周饮食策略、补剂与恢复 (3列布局) */}
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