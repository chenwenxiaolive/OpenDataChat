import { dataAnalyst } from '@/lib/mastra/agents/dataAnalyst';

// Mastra requires Node.js runtime
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('🚀 [Mastra Agent] Received request');
    const { messages, availableFiles } = await req.json();

    console.log('\n📨 [Received Messages]:');
    console.log(JSON.stringify(messages, null, 2));

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

    console.log('🤖 [Calling Mastra Agent with streaming]');
    console.log('📝 [Streaming Response]:');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用 Mastra 的 .stream() 方法，带回调
          const agentStream = await dataAnalyst.stream(contextMessage, {
            onStepFinish: async (step) => {
              console.log(`\n📋 [Step finished: ${step.stepType}]`);

              // 处理工具调用
              if (step.toolCalls && step.toolCalls.length > 0) {
                for (const toolCall of step.toolCalls) {
                  // Mastra 的 toolCall 结构：toolCall.payload.toolName 和 toolCall.payload.args
                  const payload = (toolCall as any).payload;

                  if (payload && payload.toolName === 'pythonExecutor' && payload.args?.code) {
                    console.log('🐍 [Tool call - Python]:', payload.args.code.substring(0, 50));

                    // 发送完成标记（结束之前的文本）
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'assistant-text-complete'
                      }) + '\n'
                    ));

                    // 流式发送代码块 - 按行分块
                    const codeLines = payload.args.code.split('\n');
                    const codeBlockStart = '```python\n';
                    const codeBlockEnd = '\n```';

                    // 发送开始标记（创建新的代码块气泡）
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'code-block-start'
                      }) + '\n'
                    ));

                    // 发送代码块开始标记
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'code-block-chunk',
                        content: codeBlockStart
                      }) + '\n'
                    ));

                    // 逐行发送代码
                    for (let i = 0; i < codeLines.length; i++) {
                      const line = codeLines[i] + (i < codeLines.length - 1 ? '\n' : '');
                      controller.enqueue(encoder.encode(
                        JSON.stringify({
                          type: 'code-block-chunk',
                          content: line
                        }) + '\n'
                      ));
                      // 添加小延迟以模拟打字效果
                      await new Promise(resolve => setTimeout(resolve, 20));
                    }

                    // 发送代码块结束标记
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'code-block-chunk',
                        content: codeBlockEnd
                      }) + '\n'
                    ));

                    // 发送代码块完成标记
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'code-block-complete'
                      }) + '\n'
                    ));

                    // 发送执行指令
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'code-execution',
                        code: payload.args.code
                      }) + '\n'
                    ));

                  } else if (payload && payload.toolName === 'displayImage' && payload.args?.filepath) {
                    console.log('🖼️  [Tool call - Display Image]:', payload.args.filepath);

                    // 发送显示图片指令
                    controller.enqueue(encoder.encode(
                      JSON.stringify({
                        type: 'display-image',
                        filepath: payload.args.filepath,
                        title: payload.args.title
                      }) + '\n'
                    ));
                  }
                }
              }
            }
          });

          // 流式接收文本块
          for await (const chunk of agentStream.textStream) {
            // 直接输出文本块内容，不加前缀
            process.stdout.write(chunk);

            // 发送文本块到前端
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: 'assistant-text-chunk',
                content: chunk
              }) + '\n'
            ));
          }

          console.log('✅ [Text stream completed]');

          // 发送最终完成标记
          controller.enqueue(encoder.encode(
            JSON.stringify({
              type: 'assistant-text-complete'
            }) + '\n'
          ));

          console.log('✅ [Stream completed]');
        } catch (error) {
          console.error('❌ [Stream error]:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
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
