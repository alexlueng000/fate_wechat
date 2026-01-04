# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat Mini Program (微信小程序) for Bazi/Fortune Telling (命理八字). Built with TypeScript using the WeChat Mini Program framework.

**AppID**: `wxcfefbcb12af67c8f`
**Backend API**: `https://api.fateinsight.site` (production), `http://127.0.0.1:8000` (local development)

## Development

### Opening the Project

Use **WeChat Developer Tools** (微信开发者工具) to open this project. The project root is the repository directory, with source code in `miniprogram/`.

### Building and Running

- **Development**: Open in WeChat Developer Tools with "Compile" (编译) enabled. Hot reload is configured (`compileHotReLoad: false` in project.config.json - you may need to manually refresh).
- **Build for Production**: Use "Upload" (上传) in WeChat Developer Tools.
- **Preview**: Use "Preview" (预览) to generate a QR code for testing on real devices.

### TypeScript

- Strict mode is enabled (`tsconfig.json`)
- Types are from `miniprogram-api-typings` package
- Compilation is handled by WeChat Developer Tools via the TypeScript compiler plugin

### Code Style

- 2-space indentation (configured in `project.config.json`)
- No formal linting/formatting tools configured

## Architecture

### Directory Structure

```
miniprogram/
├── app.ts          # App entry, authentication, update manager
├── app.json        # App config: pages, window, tab bar
├── app.wxss        # Global styles
├── pages/
│   ├── index/      # Chart calculation (排盘) - birth data input form
│   ├── result/     # Results display
│   ├── chat/       # Chat/interpretation (解读)
│   └── profile/    # User profile (我的)
├── utils/
│   ├── request.ts  # Centralized HTTP client with auth
│   ├── config.ts   # API base URL config (local only, not currently used)
│   ├── env.ts      # Environment-based URL switching (unused, see request.ts)
│   ├── auth.ts     # Auth utilities
│   └── util.ts     # General utilities
└── assets/         # Tab bar icons
```

### Key Pages

1. **pages/index** - Main entry point for birth data input (gender, calendar type, date/time, location). Submits to `api/bazi/calc_paipan`.
2. **pages/result** - Displays calculation results.
3. **pages/chat** - Chat interface for AI interpretation.
4. **pages/profile** - User profile page.

### Authentication Flow

The app has environment-aware authentication:

- **Development** (`env === "develop"`): Uses `js_code='dev'` bypass for local backend testing.
- **Trial/Release** (`env === "trial" | "release"`): Uses `wx.login()` to get WeChat auth code, then calls `api/auth/mp/login`.

Token is stored in both `globalData.token` and `wx.getStorageSync("token")`.

### API Client

All API calls go through `utils/request.ts`:

```typescript
request<T>(path: string, method?: "GET"|"POST"..., data?: unknown, extraHeaders?): Promise<T>
```

- Automatically adds `Authorization: Bearer {token}` header
- Base URL is hardcoded to `https://api.fateinsight.site` (update `request.ts:4` to change)
- 60-second timeout
- Handles JSON response parsing automatically

### Environment Detection

Uses `wx.getAccountInfoSync().miniProgram.envVersion` to detect:
- `develop` - WeChat Developer Tools
- `trial` - Trial version (体验版)
- `release` - Production (正式版)

## Important Notes

### Configuration Files

- `project.config.json` - WeChat Developer Tools project settings
- `tsconfig.json` - TypeScript config (strict mode enabled)
- `app.json` - Mini program manifest (pages, tab bar, window config)

### Tab Bar

Three tabs configured in `app.json`:
1. 排盘 (Chart) - `pages/index/index`
2. 解读 (Interpretation) - `pages/chat/chat`
3. 我的 (Profile) - `pages/profile/profile`

Note: `pages/result/index` is NOT in the tab bar and must be navigated to programmatically.

### Update Manager

Built-in update checking prompts users to restart when a new version is available (see `app.ts:initUpdateManager`).

### API Endpoints

Known endpoints (from code inspection):
- `POST api/auth/mp/login` - WeChat mini program login
- `POST api/bazi/calc_paipan` - Calculate Bazi chart

### Adding New Pages

1. Create page directory in `miniprogram/pages/{name}/`
2. Add `{name}.ts`, `{name}.wxml`, `{name}.wxss`, `{name}.json`
3. Register in `app.json` pages array
4. If adding to tab bar, update `tabBar.list` in `app.json`
