// ==UserScript==
// @name         砺儒云课堂自动连播
// @namespace    http://tampermonkey.net/
// @version      2025-11-07
// @description  读取砺儒云课堂视频播放进度并判断是否跳转
// @author       Cyb3rBlad3
// @match        https://moodle.scnu.edu.cn/mod/fsresource/*
// @icon         https://qzapp.qlogo.cn/qzapp/101983660/5AE3826AD44495A694B607591F8581B8/100
// @grant        none
// ==/UserScript==



(function () {
    'use strict';

    let hasRedirected = false;
    let durationCheckInterval = null;

    // ✨ 工具函数：格式化时间
    const formatTime = (seconds) => {
        seconds = Math.max(0, Math.floor(seconds));
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // 🔁 跳转到 id+1
    const redirectNext = () => {
        if (hasRedirected) return;
        hasRedirected = true;

        const url = new URL(location.href);
        const idParam = url.searchParams.get('id');
        if (!idParam || isNaN(idParam)) {
            console.warn('[自动连播] ❗ 未找到有效 id 参数，跳过跳转');
            return;
        }

        const nextId = parseInt(idParam, 10) + 1;
        url.searchParams.set('id', nextId);

        console.log(`[自动连播] 🎯 当前视频完成，跳转至 id=${nextId}`);
        location.href = url.toString();
    };

    // ▶️ 尝试自动播放（含静音兜底，应对浏览器 autoplay 策略）
        const attemptAutoplay = (video) => {
            if (video.paused && !video.ended) {
                console.log('[自动连播] 🚀 尝试自动播放…');

                // 先尝试正常播放
                const bigPlayBtn = document.querySelector('.vjs-big-play-button');
                if (video && bigPlayBtn && video.paused) {
                    console.log('[自动连播] ▶️ 点击大播放按钮');
                    bigPlayBtn.click()
                        .then(() => {
                        console.log('[自动连播] ▶️ 自动播放成功');
                    })
                    .catch(err => {
                        console.warn('[自动连播] ⚠️ 自动播放被阻止（通常因浏览器策略，建议在浏览器中设置允许当前网站自动播放），尝试静音播放…',err);
                        // 静音 + 再次尝试
                        video.muted = true;
                        video.play()
                            .then(() => {
                                console.log('[自动连播] 🔇 静音后自动播放成功');
                                // 可选：1 秒后取消静音（若用户未交互可能失败，谨慎使用）
                                setTimeout(() => {
                                video.muted = false; // ❌ 某些浏览器会拒绝，暂不启用
                                }, 1000);
                            })
                            .catch(err2 => {
                                console.error('[自动连播] ❌ 即使静音也无法自动播放，请手动点击播放', err2);
                            });
                    });}
            } else if (!video.paused) {
                console.log('[自动连播] ▶️ 视频已在播放，无需操作');
            }
        };



    // 🔍 等待视频并启用监控/自动播放
    const waitForVideo = () => {
        const video = document.querySelector('video');
        if (!video) {
            setTimeout(waitForVideo, 1000);
            return;
        }

        console.log('[自动连播] ✅ 检测到视频元素');

        // ✅ 新增：首次检测到视频即尝试自动播放
        setTimeout(() => {attemptAutoplay(video);
                                }, 0);

        // 每 3 秒打印进度 + 检查是否完成
        durationCheckInterval = setInterval(() => {
            if (hasRedirected) {
                clearInterval(durationCheckInterval);
                return;
            }

            if (isNaN(video.duration) || video.duration <= 0) {
                console.log('[自动连播] ⏳ 元数据加载中...');
                return;
            }

            const progress = (video.currentTime / video.duration) * 100;
            console.log(
                `[自动连播] 📊 进度：${progress.toFixed(2)}% ` +
                `(${formatTime(video.currentTime)} / ${formatTime(video.duration)})`
            );

            if (video.currentTime >= video.duration - 0.5) {
                clearInterval(durationCheckInterval);
                redirectNext();
            }
        }, 3000);

        // 补充 ended 事件兜底
        video.addEventListener('ended', redirectNext, { once: true });
    };

    // 启动
    waitForVideo();
})();
