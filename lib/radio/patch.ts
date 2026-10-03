import { readFile } from "fs/promises";
import path from "path";

export type PatchFile = {
  name: string;
  path: string;
  content: string;
};

const PATCH_DIR = path.join(process.cwd(), "radio/patch");

const PATCH_FILES = ["boot.scd", "live.scd", "placeholder.scd"] as const;

export async function getPatchFiles(): Promise<PatchFile[]> {
  return Promise.all(
    PATCH_FILES.map(async (name) => ({
      name,
      path: `radio/patch/${name}`,
      content: await readFile(path.join(PATCH_DIR, name), "utf-8"),
    })),
  );
}
