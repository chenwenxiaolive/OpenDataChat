# Pyodide Notebook - 基于 Next.js 的浏览器端 Python Notebook

这是一个完全运行在浏览器中的 Python Notebook 应用，使用 [Pyodide](https://pyodide.org/) 在浏览器中执行 Python 代码，无需任何后端服务器。

## 特性

- 纯前端运行，无需 Python 后端服务器
- 支持大部分 Python 标准库
- 可以使用科学计算库（NumPy, Pandas, Matplotlib 等）
- 多单元格支持，类似 Jupyter Notebook
- 可直接部署到 Vercel 等静态托管平台
- 响应式设计，支持移动端访问

## 快速开始

### 本地开发

1. 安装依赖：

```bash
npm install
```

2. 启动开发服务器：

```bash
npm run dev
```

3. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 部署到 Vercel

这个项目可以零配置部署到 Vercel：

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 点击部署

或者使用 Vercel CLI：

```bash
npm install -g vercel
vercel
```

## 使用示例

在 Notebook 中尝试以下 Python 代码：

### 基础示例

```python
# Hello World
print("Hello from Python in the browser!")

# 变量和计算
x = 10
y = 20
print(f"Sum: {x + y}")
```

### 使用 NumPy

```python
import numpy as np

# 创建数组
arr = np.array([1, 2, 3, 4, 5])
print(f"Array: {arr}")
print(f"Mean: {arr.mean()}")
print(f"Std: {arr.std()}")
```

### 使用 Pandas

```python
import pandas as pd

# 创建 DataFrame
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'city': ['Beijing', 'Shanghai', 'Guangzhou']
})

print(df)
print(f"\nAverage age: {df['age'].mean()}")
```

## 技术栈

- [Next.js 15](https://nextjs.org/) - React 框架
- [Pyodide 0.26](https://pyodide.org/) - 浏览器端 Python 运行时
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架

## 项目结构

```
pyodide-notebook/
├── app/
│   ├── page.tsx          # 主页面
│   ├── layout.tsx        # 布局
│   └── globals.css       # 全局样式
├── components/
│   └── PyodideNotebook.tsx  # Notebook 组件
├── next.config.ts        # Next.js 配置
└── package.json
```

## 注意事项

1. **首次加载时间**：Pyodide 运行时约 6-8MB，首次加载可能需要几秒钟
2. **浏览器兼容性**：需要支持 WebAssembly 的现代浏览器（Chrome 57+, Firefox 52+, Safari 11+）
3. **安全策略**：项目配置了 COOP 和 COEP headers 以支持 SharedArrayBuffer
4. **包安装**：可以使用 `micropip` 安装额外的 Python 包

## 扩展功能

### 安装额外的 Python 包

```python
import micropip
await micropip.install('package-name')
```

### 使用 Matplotlib 绘图

```python
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.plot(x, y)
plt.title('Sine Wave')
plt.savefig('plot.png')
```

## 常见问题

**Q: 为什么首次加载这么慢？**
A: Pyodide 需要下载完整的 Python 运行时（WebAssembly），约 6-8MB。后续访问会利用浏览器缓存，速度会快很多。

**Q: 支持哪些 Python 版本？**
A: Pyodide 0.26 基于 Python 3.12。

**Q: 可以访问文件系统吗？**
A: 可以使用浏览器的虚拟文件系统，但无法访问本地文件系统。

**Q: 性能如何？**
A: 对于大多数数据分析任务，性能接近原生 Python。但对于计算密集型任务，可能会比原生 Python 慢 2-3 倍。

## License

MIT

## 了解更多

- [Pyodide 文档](https://pyodide.org/en/stable/)
- [Next.js 文档](https://nextjs.org/docs)
- [Vercel 部署文档](https://vercel.com/docs)
