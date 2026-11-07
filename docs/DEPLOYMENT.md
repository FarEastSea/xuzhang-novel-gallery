# 部署与迁移

## 服务结构

浏览器通过同源 `/api` 访问作品馆。作品馆读取管理员设置的 Biz Novel Studio，只允许 GET `/api/health`、`/api/novels`、`/api/novels/:id` 和 `/api/novels/:id/chapters`。不会传递读者的 Cookie 或 Authorization。

登录、用户和设置保存在本地 SQLite，容器内目录为 `/app/data`。默认 Compose 创建命名卷，不依赖外部数据库。请保持单个应用实例，不要多副本挂载同一 SQLite 卷。

## 宝塔 / 1Panel

1. 将源码放入服务器目录，使用 Docker / Compose 功能导入 `compose.yaml`，或者在目录运行 `docker compose up -d --build`。
2. 创建站点，将全部请求（含 `/api`）反向代理至 `http://127.0.0.1:4173`，启用 HTTPS。
3. 代理覆盖 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`；不能直接保留客户端传入的转发头。
4. 在 Compose 所在目录的 `.env` 设置 `TRUST_PROXY=1`，运行 `docker compose up -d` 重建容器。只在代理受控且后端不能被绕过时启用。
5. 执行 `docker compose exec web cat /app/data/setup-token`，通过 HTTPS 打开 `/login` 创建管理员，再去 `/admin` 配置来源和用户。

Nginx 反代示例（域名与证书在面板配置）：

```nginx
location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 40s;
}
```

如果 1Panel 的反向代理本身在另一个容器，`127.0.0.1` 指向代理容器自身。应让两者加入同一个 Docker 网络，并使用 `http://web:4173` 作为上游；不要把作品馆端口暴露到公网。

## 飞牛 NAS

在 Docker 应用中创建 Compose 项目，选用本仓库的 Compose。可选择：

- 保留回环绑定，配合 NAS 的 HTTPS 反向代理；
- 仅用于可信局域网时，在 `.env` 中设置 `BIND_ADDRESS=0.0.0.0`、`PORT=4173` 后重新创建容器，通过 NAS 地址访问。此方式默认 `TRUST_PROXY=0`。

启用公网访问时使用 HTTPS 反向代理，并按上一节配置代理信任。NAS 的 ARM64 与 x86_64 均有镜像发布流程；首次本地构建使用当前设备架构。

## 使用 GHCR 发布镜像

镜像发布成功后，可将 `compose.yaml` 中 `image` 改为自己的具体版本，例如 `ghcr.io/owner/xuzhang:1.1.0`，并删除 `build: .`。使用 `docker compose pull` 和 `docker compose up -d` 更新。私有包需先登录 GHCR，公开包需在 GitHub 包设置中公开。

## 连接创作台

服务连接地址与成员入口是两个用途不同的地址：前者由容器访问，后者由成员浏览器打开。不要在容器里用 `localhost` 指代宿主机上的其他服务。可让两者加入相同网络并使用服务名，也可使用容器能够访问的宿主机或局域网地址。

成员入口只负责跳转，不代理创作台页面，也不与创作台共享账户。创作台独立认证；如果它在无认证的公网地址上，隐藏入口不能防止直接访问该地址。

管理员保存来源后可点击“检测已保存的连接”。检测失败不会改写已保存配置。来源不可达时前端使用启用的运行时快照；新实例没有作品快照时显示空作品馆。

## 数据备份与恢复

完整迁移单位是 `/app/data`，含 SQLite、可能存在的 WAL 文件和离线快照。复制前停止写入，不能只在运行中复制一个 `.sqlite` 文件。

```sh
# 在备份目录不存在的情况下执行；生成备份后再启动服务。
docker compose stop web
docker compose cp web:/app/data ./xuzhang-backup
docker compose start web
```

备份包含账户与作品，存放在仓库之外。迁移到新机器后：先建立数据卷，再将备份目录的内容复制到新卷的 `/app/data`，确保其所有者为容器内 UID/GID `1000:1000`，然后启动正式应用。使用宿主机目录绑定时同样需要保证权限。建议使用面板的卷文件管理完成恢复，覆盖前保留新旧两份备份。

只导入旧版快照：

```sh
docker compose cp ./data/snapshot.json web:/app/data/snapshot.json
```

之后在 Web 中启用离线快照。文件须为旧项目的归一化格式：包含 `generatedAt` 与 `works` 数组，作品结构与 `src/types.ts` 一致。不会从旧快照继承创作台地址、凭据或账户。

原生 Node 部署时，迁移 `DATA_DIR` 指定的整个目录；启动后沿用原账户和配置。业务设置不依赖机器的构建环境。

## 更新与回滚

更新前停止服务并备份数据。源码部署运行 `docker compose up -d --build`；镜像部署运行 `docker compose pull`、`docker compose up -d`。检查 `/healthz` 及面板容器健康状态，再验证游客阅读和管理员登录。

回滚时使用旧版本镜像及与之匹配的更新前数据备份，避免旧应用读取未来版本的数据库结构。不要运行 `docker compose down -v`，它会删除持久化卷。

## 运行参数

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Node 监听地址 |
| `PORT` | `4173` | 原生 Node 端口；Compose 中控制宿主机映射端口 |
| `DATA_DIR` | 项目 `data/` | 原生 Node 数据目录；容器固定 `/app/data` |
| `TRUST_PROXY` | `0` | 设为 `1` 后信任代理传入的 HTTPS 标志与客户端地址 |
| `BIND_ADDRESS` | `127.0.0.1` | Compose 的宿主机绑定地址 |

`/healthz` 只检查作品馆进程能否响应，与创作台状态解耦。创作台连接状态在 Web 中检测。运行 Node.js 24.x；没有额外生产 npm 依赖。
