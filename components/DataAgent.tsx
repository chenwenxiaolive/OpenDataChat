'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PyodideInterface } from 'pyodide';
import { MastraDataAgent } from '@/lib/mastraDataAgent';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  id: string;
  type: 'user' | 'system' | 'assistant' | 'code-result';
  content: string;
  isError?: boolean;
  isStreaming?: boolean;
}

export default function DataAgent() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [agent, setAgent] = useState<MastraDataAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      try {
        console.log('Starting Pyodide load...');
        setLoadingProgress(10);

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js';
        script.async = true;

        script.onload = async () => {
          console.log('Pyodide script loaded');
          setLoadingProgress(30);

          try {
            // @ts-ignore
            const pyodideInstance = await window.loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',
            });
            console.log('Pyodide instance created');
            setLoadingProgress(60);

            // Load data science packages
            await pyodideInstance.loadPackage(['pandas', 'matplotlib']);
            console.log('Packages loaded');

            setLoadingProgress(80);
            setPyodide(pyodideInstance);

            // Initialize Mastra agent
            const mastraAgent = new MastraDataAgent(pyodideInstance);
            setAgent(mastraAgent);

            setLoadingProgress(100);
            setIsLoading(false);
          } catch (err) {
            console.error('Failed to initialize Pyodide:', err);
            setIsLoading(false);
          }
        };

        script.onerror = (err) => {
          console.error('Failed to load Pyodide script:', err);
          setIsLoading(false);
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error('Failed to load Pyodide:', err);
        setIsLoading(false);
      }
    };

    loadPyodide();
  }, []);

  // Update agent when files change
  useEffect(() => {
    if (agent) {
      agent.updateAvailableFiles(uploadedFiles);
    }
  }, [uploadedFiles, agent]);


  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (files && files.length > 0 && pyodide && agent) {
      const file = files[0];
      setCurrentFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target?.result) return;
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        pyodide.FS.writeFile(file.name, data);

        // Update uploaded files list
        const newFiles = [...uploadedFiles, file.name];
        setUploadedFiles(newFiles);
        agent.updateAvailableFiles(newFiles);

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          content: `File loaded: ${file.name} (mounted to virtual file system)`
        }]);
      };
      reader.readAsArrayBuffer(file);
    }
  }, [pyodide, agent, uploadedFiles]);

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // 简化版：每个 bubble 都直接添加到列表
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    if (!agent) return;

    // 添加用户消息
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: text
    }]);
    setInput('');

    // 设置 Agent 运行状态
    setIsAgentRunning(true);

    // 处理查询 - agent 会为每个部分调用一次 onBubble
    try {
      await agent.processQuery(
        text,
        (bubble) => {
          console.log('🎈 [Bubble Update]', bubble.id, bubble.type, bubble.content.substring(0, 30));

          setMessages(prev => {
            // 查找是否已存在相同 ID 的气泡
            const existingIndex = prev.findIndex(msg => msg.id === bubble.id);

            if (existingIndex >= 0) {
              // 更新现有气泡
              const updated = [...prev];
              updated[existingIndex] = bubble;
              return updated;
            } else {
              // 添加新气泡
              return [...prev, bubble];
            }
          });
        },
        (filename) => {
          // 文件下载完成后，更新文件列表
          console.log('📥 [File Added]:', filename);
          setUploadedFiles(prev => {
            if (!prev.includes(filename)) {
              return [...prev, filename];
            }
            return prev;
          });
        }
      );
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: err.message || String(err),
        isError: true
      }]);
    } finally {
      // 处理完成，关闭运行状态
      setIsAgentRunning(false);
    }
  }, [input, agent]);

  const clearFile = useCallback(() => {
    setCurrentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Loading Python Environment...
          </h2>
          <p className="text-gray-600">
            Downloading runtime and packages ({loadingProgress}%)
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a moment on first load
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col bg-gray-50"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <h1 className="font-bold text-lg text-gray-800">
            OpenDataChat{' '}
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              Open Source
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs flex items-center gap-2 text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            Python ready
          </div>
          <div className="text-xs flex items-center gap-2 text-blue-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/>
            </svg>
            Mastra AI Agent
          </div>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
            🚀 Mastra
          </span>
        </div>
      </header>

      {/* Chat Container */}
      <main
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6"
      >
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center mt-10">
            <h2 className="text-2xl font-bold mb-2 text-gray-900">Welcome to OpenDataChat</h2>
            <p className="text-gray-500">
              Chat with your data using AI. Upload files or provide URLs to get started.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            // User message
            if (msg.type === 'user') {
              return (
                <div key={msg.id} className="max-w-4xl mx-auto mb-4">
                  <div className="flex justify-end">
                    <div className="bg-gray-100 text-gray-800 px-5 py-3 rounded-2xl rounded-tr-sm max-w-2xl shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            // System message
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center mb-4 text-xs text-gray-400">
                  {msg.content}
                </div>
              );
            }

            // Assistant message (AI response)
            if (msg.type === 'assistant') {
              // 检查是否包含代码块
              const hasCodeBlock = msg.content.includes('```');
              const title = hasCodeBlock ? 'RUNNING SCRIPT' : 'AI RESPONSE';

              return (
                <div key={msg.id} className="max-w-4xl mx-auto mb-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 flex-shrink-0 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div className={`flex-1 px-4 py-3 rounded-lg ${
                      msg.isError ? 'bg-red-50 border border-red-200' : 'bg-[#fafafa] border border-gray-200'
                    }`}>
                      <div className="text-xs font-semibold text-gray-500 mb-2">{title}</div>
                      <div className="prose prose-sm max-w-none [&>*]:text-gray-900 [&_p]:text-gray-900 [&_li]:text-gray-900 [&_h1]:text-gray-900 [&_h2]:text-gray-900 [&_h3]:text-gray-900 [&_strong]:text-gray-900 [&_em]:text-gray-900 [&_pre]:!bg-gray-900 [&_pre]:!text-white [&_pre_code]:!text-white">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            p: ({node, ...props}) => (
                              <p className="text-gray-900 my-2 last:mb-0" {...props} />
                            ),
                            h1: ({node, ...props}) => (
                              <h1 className="text-gray-900 font-bold text-xl my-3" {...props} />
                            ),
                            h2: ({node, ...props}) => (
                              <h2 className="text-gray-900 font-bold text-lg my-2" {...props} />
                            ),
                            h3: ({node, ...props}) => (
                              <h3 className="text-gray-900 font-semibold text-base my-2" {...props} />
                            ),
                            strong: ({node, ...props}) => (
                              <strong className="text-gray-900 font-bold" {...props} />
                            ),
                            li: ({node, ...props}) => (
                              <li className="text-gray-900" {...props} />
                            ),
                            pre: ({node, children, ...props}) => {
                              // 如果 children 是 code 标签，直接返回 children（避免双层包裹）
                              return <>{children}</>;
                            },
                            code: ({node, inline, className, children, ...props}: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const language = match ? match[1] : 'python';
                              const codeString = String(children).replace(/\n$/, '');

                              return !inline ? (
                                <div className="overflow-x-auto">
                                  <SyntaxHighlighter
                                    style={oneLight}
                                    language={language}
                                    PreTag="div"
                                    showLineNumbers={true}
                                    wrapLines={true}
                                    lineProps={{
                                      style: {
                                        wordBreak: 'break-all',
                                        whiteSpace: 'pre-wrap',
                                      }
                                    }}
                                    customStyle={{
                                      margin: 0,
                                      padding: '1rem',
                                      fontSize: '0.875rem',
                                      lineHeight: '1.5',
                                      borderRadius: 0,
                                      border: 'none',
                                      backgroundColor: '#fafafa',
                                      maxWidth: '100%',
                                      overflow: 'visible',
                                    }}
                                    {...props}
                                  >
                                    {codeString}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code className="bg-gray-200 text-gray-900 px-1 py-0.5 rounded text-xs" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            img: ({node, ...props}) => (
                              <img
                                className="max-w-full h-auto rounded-lg shadow-md my-4"
                                {...props}
                                alt={props.alt || 'Generated visualization'}
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Code execution result
            if (msg.type === 'code-result') {
              // 检查是否包含图片
              const imgMatch = msg.content.match(/<img\s+src="data:image\/png;base64,([^"]+)"\s*\/>/);

              return (
                <div key={msg.id} className="max-w-4xl mx-auto mb-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 flex-shrink-0 bg-green-600 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="text-xs font-semibold text-gray-500 mb-2">EXECUTION RESULT</div>
                      {imgMatch ? (
                        // 渲染图片
                        <div className="bg-white p-4 rounded border border-gray-300">
                          <img
                            src={`data:image/png;base64,${imgMatch[1]}`}
                            alt="Plot"
                            className="max-w-full h-auto"
                          />
                        </div>
                      ) : (
                        // 渲染纯文本
                        <pre className="text-gray-900 font-mono text-sm whitespace-pre-wrap overflow-x-auto m-0">
                          {msg.content}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </main>

      {/* Input Area */}
      <div className="border-t bg-white p-4 sm:p-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* File Preview */}
          {currentFile && (
            <div className="mb-3">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm border border-blue-200">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                </svg>
                <span>{currentFile.name}</span>
                <button onClick={clearFile} className="hover:text-red-500">
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className={`relative shadow-lg rounded-xl border bg-white overflow-hidden transition-all ${
            isAgentRunning
              ? 'border-green-500 ring-2 ring-green-500 animate-pulse'
              : 'border-gray-300 focus-within:ring-2 focus-within:ring-blue-500'
          }`}>
            <textarea
              id="user-query"
              name="user-query"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              className="w-full p-3 pr-20 resize-none outline-none max-h-40 text-gray-900"
              placeholder="Describe your requirements, e.g., 'Analyze the sales trends in this table'..."
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Upload file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            Supports drag & drop Excel / CSV files
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 pointer-events-none bg-blue-50 bg-opacity-90 backdrop-blur-sm border-4 border-dashed border-blue-500">
          <svg className="w-20 h-20 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h3 className="text-2xl font-bold text-blue-600">Drop file to load</h3>
        </div>
      )}
    </div>
  );
}
