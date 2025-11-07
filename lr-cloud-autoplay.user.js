// ==UserScript==
// @name         砺儒云课堂自动连播
// @namespace    http://tampermonkey.net/
// @version      2025-11-07
// @description  读取砺儒云课堂视频播放进度并按设置的ID范围自动跳转（范围会本地保存，解决播放完未完成卡死问题）
// @author       Cyb3rBlad3
// @match        https://moodle.scnu.edu.cn/mod/fsresource/*
// @icon         https://qzapp.qlogo.cn/qzapp/101983660/5AE3826AD44495A694B607591F8581B8/100
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let hasRedirected = false;
    let completionCheckInterval = null;
    let idRanges = [];  // 存储解析后的ID范围数组
    const STORAGE_KEY = 'lrCloudClassroomRanges';  // 本地存储键名
    let videoElement = null;  // 存储视频元素引用，方便全局使用

    // 从本地存储加载范围设置
    const loadFromStorage = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('[自动连播] 加载存储的范围失败', e);
                return [];
            }
        }
        return [];
    };

    // 保存范围设置到本地存储
    const saveToStorage = (ranges) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges));
        } catch (e) {
            console.error('[自动连播] 保存范围到存储失败', e);
        }
    };

    // 创建控制界面
    const createControlPanel = () => {
        // 样式设置
        const style = document.createElement('style');
        style.textContent = `
            .auto-play-control {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 9999;
                font-family: Arial, sans-serif;
                width: 300px;
            }
            .auto-play-control h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 16px;
            }
            .auto-play-control textarea {
                width: 100%;
                height: 100px;
                margin-bottom: 10px;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                resize: vertical;
            }
            .auto-play-control .btn-group {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }
            .auto-play-control button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                flex: 1;
            }
            .auto-play-control button.clear-btn {
                background: #f44336;
            }
            .auto-play-control button:hover {
                opacity: 0.9;
            }
            .status-text {
                margin-top: 10px;
                font-size: 12px;
                color: #666;
            }
        `;
        document.head.appendChild(style);

        // 控制面板
        const panel = document.createElement('div');
        panel.className = 'auto-play-control';
        panel.innerHTML = `
            <h3>自动连播设置</h3>
            <textarea placeholder="请输入网址结尾的ID范围，每行一个范围，格式如下：
771843-771849
771850-771853"></textarea>
            <div class="btn-group">
                <button id="saveRanges">保存范围</button>
                <button id="clearRanges" class="clear-btn">清除范围</button>
            </div>
            <div class="status-text">状态：未设置范围</div>
        `;
        document.body.appendChild(panel);

        // 获取元素引用
        const saveBtn = panel.querySelector('#saveRanges');
        const clearBtn = panel.querySelector('#clearRanges');
        const textarea = panel.querySelector('textarea');
        const statusText = panel.querySelector('.status-text');

        // 从本地存储加载并显示已保存的范围
        const savedRanges = loadFromStorage();
        if (savedRanges.length > 0) {
            idRanges = savedRanges;
            // 将范围数组转换回文本格式显示在输入框中
            textarea.value = savedRanges.map(range => `${range.start}-${range.end}`).join('\n');
            statusText.textContent = `已加载 ${idRanges.length} 个范围，当前ID: ${getCurrentId()}`;
        }

        // 保存按钮事件
        saveBtn.addEventListener('click', () => {
            idRanges = parseIdRanges(textarea.value);
            if (idRanges.length > 0) {
                saveToStorage(idRanges);  // 保存到本地存储
                statusText.textContent = `已保存 ${idRanges.length} 个范围，当前ID: ${getCurrentId()}`;
                console.log('[自动连播] 已设置并保存ID范围:', idRanges);
            } else {
                statusText.textContent = '范围格式错误，请重新输入';
            }
        });

        // 清除按钮事件
        clearBtn.addEventListener('click', () => {
            if (confirm('确定要清除所有已设置的范围吗？')) {
                idRanges = [];
                textarea.value = '';
                localStorage.removeItem(STORAGE_KEY);  // 从本地存储移除
                statusText.textContent = '已清除所有范围设置';
                console.log('[自动连播] 已清除所有ID范围设置');
            }
        });
    };

    // 解析ID范围文本
    const parseIdRanges = (text) => {
        const ranges = [];
        const lines = text.trim().split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(/^(\d+)-(\d+)$/);
            if (match) {
                const start = parseInt(match[1], 10);
                const end = parseInt(match[2], 10);
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    ranges.push({ start, end });
                }
            }
        }

        return ranges;
    };

    // 获取当前ID
    const getCurrentId = () => {
        const url = new URL(location.href);
        const id = url.searchParams.get('id');
        return id ? parseInt(id, 10) : null;
    };

    // 检查ID是否在设置的范围内
    const isIdInRanges = (id) => {
        if (!idRanges.length) return true; // 未设置范围时默认允许跳转

        for (const range of idRanges) {
            if (id >= range.start && id <= range.end) {
                return true;
            }
        }
        return false;
    };

    // 找到下一个有效的ID
    const getNextValidId = (currentId) => {
        if (!currentId) return null;

        let nextId = currentId + 1;

        // 如果未设置范围，直接返回下一个ID
        if (!idRanges.length) return nextId;

        // 检查下一个ID是否在范围内
        if (isIdInRanges(nextId)) {
            return nextId;
        }

        // 查找下一个范围内的ID
        for (const range of idRanges) {
            if (range.start > nextId) {
                return range.start;
            }
        }

        // 所有范围都已播放完毕
        return null;
    };

    // ✨ 工具函数：格式化时间
    const formatTime = (seconds) => {
        seconds = Math.max(0, Math.floor(seconds));
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // 🔁 跳转到下一个有效ID
    const redirectNext = () => {
        if (hasRedirected) return;
        hasRedirected = true;

        const currentId = getCurrentId();
        if (currentId === null) {
            console.warn('[自动连播] ❗ 未找到有效 id 参数，跳过跳转');
            return;
        }

        const nextId = getNextValidId(currentId);
        if (nextId === null) {
            console.log('[自动连播] 🎉 所有设置范围内的视频已播放完毕');
            // 显示完成提示
            alert('所有设置范围内的视频已播放完毕！');
            return;
        }

        const url = new URL(location.href);
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
                        console.warn('[自动连播] ⚠️ 自动播放被阻止，尝试静音播放…', err);
                        // 静音 + 再次尝试
                        video.muted = true;
                        video.play()
                            .then(() => {
                                console.log('[自动连播] 🔇 静音后自动播放成功');
                            })
                            .catch(err2 => {
                                console.error('[自动连播] ❌ 即使静音也无法自动播放，请手动点击播放', err2);
                            });
                    });
            }
        } else if (!video.paused) {
            console.log('[自动连播] ▶️ 视频已在播放，无需操作');
        }
    };

    // 🕒 视频播放完毕但未检测到已完成时，倒退20秒并继续播放
    const handleVideoEndedWithoutCompletion = () => {
        if (!videoElement || hasRedirected) return;

        // 计算倒退后的时间（不小于0）
        const backTime = Math.max(0, videoElement.duration - 20);
        console.log(`[自动连播] ⏮️ 视频播放完毕但未检测到"已完成"，倒退至 ${formatTime(backTime)} 继续播放`);

        // 设置进度并播放
        videoElement.currentTime = backTime;
        // 确保视频处于播放状态（防止暂停）
        if (videoElement.paused) {
            videoElement.play().catch(err => {
                console.warn('[自动连播] ⚠️ 倒退后播放失败，尝试静音播放', err);
                videoElement.muted = true;
                videoElement.play().catch(err2 => {
                    console.error('[自动连播] ❌ 倒退后播放失败，请手动点击播放', err2);
                });
            });
        }
    };

    // 检测完成状态（监听.tips-completion文本变化）
    const checkCompletionStatus = () => {
        const completionElem = document.querySelector('.tips-completion');
        if (completionElem) {
            const statusText = completionElem.textContent.trim();
            console.log(`[自动连播] 📋 当前完成状态：${statusText}`);
            if (statusText === '已完成') {
                clearInterval(completionCheckInterval);
                redirectNext();
            } else {
                // 状态未完成时，检查视频是否已播放完毕
                if (videoElement && videoElement.ended) {
                    handleVideoEndedWithoutCompletion();
                }
            }
        } else {
            // 未找到状态元素时，也检查视频是否已播放完毕（防止状态元素加载慢）
            if (videoElement && videoElement.ended) {
                handleVideoEndedWithoutCompletion();
            }
        }
    };

    // 等待视频并启用监控
    const waitForVideo = () => {
        videoElement = document.querySelector('video');
        if (!videoElement) {
            setTimeout(waitForVideo, 1000);
            return;
        }
        console.log('[自动连播] ✅ 检测到视频元素');

        // 首次检测到视频即尝试自动播放
        setTimeout(() => {
            attemptAutoplay(videoElement);
        }, 0);

        // 监听视频播放结束事件（提前拦截，防止卡死）
        videoElement.addEventListener('ended', () => {
            console.log('[自动连播] ⏹️ 视频播放结束事件触发');
            // 延迟1秒检查状态，给系统一点时间更新"已完成"状态
            setTimeout(checkCompletionStatus, 1000);
        }, { once: false });

        // 每5秒检测一次完成状态
        completionCheckInterval = setInterval(() => {
            if (hasRedirected) {
                clearInterval(completionCheckInterval);
                return;
            }
            checkCompletionStatus();
        }, 5000);
    };

    // 初始化
    createControlPanel();
    waitForVideo();
})();
