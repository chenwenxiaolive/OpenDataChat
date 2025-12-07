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

      // 读取完整响应（不再分块处理，等待完整数据）
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullData = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullData += decoder.decode(value, { stream: true });
        }
      }

      console.log('📦 [Full Response]:', fullData);

      // 解析完整的 JSON 响应
      const lines = fullData.split('\n').filter(line => line.trim());

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          const message = JSON.parse(line);
          console.log(`📋 [Message ${i + 1}/${lines.length}]:`, message.type, message.content?.substring(0, 30));

          if (message.type === 'assistant-text') {
            // AI 的文字回复
            const bubble = {
              id: `assistant-${Date.now()}-${Math.random()}`,
              type: 'assistant' as const,
              content: message.content,
              isStreaming: false
            };
            console.log('🎈 [Creating Assistant Bubble]:', bubble.id);
            onBubble(bubble);
            // 添加小延迟确保 React 正确渲染
            await new Promise(resolve => setTimeout(resolve, 10));
          } else if (message.type === 'code-execution') {
            // 代码执行结果
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
              await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error: any) {
              const bubble = {
                id: `code-error-${Date.now()}-${Math.random()}`,
                type: 'code-result' as const,
                content: `Error: ${error.message}`,
                isError: true
              };
              console.log('🎈 [Creating Error Bubble]:', bubble.id);
              onBubble(bubble);
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        } catch (e) {
          console.error('Failed to parse line:', line, e);
        }
      }

      // 添加完整响应到历史（简化，只保留文本部分）
      const allText = lines
        .map(line => {
          try {
            const msg = JSON.parse(line);
            return msg.type === 'assistant-text' ? msg.content : '';
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\n\n');

      this.conversationHistory.push({
        role: 'assistant',
        content: allText
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
