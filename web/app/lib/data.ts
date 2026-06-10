import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Predictions } from "./types";

export async function getPredictions(): Promise<Predictions> {
  const file = path.join(process.cwd(), "public", "data", "predictions.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as Predictions;
}
