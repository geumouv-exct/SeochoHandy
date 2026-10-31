import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const indexFile = resolve("out/index.html");
const fallbackFile = resolve("out/404.html");

if (!existsSync(indexFile)) {
  throw new Error("정적 내보내기 결과 out/index.html을 찾지 못했습니다.");
}

copyFileSync(indexFile, fallbackFile);
console.log("GitHub Pages 경로 새로고침용 out/404.html을 만들었습니다.");
