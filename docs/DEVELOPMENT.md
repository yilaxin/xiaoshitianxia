# 开发与发行

环境：Windows x64 或 ARM64、Node.js 24、Python 3.12+。运行 `npm ci` 和 `python -m pip install -r requirements-build.txt`，再执行 `npm run build`。

## 文件结构

| 路径 | 用途 |
| --- | --- |
| `app/renderer.html`、`core.js`、`base.css` | 页面壳、核心逻辑和基础样式 |
| `app/*.js`、`app/*.css` | 书页、照片、日历和动效 |
| `app/desktop/` | Electron 主进程、受控接口、本机存储及图片通道 |
| `assets/` | Logo 与公开示例照片，不放个人照片 |
| `scripts/` | 构建、图标及 Windows 发行脚本 |
| `tests/` | 独立资料目录中的模型、存储和交互检查 |

## 测试

先运行 `python -m pip install -r requirements-test.txt` 安装测试依赖，再使用 `npm run test:all` 顺序执行全部回归。剪贴板测试结束后会恢复原剪贴板，建议在不同时操作剪贴板的测试环境中运行。

`npm run test:pdf` 会通过真实原生接口生成三种美食之书，检查筛选范围、中文可搜索文字、图片、长内容分页、取消、重复点击、失败覆盖保护和隐藏窗口释放。文件仅在隔离测试目录与 outputs 中生成，不读取私人资料。也可将 `XSTX_TEST_PYTHON` 指向已安装 pypdf 的 Python。

GitHub Actions 在原生 x64 和 ARM64 Runner 执行存储、模型与真实 Electron 资源检查，再生成对应发行包。完整桌面交互可另在本机运行，未在 CI 执行的桌面操作不宣称为全部系统实机验证。

可设置 `XSTX_TEST_BUILD` 为打包程序内 `resources/app.asar` 的相对路径，再运行 `npm run test:resources` 或 `npm run test:pdf` 检查打包后的资源与 PDF 导出；测试仍使用隔离目录。

## 发行

1. 同步修改 package.json、package-lock.json、app/desktop/preload.cjs 的版本。
2. 构建并运行回归，执行 `npm run release:windows`。
3. 检查 ZIP 中的 PE 架构、版本、资源、完整性并解压运行。
4. 创建 GitHub Release，上传两份 ZIP 与 SHA256SUMS.txt；GitHub 自动提供源码下载。
5. 不提交 work、outputs、个人资料、照片、备份、令牌或签名私钥。

发行脚本只从 dist-app 打包，不读取个人资料库，发现个人资料文件名时会拒绝归档。
