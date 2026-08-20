import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/theme.css";
import "./styles/app.css";
import { App } from "./App";
import { registerAllTools } from "./tools";
import { bootstrapProject } from "./core/persist/io";

// Register every tool into the metadata-driven registry, then load the last
// project (or the House demo on first run) before mounting.
registerAllTools();
bootstrapProject();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
