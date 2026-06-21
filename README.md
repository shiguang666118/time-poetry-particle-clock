# Time Poetry Particle Clock

[中文](./README.zh-CN.md) | English

An interactive WebGL clock built with Three.js, Vite, and TypeScript.

The clock uses live system time for the hands. Pointer movement across the dial tears open the particle field and reveals short Chinese poems about time, study, and self-discipline. The scattered particles use Chinese glyphs instead of generic dots.

## Features

- Real-time hour, minute, and second hands
- Pointer-driven particle rupture interaction
- Chinese glyph particle atlas
- Poetry lines that change by clock sector
- Three visual themes: aurora, cyber, and gold
- Desktop and mobile Playwright smoke tests

## Run Locally

```powershell
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```powershell
npm run build
```

The production files are generated in `dist/`.

## Test

```powershell
npm test
npm run test:e2e
```

The Playwright tests expect Chrome to be available. You can set `PLAYWRIGHT_CHROME_PATH` if your Chrome is installed in a custom location.

## Controls

- Move the pointer near the dial to disturb the particle field.
- Move around different clock sectors to switch the visible poetry lines.
- Drag to rotate the dial.
- Use the mouse wheel to zoom.
- Press `Space` to toggle automatic/manual drift.
- Press `R` to replay the animation.
- Press `T` to switch themes.

## License

MIT
