import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Pill } from "./components/Pill";
import "./index.css";

createRoot(document.getElementById("pill")!).render(
  <StrictMode>
    <Pill />
  </StrictMode>,
);
