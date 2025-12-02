
import React, { useState, useEffect } from 'react';
import { UserInput, Gender, ActivityLevel, Goal, TrainingHistory, SubHealthCondition, MacroPreference } from '../types';
import { ChevronRight, ChevronLeft, Activity, Scale, Moon, HeartPulse, Stethoscope, PieChart } from 'lucide-react';

interface Props {
  onComplete: (data: UserInput) => void;
}

const InputWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UserInput>({
    height: 170,
    weight: 70,
    age: 30,
    gender: Gender.Male,
    bodyFat: undefined,
    goal: Goal.LoseFat,
    activityLevel: ActivityLevel.Moderate,
    trainingHistory: TrainingHistory.Intermediate,
    macroPreference: MacroPreference.Balanced,
    customMacroRatio: { p: 30, f: 20, c: 50 }, // Default custom values
    waterIntake: '正常',
    supplements: '无',
    appetiteStress: 5,
    sleepQuality: 7,
    healthConditions: [SubHealthCondition.None]
  });

  const nextStep = () => {
    // Basic validation for numeric inputs
    if (step === 1) {
      if (!formData.height || !formData.weight || !formData.age) {
        alert("请填写完整的身高、体重和年龄");
        return;
      }
    }
    // Validation for Custom Macros
    if (step === 2 && formData.macroPreference === MacroPreference.Custom) {
      const { p, f, c } = formData.customMacroRatio || { p: 0, f: 0, c: 0 };
      if (p + f + c !== 100) {
        alert(`当前总比例为 ${p + f + c}%，请调整至 100%`);
        return;
      }
    }
    setStep(prev => prev + 1);
  };
  
  const prevStep = () => setStep(prev => prev - 1);

  const handleFinish = () => {
    onComplete(formData);
  };

  const toggleCondition = (condition: SubHealthCondition) => {
    let newConditions = [...formData.healthConditions];
    
    if (condition === SubHealthCondition.None) {
      // If "None" is selected, clear everything else
      newConditions = [SubHealthCondition.None];
    } else {
      // If specific condition is selected, remove "None"
      newConditions = newConditions.filter(c => c !== SubHealthCondition.None);
      
      if (newConditions.includes(condition)) {
        newConditions = newConditions.filter(c => c !== condition);
      } else {
        newConditions.push(condition);
      }
      
      // If list becomes empty, default back to None
      if (newConditions.length === 0) {
        newConditions = [SubHealthCondition.None];
      }
    }
    
    setFormData({ ...formData, healthConditions: newConditions });
  };

  const updateCustomMacro = (type: 'p' | 'f' | 'c', value: number) => {
    const newRatio = { ...formData.customMacroRatio!, [type]: value };
    setFormData({ ...formData, customMacroRatio: newRatio });
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Scale className="text-blue-600" /> 基本指标
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">性别</label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setFormData({...formData, gender: Gender.Male})}
                    className={`flex-1 py-3 rounded-lg border-2 ${formData.gender === Gender.Male ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    男
                  </button>
                  <button 
                    onClick={() => setFormData({...formData, gender: Gender.Female})}
                    className={`flex-1 py-3 rounded-lg border-2 ${formData.gender === Gender.Female ? 'border-pink-600 bg-pink-50 text-pink-700' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    女
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">年龄</label>
                <input 
                  type="number" 
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value === '' ? '' : Number(e.target.value)})}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">身高 (cm)</label>
                <input 
                  type="number" 
                  value={formData.height}
                  onChange={(e) => setFormData({...formData, height: e.target.value === '' ? '' : Number(e.target.value)})}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">体重 (kg)</label>
                <input 
                  type="number" 
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value === '' ? '' : Number(e.target.value)})}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">体脂率 % (可选)</label>
                <input 
                  type="number" 
                  placeholder="如果不确定，请留空"
                  value={formData.bodyFat || ''}
                  onChange={(e) => setFormData({...formData, bodyFat: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        const currentTotal = (formData.customMacroRatio?.p || 0) + (formData.customMacroRatio?.f || 0) + (formData.customMacroRatio?.c || 0);
        const isCustom = formData.macroPreference === MacroPreference.Custom;

        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-orange-600" /> 目标与活动
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">健身目标</label>
              <select 
                value={formData.goal}
                onChange={(e) => setFormData({...formData, goal: e.target.value as Goal})}
                className="w-full p-3 border border-slate-300 rounded-lg bg-white"
              >
                {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">日常活动量</label>
              <select 
                value={formData.activityLevel}
                onChange={(e) => setFormData({...formData, activityLevel: e.target.value as ActivityLevel})}
                className="w-full p-3 border border-slate-300 rounded-lg bg-white"
              >
                {Object.values(ActivityLevel).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">训练经验</label>
                <select 
                  value={formData.trainingHistory}
                  onChange={(e) => setFormData({...formData, trainingHistory: e.target.value as TrainingHistory})}
                  className="w-full p-3 border border-slate-300 rounded-lg bg-white"
                >
                  {Object.values(TrainingHistory).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">饮食结构偏好</label>
                <select 
                  value={formData.macroPreference}
                  onChange={(e) => setFormData({...formData, macroPreference: e.target.value as MacroPreference})}
                  className="w-full p-3 border border-slate-300 rounded-lg bg-white"
                >
                  {Object.values(MacroPreference).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* 自定义比例输入区域 */}
            {isCustom && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <PieChart size={16} /> 自定义营养素比例
                  </h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${currentTotal === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    总计: {currentTotal}%
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-blue-600 font-medium">蛋白质 (Protein)</span>
                      <span>{formData.customMacroRatio?.p}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={formData.customMacroRatio?.p}
                      onChange={(e) => updateCustomMacro('p', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-green-600 font-medium">脂肪 (Fat)</span>
                      <span>{formData.customMacroRatio?.f}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={formData.customMacroRatio?.f}
                      onChange={(e) => updateCustomMacro('f', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-orange-600 font-medium">碳水化合物 (Carbs)</span>
                      <span>{formData.customMacroRatio?.c}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={formData.customMacroRatio?.c}
                      onChange={(e) => updateCustomMacro('c', Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>
                </div>
                {currentTotal !== 100 && (
                  <p className="text-xs text-red-500 mt-2 text-center">请确保三者相加等于 100%</p>
                )}
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Moon className="text-indigo-600" /> 生活与恢复
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">每日饮水量</label>
              <div className="grid grid-cols-2 gap-2">
                {['偏少 (<1.5L)', '正常 (1.5-2.5L)', '充足 (>2.5L)'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFormData({...formData, waterIntake: opt})}
                    className={`py-2 px-3 text-sm rounded-lg border ${formData.waterIntake === opt ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">当前补剂使用</label>
              <input 
                type="text" 
                placeholder="例如：肌酸，蛋白粉，维他命 (没有填'无')"
                value={formData.supplements}
                onChange={(e) => setFormData({...formData, supplements: e.target.value})}
                className="w-full p-3 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                  <span>生活/工作压力 (1-10)</span>
                  <span className="text-indigo-600">{formData.appetiteStress}</span>
                </label>
                <input 
                  type="range" min="1" max="10" 
                  value={formData.appetiteStress}
                  onChange={(e) => setFormData({...formData, appetiteStress: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                  <span>睡眠质量 (1-10)</span>
                  <span className="text-indigo-600">{formData.sleepQuality}</span>
                </label>
                <input 
                  type="range" min="1" max="10" 
                  value={formData.sleepQuality}
                  onChange={(e) => setFormData({...formData, sleepQuality: Number(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Stethoscope className="text-emerald-600" /> 健康筛查
            </h2>
            <p className="text-sm text-slate-500">
              请选择目前存在的亚健康状况（可多选），AI 将根据您的选择提供针对性的功能医学建议。
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(SubHealthCondition).map((condition) => {
                const isSelected = formData.healthConditions.includes(condition);
                return (
                  <button
                    key={condition}
                    onClick={() => toggleCondition(condition)}
                    className={`
                      flex items-center justify-between p-4 rounded-xl border transition-all
                      ${isSelected 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600'}
                    `}
                  >
                    <span className="font-medium text-sm">{condition}</span>
                    {isSelected && <HeartPulse size={16} className="text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-2xl mx-auto border border-slate-100">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-400">STEP {step} / 4</span>
          <span className="text-xs text-slate-400">{Math.round((step / 4) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="min-h-[350px]">
        {renderStep()}
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
        <button 
          onClick={prevStep}
          disabled={step === 1}
          className={`flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium px-4 py-2 rounded-lg transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ChevronLeft size={20} /> 上一步
        </button>
        
        {step < 4 ? (
          <button 
            onClick={nextStep}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 font-medium"
          >
            下一步 <ChevronRight size={20} />
          </button>
        ) : (
          <button 
            onClick={handleFinish}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-indigo-200 font-bold"
          >
            生成方案 <Activity size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default InputWizard;
