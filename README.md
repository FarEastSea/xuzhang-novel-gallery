# 叙章 XUZHANG

与 Biz Novel Studio 联动的 AI 小说作品馆。支持作品陈列、作品档案、沉浸阅读、Web 配置和用户管理。

## 权限与配置

| 身份 | 能力 |
| --- | --- |
| 游客 | 仅阅读已上架且面向所有人开放的作品 |
| 成员 | 按可见范围阅读上架作品；创作台入口需单独授权 |
| 管理员 | 管理作品上架、可见范围、用户和站点配置，可预览未上架作品 |

账户由管理员创建。作品来源、创作台入口、离线阅读、连接超时和会话时长统一在 Web 管理中心配置，保存后生效。作品馆仅使用明确白名单的阅读接口；创作台仍使用自身的认证体系。

运行数据独立保存，不进入 Git 或 Docker 镜像。现有小说快照保留在本地 `data/snapshot.json`，同样遵循上架状态与可见范围。

新作品默认不上架。上架后可选择所有人、登录用户、指定用户或仅管理员可见。列表、详情、章节与离线快照均由服务端按同一权限过滤；切换作品来源时使用独立的上架设置。

## 版本规则

当前版本为 **0.7.2**，对齐 Biz Novel Studio **0.7.2**。

- 创作台版本不变时，独立更新依次为 `0.7.2.1`、`0.7.2.2`。
- 对齐创作台新版本时，重置为对应三段版本，例如 `0.7.3`。
- `VERSION` 是公开版本的唯一来源；Git 标签、镜像标签和健康接口保持一致。

```sh
npm run version:set -- 0.7.2
npm run version:next
npm run version:check
```

npm 元数据使用合法 SemVer：例如公开版本 `0.7.2.2` 对应内部包版本 `0.7.2+revision.2`。公开版本始终保留第四段编号。

## 本地开发与检查

需要 Node.js 24.x。开发时分别运行 `npm run dev:server` 和 `npm run dev`。

```sh
npm ci
npm test
npm run build
npm run check:release
```

生产交付采用 Docker Compose，提供 AMD64 和 ARM64 镜像。GitHub Actions 检查代码、构建和容器启动，并按版本标签发布镜像。

[仓库](https://github.com/FarEastSea/xuzhang-novel-gallery) · [版本记录](CHANGELOG.md) · [发布维护规则](docs/RELEASING.md)
