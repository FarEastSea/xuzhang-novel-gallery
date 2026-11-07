# 叙章 XUZHANG

与 Biz Novel Studio 联动的 AI 小说作品馆。支持作品陈列、作品档案、沉浸阅读、Web 配置和用户管理。

## 权限

| 身份 | 能力 |
| --- | --- |
| 游客 | 浏览作品、查看目录、阅读章节；没有创作台入口 |
| 成员 | 游客能力，以及管理员配置的创作台跳转入口 |
| 管理员 | 成员能力，以及站点配置、用户创建、停用、角色调整、密码重置与删除 |

账户由管理员创建，不开放自助注册。作品馆只读取创作台的明确白名单接口，不提供创作台写操作。创作台本身仍需独立的登录和访问控制。当前全部阅读内容对游客开放，不提供逐作品可见性控制。

## 推荐部署：Docker Compose

宝塔、飞牛 NAS 和 1Panel 均使用同一套 Compose。镜像使用 Node.js 24，多阶段构建，运行阶段不安装前端依赖，以非 root 用户运行，数据单独持久化。[Docker Compose 部署说明](https://docs.docker.com/compose/how-tos/production/)

```sh
docker compose up -d --build
docker compose exec web cat /app/data/setup-token
```

默认仅绑定服务器的 `127.0.0.1:4173`。通过 SSH 本地转发、服务器浏览器或配置反向代理访问 `/login`，输入上面的一次性密钥并创建管理员。随后进入 `/admin`，统一配置：

- **服务连接地址**：作品馆容器能够访问的创作台源地址，例如 `http://studio:28080`。
- **成员访问入口**：成员浏览器能够访问的创作台地址，例如 `https://studio.example.com`。留空隐藏全部创作台入口。
- **离线快照**：是否向读者提供数据目录里的离线内容。
- **会话有效期与连接超时**：保存后生效，缩短会话时长也会限制现有会话。

配置存储在 SQLite 中，无需修改源码、重新构建或重启容器。浏览器已加载的作品在刷新后使用新来源。运行参数、反向代理和详细迁移步骤见 [部署文档](docs/DEPLOYMENT.md)。

## 本地运行

要求 **Node.js 24.x**，使用其内置 SQLite，不需要安装数据库服务。[Node.js SQLite 文档](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)

```sh
npm ci
npm run build
npm start
```

打开 `http://localhost:4173/login`。初始化密钥在 `data/setup-token`，创建首位管理员后自动移除，无默认账号或默认密码。

开发时分两个终端运行：

```sh
npm run dev:server
npm run dev
```

浏览器打开 `http://localhost:5173`。Vite 将同源 API 交给本地应用服务，开发和生产采用相同的配置与鉴权逻辑。`npm run preview` 仅预览静态构建，不提供完整后端功能。

`.env` 只保留进程参数，模板见 [.env.example](.env.example)：`HOST`、`PORT`、`DATA_DIR`、`TRUST_PROXY`。创作台地址等业务配置全部在 Web 页面设置，原 `BNS_STUDIO_ORIGIN` / `VITE_BNS_*` 不再使用。

## 数据与迁移

`data/` 或容器的 `/app/data` 包含配置、用户、会话与可选离线快照，不能提交 Git，也不能打进镜像。

- `xuzhang.sqlite`：业务配置、密码哈希和会话哈希。
- `snapshot.json`：可选的归一化作品快照；启用时其中的作品供游客阅读。
- `setup-token`：仅首次初始化时存在。

旧版源码中内嵌的小说快照已迁入本地 `data/snapshot.json`。仓库中的 `src/data/snapshot.json` 为空模板，发布后不会携带现有作品或原局域网地址。新实例配置创作台后可直接读取实时作品；离线快照需要自行提供，不自动生成。

迁移时复制整个数据目录；备份和恢复方式见 [部署文档](docs/DEPLOYMENT.md)。

## 检查与发布

```sh
npm test
npm run build
npm run check:release
```

`npm test` 验证初始化、权限边界、只读接口、配置校验、会话撤销、离线快照与登录限流。发布检查扫描源代码和构建产物中的常见凭据及私网地址；它是辅助检查，不能替代人工核对。

GitHub Actions 已准备好：

- `ci.yml`：测试、构建、发布检查、Compose 校验、Docker 构建与容器启动检查。
- `release.yml`：推送 `v*.*.*` 标签后发布 `linux/amd64` 和 `linux/arm64` 镜像到 `ghcr.io/<仓库所有者>/<仓库名>`；手动运行生成 SHA 标签。

添加远程仓库和首次发布步骤见 [GitHub 发布说明](docs/RELEASING.md)。当前未声明开源许可证，公开仓库前由所有者决定授权方式。

## 目录

```text
src/                 React 页面、阅读数据归一化、会话与管理界面
server/              SQLite 存储、会话与权限、阅读接口投影
server.mjs           静态服务与应用入口
public/              图标和概念封面
scripts/             发布检查
tests/               后端集成测试
data/                运行数据（忽略提交）
Dockerfile           测试、构建与精简运行镜像
compose.yaml         通用部署与持久化
.github/workflows/   GitHub CI 与多架构镜像发布
```
