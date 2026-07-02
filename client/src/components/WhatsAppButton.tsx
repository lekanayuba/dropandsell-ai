import { SiWhatsapp } from "react-icons/si";

const WHATSAPP_NUMBER = "2348067523442";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      data-testid="link-whatsapp"
      className="fixed bottom-36 right-6 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg z-50 flex items-center justify-center transition-transform hover:scale-110 hover:bg-[#1ebe57] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]"
    >
      <SiWhatsapp className="h-7 w-7" />
    </a>
  );
}
