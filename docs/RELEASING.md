# GitHub 发布准备

仓库：[FarEastSea/xuzhang-novel-gallery](https://github.com/FarEastSea/xuzhang-novel-gallery)。

## 新副本关联

优先直接克隆本仓库。若从不含 Git 元数据的源码目录开始，执行以下步骤。提交前确认不含运行数据、原作品快照、账户、初始化密钥和私有地址。

```sh
git init -b main
git add .
git diff --cached --stat
git diff --cached
# 核对后执行
git commit -m "feat: add web administration, users and container deployment"
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

`.gitignore` 排除 `data/`、`.env*`（保留模板）、本地预览截图、构建产物和依赖。`.dockerignore` 使用允许列表控制镜像构建上下文。不要用 `git add -f` 添加运行数据。

## 发布检查

```sh
npm ci
npm test
npm run build
npm run check:release
# 在有 Docker 的设备上完成
docker compose config --quiet
docker compose up -d --build
```

在浏览器验收首次初始化、游客无创作台入口、成员权限、管理员设置、用户停用和阅读页面。核对实际作品是否可以向游客公开。

若设置了自定义 registry，依赖审核可使用 `npm audit --registry=https://registry.npmjs.org`。网络失败不能视作审核通过。GitHub 发布前按实际输出处理依赖风险。

## 标签与镜像

1. 等待主分支 CI 成功。
2. 按 `package.json` 更新版本和变更记录。
3. 创建并推送版本标签，当前功能版本为 `1.1.0`：

```sh
git tag v1.1.0
git push origin v1.1.0
```

标签触发 `release.yml`，镜像在 `ghcr.io/<owner>/<repo>`。GitHub Actions 的 `GITHUB_TOKEN` 需具备包写入权限；工作流已声明 `packages: write`。使用具体版本部署以便回滚。工作流不会自动在宝塔或 NAS 上更新服务。

尚未选择开源许可证；`UNLICENSED` 不授予复用许可。公开发布前由项目所有者选择许可，并检查概念封面等资产的授权。仓库创建后可启用分支保护、Dependabot 和私密漏洞报告。
