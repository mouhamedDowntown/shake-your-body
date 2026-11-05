import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TrayPopup } from "./components/TrayPopup";
import "./index.css";

createRoot(document.getElementById("popup")!).render(
  <StrictMode>
    <TrayPopup />
  </StrictMode>,
);
