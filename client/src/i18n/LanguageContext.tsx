import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { t as translate, languages } from "./translations";

const RTL_LANGS = ["ar", "he", "ur", "fa"];

interface LanguageContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("dropandsell_lang") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang: string) => {
    if (newLang === lang) return;
    try {
      localStorage.setItem("dropandsell_lang", newLang);
    } catch {}
    document.documentElement.dir = RTL_LANGS.includes(newLang) ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
    setLangState(newLang);
    // The DomTranslator (mounted at the app root) reacts to this change and
    // translates every visible word — including dynamically loaded content —
    // without needing a full page reload.
  }, [lang]);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { languages };
