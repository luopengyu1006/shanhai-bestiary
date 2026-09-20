# 山海簿 · Shanhai Bestiary

> 山海为簿，异兽为事；文档为鉴，游历为记。

一款基于 Electron 的本地优先桌面应用，把每一件事视为一只异兽，把文档视为图鉴，把日常记录视为游历。

## 特性

- **任务即异兽**：以异兽化视角管理任务，每只"异兽"都有自己的状态、图鉴与经历
- **本地优先**：所有数据存储于本地 SQLite，无需联网，断网可用
- **富文本进展**：支持 Markdown 进展记录，可插入图片附件
- **状态流转**：内置 10 种状态（未开始、待确认、进行中、待联调、待测试、待上线、已完成、已暂停、已取消…）
- **备份恢复**：一键导出/导入 zip 备份，数据迁移无忧
- **快速便签**：全局快捷唤起的轻量笔记窗口
- **系统托盘**：最小化至托盘，常驻后台不打扰

## 截图

> 暂无截图，欢迎在 Issue 中提交你的使用截图

## 技术栈

- **运行时**：Electron 33
- **构建工具**：electron-vite 2 + Vite 5
- **前端**：React 18 + TypeScript 5
- **状态管理**：Zustand 5
- **数据库**：SQLite (sql.js)
- **渲染**：Markdown (marked)
- **打包**：electron-builder 25

## 开发环境

- Node.js ≥ 18
- npm / pnpm / yarn 任选

### 安装

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

### 构建

```bash
# 仅打包 JS（不生成安装器）
npm run build

# 打包 Windows 安装器（NSIS + Portable）
npm run dist:win

# 当前平台完整构建
npm run dist
```

构建产物输出至 `release/` 目录。

## 目录结构

```
shanhai-bestiary/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts          # 入口
│   │   ├── mainWindow.ts     # 主窗口
│   │   ├── quickNote.ts      # 便签窗口
│   │   ├── db.ts             # SQLite 封装
│   │   ├── storage.ts        # 附件存储
│   │   ├── ipc.ts            # IPC 通信
│   │   ├── backup.ts         # 备份
│   │   └── restore.ts        # 恢复
│   ├── preload/       # 预加载脚本
│   ├── renderer/      # 渲染进程（React UI）
│   │   └── src/
│   │       ├── components/   # UI 组件
│   │       ├── utils/        # 工具函数
│   │       ├── App.tsx
│   │       └── store.ts      # Zustand 状态
│   └── shared/        # 主/渲染进程共享类型
├── build/             # 图标与构建资源
├── scripts/           # 构建脚本
└── electron-builder.yml
```

## 数据存储位置

应用首次启动后，会在系统用户目录下创建数据目录：

- **Windows**：`%APPDATA%\shanhaibu\`
- **macOS**：`~/Library/Application Support/shanhaibu/`
- **Linux**：`~/.config/shanhaibu/`

可通过应用内"打开数据目录"按钮快速访问。

## 贡献

欢迎通过 Issue 与 Pull Request 参与贡献。在提交 PR 前请确保：

1. 代码通过 `npm run build` 编译
2. 遵循现有代码风格
3. 在 PR 描述中说明改动动机与测试方式

## 许可证

[MIT](./LICENSE) © 2026 山海簿
