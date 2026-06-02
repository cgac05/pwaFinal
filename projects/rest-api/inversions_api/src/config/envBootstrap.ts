import dotenv from "dotenv";
import path from "path";

// Load the project-local .env first, then the workspace-root .env as fallback.
// This keeps local overrides when they exist while still supporting the shared
// root .env used in the workspace.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../../.env") });
