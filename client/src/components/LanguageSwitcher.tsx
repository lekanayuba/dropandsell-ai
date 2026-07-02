import { useLanguage, languages } from "@/i18n/LanguageContext";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LanguageSwitcherProps {
  variant?: "default" | "compact" | "login" | "sidebar";
}

export function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();

  const currentLang = languages.find(l => l.code === lang);

  const triggerClass =
    variant === "login"
      ? "w-[160px] h-8 text-xs border-white/20 bg-white/10 text-white/80 hover:bg-white/15 focus:ring-0"
      : variant === "sidebar"
      ? "w-full h-8 text-xs border-white/15 bg-white/10 text-white/70 hover:bg-white/15 focus:ring-0"
      : variant === "compact"
      ? "w-[140px] h-8 text-xs"
      : "w-[180px] h-9 text-sm";

  const globeClass =
    variant === "sidebar"
      ? "w-4 h-4 text-white/50 flex-shrink-0"
      : "w-4 h-4 text-muted-foreground flex-shrink-0";

  return (
    <div className="flex items-center gap-1.5" data-testid="language-switcher">
      <Globe className={globeClass} />
      <Select value={lang} onValueChange={setLang}>
        <SelectTrigger
          className={triggerClass}
          data-testid="select-language"
        >
          <SelectValue>{currentLang?.name || "English"}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[320px]" data-testid="language-options">
          {languages.map((l) => (
            <SelectItem
              key={l.code}
              value={l.code}
              className="text-sm"
              data-testid={`lang-option-${l.code}`}
            >
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
