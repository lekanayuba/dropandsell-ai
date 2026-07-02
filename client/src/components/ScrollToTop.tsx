import { useState, useEffect, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => {
    const scrollContainer = document.querySelector("main");
    if (scrollContainer) {
      setVisible(scrollContainer.scrollTop > 300);
    }
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!scrollContainer) return;
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector("main");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full w-10 h-10 shadow-lg bg-[#285261] hover:bg-[#1e3f4d] text-white transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
      data-testid="button-scroll-to-top"
    >
      <ArrowUp className="w-5 h-5" />
    </Button>
  );
}
