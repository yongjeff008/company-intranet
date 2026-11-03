export interface Grant {
  departmentId: string;
  canViewResults: boolean;
}
export interface Account {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  grants: Grant[];
}
export interface Department {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}
export interface Doc<T = unknown> {
  id: string;
  kind: string;
  departmentId: string | null;
  draft: string;
  published: string | null;
  version: number;
  updatedAt: string;
  data?: T;
}
export interface Question {
  id: string;
  title: string;
  type: string;
  required: boolean;
  options: string[];
  min: number | null;
  max: number | null;
}
export interface Content {
  type: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  pinned: boolean;
  coverId: string | null;
  assetIds: string[];
  videoId: string | null;
  videoUrl: string;
  link: string;
  documentNumber: string;
  issuer: string;
  issuedOn: string;
  effectiveState: string;
  replacesId: string;
  changeNote: string;
  startsAt: string | null;
  endsAt: string | null;
  questions: Question[];
  anonymous: boolean;
  closed: boolean;
}
export interface Module {
  id: string;
  type: string;
  title: string;
  variant: string;
  width: number;
  count: number;
  hidden: boolean;
  departmentId: string;
  category: string;
  accent: string;
  background: string;
  emptyMode: string;
  tickerMode: string;
  selectedIds: string[];
  templateId: string;
  templateVersion: number;
}
export interface Page {
  name: string;
  description: string;
  layout: string;
  accent: string;
  modules: Module[];
}
export interface Site {
  name: string;
  subtitle: string;
  footer: string;
  accent: string;
  theme?: import("./themes").ThemeId;
}
export interface Template {
  name: string;
  html: string;
  itemHtml: string;
  css: string;
}
export interface Item {
  id: string;
  departmentId: string;
  departmentName: string;
  updatedAt: string;
  data: Content;
}
export interface PortalModule {
  config: Module;
  items: Item[];
  template: Template | null;
}
export interface Portal {
  page: Page;
  modules: PortalModule[];
  site: Site;
  preview: boolean;
}
export interface Asset {
  id: string;
  departmentId: string;
  filename: string;
  mime: string;
  size: number;
}
export interface Revision {
  version: number;
  action: string;
  actor: string;
  createdAt: string;
  data: string;
}
export const kinds: Record<string, string> = {
  news: "新闻资讯",
  notice: "通知公告",
  video: "视频培训",
  document: "红头文件",
  ticker: "跑马灯新闻",
  survey: "问卷调查",
};
export const roles: Record<string, string> = {
  admin: "系统管理员",
  it: "IT 配置管理员",
  editor: "部门管理员",
  reader: "普通用户",
};
export const defaultContent = (type = "news"): Content => ({
  type,
  title: "",
  summary: "",
  body: "",
  category: "",
  author: "",
  pinned: false,
  coverId: null,
  assetIds: [],
  videoId: null,
  videoUrl: "",
  link: "",
  documentNumber: "",
  issuer: "",
  issuedOn: "",
  effectiveState: "effective",
  replacesId: "",
  changeNote: "",
  startsAt: null,
  endsAt: null,
  questions: [],
  anonymous: true,
  closed: false,
});
export const defaultModule = (type = "news", departmentId = ""): Module => ({
  id: crypto.randomUUID(),
  type,
  title: kinds[type],
  variant: "list",
  width: type === "ticker" ? 12 : 6,
  count: 5,
  hidden: false,
  departmentId,
  category: "",
  accent: "#226957",
  background: "#ffffff",
  emptyMode: "show",
  tickerMode: "scroll",
  selectedIds: [],
  templateId: "",
  templateVersion: 0,
});
