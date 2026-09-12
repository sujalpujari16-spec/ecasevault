import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SupportedLanguage } from '../i18n/translations';

interface LanguageSelectorProps {
  variant?: 'header' | 'compact' | 'pill';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { language, setLanguage, currentOption, supportedLanguages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t('app.switch_language', 'Change Language')}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          isOpen
            ? 'bg-slate-100 border-blue-600 text-blue-900 shadow-sm'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
        }`}
      >
        <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Globe className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="text-slate-900 font-bold">{currentOption.nativeLabel}</span>
          <span className="px-1.5 py-0.2 bg-blue-100/70 text-blue-800 text-[10px] font-mono font-bold rounded">
            {currentOption.badge}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Language Options Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden text-xs py-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <span className="font-bold text-[11px] text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              {t('app.switch_language', 'Select Language')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">3 Languages</span>
          </div>

          <div className="p-1.5 space-y-1">
            {supportedLanguages.map((option) => {
              const isSelected = option.code === language;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleSelect(option.code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-900 font-bold border border-blue-200/60 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center border border-slate-200 shrink-0">
                      {option.badge}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{option.nativeLabel}</span>
                        {option.code !== 'en' && (
                          <span className="text-[11px] text-slate-500 font-normal">({option.label})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">{option.sublabel}</span>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 text-center font-medium">
            Maharashtra Police • e-CASEVAULT Multilingual
          </div>
        </div>
      )}
    </div>
  );
};
