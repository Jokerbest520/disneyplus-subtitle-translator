# Disney+ Subtitle Translator (Disney+ 浏览器字幕翻译助手)

一个用于在 macOS Safari 和 iOS/iPadOS Safari（以及 Chrome、Edge、Arc、Firefox）中实时将 Disney+ 的字幕翻译为中文的浏览器插件。

支持显示**双语对照字幕**或**仅显示中文译文**，并提供丰富的字幕样式微调以及多翻译引擎支持。

---

## 🌟 主要特性

*   **多端兼容**：支持 macOS Safari、iOS / iPadOS Safari，以及所有 Chromium 内核浏览器（Chrome, Edge, Arc, Opera 等）。
*   **完美绕过 DRM 与 DOM 限制**：采用现代独立图层（Viewport Overlay）绝对定位技术，字幕完美对齐播放视频，且不破坏播放器内部结构，彻底避免 DRM 截图黑屏或播放器奔溃的问题。
*   **多翻译引擎支持**：
    *   **Google 翻译**：默认免密钥，即开即用。
    *   **Gemini AI**：高精度上下文翻译（支持配置个人 API Key，推荐）。
    *   **OpenAI GPT-4o**：大模型智能翻译。
    *   **DeepL 翻译**：高质量专业机器翻译。
*   **外观高度定制**：可通过插件弹窗实时调节译文的字体大小、文字颜色、背景半透明阴影遮罩。
*   **智能缓存**：内置 500 条字幕翻译缓存，避免重复请求，节省 API Key 消耗与请求延迟。
*   **支持全屏模式**：监听浏览器全屏事件，进入全屏后字幕层自动挂载，无缝衔接。

---

## 📦 项目结构

```
clever-kepler/
├── manifest.json         # 插件配置文件 (Manifest V3)
├── background.js        # 核心后台服务 (处理跨域翻译请求与缓存)
├── content/
│   ├── content.js       # 核心注入脚本 (穿透 Shadow DOM, 提取并渲染字幕)
│   └── content.css      # 独立字幕图层样式
├── popup/
│   ├── popup.html       # 玻璃拟态设计设置面板
│   ├── popup.js         # 面板控制器 (数据持久化)
│   └── popup.css        # 面板样式 (适配 Mac & iOS 底部菜单)
├── icons/               # 各种尺寸的插件高清图标
├── test/
│   └── mock_player.html # 本地沙盒测试网页 (自带 HTML5 播放器，可直接双击测试)
└── wrapper/             # 转换生成的 Xcode 原生工程 (用于 Safari iOS/macOS 部署)
```

---

## 🚀 安装与使用

### 方法 A：在 Chrome / Edge / Arc 浏览器中使用（最推荐，永久生效）
1.  下载本项目代码，解压到本地。
2.  打开浏览器扩展管理页面（如 Chrome 输入 `chrome://extensions/`）。
3.  开启右上角 **“开发者模式” (Developer Mode)** 开关。
4.  点击 **“加载已解压的扩展程序”**，选中本项目根目录即可。

### 方法 B：在 Mac Safari 浏览器中使用
1.  进入 `/release` 目录，解压 `disney_translator_safari_mac.zip` 得到 **`DisneyPlusTranslator.app`**。
2.  将其拖入您的 **应用程序 (Applications)** 文件夹。
3.  **双击运行一次**完成系统服务注册，然后关闭应用。
4.  在 Safari 浏览器中选择 **开发 -> 允许未签名的扩展** (Allow Unsigned Extensions)。
5.  在 **Safari 设置 -> 扩展** 中，勾选启用 **Disney+ Subtitle Translator**。

### 方法 C：在 iPhone / iPad Safari 浏览器中使用
1.  在 Mac 上双击打开 `wrapper/DisneyPlusTranslator/DisneyPlusTranslator.xcodeproj` 工程。
2.  在 Xcode 顶部运行栏，将 Scheme 设为 `DisneyPlusTranslator (iOS)`。
3.  用数据线连接您的手机，在运行设备里选中您的 iPhone/iPad。
4.  在项目的 *Signing & Capabilities* 中绑定您的个人 Apple ID 签名。
5.  点击 **Run** 按钮部署到手机上，并在手机的 **系统设置 -> Safari 浏览器 -> 扩展** 中启用。

---

## 🛠️ 本地调试与沙盒测试

为了方便调试，本项目内置了**本地验证沙盒**。
1. 双击打开 **`test/mock_player.html`**。
2. 页面中会播放一个测试视频。
3. 在上方输入框输入日语，点击 **“更新字幕”**，即可预览双语对照翻译在视频底部的完美呈现！
