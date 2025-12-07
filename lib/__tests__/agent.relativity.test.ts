import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataAgent, MockDataAgent, type AgentStep } from '../dataAgent';
import type { PyodideInterface } from 'pyodide';

// Mock PyodideInterface
const createMockPyodide = (): PyodideInterface => {
  return {
    runPythonAsync: vi.fn().mockResolvedValue(''),
    FS: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
  } as unknown as PyodideInterface;
};

// Mock fetch globally
global.fetch = vi.fn();

describe('相对论问题测试', () => {
  let mockPyodide: PyodideInterface;
  let steps: AgentStep[];
  const onStep = (step: AgentStep) => {
    console.log(`\n[步骤 ${steps.length + 1}] ${step.type}:`);
    console.log(step.content.substring(0, 200) + (step.content.length > 200 ? '...' : ''));
    steps.push(step);
  };

  beforeEach(() => {
    mockPyodide = createMockPyodide();
    steps = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该正确回答"告诉我相对论讲了什么？"', async () => {
    const agent = new DataAgent(mockPyodide);

    // 模拟AI的中文回答
    const aiResponse = `**Thought:** 用户问的是相对论的基本概念，我可以用Python来展示一些相对论的关键公式和概念。

**Code:**
\`\`\`python
import math

print("=== 爱因斯坦相对论简介 ===\\n")

print("相对论由阿尔伯特·爱因斯坦提出，包括两个主要理论：\\n")

print("1. 狭义相对论 (1905年)")
print("   主要内容：")
print("   - 光速不变原理：真空中光速恒定，约为 c = 299,792,458 m/s")
print("   - 相对性原理：物理定律在所有惯性参考系中相同")
print("   - 时间膨胀：运动物体的时间会变慢")
print("   - 长度收缩：运动物体在运动方向上会缩短")
print("   - 质能等价：E = mc²\\n")

# 计算质能转换示例
mass = 1  # kg
c = 299792458  # m/s
energy = mass * c ** 2
print(f"   质能方程示例：1kg质量 = {energy:.2e} 焦耳\\n")

print("2. 广义相对论 (1915年)")
print("   主要内容：")
print("   - 引力本质：引力是时空弯曲的表现，而非力")
print("   - 质量和能量会使周围时空发生弯曲")
print("   - 预言了黑洞、引力波、宇宙膨胀等现象")
print("   - 解释了光线在引力场中弯曲（引力透镜）\\n")

# 时间膨胀公式示例
print("时间膨胀公式：t' = t / sqrt(1 - v²/c²)")
v = 0.5 * c  # 速度为光速的50%
gamma = 1 / math.sqrt(1 - (v**2 / c**2))
print(f"   当速度为光速50%时，时间膨胀因子 γ = {gamma:.4f}")
print(f"   即：地球上1小时 = 运动物体上{gamma:.4f}小时\\n")

print("相对论的重要应用：")
print("- GPS卫星定位（需要考虑相对论修正）")
print("- 核能利用（质能转换）")
print("- 粒子加速器设计")
print("- 黑洞和中子星研究")
print("- 宇宙学和大爆炸理论")
\`\`\``;

    // 模拟API流式响应
    let callCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          return Promise.resolve({
            done: false,
            value: new TextEncoder().encode(`0:${JSON.stringify(aiResponse)}\n`)
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      })
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader
      }
    });

    // 模拟Pyodide执行相对论解释代码
    const pythonOutput = `=== 爱因斯坦相对论简介 ===

相对论由阿尔伯特·爱因斯坦提出，包括两个主要理论：

1. 狭义相对论 (1905年)
   主要内容：
   - 光速不变原理：真空中光速恒定，约为 c = 299,792,458 m/s
   - 相对性原理：物理定律在所有惯性参考系中相同
   - 时间膨胀：运动物体的时间会变慢
   - 长度收缩：运动物体在运动方向上会缩短
   - 质能等价：E = mc²

   质能方程示例：1kg质量 = 8.99e+16 焦耳

2. 广义相对论 (1915年)
   主要内容：
   - 引力本质：引力是时空弯曲的表现，而非力
   - 质量和能量会使周围时空发生弯曲
   - 预言了黑洞、引力波、宇宙膨胀等现象
   - 解释了光线在引力场中弯曲（引力透镜）

时间膨胀公式：t' = t / sqrt(1 - v²/c²)
   当速度为光速50%时，时间膨胀因子 γ = 1.1547
   即：地球上1小时 = 运动物体上1.1547小时

相对论的重要应用：
- GPS卫星定位（需要考虑相对论修正）
- 核能利用（质能转换）
- 粒子加速器设计
- 黑洞和中子星研究
- 宇宙学和大爆炸理论`;

    (mockPyodide.runPythonAsync as any)
      .mockResolvedValueOnce(undefined) // 设置stdout/stderr
      .mockResolvedValueOnce(undefined) // 执行代码
      .mockResolvedValueOnce(pythonOutput) // 获取stdout
      .mockResolvedValueOnce(''); // 获取stderr

    // 执行测试
    console.log('\n开始测试：告诉我相对论讲了什么？');
    console.log('=' .repeat(80));

    await agent.processQuery('告诉我相对论讲了什么？', onStep);

    console.log('\n' + '=' .repeat(80));
    console.log(`测试完成！共生成 ${steps.length} 个步骤`);
    console.log('=' .repeat(80) + '\n');

    // 验证步骤
    expect(steps.length).toBeGreaterThan(0);

    // 应该有思考步骤
    const thoughtSteps = steps.filter(s => s.type === 'thought');
    expect(thoughtSteps.length).toBeGreaterThan(0);
    console.log(`✓ 思考步骤数量: ${thoughtSteps.length}`);

    // 应该有代码步骤
    const codeStep = steps.find(s => s.type === 'code');
    expect(codeStep).toBeDefined();
    expect(codeStep?.content).toContain('print');
    expect(codeStep?.content).toContain('相对论');
    console.log('✓ 包含代码步骤，内容包含"相对论"');

    // 应该有结果步骤
    const resultStep = steps.find(s => s.type === 'result');
    expect(resultStep).toBeDefined();
    expect(resultStep?.content).toContain('相对论');
    expect(resultStep?.content).toContain('爱因斯坦');
    expect(resultStep?.content).toContain('E = mc²');
    console.log('✓ 结果包含相对论、爱因斯坦和质能方程');

    // 验证关键概念
    expect(resultStep?.content).toContain('狭义相对论');
    expect(resultStep?.content).toContain('广义相对论');
    expect(resultStep?.content).toContain('光速');
    expect(resultStep?.content).toContain('时间膨胀');
    console.log('✓ 结果包含狭义相对论、广义相对论、光速和时间膨胀等关键概念');

    // 验证API调用
    expect(global.fetch).toHaveBeenCalledWith('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('相对论')
    });
    console.log('✓ API调用参数正确');

    // 验证Pyodide调用
    expect(mockPyodide.runPythonAsync).toHaveBeenCalled();
    console.log('✓ Pyodide执行成功');
  });

  it('MockDataAgent 也应该能处理相对论问题', async () => {
    const mockAgent = new MockDataAgent(mockPyodide);

    vi.useFakeTimers();

    // 模拟输出
    const mockOutput = `相对论示例数据分析：
使用示例数据集展示相对论效应
（实际应用中可以用数据来展示时间膨胀等效应）`;

    (mockPyodide.runPythonAsync as any)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(mockOutput)
      .mockResolvedValueOnce('');

    const promise = mockAgent.processQuery('告诉我相对论讲了什么？', onStep);

    await vi.runAllTimersAsync();
    await promise;

    vi.useRealTimers();

    // 验证
    expect(steps.length).toBeGreaterThan(0);
    const codeStep = steps.find(s => s.type === 'code');
    expect(codeStep).toBeDefined();

    console.log('\n✓ MockDataAgent 也能处理相对论问题');
  });

  it('应该能正确处理中文输入和输出', async () => {
    const agent = new DataAgent(mockPyodide);

    const chineseResponse = `**Thought:** 用户用中文提问，我也用中文回答

**Code:**
\`\`\`python
print("这是中文输出测试")
print("相对论、量子力学、热力学")
\`\`\``;

    let callCount = 0;
    (global.fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockImplementation(() => {
            if (callCount === 0) {
              callCount++;
              return Promise.resolve({
                done: false,
                value: new TextEncoder().encode(`0:${JSON.stringify(chineseResponse)}\n`)
              });
            }
            return Promise.resolve({ done: true, value: undefined });
          })
        })
      }
    });

    (mockPyodide.runPythonAsync as any)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('这是中文输出测试\n相对论、量子力学、热力学\n')
      .mockResolvedValueOnce('');

    await agent.processQuery('告诉我相对论讲了什么？', onStep);

    const resultStep = steps.find(s => s.type === 'result');
    expect(resultStep?.content).toContain('中文');
    expect(resultStep?.content).toContain('相对论');

    console.log('✓ 中文输入输出处理正确');
  });
});
