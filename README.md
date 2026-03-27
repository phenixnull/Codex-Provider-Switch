<div align="center">
  <img src="./docs/cover.svg" alt="Codex Provider Switch cover" width="100%" />
  <h1>Codex Provider Switch</h1>
  <p><strong>一个面向 Codex 工作流的 Electron 预设切换器</strong></p>
  <p>把 <code>config.toml</code> / <code>auth.json</code> 的切换、编辑、保存、启用和在线测试，收束到一个更友好的桌面界面里。</p>

  <p>
    <img src="https://img.shields.io/badge/Electron-41.1.0-191970?style=for-the-badge&logo=electron&logoColor=white" alt="Electron 41.1.0" />
    <img src="https://img.shields.io/badge/Node.js-Desktop_App-1F9D55?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js desktop app" />
    <img src="https://img.shields.io/badge/Providers-92scw%20%7C%20GMN%20%7C%20Gwen%20%7C%20OpenAI-FF7A59?style=for-the-badge" alt="Built-in providers" />
    <img src="https://img.shields.io/badge/Tests-25%20passing-0F766E?style=for-the-badge" alt="25 passing tests" />
  </p>
</div>

## 项目定位

这个项目解决的是一个很具体、但很烦的日常问题：

- 你可能会在多个 Codex relay / provider 之间频繁切换。
- 真正生效的配置文件在 `%USERPROFILE%\\.codex\\config.toml` 和 `%USERPROFILE%\\.codex\\auth.json`。
- 手动改文件容易漏改、改错，尤其是 `provider id`、`base_url`、`wire_api` 和密钥。
- 某些供应商“终端里能通，应用内测试却失败”，还需要单独排查网络栈差异。

`Codex Provider Switch` 的目标不是替代 Codex，而是把这层“供应商配置管理”做成一个单独、清晰、可验证的工具。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 内置默认预设 | 保留 `92scw`、`GMN`、`Gwen`、`OpenAI Official` 四套默认预设 |
| 双文件编辑 | 同时展示并编辑 `config.toml` 和 `auth.json` |
| 保存与启用分离 | `保存预设` 只保存到应用预设库，`启用到 Codex` 才会写入用户真实生效文件 |
| 在线测试 | 直接对当前编辑中的配置发起最小 `/responses` 请求，返回状态、接口地址、响应 id 和文本 |
| 自定义预设 | 支持新增自定义预设，名称和描述都可编辑 |
| 现有预设可编辑 | 包括内置预设，也支持修改名称、描述、配置内容和密钥后再保存 |
| 目标文件可追踪 | 清楚展示当前生效文件路径，方便你确认真正写到了哪里 |
| Windows 兼容回退 | 针对部分网关拦截 Node/Electron `fetch` 的场景，在线测试可在 Windows 下自动回退到 PowerShell 请求 |

## 当前工作流

1. 在左侧选择一个内置预设，或者点击 `+ 新增预设`。
2. 在右侧直接编辑供应商名称、供应商描述、`config.toml`、`auth.json`。
3. 先点 `保存预设`，把它保存在应用自己的预设库里。
4. 需要真正切换时，再点 `启用到 Codex`，写入 `%USERPROFILE%\\.codex\\` 下的真实文件。
5. 如果想先验证联通性，直接点 `在线测试`，不需要先启用。

## 内置预设

| 预设 | `model_provider` | 接口基址 | 备注 |
| --- | --- | --- | --- |
| `92scw` | `codex` | `http://92scw.cn/v1` | 走 `responses` |
| `GMN` | `codex` | `https://gmn.chuangzuoli.com` | 走 `responses` |
| `Gwen` | `gwen` | `https://ai.love-gwen.top/openai` | 走 `responses`，Windows 在线测试已兼容网关拦截回退 |
| `OpenAI Official` | `openai` | `https://api.openai.com/v1` | 官方直连 |

说明：

- 这些默认预设会保留在项目里，便于开箱即用。
- 你仍然可以在 UI 中修改 key、模型、描述和完整配置，并单独保存。
- 真正生效时，应用只会把你当前确认启用的内容写进用户目录下的 `.codex` 文件。

## 在线测试链路

```mermaid
flowchart LR
  A[当前编辑器中的 config.toml + auth.json] --> B[构造 /responses 最小请求]
  B --> C{Node/Electron 请求成功?}
  C -- Yes --> D[显示 endpoint / response id / output_text]
  C -- No --> E{Windows + openresty 403?}
  E -- No --> F[直接展示错误]
  E -- Yes --> G[回退到 PowerShell Invoke-RestMethod]
  G --> D
```

这个回退逻辑是专门为 `Gwen` 这类“PowerShell 能用，但 Electron 默认 `fetch` 会被网关拦 403”的场景补上的。

## 界面重点

- 左侧是“预设卡片区”，用于切换和新增预设。
- 右侧上方是“当前编辑目标”，名称和一行描述都可以编辑。
- 中部是两个代码编辑器，分别对应 `config.toml` 和 `auth.json`。
- 底部是测试面板，用于显示在线测试状态、接口、模型、响应 id 和返回文本。

这意味着它不是一个“仅能一键覆盖”的工具，而是一个“先编辑、再保存、最后启用”的可控工作流。

## 项目结构

```text
src/
  main/
    codex-files.js          # 读取 / 写入用户目录下的 .codex 文件
    main.js                 # Electron 主进程与 IPC 绑定
    preset-overrides.js     # 内置预设覆盖与自定义预设持久化
    provider-tester.js      # 在线测试与 Windows 回退逻辑
  preload/
    preload.js              # 暴露安全 IPC 接口
  renderer/
    index.html              # 页面结构
    renderer.js             # 界面状态与交互
    styles.css              # 视觉样式
  shared/
    config-service.js       # 配置解析与摘要
    presets.js              # 内置预设定义
test/
  *.test.js                 # node:test 回归测试
```

## 本地运行

```bash
npm install
npm start
```

默认会打开 Electron 桌面应用，并读取：

- `%USERPROFILE%\\.codex\\config.toml`
- `%USERPROFILE%\\.codex\\auth.json`

## 测试

```bash
npm test
```

当前仓库包含的自动化测试主要覆盖：

- `.codex` 文件读写
- 预设识别与摘要生成
- 内置预设与自定义预设保存
- IPC 错误包装
- `/responses` 在线测试请求构造
- Gwen 在 Windows 下的 PowerShell 回退链路

## 构建

```bash
npm run build
npm run dist
```

`electron-builder` 当前配置会输出 Windows portable 包。

## 敏感信息与提交策略

- 项目源码里保留的是“默认预设模板”。
- 用户真实生效的 `auth.json` 位于 `%USERPROFILE%\\.codex\\auth.json`，不应该作为运行时文件提交到仓库。
- 如果你在本地把某个 key 改成自己的正式密钥，请只让它留在用户目录或本地应用预设存储里，不要把单独导出的真实运行时认证文件提交出去。

## 适合谁用

- 经常切换多个 Codex relay / provider 的用户
- 不想反复手改 `.codex` 文件的人
- 想把“保存预设”和“真正启用”拆开的用户
- 需要在桌面界面里直接验证供应商接口是否可用的人

## 后续可继续扩展的方向

- 预设导入 / 导出
- 预设删除与排序
- 多环境配置分组
- 更完整的测试诊断日志
- 发布可下载的便携版发行页

---

如果你想把它当成一个专门管理 Codex 第三方配置的“小控制台”，现在这版已经具备完整的基本闭环：**查看、编辑、保存、启用、测试**。
