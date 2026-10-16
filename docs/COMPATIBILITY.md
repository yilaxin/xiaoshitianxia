# Windows 兼容性

| 系统与处理器 | 发行包 | 说明 |
| --- | --- | --- |
| Windows 10 / 11，Intel 或 AMD 64 位 | x64 | 大多数普通 Windows 电脑；推荐 Win10 22H2 或保持更新的 Win11 |
| Windows 10 / 11 on ARM，ARM64 | arm64 | 使用原生 ARM64 版，不依赖 x64 模拟 |
| Windows 7 / 8 / 8.1 | 不支持 | 当前 Electron 运行时已结束支持 |
| 32 位 Windows | 不支持 | 当前 Electron 不再提供 Windows ia32 运行时 |
| Windows S 模式 | 不提供商店安装包 | 此项目通过 GitHub ZIP 分发 |

ZIP 包含完整运行时，用户不用另装 Node.js、Python 或 WebView2。解压后请保留整个程序文件夹，不要只复制 exe。

## 验证方法与边界

源码不包含仅适用于 ARM64 的运行时依赖，两种架构分别使用对应的官方 Electron 运行时。打包后检查 PE 处理器标识、版本、资源、SHA256 和 ZIP 完整性，并在独立资料目录中检查启动、照片读取、画布、保存、关闭与重开。

本地完整回归覆盖菜品、饭局、食谱、日历、分类标签、图片粘贴与复制、翻书、全屏、滚轮和备份。GitHub Actions 另在原生 x64 Windows Runner 与 ARM64 Windows Runner 中检查并构建，实际结果以仓库 Actions 记录为准。

运行时支持 Windows 10 / 11，不代表每种补丁、显卡驱动或精简版系统都经过实机测试。Windows Server CI 结果不冒称为全部桌面系统实机认证。

## 下载与更新

- 从仓库 Releases 下载并核对 `SHA256SUMS.txt`。当前版本未签名，系统可能显示发布者未知；请确认来源，不要关闭系统安全功能。
- 解压到普通用户文件夹运行，无需管理员权限。
- 数据位于 `%APPDATA%\XiaoshiTianxia`，更新前保存编辑内容、导出完整备份并退出旧版。
- x64 与 ARM64 使用相同资料格式；换电脑请通过完整备份导出和恢复。

## 上游依据

- [Electron 支持平台](https://github.com/electron/electron#platform-support)
- [Electron 运行时与处理器架构](https://www.electronjs.org/docs/latest/tutorial/installation)
- [Windows 7 / 8 / 8.1 支持结束](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice)
