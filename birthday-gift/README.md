# dear you. — 一封生日来信

黑白灰、纸张质感和克制动效的生日礼物网页。独立放在 `birthday-gift/`，原有 TensorFlow 笔记本不受影响。

已实现：信封翻盖与抽出信纸、生日祝福、3000 元服装代金券、可重复触发的领取反馈、完整礼品券 PNG 保存、照片回忆与大图查看、背景音乐播放/暂停、手机适配、键盘操作及减少动态效果偏好。

保存的礼品券为完整高清横版图片，包含券面、右侧票根、条码、虚线、上下缺口和星形装饰；在手机上保存也使用完整横版排版。再次点击「已收好这份心意」会重新显示确认提示并播放庆祝动效，开启减少动态效果时仅显示提示。

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

制作模式中的照片和音频导入只在浏览器本地处理，导出并部署后会随网页一起发送。普通访问不读取制作者的本机草稿，也不显示编辑入口。制作模式只改变当前浏览器的草稿，不能修改已经部署的网站。

**已加入用户上传的藤井风《Close to you》。** 原 FLAC 保留在附件目录，网页使用由该原文件完整转码的 160 kbps、44.1 kHz、双声道 MP3，时长约 3 分 38 秒。打开信封时触发播放，自动循环，右上角可暂停或继续；实际播放仍受接收者的浏览器设置影响。构建时音乐会内嵌到 HTML，下载成品后不需要额外上传音频文件。

聊天内的原照片尚未提供云机器可读取的文件，没有照片时隐藏相册。编辑器中仍可更换或移除背景音乐；移除后提供音乐平台搜索链接。

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

上面只展示要修改的字段，请保留配置中的其他字段。个人照片和其他音频默认被 Git 忽略；用户明确提供的 `assets/close-to-you.mp3` 随此网站提交。

## 构建与分享

```bash
npm run check
npm run build
npm run preview
```

`dist/index.html` 包含应用代码、配置和内嵌的本地背景音乐；`assets/` 中的文件会复制到 `dist/assets/`。把整个 `dist/` 放到静态网站托管即可，不需要后端、数据库或 API 密钥。默认配置未包含照片，当前构建的 `index.html` 本身即可独立部署；增加照片等外部素材后应上传整个 `dist/` 或使用制作模式导出含素材的单文件。

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

浏览器测试覆盖拆信、键盘操作、重复领取反馈、PNG 下载后的票根条码与缺口、手机和桌面下载图片一致性、实际背景歌曲的播放/暂停/继续及结束循环、移除音乐后的平台链接、照片/音频导入、本机草稿恢复、相册、完整网页导出、新来源无外部依赖加载、减少动态效果偏好和 320/375/390/768 像素布局。默认播放器验证实际提供的歌曲；编辑器测试另外生成临时图片和短音频夹具。截图和报告输出到被忽略的 `test-results/`。

如果要测试生产构建，在另一终端以 `PORT=4174 npm run preview` 启动，然后执行：

```bash
GIFT_TEST_URL=http://127.0.0.1:4174 XDG_CACHE_HOME=/workspace/.cache python tests/browser_smoke.py
```

云环境中启动服务、浏览器和 Jupyter 内核可能需要执行工具允许本机套接字通信的权限。保持现有代理、证书信任和平台 GitHub 身份配置，不需要额外 GitHub Token。
