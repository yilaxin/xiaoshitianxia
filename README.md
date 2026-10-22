# 笑食天下

把喜欢的味道，好好收藏。一个可以离线使用的 Windows 私人美食 App：收藏吃过的菜、记录一顿饭、整理自己的食谱，也在日历里写下日常。

![笑食天下菜单页面，展示内置示例内容](docs/images/menu.png)

## 下载使用

**[前往 Releases 下载最新版](https://github.com/yilaxin/xiaoshitianxia/releases/latest)**

| 你的电脑 | 下载文件 |
| --- | --- |
| 普通 Intel / AMD 64 位电脑 | `XiaoshiTianxia-版本号-windows-x64.zip` |
| 骁龙 / Surface 等 Windows ARM 电脑 | `XiaoshiTianxia-版本号-windows-arm64.zip` |

完整解压 ZIP，再双击其中的 **笑食天下.exe**。请保留整个文件夹；不用注册账号，也不用安装 Node.js、Python 或浏览器组件。

支持 **Windows 10 / Windows 11 的 64 位系统**，推荐 Win10 22H2 或保持更新的 Win11。当前 Electron 不再支持 Win7、Win8/8.1 或 32 位 Windows。参见[兼容范围与验证说明](docs/COMPATIBILITY.md)。

每次发布附带 SHA256SUMS.txt。当前程序未做商业代码签名，系统可能显示发布者未知；请核对下载来源和文件校验值，不要关闭系统安全功能。

Windows 自动检查覆盖 x64 与 ARM64，主分支推送、面向主分支的 PR 和手动操作会触发；发布标签复用同一提交的检查结果。关键动画场景连续验证三轮，失败即停止并保留日志，不使用自动重试掩盖失败。

## 可以做什么

- **启动翻书动画**：冷启动先显示放大居中的主题酒红封面，留白配有淡金线描与中式小印章；点击封面或按 Enter / 空格后，用 2.6 秒翻开书页、铺展暖白纸面并渐入「我的菜单」；支持跳过、Esc 和设置关闭，减少动态效果时点击后使用约 200ms 淡入。
- **我的菜单**：收藏菜品，管理分类标签，搜索、筛选、排序、标记特别喜欢；照片可以以后再补。
- **用餐记录**：记录日期、感受、地点和制作者，保存单道菜及整桌饭局的照片。
- **三本美食之书**：山珍海味收藏美味，独家食谱记录食材做法，欢聚一堂回味一顿饭；支持翻书动画、目录和全屏。
- **内置食谱示例**：「家常蛋炒饭 · 示例」展示成品图、食材用量、六步做法与心得，可编辑或删除，删除后不会重复添加。
- **饮食日历**：查看当天用餐与农历节日，独立填写感想；内置 2025/2026 年中国大陆官方调休，其他年份不会推算休班。
- **分享与备份**：菜品记录复制为图片，导出包含照片的完整备份；支持删除确认和撤销。
- **整本导出 PDF**：在三种翻阅页面点击「导出 PDF」，保存封面、目录和当前范围的全部内容。美味册支持分类／特别喜欢筛选；食谱做法与饭局记录会自动分页，文字可以搜索和复制。

## 资料与更新

资料保存在当前 Windows 用户的 `%APPDATA%\XiaoshiTianxia`。应用离线使用，不会把你的私人记录上传到 GitHub。

更新前保存正在编辑的内容、导出完整备份并退出旧版，将新版解压到新文件夹再运行；同一 Windows 用户会继续读取原资料。换电脑请使用完整备份导入。不要公开提交个人资料库、照片或备份。

## 开发构建

开发环境：Windows、Node.js 24、Python 3.12+。普通下载用户不需要这些环境。

```powershell
npm ci
python -m pip install -r requirements-build.txt
npm run build
npm start
```

```powershell
npm run test:all
npm run test:startup
npm run test:startup-independent
npm run release:windows
# 或只构建一个架构
npm run release:windows -- --arch x64
npm run release:windows -- --arch arm64
```

输出在 outputs/release，包含两种完整 ZIP 和 SHA256 校验值。GitHub Actions 在 x64 与 ARM64 Windows Runner 中检查和构建。参见[开发文档](docs/DEVELOPMENT.md)及[更新记录](CHANGELOG.md)。

运行 PDF 文件验证与完整测试前，请先执行 `python -m pip install -r requirements-test.txt`；这些依赖仅用于开发测试，下载使用 App 无需安装。

## 反馈与许可

请在 [Issues](https://github.com/yilaxin/xiaoshitianxia/issues) 提供版本、系统架构、复现步骤和错误提示；截图或日志请先移除个人信息。

原创代码采用 [MIT 许可](LICENSE)，允许使用、修改和分发，保留版权声明。第三方组件及示例照片适用各自许可，见[第三方说明](THIRD_PARTY_NOTICES.md)。
