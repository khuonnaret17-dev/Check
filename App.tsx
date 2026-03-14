import React, { useState, useCallback, useEffect, useRef } from 'react';
import { analyzeKhmerText } from './services/geminiService';
import { AnalysisResult, HistoryItem, SpellCorrection } from './types';
import CorrectionCard from './components/CorrectionCard';
import { 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Copy, 
  Check, 
  Sparkles, 
  Loader2, 
  Key,
  Eraser,
  ClipboardCheck,
  X,
  ChevronRight,
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Studio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<{ message: string; type: 'auth' | 'general' } | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedImproved, setCopiedImproved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // Check for API Key on load
  useEffect(() => {
    const checkKeyStatus = async () => {
      setIsCheckingKey(true);
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.API_KEY;
      if (apiKey && apiKey !== "") {
        setNeedsKey(false);
        setIsCheckingKey(false);
        return;
      }

      if (typeof window !== 'undefined' && (window as Window & { aistudio?: Studio }).aistudio) {
        try {
          const hasKey = await (window as Window & { aistudio: Studio }).aistudio.hasSelectedApiKey();
          setNeedsKey(!hasKey);
        } catch {
          setNeedsKey(true);
        }
      } else {
        setNeedsKey(true);
      }
      setIsCheckingKey(false);
    };
    
    checkKeyStatus();
    
    const savedHistory = localStorage.getItem('khmer_spellcheck_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const handleOpenKeyDialog = async () => {
    if (typeof window !== 'undefined' && (window as Window & { aistudio?: Studio }).aistudio) {
      await (window as Window & { aistudio: Studio }).aistudio.openSelectKey();
      setNeedsKey(false);
      setError(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightLayerRef.current) {
      highlightLayerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const saveToHistory = useCallback((text: string, analysis: AnalysisResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      text,
      result: analysis
    };
    const updatedHistory = [newItem, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('khmer_spellcheck_history', JSON.stringify(updatedHistory));
  }, [history]);

  const handleCheck = async () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeKhmerText(inputText);
      setResult(data);
      saveToHistory(inputText, data);
    } catch (err: unknown) {
      console.error("Check Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage === 'MISSING_API_KEY') {
        setNeedsKey(true);
        setError({
          type: 'auth',
          message: 'សូមភ្ជាប់ API Key ដើម្បីប្រើប្រាស់មុខងារនេះ។'
        });
      } else {
        setError({
          type: 'general',
          message: 'មានបញ្ហាបច្ចេកទេស។ សូមព្យាយាមម្តងទៀត។'
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyAll = () => {
    if (result) {
      setInputText(result.improvedText);
      setResult(null);
    }
  };

  const handleApplySingle = (correction: SpellCorrection) => {
    const escaped = correction.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newText = inputText.replace(new RegExp(escaped, 'g'), correction.suggestedText);
    setInputText(newText);
    
    if (result) {
      const remaining = result.corrections.filter(c => c.originalText !== correction.originalText);
      setResult({
        ...result,
        corrections: remaining,
        isCorrect: remaining.length === 0,
        improvedText: result.improvedText
      });
    }
  };

  const copyToClipboard = (text: string, type: 'input' | 'improved') => {
    navigator.clipboard.writeText(text);
    if (type === 'input') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedImproved(true);
      setTimeout(() => setCopiedImproved(false), 2000);
    }
  };

  const renderHighlightedText = () => {
    if (!result || result.corrections.length === 0) return inputText;

    const sortedCorrections = [...result.corrections].sort((a, b) => b.originalText.length - a.originalText.length);
    
    let html = inputText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const placeholders: string[] = [];
    
    sortedCorrections.forEach((c, i) => {
      const escapedOriginal = c.originalText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (escapedOriginal) {
        const placeholder = `__CORRECTION_${i}__`;
        placeholders[i] = `<span class="highlight-error">${escapedOriginal}</span>`;
        const regex = new RegExp(escapedOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        html = html.replace(regex, placeholder);
      }
    });

    placeholders.forEach((p, i) => {
      html = html.replace(new RegExp(`__CORRECTION_${i}__`, 'g'), p);
    });

    return <div dangerouslySetInnerHTML={{ __html: html + '\n' }} />;
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('khmer_spellcheck_history');
  };

  const loadFromHistory = (item: HistoryItem) => {
    setInputText(item.text);
    setResult(item.result);
    setShowHistory(false);
  };

  if (isCheckingKey) {
    return (
      <div className="min-h-screen bg-[#f5e6ca] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
          <p className="khmer-font text-slate-500 animate-pulse">{"កំពុងរៀបចំកម្មវិធី..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center py-8 px-4 sm:px-6 selection:bg-amber-100">
      <header className="max-w-5xl w-full text-center mb-12">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative inline-block group"
        >
          <div className="khmer-ancient-frame transition-all duration-500 group-hover:shadow-[0_0_40px_rgba(212,175,55,0.4)]">
            <div className="kbach-corner tl-kbach" />
            <div className="kbach-corner tr-kbach" />
            <div className="kbach-corner bl-kbach" />
            <div className="kbach-corner br-kbach" />
            <div className="kbach-center top-center" />
            <div className="kbach-center bottom-center" />
            <div className="frame-inner-border" />
            <h1 className="text-4xl md:text-6xl font-black text-white niroth-font relative z-10 px-16 py-6">
              កម្មវិធីពិនិត្យអក្ខរាវិរុទ្ធ
            </h1>
          </div>

        </motion.div>
      </header>

      <main className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-6">
          <AnimatePresence>
            {needsKey && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-amber-500/10 backdrop-blur-md border border-amber-500/30 p-6 rounded-[2.5rem] flex flex-col sm:flex-row gap-6 items-center overflow-hidden"
              >
                <div className="bg-amber-500 p-4 rounded-2xl text-white shadow-lg shadow-amber-500/30">
                  <Key className="w-6 h-6" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-amber-800 font-bold khmer-font text-lg">{"មិនទាន់មាន API Key"}</h4>
                  <p className="text-amber-700/70 text-sm khmer-font leading-relaxed">
                    {"សូមភ្ជាប់ API Key ដើម្បីឱ្យកម្មវិធីអាចពិនិត្យអត្ថបទរបស់អ្នកបាន។"}
                  </p>
                </div>
                <button 
                  onClick={handleOpenKeyDialog}
                  className="whitespace-nowrap px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold khmer-font transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  {"ភ្ជាប់ឥឡូវនេះ"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            className="bg-[#fcf9f2] khmer-card-pattern rounded-[3rem] shadow-2xl shadow-amber-900/10 overflow-hidden border border-amber-100/50 flex flex-col min-h-[650px] relative"
          >
            <div className="bg-[#f5e6ca]/30 border-b border-amber-100/50 px-8 py-6 flex justify-between items-center">
              <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                  <span className="khmer-font">{"តួអក្សរ: "}{inputText.length}</span>
                </div>
                {result && result.corrections.length > 0 && (
                  <div className="flex items-center gap-2.5 text-rose-500">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="khmer-font">{"កំហុស: "}{result.corrections.length}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => copyToClipboard(inputText, 'input')}
                  disabled={!inputText}
                  className={cn(
                    "p-3 rounded-2xl transition-all flex items-center gap-2 border border-transparent",
                    copied ? "bg-green-50 text-green-600 border-green-100" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  )}
                  title="Copy to Clipboard"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => {
                    setInputText('');
                    setResult(null);
                  }} 
                  className="p-3 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-2xl transition-all border border-transparent hover:border-rose-100" 
                  title="Clear All"
                >
                  <Eraser className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="editor-container relative group flex-1">
              <div ref={highlightLayerRef} className="editor-layer khmer-font custom-scrollbar p-8 text-xl leading-[1.8]">{renderHighlightedText()}</div>
              <textarea
                ref={textareaRef}
                className="editor-textarea khmer-font custom-scrollbar p-8 text-xl leading-[1.8] focus:ring-0"
                placeholder="សូមសរសេរ ឬចម្លងអត្ថបទនៅទីនេះ ដើម្បីពិនិត្យ..."
                value={inputText}
                onScroll={handleScroll}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (result) setResult(null);
                }}
              />
            </div>

          <div className="p-8 bg-[#fcf9f2] border-t border-amber-50 flex flex-wrap justify-between items-center gap-6 sticky bottom-0 z-30">
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "px-6 py-4 rounded-[1.5rem] transition-all flex items-center gap-3 khmer-font text-sm font-bold shadow-sm",
                    showHistory ? "bg-indigo-600 text-white shadow-indigo-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <History className="w-4.5 h-4.5" />
                  {"ប្រវត្តិ"}
                </button>
              </div>

              <div className="flex gap-4">
                {result && !result.isCorrect && result.corrections.length > 0 && (
                  <button 
                    onClick={handleApplyAll} 
                    className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-[1.5rem] font-bold transition-all shadow-xl shadow-teal-600/20 khmer-font flex items-center gap-3 active:scale-95"
                  >
                    <ClipboardCheck className="w-5 h-5" />
                    {"កែតម្រូវទាំងអស់"}
                  </button>
                )}
                <button 
                  onClick={handleCheck}
                  disabled={isAnalyzing || !inputText.trim()}
                  className={cn(
                    "px-14 py-4 rounded-[1.5rem] font-bold transition-all shadow-2xl flex items-center gap-3 khmer-font active:scale-95",
                    isAnalyzing || !inputText.trim()
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/40'
                  )}
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />{"កំពុងពិនិត្យ..."}</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" />{"ពិនិត្យអត្ថបទ"}</>
                  )}
                </button>
              </div>
            </div>

            {/* History Overlay */}
            <AnimatePresence>
              {showHistory && (
                <motion.div 
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="absolute inset-0 z-40 bg-[#fcf9f2]/98 backdrop-blur-xl flex flex-col"
                >
                  <div className="p-8 border-b border-amber-50 flex justify-between items-center">
                    <h4 className="khmer-font font-black text-xl flex items-center gap-3 text-slate-800">
                      <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                        <History className="w-5 h-5" />
                      </div>
                      {"ប្រវត្តិការពិនិត្យ"}
                    </h4>
                    <div className="flex gap-3">
                      <button onClick={clearHistory} className="text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-2xl text-xs font-bold khmer-font transition-all flex items-center gap-2 border border-transparent hover:border-rose-100">
                        <Trash2 className="w-4 h-4" />
                        {"លុបទាំងអស់"}
                      </button>
                      <button onClick={() => setShowHistory(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                    {history.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                          <History className="w-12 h-12" />
                        </div>
                        <p className="khmer-font text-lg font-bold">{"មិនទាន់មានប្រវត្តិ"}</p>
                        <p className="khmer-font text-sm opacity-60 mt-2">{"រាល់ការពិនិត្យរបស់អ្នកនឹងបង្ហាញនៅទីនេះ"}</p>
                      </div>
                    ) : (
                      history.map((item) => (
                        <motion.div 
                          key={item.id} 
                          whileHover={{ scale: 1.01 }}
                          onClick={() => loadFromHistory(item)}
                          className="p-6 border border-slate-100 rounded-[2rem] hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all group relative overflow-hidden"
                        >
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors"></div>
                              <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">
                                {new Date(item.timestamp).toLocaleDateString('km-KH')} {new Date(item.timestamp).toLocaleTimeString('km-KH')}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border",
                              item.result.isCorrect 
                                ? "bg-green-50 text-green-600 border-green-100" 
                                : "bg-rose-50 text-rose-600 border-rose-100"
                            )}>
                              {item.result.isCorrect ? "ត្រឹមត្រូវ" : `${item.result.corrections.length} កំហុស`}
                            </span>
                          </div>
                          <p className="khmer-font text-base text-slate-600 line-clamp-2 leading-relaxed group-hover:text-slate-900 transition-colors">
                            {item.text}
                          </p>
                          <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                            <ChevronRight className="w-5 h-5 text-indigo-400" />
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <AnimatePresence>
            {error?.type === 'general' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-600 rounded-[2rem] khmer-font text-sm flex items-center gap-4 shadow-lg shadow-rose-500/5"
              >
                <div className="bg-rose-500 p-2 rounded-xl text-white">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                </div>
                <div className="flex-1">
                  <p className="font-bold">{"មានបញ្ហាបច្ចេកទេស"}</p>
                  <p className="opacity-70">{error.message}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="lg:col-span-4 space-y-6">
          <motion.div 
            layout
            className="bg-[#fcf9f2] rounded-[3rem] shadow-2xl shadow-amber-900/10 border border-amber-100/50 p-8 min-h-[600px] flex flex-col sticky top-8"
          >
            <h3 className="text-xl font-black text-slate-800 mb-8 khmer-font flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              {"លទ្ធផលវិភាគ"}
            </h3>
            
            <AnimatePresence mode="wait">
              {!result && !isAnalyzing && (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-24 h-24 bg-amber-50 rounded-[2rem] flex items-center justify-center relative">
                    <ClipboardCheck className="w-12 h-12 text-amber-200" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-100 rounded-full border-4 border-[#fcf9f2]"></div>
                  </div>
                  <div className="space-y-2">
                    <p className="khmer-font text-slate-800 font-bold">{"ត្រៀមខ្លួនរួចរាល់"}</p>
                    <p className="khmer-font text-slate-400 text-xs leading-relaxed max-w-[200px] mx-auto">{"សូមបញ្ចូលអត្ថបទរួចចុចប៊ូតុង 'ពិនិត្យអត្ថបទ' ដើម្បីឱ្យកម្មវិធីជួយពិនិត្យ"}</p>
                  </div>
                </motion.div>
              )}

              {isAnalyzing && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {[1,2,3].map(i => (
                    <div key={i} className="space-y-4">
                      <div className="h-4 bg-slate-100 rounded-full w-1/3 animate-pulse"></div>
                      <div className="h-32 bg-slate-50 rounded-[2rem] animate-pulse"></div>
                    </div>
                  ))}
                </motion.div>
              )}

              {result && (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 flex-1 flex flex-col"
                >
                  <div className={cn(
                    "p-6 rounded-[2.5rem] border transition-all relative overflow-hidden",
                    result.isCorrect 
                      ? 'bg-green-50/50 border-green-100 text-green-800' 
                      : 'bg-amber-50/50 border-amber-100 text-amber-800'
                  )}>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                      <div className={cn(
                        "p-2 rounded-xl",
                        result.isCorrect ? "bg-green-500 text-white" : "bg-amber-600 text-white"
                      )}>
                        {result.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                      </div>
                      <p className="font-black khmer-font text-lg">{result.isCorrect ? '✨ ត្រឹមត្រូវល្អ!' : '📝 ការវិភាគសង្ខេប'}</p>
                    </div>
                    <p className="text-sm khmer-font leading-[1.7] opacity-80 relative z-10">{result.summary}</p>
                    <div className="absolute -right-4 -bottom-4 opacity-5">
                      <Sparkles className="w-24 h-24" />
                    </div>
                  </div>

                  {result.isCorrect ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/10"
                      >
                        <CheckCircle2 className="w-10 h-10" />
                      </motion.div>
                      <div className="space-y-2">
                        <p className="khmer-font text-slate-800 font-bold text-lg">{"អស្ចារ្យណាស់!"}</p>
                        <p className="khmer-font text-slate-400 text-sm">{"អត្ថបទរបស់អ្នកត្រឹមត្រូវតាមក្បួនខ្នាតហើយ"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="khmer-font font-bold text-slate-500 text-xs uppercase tracking-widest">{"បញ្ជីកែតម្រូវ"}</h4>
                        <button 
                          onClick={() => copyToClipboard(result.improvedText, 'improved')}
                          className={cn(
                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all",
                            copiedImproved ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          )}
                        >
                          {copiedImproved ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedImproved ? "ចម្លងរួច" : "ចម្លងអត្ថបទដែលកែរួច"}
                        </button>
                      </div>
                      <div className="space-y-5 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar pb-4">
                        {result.corrections.map((c, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx}
                          >
                            <CorrectionCard correction={c} onApply={handleApplySingle} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </aside>
      </main>

      <footer className="mt-24 text-center text-slate-400 text-sm khmer-font pb-16 border-t border-slate-100 pt-12 w-full max-w-6xl">
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 mb-8 font-bold text-slate-500">
          <span className="hover:text-indigo-600 cursor-pointer transition-colors flex items-center gap-2">
            <Info className="w-4 h-4" />
            {"អំពីកម្មវិធី"}
          </span>
          <span className="hover:text-indigo-600 cursor-pointer transition-colors flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {"គោលការណ៍ឯកជនភាព"}
          </span>
          <span className="hover:text-indigo-600 cursor-pointer transition-colors flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {"ជំនួយ"}
          </span>
        </div>
        <div className="space-y-2 opacity-60">
          <p className="font-black tracking-widest uppercase text-[10px]">{"Khmer Spell Checker Pro"}</p>
          <p>{"© "}{new Date().getFullYear()}{" រក្សាសិទ្ធិគ្រប់យ៉ាង - បង្កើតឡើងដោយបច្ចេកវិទ្យាជំនាន់ថ្មី"}</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
