# 时间诗词粒子钟

中文 | [English](./README.md)

一个用 Three.js、Vite 和 TypeScript 做的互动 WebGL 粒子钟。

指针显示真实系统时间。鼠标在钟面上移动时，会撕开粒子场，并显示关于时间、劝学、自律的中国古代诗句。飞散的粒子不是普通光点，而是由中文汉字组成。

## 特性

- 真实时间的时针、分针、秒针
- 鼠标驱动的粒子撕裂互动效果
- 中文汉字粒子图集
- 诗句会根据鼠标所在钟面扇区切换
- 三套视觉主题：aurora、cyber、gold
- 桌面端和移动端 Playwright 冒烟测试

## 本地运行

```powershell
npm install
npm run dev
```

然后打开 Vite 在终端里输出的本地地址。

## 构建

```powershell
npm run build
```

生产文件会生成到 `dist/` 目录。

## 测试

```powershell
npm test
npm run test:e2e
```

Playwright 测试需要本机有 Chrome。如果 Chrome 安装在自定义位置，可以设置 `PLAYWRIGHT_CHROME_PATH`。

## 操作

- 在钟面附近移动鼠标，可以扰动粒子场。
- 鼠标移动到不同钟面扇区，会切换显示的诗句。
- 拖拽可以旋转钟面。
- 鼠标滚轮可以缩放。
- 按 `Space` 切换自动/手动漂移。
- 按 `R` 重播动画。
- 按 `T` 切换主题。

## 许可证

MIT
