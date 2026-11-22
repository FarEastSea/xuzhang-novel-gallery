# 贡献指南

感谢关注并参与「叙章 (Xuzhang)」项目！为保证项目的代码质量与演进一致性，请在提交代码或建议前阅读以下指引。

## 开发与环境

- **运行环境**：Node.js 24.x。
- **本地启动**：
  ```sh
  npm ci
  npm run dev:server  # 启动服务端
  npm run dev         # 启动前端开发服务器
  ```

## 提交规范

1. **分支管理**：从 `main` 分支切出功能分支，例如 `feature/xxx` 或 `fix/xxx`。
2. **Commit 规范**：遵循常规提交（Conventional Commits）规范，例如：
   - `feat:` 新功能
   - `fix:` 问题修复
   - `docs:` 文档更新
   - `ci:` CI/CD 流程调整
3. **版本号管理**：
   - 版本以根目录 `VERSION` 为准，前三段对齐 Biz Novel Studio。
   - 独立更新使用 `npm run version:next`，对齐主版本使用 `npm run version:set -- x.y.z`。
   - 禁止手动改动 `package.json` 中的版本号。

## 提交前自测

在提交 Pull Request 前，请确保以下命令在本地全部通过：

```sh
npm test              # 运行单元与集成测试
npm run build         # 构建前端资源
npm run check:release # 执行发布安全合规检查
```

## 注意事项

- 生产运行数据、个人凭据、本地环境配置与真实小说内容不得进入 Git 仓库。
- 详情请查阅 [发布维护规则](docs/RELEASING.md) 与 [安全与权限说明](SECURITY.md)。
