import { createRoot } from "react-dom/client";
import { WebApp } from "./WebApp";

const container = document.getElementById("root")!;

document.body.style.margin = "0";
document.body.style.height = "100vh";
container.style.height = "100%";

const root = createRoot(container);
root.render(<WebApp />);
