import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Preload credit coin icon so it renders instantly in the header
import creditCoinUrl from "@/assets/icons/credit-coin.png";
const link = document.createElement("link");
link.rel = "preload";
link.as = "image";
link.href = creditCoinUrl;
document.head.appendChild(link);

// Redirect all non-production domains to formanova.ai
const PRODUCTION_DOMAIN = 'formanova.ai';
if (
  typeof window !== 'undefined' &&
  window.location.hostname !== PRODUCTION_DOMAIN &&
  window.location.hostname !== 'www.formanova.ai' &&
  window.location.hostname !== 'localhost' &&
  !window.location.hostname.startsWith('192.168.') &&
  !window.location.hostname.startsWith('10.') &&
  !window.location.hostname.startsWith('127.')
) {
  // Preserve the path and query string during redirect
  window.location.replace(`https://${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
