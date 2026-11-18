import express from "express";
import cors from "cors";
import "dotenv/config";
import routes from "./routes";
import { errorMiddleware } from "./middleware/errorMiddleware";
import { auditMiddleware } from "./middleware/auditMiddleware";

const app = express();
const port = process.env.PORT || 3000;

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(auditMiddleware);

// Routes
app.use(routes);

// Global Error Handler
app.use(errorMiddleware);

// Start Server
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`🚀 Server running on Node.js at http://localhost:${port}`);
    console.log(`📋 Health check: http://localhost:${port}/health`);
  });
}

export default app;

