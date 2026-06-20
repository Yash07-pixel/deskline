import { config } from "dotenv";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyticsRouter } from "./routes/analytics.js";
import { aiRouter } from "./routes/ai.js";
import { notificationsRouter, ticketsRouter } from "./routes/tickets.js";
import "./db/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const frontendUrl = process.env.FRONTEND_URL;

app.use(
  cors({
    origin: isProduction ? frontendUrl : "http://localhost:5173"
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "deskline-backend" });
});

app.use("/api/tickets", ticketsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/analytics", analyticsRouter);

const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

if (isProduction && existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(frontendIndexPath);
  });
}

app.listen(port, () => {
  console.log(`Deskline backend listening on http://localhost:${port}`);
});
