import { dataAnalyst } from '@/lib/mastra/agents/dataAnalyst';

// Mastra requires Node.js runtime
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('🚀 [Mastra Agent] Received request');
    const { messages, availableFiles } = await req.json();

    // 获取最后一条用户消息
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message found');
    }

    // 添加文件上下文
    let contextMessage = lastMessage.content;
    if (availableFiles && availableFiles.length > 0) {
      contextMessage = `Available files: ${availableFiles.join(', ')}\n\nUser request: ${contextMessage}`;
    }

    console.log('🤖 [Calling Mastra Agent]');

    // 调用 Mastra Agent（等待完整结果，不流式）
    const result = await dataAnalyst.generate(contextMessage);

    console.log('✅ [Agent Response Received]');

    // 解析响应的 steps
    const steps = result.steps || [];
    console.log('📦 [Steps]:', steps.length);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const step of steps) {
          if (step.content && Array.isArray(step.content)) {
            console.log('📄 [Step content items]:', step.content.length);

            for (const item of step.content) {
              if (item.type === 'text' && item.text) {
                // 发送文本部分
                console.log('💬 [Text]:', item.text.substring(0, 50));
                controller.enqueue(encoder.encode(
                  JSON.stringify({
                    type: 'assistant-text',
                    content: item.text
                  }) + '\n'
                ));
              } else if (item.type === 'tool-call' && item.input?.code) {
                // 先发送代码内容（显示）
                console.log('🐍 [Code]:', item.input.code.substring(0, 50));
                controller.enqueue(encoder.encode(
                  JSON.stringify({
                    type: 'assistant-text',
                    content: '```python\n' + item.input.code + '\n```'
                  }) + '\n'
                ));

                // 再发送代码执行指令
                controller.enqueue(encoder.encode(
                  JSON.stringify({
                    type: 'code-execution',
                    code: item.input.code
                  }) + '\n'
                ));
              }
            }
          }
        }

        controller.close();
        console.log('✅ [Stream completed]');
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error('❌ [Error]:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process request'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
