# dear you. — 一封生日来信

黑白灰、纸张质感和克制动效的生日礼物网页。独立放在 `birthday-gift/`，原有 TensorFlow 笔记本不受影响。

已实现：信封翻盖与抽出信纸、生日祝福、3000 元服装代金券、领取反馈、礼品券 PNG 保存、照片回忆与大图查看、背景音乐播放/暂停、手机适配、键盘操作及减少动态效果偏好。

## 本地开发

需要 Node.js 20 或更新版本。没有第三方 Node 依赖，不需要 `npm install`。

```bash
cd /workspace/video_sync_v1/birthday-gift
npm run dev
```

开发服务默认只监听本机 4173 端口。通过浏览器打开服务，在路径后附加 `?edit` 进入制作模式；普通路径是接收者看到的页面。云环境的 onboarding 界面不提供本机服务的公开预览链接。

## 加入照片和音乐

在制作模式中点击右下角「编辑这份心意」：

1. 修改称呼、署名、生日文案和礼品券内容。
2. 选择原图，最多 9 张。浏览器会将最长边压缩到 1600 像素；可移除照片，桌面上可拖动调整顺序。
3. 选择可使用的《Close to you》音频文件，支持 MP3、M4A、WAV、OGG，最大 20 MB。
4. 「保存并预览」只保存到当前浏览器的 IndexedDB。
5. 「导出完整网页」生成一个包含照片、音频、文案、CSS 和 JS 的 `index.html`。部署这个文件后，朋友的设备才能加载这些素材。

照片与音频不会上传到任何服务器。普通访问不读取制作者的本机草稿，也不显示编辑入口。制作模式只改变当前浏览器的草稿，不能修改已经部署的网站。

**当前交付没有附带用户原图或歌曲音频。** 聊天内的图片未提供云机器可读取的原始文件；歌曲也未提供音频文件。页面不会用别人的照片或其他音乐冒充这些素材。没有照片时隐藏相册；没有音频时提供音乐平台搜索链接。上传音频后，打开信封的点击会触发播放，右上角可以暂停；实际播放仍受接收者的浏览器设置影响。

也可以把素材放入 `assets/`，在 `gift.config.json` 填写相对路径：

```json
{
  "photos": [
    {"src": "assets/sunset.jpg", "caption": "一起看日落"},
    {"src": "assets/portrait.jpg", "caption": "值得收藏的日常"}
  ],
  "music": {
    "title": "Close to you",
    "artist": "藤井 風",
    "src": "assets/close-to-you.mp3",
    "listenUrl": "https://music.youtube.com/search?q=Fujii+Kaze+Close+to+you"
  }
}
```

上面只展示要修改的字段，请保留配置中的其他字段。个人照片和音频默认被 Git 忽略，避免误提交。

## 构建与分享

```bash
npm run check
npm run build
npm run preview
```

`dist/index.html` 包含应用代码与配置；`assets/` 中的文件会复制到 `dist/assets/`。把整个 `dist/` 放到静态网站托管即可，不需要后端、数据库或 API 密钥。也可以从制作模式导出单文件后，单独托管导出的 `index.html`。

已配置当前仓库的 GitHub Pages 发布工作流：`.github/workflows/deploy-birthday.yml`。工作流只上传 `birthday-gift/dist/`，研究笔记本、测试截图和云环境文件不包含在发布内容中。官方 Actions 固定到已核对的提交哈希。

第一次发布时，在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。随后打开 **Actions → Deploy birthday gift to GitHub Pages → Run workflow**，选择 `main`。以后推送 `main` 中的生日网页变更会自动重新发布。GitHub 内置的工作流令牌不能自行启用一个尚未开启的 Pages 站点，因此不在工作流中伪造启用步骤。

部署成功后以工作流输出的实际网址为准。默认项目网址通常是 `https://jirrrr77.github.io/video_sync_v1/`，尚未完成部署验证前不应把它当成已上线地址。制作入口是在同一网址后加 `?edit`。页面资源使用相对路径，适用于 GitHub Pages 项目子目录。

也可以将整个 `dist/` 或从制作模式导出的 `index.html` 上传至其他静态网站托管。当前云环境需要允许访问 `api.github.com` 才能通过 GitHub API 管理 Pages；验证公开站点需要允许 `jirrrr77.github.io`。这些域名已加入环境配置草稿，草稿保存不会自动更新运行实例的网络规则。

网页中的代金券是一份私人生日承诺，领取按钮提供本地反馈，不会通知赠送者或扣款；没有接入真实商家的支付、核销系统。照片、音乐和祝福会随网页一起发送，拿到链接的人可以查看。

## 验证

```bash
npm run check
npm run build
# 保持 npm run dev 运行，使用云镜像预装的 Python、Playwright 与 Chromium：
XDG_CACHE_HOME=/workspace/.cache python tests/browser_smoke.py
```

浏览器测试覆盖拆信、键盘操作、领取、PNG 下载、照片/音频导入、本机草稿恢复、音乐播放暂停、相册、完整网页导出、新来源无外部依赖加载、减少动态效果偏好和 320/375/390/768 像素布局。测试用图片与音频均为临时生成的功能夹具，并非用户素材；截图和报告输出到被忽略的 `test-results/`。

如果要测试生产构建，在另一终端以 `PORT=4174 npm run preview` 启动，然后执行：

```bash
GIFT_TEST_URL=http://127.0.0.1:4174 XDG_CACHE_HOME=/workspace/.cache python tests/browser_smoke.py
```

云环境中启动服务、浏览器和 Jupyter 内核可能需要执行工具允许本机套接字通信的权限。保持现有代理、证书信任和平台 GitHub 身份配置，不需要额外 GitHub Token。
