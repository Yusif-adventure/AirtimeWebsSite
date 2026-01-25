import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import app from "./functions/server/index.tsx";

const rootApp = new Hono();

rootApp.get("/", (c) => c.text("Airtime Backend is Live!"));

// Mount the imported app under /functions/v1
rootApp.route("/functions/v1", app);

const port = parseInt(process.env.PORT || "54321");

console.log(`Server is running on port ${port}`);

serve({
  fetch: rootApp.fetch,
  port,
});
