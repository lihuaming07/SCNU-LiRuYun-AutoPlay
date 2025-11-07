# 砺儒云课堂自动连播脚本

> 🎯 自动检测视频进度，播完跳转下一课（id+1），新页面自动播放｜支持华南师范大学砺儒云课堂

## ✨ 功能
- 每 3 秒打印播放进度
- 视频结束自动跳转到 `id+1` 页面
- 新页面自动播放（含静音兜底）
- 防重复跳转、浮点误差处理

## 🔧 安装
1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 点击安装链接 → [lr-cloud-autoplay.user.js](https://github.com/lihuaming/repo/raw/main/lr-cloud-autoplay.user.js)
   > 💡 或直接拖拽 `.user.js` 文件到 Tampermonkey 面板
3. 前往浏览器设置，在自动播放的设置中，允许媒体自动播放列表 添加砺儒云课堂的域名：moodle.scnu.edu.cn
