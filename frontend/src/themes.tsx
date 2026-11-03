import { createContext, useContext, type CSSProperties } from "react";
import type { Module, Site } from "./types";

export const themes = [
  {
    id: "spring",
    name: "春 · 花信",
    group: "四季",
    description: "新叶绿、花瓣粉与柔和奶白",
    colors: ["#28614c", "#a44669", "#75602f"],
    background: "#f5f8f1",
    tint: "#e5efdf",
    deep: "#203f35",
  },
  {
    id: "summer",
    name: "夏 · 海风",
    group: "四季",
    description: "海洋蓝、青绿与明亮沙金",
    colors: ["#186382", "#277266", "#98611b"],
    background: "#f1f7fa",
    tint: "#dff0f5",
    deep: "#163e53",
  },
  {
    id: "autumn",
    name: "秋 · 拾光",
    group: "四季",
    description: "枫叶赭红、琥珀金与橄榄绿",
    colors: ["#91432f", "#8c611e", "#5b6842"],
    background: "#faf6ef",
    tint: "#f2e5d5",
    deep: "#51362d",
  },
  {
    id: "winter",
    name: "冬 · 晴雪",
    group: "四季",
    description: "静谧靛蓝、雾紫与冰川青",
    colors: ["#435c88", "#785580", "#366f7b"],
    background: "#f4f6fb",
    tint: "#e6ebf5",
    deep: "#2a3653",
  },
  {
    id: "christmas",
    name: "圣诞 · 冬青",
    group: "节日",
    description: "冬青绿、浆果红与暖金",
    colors: ["#28604d", "#aa3749", "#89651f"],
    background: "#faf7f0",
    tint: "#e8eee0",
    deep: "#243e34",
  },
  {
    id: "new-year",
    name: "新年 · 瑞彩",
    group: "节日",
    description: "中国红、鎏金与沉稳青玉",
    colors: ["#aa303d", "#89651b", "#386e67"],
    background: "#fcf6ef",
    tint: "#f6e3df",
    deep: "#602b32",
  },
  {
    id: "lantern",
    name: "元宵 · 灯华",
    group: "节日",
    description: "灯笼绯红、暖橙与夜空紫",
    colors: ["#9f3b55", "#a15b26", "#66518b"],
    background: "#fcf5f2",
    tint: "#f6e1df",
    deep: "#543448",
  },
  {
    id: "halloween",
    name: "万圣 · 夜游",
    group: "节日",
    description: "南瓜橙、暮色紫与苔藓绿",
    colors: ["#9d4b19", "#6c4889", "#537044"],
    background: "#f8f4fa",
    tint: "#efe0f3",
    deep: "#392c4b",
  },
  {
    id: "custom",
    name: "自选主题色",
    group: "通用",
    description: "沿用品牌色，保留各模块独立配色",
    colors: ["#226957", "#7c6639", "#76597f"],
    background: "#f5f6f2",
    tint: "#e5eddf",
    deep: "#174f43",
  },
  {
    id: "monochrome",
    name: "黑白 · 肃静",
    group: "通用",
    description: "全站灰阶，适用于纪念等特殊场景",
    colors: ["#3d3d3d", "#555555", "#666666"],
    background: "#f5f5f5",
    tint: "#e8e8e8",
    deep: "#292929",
  },
] as const;
export type ThemeId = (typeof themes)[number]["id"];
export const SiteTheme = createContext<Site | null>(null);
export const useSiteTheme = () => useContext(SiteTheme);
export function themeId(site?: Pick<Site, "theme"> | null): ThemeId {
  return themes.some((t) => t.id === site?.theme) ? site!.theme! : "custom";
}
function mix(a: string, b: string, weight: number) {
  const rgb = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(a.slice(i, i + 2), 16) * (1 - weight) +
        parseInt(b.slice(i, i + 2), 16) * weight,
    ),
  );
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// Keep white button labels readable even when a very pale brand colour is selected.
function readable(color: string) {
  const luminance = (hex: string) =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  while (luminance(color) > 0.183) color = mix(color, "#000000", 0.08);
  return color;
}
export function themeStyle(
  site?: Pick<Site, "theme" | "accent"> | null,
): CSSProperties {
  const preset = themes.find((t) => t.id === themeId(site))!;
  const custom = preset.id === "custom";
  const primary = custom
    ? readable(
        /^#[\da-f]{6}$/i.test(site?.accent ?? "") ? site!.accent : "#226957",
      )
    : preset.colors[0];
  const [secondary, tertiary] = preset.colors.slice(1);
  const deep = custom ? mix(primary, "#17212b", 0.35) : preset.deep;
  return {
    "--green": primary,
    "--accent": primary,
    "--deep": deep,
    "--secondary": secondary,
    "--tertiary": tertiary,
    "--page-bg": custom ? mix(primary, "#ffffff", 0.96) : preset.background,
    "--surface": "#ffffff",
    "--surface-soft": custom
      ? mix(primary, "#ffffff", 0.94)
      : mix(primary, "#ffffff", 0.96),
    "--tint": custom ? mix(primary, "#ffffff", 0.88) : preset.tint,
    "--cream": mix(secondary, "#ffffff", 0.83),
    "--text": mix(deep, "#17212b", 0.4),
    "--muted": mix(deep, "#ffffff", 0.3),
    "--border": mix(primary, "#ffffff", 0.84),
    "--on-dark": "#ffffff",
    "--on-dark-muted": mix(primary, "#ffffff", 0.76),
    "--hero-bg": `linear-gradient(115deg, ${deep}, ${mix(primary, tertiary, 0.3)})`,
  } as CSSProperties;
}
export function moduleStyle(module: Module, site?: Site | null): CSSProperties {
  if (themeId(site) === "custom")
    return {
      background: module.background,
      "--accent": module.accent,
    } as CSSProperties;
  const preset = themes.find((t) => t.id === themeId(site))!;
  const index = ["notice", "document"].includes(module.type)
    ? 1
    : ["video", "survey"].includes(module.type)
      ? 2
      : 0;
  const color = preset.colors[index];
  return {
    background: mix(color, "#ffffff", module.type === "ticker" ? 0.9 : 0.985),
    "--accent": color,
  } as CSSProperties;
}
