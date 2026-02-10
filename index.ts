import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";

import eventRoutes from "./routes/eventRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import mosqueRoutes from "./routes/mosqueRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());

// Log request middleware(receptionist)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} request for ${req.url}`);
    next();
});

app.use("/api/events", eventRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/mosques", mosqueRoutes);
app.get("/health", (req, res) => {
  res.send("Server is up and running!");
});

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
