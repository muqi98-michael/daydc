# Daily Report Auto Pages

一个最轻量的自动发布应用：把报告文件上传到仓库目录 `reports-source/`，按日期生成可筛选页面并自动部署到 GitHub Pages。

## 1. 报告命名规则

- 文件名必须匹配：
  - `daily-insight-2026-03-02.html`
  - `daily-insight-2026-03-02.md`
- 同一天如果同时存在 `.html` 和 `.md`，优先使用 `.html`。

## 2. 数据目录

数据源目录优先级（从高到低）：

1. 命令行参数：`--source`
2. 环境变量：`REPORTS_DIR`
3. 默认目录：`./reports-source`

示例：

```bash
npm run build -- --source "/absolute/path/to/reports"
```

```bash
REPORTS_DIR="/absolute/path/to/reports" npm run build
```

## 3. 上传报告并构建

```bash
npm install
npm run build
```

输出目录：

- `dist/index.html`
- `dist/reports.json`
- `dist/reports/*.html`

报告请直接放进仓库目录 `reports-source/`，例如：

```bash
reports-source/daily-insight-2026-03-02.html
```

## 4. 部署到 GitHub Pages

1. 把本目录推送到 GitHub 仓库（默认分支 `main` 或 `master`）。
2. 在仓库 **Settings -> Pages** 中，将 Source 设为 **GitHub Actions**。
3. 每次把新报告文件提交到 `reports-source/` 并 `git push`。
4. 推送后会自动触发 `.github/workflows/deploy-pages.yml` 完成部署。

## 5. 页面行为

- 首页会加载全部日期并默认展示最新日期报告。
- 通过日期下拉框切换历史报告。
- URL 会带 `?date=YYYY-MM-DD`，可直接分享指定日期链接。
