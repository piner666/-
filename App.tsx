import React, { useState } from 'react';
import InputWizard from './components/InputWizard';
import ResultsDashboard from './components/ResultsDashboard';
import { UserInput } from './types';
import { Dumbbell } from 'lucide-react';

const App: React.FC = () => {
  const [userData, setUserData] = useState<UserInput | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Dumbbell size={24} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
              NeuroFit 运动营养
            </span>
          </div>
          {userData && (
            <button 
              onClick={() => setUserData(null)}
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              重新开始
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!userData ? (
          <>
            <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
              <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                精准营养，<br/>
                <span className="text-indigo-600">为运动表现而生。</span>
              </h1>
              <p className="text-lg text-slate-600">
                科学的饮食规划方案。我们使用 Katch-McArdle & Mifflin-St Jeor 协议精确计算您的代谢需求，并利用 AI 制定完美的膳食计划。
              </p>
            </div>
            <InputWizard onComplete={setUserData} />
          </>
        ) : (
          <ResultsDashboard userData={userData} onReset={() => setUserData(null)} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} NeuroFit 运动营养。基于运动营养程序架构图开发。</p>
          <p className="mt-2">免责声明：本工具仅供参考。在开始任何饮食计划前请咨询专业医师。</p>
        </div>
      </footer>
    </div>
  );
};

export default App;