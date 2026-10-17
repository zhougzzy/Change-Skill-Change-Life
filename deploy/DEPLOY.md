# 换一课 Skill Swap 部署方案

## 0. 当前工作区结论

截至 2026-10-17，当前工作区仅发现：

- `outputs/skill-swap/docs/PRODUCT.md`
- 空的 `outputs/skill-swap/server/` 与 `outputs/skill-swap/deploy/` 目录

未发现前端/后端源码、`package.json`、Dockerfile、数据库迁移、现有域名或云平台配置。因此本文提供可落地的部署方案和配置模板；其中 `<替换项>` 必须在接入真实项目时按实际框架、启动命令和端口替换。

本文不要求 GitHub CLI。推荐通过 Render、Railway、Vercel 的网页控制台连接 Git 仓库并完成部署。

## 1. 推荐架构

### 方案 A：Vercel 前端 + Render API + Render PostgreSQL

适合前端是 React/Vite/Next.js、API 是 Node/Python/Go 等常规 HTTP 服务的 MVP。

```text
用户浏览器
   |
   | https://app.example.com
   v
Vercel Frontend
   |
   | https://api.example.com
   v
Render Web Service (API)
   |
   v
Render PostgreSQL
```

优点：前端 CDN 和预览部署成熟；API、数据库、健康检查和固定域名可在 Render 控制台统一管理。缺点：前后端分属两个平台，需要正确配置 CORS 和环境变量。

### 方案 B：Vercel 前端 + Railway API + Railway PostgreSQL

适合希望在 Railway 内快速创建 API 和数据库，并接受按用量计费的项目。Railway 的 Web Service 必须监听平台注入的 `PORT`，不能固定写死本地端口。

### 方案 C：Render 前端静态站点 + Render API

适合前端构建产物为纯静态文件，想让前后端在同一平台管理。若前端是需要 Node 服务端运行的 Next.js，请按 Next.js 的实际启动模式创建 Web Service，而不是 Static Site。

## 2. 推荐发布顺序

1. 先确认真实仓库的前端目录、API 目录、包管理器和生产启动命令。
2. 先部署数据库，再部署 API，最后部署前端。
3. API 首次上线后，先验证 `/healthz`、数据库连接和 CORS。
4. 将 API 的公开地址写入前端生产环境变量，重新部署前端。
5. 先使用平台默认域名验收，再绑定自定义域名。

## 3. Render 部署步骤

### 3.1 创建数据库

在 Render 控制台创建 PostgreSQL，并保存其内部连接串。API 与数据库位于同一 Render 区域时，优先使用 Internal Database URL；需要在本地或其他平台连接时使用 External Database URL。

不要把数据库密码写入仓库、前端变量或文档截图。

### 3.2 创建 API Web Service

在 Render 控制台选择 `New > Web Service`，连接 Git 仓库并设置：

```text
Root Directory: <api目录，例如 server>
Build Command: <例如 npm ci && npm run build>
Start Command: <例如 npm run start>
Health Check Path: /healthz
```

平台不会替应用自动补全启动命令。必须以真实 `package.json`、`Procfile` 或框架文档为准。

API 必须监听：

```text
0.0.0.0:$PORT
```

不要只监听 `localhost`，也不要把生产端口固定为 `3000`、`8000` 等本地端口。

### 3.3 创建前端

若前端输出静态文件，在 Render 创建 `Static Site`：

```text
Root Directory: <frontend目录>
Build Command: <例如 npm ci && npm run build>
Publish Directory: <例如 dist 或 build>
```

若前端是 Next.js SSR 或其他需要 Node 进程的框架，应创建 Web Service，并使用框架要求的生产启动命令。

## 4. Railway 部署步骤

1. 在 Railway 控制台新建 Project。
2. 添加 PostgreSQL 插件或数据库服务。
3. 从 GitHub 仓库添加 API 服务，设置 API 根目录、构建命令和启动命令。
4. 在 Variables 中填写数据库连接串、密钥和前端来源。
5. 在 Networking 中生成 API 公网域名。
6. 将健康检查配置为 `/healthz`；服务应返回 HTTP 200 后再认为部署成功。
7. 前端可部署到 Vercel，也可在 Railway 中作为独立服务部署。生产前端不要依赖 API 的私有网络地址。

Railway 部署时使用平台注入的 `PORT`，应用监听 `0.0.0.0`。数据库连接变量名以 Railway 面板实际提供的变量为准，统一映射到应用需要的 `DATABASE_URL`。

## 5. Vercel 前端部署步骤

1. 在 Vercel 控制台选择 `Add New > Project`，通过网页连接 Git 仓库。
2. 选择前端目录作为 Root Directory。
3. 确认 Framework Preset、Install Command、Build Command 和 Output Directory。
4. 在 `Production` 环境添加 API 地址，例如：

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

Vite 项目通常使用 `VITE_API_BASE_URL`；Next.js 项目通常使用 `NEXT_PUBLIC_API_BASE_URL`。变量名必须与前端代码实际读取的名称一致。

5. Deploy 后先使用 Vercel 默认域名验收，再绑定自定义域名。

注意：所有带 `NEXT_PUBLIC_` 或 `VITE_` 前缀的值都会进入浏览器端，不能放置数据库密码、JWT 签名密钥或第三方私钥。

## 6. 固定域名与 DNS

推荐域名规划：

```text
app.example.com   -> Vercel 前端
api.example.com   -> Render/Railway API
```

绑定流程：

1. 在 Vercel 项目中添加 `app.example.com`，按控制台提示在 DNS 服务商添加记录。
2. 在 Render 或 Railway API 服务中添加 `api.example.com`。
3. DNS 记录以平台控制台给出的最终值为准。常见形式是 CNAME，不要凭经验覆盖平台要求的记录。
4. 等待证书签发后，用 HTTPS 地址验证前端、API 和健康检查。
5. API 的允许来源只保留生产前端域名和必要的本地开发地址。

不要把 API 公开地址写死在前端源码中；使用生产环境变量，便于切换预览、测试和正式环境。

## 7. 环境变量建议

### API

```text
NODE_ENV=production
PORT=<由平台注入，应用读取 process.env.PORT>
DATABASE_URL=<托管数据库连接串>
APP_ORIGIN=https://app.example.com
CORS_ORIGINS=https://app.example.com
JWT_SECRET=<至少 32 字节的随机值，若使用登录>
SESSION_SECRET=<若使用服务端会话>
LOG_LEVEL=info
```

若当前 MVP 仍是内存演示模式，应显式设置：

```text
DEMO_MODE=true
```

并在界面中说明刷新后数据可能丢失。上线真实试用前，必须切换到持久化存储并关闭演示模式。

### 前端

```text
VITE_API_BASE_URL=https://api.example.com
```

或：

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

仅保留实际框架使用的变量名。所有环境变量分别配置在 Preview、Staging、Production，避免测试环境误连生产数据库。

## 8. 健康检查约定

建议 API 提供两个端点：

```text
GET /healthz
```

用于平台存活检查，只验证进程可响应，返回示例：

```json
{"status":"ok"}
```

```text
GET /readyz
```

用于发布验收，额外检查数据库连接和必要依赖。数据库不可用时返回 HTTP 503，而不是 HTTP 200。

部署完成后至少验证：

```text
curl -i https://api.example.com/healthz
curl -i https://api.example.com/readyz
```

如果 API 尚未实现上述端点，应在部署前补齐；这属于 API 运行契约，不改变前端业务代码。

## 9. 生产安全与网络配置

- API 只允许 `https://app.example.com` 作为生产 CORS 来源。
- 允许 `http://localhost:<端口>` 仅用于本地开发，不要加入生产前端来源列表。
- 生产环境禁止使用通配符 `*` CORS，尤其是启用 Cookie 或 Authorization 时。
- Cookie 会话应设置 `Secure`、`HttpOnly`，跨站部署时按实际架构设置 `SameSite`。
- API 对状态变更接口做服务端权限检查、重复提交保护和状态机校验。
- 数据库迁移应在 API 发布前执行，并准备回滚或向前兼容方案。
- 日志中不得输出密码、完整 Token、Cookie、数据库连接串或用户敏感信息。
- 为数据库启用自动备份；正式环境不要依赖内存数据。

## 10. 配置模板建议

当前没有源码和真实目录，因此不直接提交可执行的 `render.yaml` 或 `vercel.json`，避免错误的根目录、启动命令和输出目录被平台采纳。接入真实仓库后，建议在仓库根目录增加以下配置：

### `render.yaml` 最小结构

```yaml
services:
  - type: web
    name: skill-swap-api
    env: <node|python|go>
    rootDir: <api目录>
    buildCommand: <真实构建命令>
    startCommand: <真实生产启动命令>
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: <Render数据库名>
          property: connectionString
```

### `vercel.json` 常见静态前端结构

```json
{
  "buildCommand": "<真实构建命令>",
  "outputDirectory": "<dist或build>",
  "framework": "<实际框架或null>"
}
```

这两个片段是配置建议，不是当前项目可直接执行的配置。只有确认真实目录和脚本后才应提交到应用仓库。

## 11. 上线验收清单

- [ ] API 使用平台分配的 `PORT`，监听 `0.0.0.0`。
- [ ] `GET /healthz` 返回 HTTP 200。
- [ ] `GET /readyz` 能区分数据库可用与不可用。
- [ ] API 默认域名和固定域名都能通过 HTTPS 访问。
- [ ] 前端生产环境变量指向固定 API 域名。
- [ ] 浏览器预检请求 `OPTIONS` 和实际 API 请求的 CORS 头正确。
- [ ] 刷新页面后前端路由仍可访问；静态托管已配置 SPA fallback（如项目需要）。
- [ ] 数据库迁移和种子数据执行成功。
- [ ] 登录、越权、重复提交和非法状态流转被服务端拒绝。
- [ ] 日志中没有密钥、Token 或数据库凭据。
- [ ] 已记录平台项目名、服务名、区域、域名、变量名和回滚版本。
- [ ] 已确认当前是演示模式还是持久化真实试用模式。

## 12. 推荐决策

在当前信息不足、且没有 GitHub CLI 的前提下，优先采用：

```text
Vercel 前端 + Render API + Render PostgreSQL
```

原因是三部分均可通过网页控制台完成，前端预览部署和固定域名较直接，API 具备健康检查入口，数据库也能与 API 放在同一平台区域。若团队已经在 Railway 有项目和计费配置，则将 API 与 PostgreSQL 换成 Railway，前端仍可保留在 Vercel。

真正部署前必须补齐的项目事实只有四项：前端目录、API 目录、生产构建/启动命令、数据库迁移命令。确认这四项后，再把本文中的占位配置固化为仓库内的 `render.yaml` 或 Vercel 项目设置。
