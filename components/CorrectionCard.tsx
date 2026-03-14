import React from 'react';
import { SpellCorrection } from '../types';
import { Check, ArrowRight, Info } from 'lucide-react';

interface CorrectionCardProps {
  correction: SpellCorrection;
  onApply: (correction: SpellCorrection) => void;
}

const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction, onApply }) => {
  const typeStyles = {
    spelling: 'bg-rose-50 text-rose-600 border-rose-100',
    grammar: 'bg-amber-50 text-amber-600 border-amber-100',
    style: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  const typeLabels = {
    spelling: 'អក្ខរាវិរុទ្ធ',
    grammar: 'វេយ្យាករណ៍',
    style: 'រចនាបថ',
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-indigo-500">
      <div className="flex justify-between items-center mb-4">
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${typeStyles[correction.type]}`}>
          {typeLabels[correction.type] || correction.type}
        </span>
        <button 
          onClick={() => onApply(correction)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all khmer-font flex items-center gap-2 active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          <Check className="w-3 h-3" />
          {"អនុវត្ត"}
        </button>
      </div>
      
      <div className="flex items-center flex-wrap gap-3 mb-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
        <span className="line-through text-slate-400 khmer-font text-sm decoration-rose-300">{correction.originalText}</span>
        <ArrowRight className="w-4 h-4 text-slate-300" />
        <span className="text-indigo-600 font-black khmer-font text-base">{correction.suggestedText}</span>
      </div>
      
      <div className="flex gap-2 items-start">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500 khmer-font leading-relaxed italic">
          {correction.reason}
        </p>
      </div>
    </div>
  );
};

export default CorrectionCard;
