import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ensureStorageReady } from "./storage";
import "./styles.css";

async function bootstrap() {
  try {
    await ensureStorageReady();
  } catch (err) {
    console.error("GradeBoss storage init failed:", err);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
