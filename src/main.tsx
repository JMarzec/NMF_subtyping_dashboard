import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const root=document.getElementById("root");
if(!root)throw new Error("App root is missing");
createRoot(root).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
