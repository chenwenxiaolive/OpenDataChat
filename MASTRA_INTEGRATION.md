# Mastra.ai Integration 集成文档

## ✅ 集成完成

本项目已成功集成 Mastra.ai 框架，提供更强大的 AI Agent 功能。

## 架构概览

```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                    │
│  ┌────────────────────────────────────────────┐ │
│  │  DataAgent Component                       │ │
│  │  - Switch between 3 agent types            │ │
│  │  - AI SDK Agent                            │ │
│  │  - Mock Agent                              │ │
│  │  - 🚀 Mastra Agent (NEW)                   │ │
│  └────────────────────────────────────────────┘ │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│              API Routes (Next.js)                │
│  ┌────────────────────────────────────────────┐ │
│  │  /api/agent (Edge Runtime)                 │ │
│  │  - Original AI SDK implementation          │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │  /api/mastra-agent (Node.js Runtime)       │ │
│  │  - 🚀 Mastra Agent API                     │ │
│  │  - Streaming support                       │ │
│  └────────────────────────────────────────────┘ │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│          Mastra Configuration                    │
│  ┌────────────────────────────────────────────┐ │
│  │  lib/mastra/agents/dataAnalyst.ts          │ │
│  │  - Agent definition                        │ │
│  │  - Anthropic model (claude-sonnet-4.5)     │ │
│  │  - Custom endpoint configuration           │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │  lib/mastra/tools/pythonExecutor.ts        │ │
│  │  - Pyodide execution tool                  │ │
│  └────────────────────────────────────────────┘ │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│         Custom Anthropic Endpoint                │
│  http://23.106.130.6:3000/api/v1/messages       │
└─────────────────────────────────────────────────┘
```

## 文件结构

### 核心文件

1. **Agent 配置** - `lib/mastra/agents/dataAnalyst.ts`
   - 定义 Data Analyst Agent
   - 配置自定义 Anthropic endpoint
   - 集成 Python 执行工具

2. **工具定义** - `lib/mastra/tools/pythonExecutor.ts`
   - Python 代码执行工具
   - 与 Pyodide 集成

3. **API 路由** - `app/api/mastra-agent/route.ts`
   - 处理客户端请求
   - 流式响应支持
   - Node.js runtime（必需）

4. **前端 Agent** - `lib/mastraDataAgent.ts`
   - 客户端 Agent 类
   - 处理流式响应
   - Python 代码执行

5. **UI 组件** - `components/DataAgent.tsx`
   - Agent 类型切换
   - 3种 Agent 支持

## 特性

### ✅ 已实现

1. **Mastra Agent 集成**
   - ✅ 使用 AI SDK 模型实例
   - ✅ 自定义 Anthropic endpoint
   - ✅ 流式响应
   - ✅ 工具调用（Python executor）

2. **前端集成**
   - ✅ Agent 类型切换（AI SDK / Mock / Mastra）
   - ✅ 实时状态显示
   - ✅ 流式响应处理

3. **数据分析功能**
   - ✅ Thought-Code-Result 工作流
   - ✅ Pyodide Python 执行
   - ✅ Pandas, NumPy, Matplotlib 支持
   - ✅ 文件上传和管理

### 🔜 待实现

1. **Mastra Workflows**
   - 复杂数据分析工作流
   - 多步骤任务编排
   - 条件分支

2. **增强功能**
   - Memory 和 RAG
   - 更多工具集成
   - Observability 和日志

## 使用方法

### 基本使用

1. 访问 `http://localhost:54891`
2. 点击右上角的 "Switch Agent" 按钮
3. 选择 "🚀 Mastra" Agent
4. 输入问题，例如："分析 HR 数据集"

### 切换 Agent

应用支持 3 种 Agent：

- **🚀 Mastra** - Mastra.ai 框架（推荐）
  - 更强大的功能
  - 工具调用支持
  - 流式响应

- **🤖 AI SDK** - 原始 AI SDK 实现
  - 轻量级
  - Edge Runtime

- **🎭 Mock** - 测试/演示
  - 无需 API 密钥
  - 快速响应

### API 调用示例

```typescript
// 使用 Mastra Agent
const response = await fetch('/api/mastra-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Analyze this data' }
    ],
    availableFiles: ['data.csv']
  })
});

// 读取流式响应
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  console.log(chunk); // 实时显示 AI 响应
}
```

## 配置

### 环境变量

`.env.local`:
```bash
ANTHROPIC_BASE_URL=http://23.106.130.6:3000/api/v1
ANTHROPIC_AUTH_TOKEN=cr_04325b987463dd92d65b5b581edea6fc4f2b0a9809b95c4b76dd8ca1b9bef927
```

### 依赖

```json
{
  "@mastra/core": "^0.24.6",
  "@ai-sdk/anthropic": "^2.0.53",
  "ai": "^5.0.108"
}
```

## 测试

### 测试 Mastra API

```bash
curl -X POST http://localhost:54891/api/mastra-agent \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"availableFiles":[]}'
```

预期输出（流式）：
```
**Thought:** The user wants a greeting...

**Code:**
\```python
print("Hello!")
\```
```

## 技术细节

### 为什么需要 Node.js Runtime？

Mastra 依赖 Node.js 的 `stream` 模块，Edge Runtime 不支持。因此 Mastra API 路由必须使用 Node.js runtime：

```typescript
export const runtime = 'nodejs'; // 必需！
```

### 模型配置

Mastra 使用 AI SDK 的模型实例，而不是配置对象：

```typescript
// ✅ 正确
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  baseURL: 'http://23.106.130.6:3000/api/v1',
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
});

const agent = new Agent({
  model: anthropic('claude-sonnet-4-5-20250929'), // AI SDK 实例
});

// ❌ 错误
const agent = new Agent({
  model: {
    provider: 'ANTHROPIC',  // 不支持
    name: 'claude-sonnet-4-5-20250929',
  },
});
```

### 流式响应处理

Mastra 提供 `textStream` async iterator：

```typescript
const stream = await agent.stream(message);

for await (const chunk of stream.textStream) {
  console.log(chunk); // 每个 token
}
```

## 参考资源

- [Mastra 官方文档](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Using AI SDK with Mastra](https://mastra.ai/blog/using-ai-sdk-with-mastra)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

## 故障排除

### 问题：Edge Runtime 错误

```
Error: The edge runtime does not support Node.js 'stream' module
```

**解决方案**：确保 API 路由使用 `nodejs` runtime：
```typescript
export const runtime = 'nodejs';
```

### 问题：模型配置错误

```
[Agent:Data Analyst] - Failed to resolve model configuration
```

**解决方案**：使用 AI SDK 模型实例而不是配置对象。

### 问题：环境变量未加载

**解决方案**：
1. 检查 `.env.local` 文件
2. 重启开发服务器
3. 清除 `.next` 缓存：`rm -rf .next`

## 更新日志

### 2025-12-07
- ✅ 集成 Mastra.ai 框架
- ✅ 实现 Data Analyst Agent
- ✅ 添加流式响应支持
- ✅ 创建 Python 执行工具
- ✅ 更新 UI 支持 Agent 切换
- ✅ 完成端到端测试

---

**状态**: 生产就绪 ✅
**最后更新**: 2025-12-07
**维护者**: Shiro
