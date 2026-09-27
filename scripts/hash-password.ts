import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import crypto from "node:crypto";

const ITERATIONS = 100_000;

async function main() {
  const password = process.argv[2] ?? (await createInterface({ input: stdin, output: stdout }).question("كلمة المرور: "));
  if (!password) {
    console.error("كلمة المرور مطلوبة");
    process.exit(1);
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256").toString("hex");
  console.log(`\nCAREGIVER_PASSWORD_HASH="${ITERATIONS}:${salt}:${hash}"`);
  console.log('\nانقل هذا السطر إلى ملف .env (أو Environment Variables في Vercel)');
}

main();
