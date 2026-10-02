/**
 * Prepend anúncio oficial PIMO vNext (M10) em public/updates/news.json.
 */
import fs from "node:fs";

const NEWS_PATH = "public/updates/news.json";
const raw = fs.readFileSync(NEWS_PATH, "utf8").replace(/^\uFEFF/, "");
const data = JSON.parse(raw);
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version = `v${String(now.getFullYear()).slice(-1)}.${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
const publishedAt = now.toISOString();

const title = "PIMO vNext — lançamento oficial (M10 Final)";
const description = [
  "O PIMO vNext está oficialmente concluído e é agora o motor principal do sistema.",
  "RoomMeshEngine substitui o RoomManager; mesh derivado de project.room (mm).",
  "Domínio unificado em pimo-room/domain (AI/IFC/Catalog/Bridge/Converter); pimo-room-v4 removido.",
  "UI via uiStore; sync sem wallStore; legado 3d/room e wallStore eliminados.",
  "Industrial/CNC intacto. Base sólida para a nova geração do PIMO.",
].join(" ");

const entry = {
  version,
  title,
  description,
  publishedAt,
  type: "feature",
  author: "pimo-pro",
  icon: "feature",
};

const news = (Array.isArray(data.news) ? data.news : []).filter(
  (n) => n && n.version !== version && n.version !== "v.." && n.title !== title
);
news.unshift(entry);

fs.writeFileSync(
  NEWS_PATH,
  `${JSON.stringify({ updatedAt: publishedAt, news }, null, 2)}\n`,
  "utf8"
);
console.log("ok", version);
