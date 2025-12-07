import type { PyodideInterface } from 'pyodide';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 简化的消息类型：每个都是独立的气泡
export interface BubbleMessage {
  id: string;
  type: 'user' | 'assistant' | 'code-result' | 'system';
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

/**
 * Mastra-powered Data Agent
 * 完全重写的版本，逻辑清晰简单
 */
export class MastraDataAgent {
  private pyodide: PyodideInterface;
  private conversationHistory: AgentMessage[] = [];
  private availableFiles: string[] = [];

  constructor(pyodide: PyodideInterface) {
    this.pyodide = pyodide;
  }

  updateAvailableFiles(files: string[]) {
    this.availableFiles = files;
  }

  async processQuery(
    userQuery: string,
    onBubble: (bubble: BubbleMessage) => void
  ): Promise<void> {
    // 添加到历史
    this.conversationHistory.push({
      role: 'user',
      content: userQuery
    });

    try {
      // 调用 Mastra API
      const response = await fetch('/api/mastra-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory,
          availableFiles: this.availableFiles
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      // 流式读取响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let allText = '';
      let currentTextBubbleId: string | null = null;
      let currentTextContent = '';
      let currentCodeBubbleId: string | null = null;
      let currentCodeContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // 解码新数据
          buffer += decoder.decode(value, { stream: true });

          // 处理完整的行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const message = JSON.parse(line);
              console.log(`📋 [Stream Message]:`, message.type, message.content?.substring(0, 30));

              if (message.type === 'assistant-text-chunk') {
                // 文本分块 - 累积到当前气泡
                if (!currentTextBubbleId) {
                  currentTextBubbleId = `assistant-${Date.now()}-${Math.random()}`;
                  currentTextContent = '';
                }

                currentTextContent += message.content;
                allText += message.content;

                // 更新气泡（打字机效果）
                const bubble = {
                  id: currentTextBubbleId,
                  type: 'assistant' as const,
                  content: currentTextContent,
                  isStreaming: true
                };
                onBubble(bubble);

              } else if (message.type === 'assistant-text-complete') {
                // 文本完成标记
                if (currentTextBubbleId) {
                  const bubble = {
                    id: currentTextBubbleId,
                    type: 'assistant' as const,
                    content: currentTextContent,
                    isStreaming: false
                  };
                  onBubble(bubble);
                  currentTextBubbleId = null;
                  currentTextContent = '';
                }

              } else if (message.type === 'code-block-start') {
                // 代码块开始 - 创建新的代码气泡
                currentCodeBubbleId = `code-${Date.now()}-${Math.random()}`;
                currentCodeContent = '';

              } else if (message.type === 'code-block-chunk') {
                // 代码块分块 - 累积到当前代码气泡
                if (currentCodeBubbleId) {
                  currentCodeContent += message.content;

                  // 更新气泡（流式效果）
                  const bubble = {
                    id: currentCodeBubbleId,
                    type: 'assistant' as const,
                    content: currentCodeContent,
                    isStreaming: true
                  };
                  onBubble(bubble);
                }

              } else if (message.type === 'code-block-complete') {
                // 代码块完成
                if (currentCodeBubbleId) {
                  const bubble = {
                    id: currentCodeBubbleId,
                    type: 'assistant' as const,
                    content: currentCodeContent,
                    isStreaming: false
                  };
                  console.log('🎈 [Creating Code Block Bubble]:', bubble.id);
                  onBubble(bubble);
                  currentCodeBubbleId = null;
                  currentCodeContent = '';
                }

              } else if (message.type === 'assistant-text') {
                // 完整文本消息（向后兼容）
                // 先结束当前的打字机效果
                if (currentTextBubbleId) {
                  const bubble = {
                    id: currentTextBubbleId,
                    type: 'assistant' as const,
                    content: currentTextContent,
                    isStreaming: false
                  };
                  onBubble(bubble);
                  currentTextBubbleId = null;
                  currentTextContent = '';
                }

                // 代码块作为单独的气泡，不累积到 allText
                const bubble = {
                  id: `assistant-${Date.now()}-${Math.random()}`,
                  type: 'assistant' as const,
                  content: message.content,
                  isStreaming: false
                };
                console.log('🎈 [Creating Assistant Bubble (Code Block)]:', bubble.id);
                onBubble(bubble);
                // 不添加到 allText，因为这是代码块，不是对话内容

              } else if (message.type === 'display-image') {
                // 显示图片 - 从 Pyodide 虚拟文件系统读取
                console.log('🖼️  [Display Image]:', message.filepath);

                try {
                  // 从 Pyodide FS 读取图片文件
                  const imageData = this.pyodide.FS.readFile(message.filepath);

                  // 转换为 base64
                  const base64 = btoa(
                    imageData.reduce((data: string, byte: number) => data + String.fromCharCode(byte), '')
                  );

                  // 创建图片气泡
                  const bubble = {
                    id: `image-${Date.now()}-${Math.random()}`,
                    type: 'code-result' as const,
                    content: `<img src="data:image/png;base64,${base64}" />`,
                    isStreaming: false
                  };
                  console.log('🎈 [Creating Image Bubble]:', bubble.id);
                  onBubble(bubble);
                } catch (error: any) {
                  const bubble = {
                    id: `image-error-${Date.now()}-${Math.random()}`,
                    type: 'code-result' as const,
                    content: `Error loading image: ${error.message}`,
                    isError: true
                  };
                  console.log('🎈 [Creating Error Bubble]:', bubble.id);
                  onBubble(bubble);
                }

              } else if (message.type === 'code-execution') {
                // 代码执行前，先结束当前文本气泡
                if (currentTextBubbleId) {
                  const bubble = {
                    id: currentTextBubbleId,
                    type: 'assistant' as const,
                    content: currentTextContent,
                    isStreaming: false
                  };
                  onBubble(bubble);
                  currentTextBubbleId = null;
                  currentTextContent = '';
                }

                console.log('🐍 [Executing Code]:', message.code.substring(0, 50));

                try {
                  const result = await this.executeCode(message.code);
                  const bubble = {
                    id: `code-result-${Date.now()}-${Math.random()}`,
                    type: 'code-result' as const,
                    content: result,
                    isStreaming: false
                  };
                  console.log('🎈 [Creating Code Result Bubble]:', bubble.id);
                  onBubble(bubble);
                } catch (error: any) {
                  const bubble = {
                    id: `code-error-${Date.now()}-${Math.random()}`,
                    type: 'code-result' as const,
                    content: `Error: ${error.message}`,
                    isError: true
                  };
                  console.log('🎈 [Creating Error Bubble]:', bubble.id);
                  onBubble(bubble);
                }
              }
            } catch (e) {
              console.error('Failed to parse line:', line, e);
            }
          }
        }
      }

      // 添加完整响应到历史
      this.conversationHistory.push({
        role: 'assistant',
        content: allText.trim()
      });

    } catch (error: any) {
      console.error('❌ [Error]:', error);
      onBubble({
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: error.message || String(error),
        isError: true
      });
    }
  }

  private async executeCode(code: string): Promise<string> {
    try {
      // 重定向 stdout/stderr
      await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      // 执行代码
      await this.pyodide.runPythonAsync(code);

      // 获取输出
      const stdout = await this.pyodide.runPythonAsync('sys.stdout.getvalue()');
      const stderr = await this.pyodide.runPythonAsync('sys.stderr.getvalue()');

      if (stderr) {
        return `⚠️ Warnings:\n${stderr}\n\nOutput:\n${stdout || '(no output)'}`;
      }

      return stdout || 'Code executed successfully (no output)';
    } catch (error: any) {
      throw new Error(`Execution error: ${error.message}`);
    }
  }

  reset() {
    this.conversationHistory = [];
  }
}
