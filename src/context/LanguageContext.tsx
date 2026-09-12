import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageOption, translations } from '../i18n/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultText?: string) => string;
  currentOption: LanguageOption;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'ecv_app_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'mr' || saved === 'hi') {
        return saved;
      }
    } catch {
      // localStorage may be restricted
    }
    return 'en';
  });

  const setLanguage = (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const currentOption = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const t = useMemo(() => {
    return (key: string, defaultText?: string): string => {
      const langDict = translations[language];
      if (langDict && langDict[key]) {
        return langDict[key];
      }
      // Fallback to English
      const enDict = translations.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return defaultText || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      currentOption,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, currentOption, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
