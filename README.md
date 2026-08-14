# 瓜分Design

> 一款浏览器端的 UI/UX 设计工具

XGDesign 是前后端分离的全栈应用：

- **前端**：React 19 + TypeScript + Vite 单页应用，数据驱动画布设计器
- **后端**：Spring Boot 3.3.5 + Java 21 + PostgreSQL 16 + JWT 认证
- **部署**：Docker Compose 一键启动全栈

## 功能特性

### 设计编辑器
- 数据驱动画布渲染，支持 frame / group / rectangle / text / chart / comment / path 七类图层
- 四区工作台：顶部工具栏、左侧图层面板（图层 / 组件两个 tab）、中央无限画布、右侧检视器（设计 / 原型 / 检查三个 tab）
- 绘制工具：画板、矩形、钢笔路径、文本、评论；组件库内置 8 种模板拖拽/点击插入
- 多页文档管理：新建 / 重命名 / 复制 / 删除页面，画板尺寸预设
- 选择能力：框选、Shift 多选、多选整体拖拽、Shift 等比缩放、拖拽吸附（6px）、Alt 间距标注
- 画布交互：滚轮缩放、空格 / 中键平移、适应画布、旋转手柄（15° 吸附）
- 属性编辑：X/Y/W/H、旋转、圆角、填充、透明度、描边、阴影、文本样式、图表数据、评论内容
- 图层树：搜索、分组、排序、显隐/锁定、双击重命名、右键菜单
- 撤销/重做历史（上限 50 条快照）
- 原型连接 + 交互式全屏预览（转场：instant / dissolve / slide）
- 导出：选中图层 PNG 导出（@1x / @2x）、复制 CSS / JSON 片段
- 设计检查：文本溢出、隐藏锁定、超出画板、空名称、低对比度等规则

### 账号与协作
- 注册 / 登录 / 会话恢复（JWT + BCrypt）
- 项目列表首页：新建、复制、归档 / 取消归档、物理删除、导入本地项目
- 文档分享：匿名链接（仅查看 / 可编辑），重新分享即刻使旧链接失效
- 协作者：邀请、角色管理（owner / editor / viewer）、移除成员
- 操作日志流水（文档、认证、分享、成员事件）

### 数据与持久化
- 文档以整体 JSON 存储于 PostgreSQL `jsonb` 字段
- 版本号乐观锁，冲突返回 409，前端提供「加载最新 / 另存为新文件」两种解决方式
- 500ms 防抖自动保存
- 双数据源抽象：远程后端（默认 `remote`）与本地 localStorage（`local`）可切换

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite、原生 fetch + useReducer（无第三方 UI/状态库） |
| 后端 | Spring Boot 3.3.5、Spring Security、Spring Data JPA、jjwt 0.12.6 |
| 数据库 | PostgreSQL 16、Flyway 迁移 |
| 部署 | Docker Compose、Nginx（静态托管 + 反向代理） |

## 快速开始

### 方式一：Docker Compose 一键启动（推荐）

```bash
# 1. 准备环境变量（按需修改）
cp .env.example .env

# 2. 启动全栈（数据库 + 后端 + 前端）
docker compose up -d --build
```

启动后：

- 前端：<http://localhost>
- 后端健康检查：<http://localhost:8090/api/health>

停止：`docker compose down`；如需清空数据卷：`docker compose down -v`。

### 方式二：本地开发

前置要求：Node.js 20+、JDK 21、Maven 3.9+、Docker（或本地 PostgreSQL 16）。

```bash
# 1. 只启动数据库（Docker）
docker compose -f docker-compose.dev.yml up -d

# 2. 启动后端（端口 8090）
cd backend
mvn spring-boot:run

# 3. 启动前端（Vite dev server，端口 5183，/api 代理到 8090）
cd frontend
npm install
npm run dev
```

访问 <http://localhost:5183>。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `xgdesign` | PostgreSQL 凭据与库名 |
| `JWT_SECRET` | 开发默认值 | JWT 签名密钥，**生产环境必须修改**（建议 ≥32 字节随机值） |
| `JWT_TTL_HOURS` | `24` | Token 有效期（小时） |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/xgdesign` | 数据库连接串 |
| `VITE_REPOSITORY` | `remote` | 前端数据源：`remote`（后端）或 `local`（localStorage） |

## 目录结构

```text
.
├── backend/                  # Spring Boot 后端
│   ├── src/main/java/        #   auth / project / config / security / common
│   ├── src/main/resources/
│   │   ├── application.yml   #   端口 8090、JWT、Flyway 配置
│   │   └── db/migration/     #   Flyway SQL 迁移
│   ├── pom.xml
│   └── Dockerfile            # Maven 多阶段构建 → JRE 21
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/       #   toolbar / layers / canvas / inspector / projects / share / auth
│   │   ├── state/            #   editor-reducer / editor-store
│   │   ├── services/         #   http / auth / documentRepository（remote + local）
│   │   ├── types/            #   design.ts / project.ts
│   │   ├── hooks/            #   useKeyboardShortcuts 等
│   │   ├── utils/            #   geometry / export / inspect
│   │   └── fixtures/         #   starter-document（内置模板）
│   ├── vite.config.ts        #   dev 端口 5183，/api 代理 8090
│   ├── nginx.conf            #   /api 反代 backend:8090，SPA 回退
│   ├── Dockerfile            # Node 构建 → Nginx
│   └── package.json
├── docker-compose.yml        # 全栈编排（db / backend / frontend）
├── docker-compose.dev.yml    # 仅数据库（本地开发）
└── .env.example              # 环境变量模板
```

## API 概览

统一响应格式：`{ code, message, data }`（`code === 0` 为成功）。

| 模块 | 路径 | 说明 |
|---|---|---|
| 认证 | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | 注册 / 登录 / 会话恢复 |
| 项目 | `GET|POST /api/projects` · `POST /api/projects/{id}/duplicate` · `archive` / `unarchive` / `DELETE` | 项目生命周期 |
| 文档 | `GET|PUT /api/documents/{id}` · `PUT|DELETE /api/documents/{id}/share` · `GET /api/documents/{id}/history` | 打开 / 保存（乐观锁）/ 分享 / 操作日志 |
| 成员 | `GET|POST /api/documents/{id}/members` · `PUT|DELETE .../members/{userId}` | 协作者管理 |
| 分享 | `GET|PUT /api/shared/{token}` | 匿名打开 / 保存分享文档 |
| 健康检查 | `GET /api/health` | 存活探针 |

除注册 / 登录 / 健康检查 / 分享接口外，均需 `Authorization: Bearer <JWT>`。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。



