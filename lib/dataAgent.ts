import type { PyodideInterface } from 'pyodide';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentStep {
  type: 'thought' | 'code' | 'result' | 'error';
  content: string;
}

export class DataAgent {
  private pyodide: PyodideInterface;
  private conversationHistory: AgentMessage[] = [];
  private availableFiles: string[] = [];

  constructor(pyodide: PyodideInterface) {
    this.pyodide = pyodide;
  }

  updateAvailableFiles(files: string[]) {
    this.availableFiles = files;
  }

  async processQuery(userQuery: string, onStep: (step: AgentStep) => void): Promise<void> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userQuery
    });

    try {
      // Call agent API with streaming
      onStep({ type: 'thought', content: 'Analyzing your request...' });

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory,
          availableFiles: this.availableFiles
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response from agent');
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      console.log('🤖 [AI Agent] Starting to receive response...');
      console.log('📡 [AI Agent] Reader exists:', !!reader);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          console.log('📦 [AI Agent] Read chunk - done:', done, 'value length:', value?.length);
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log('📝 [AI Chunk]', chunk);
          fullResponse += chunk;
        }
      }

      console.log('\n✅ [AI Agent] Complete response received:');
      console.log('━'.repeat(80));
      console.log(fullResponse);
      console.log('━'.repeat(80));

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });

      // Parse response
      const { thought, code } = this.parseResponse(fullResponse);

      // Show thought process
      if (thought) {
        onStep({ type: 'thought', content: thought });
      }

      // Show and execute code
      if (code) {
        onStep({ type: 'code', content: code });
        const result = await this.executeCode(code);
        onStep({ type: 'result', content: result });
      } else {
        // If no code block, show the full response as result
        onStep({ type: 'result', content: fullResponse });
      }

    } catch (error: any) {
      onStep({ type: 'error', content: error.message || String(error) });
    }
  }

  private parseResponse(response: string): { thought: string; code: string } {
    let thought = '';
    let code = '';

    // Extract thought
    const thoughtMatch = response.match(/\*\*Thought:\*\*\s*(.+?)(?=\n\*\*Code:\*\*|\n```|$)/s);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
    }

    // Extract code from markdown code blocks
    const codeMatch = response.match(/```python\n([\s\S]+?)\n```/);
    if (codeMatch) {
      code = codeMatch[1].trim();
    }

    return { thought, code };
  }

  private async executeCode(code: string): Promise<string> {
    try {
      // Redirect stdout and stderr
      await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      // Execute user code
      await this.pyodide.runPythonAsync(code);

      // Get output
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

// Mock agent for development/testing
export class MockDataAgent {
  private pyodide: PyodideInterface;
  private availableFiles: string[] = [];

  constructor(pyodide: PyodideInterface) {
    this.pyodide = pyodide;
  }

  updateAvailableFiles(files: string[]) {
    this.availableFiles = files;
  }

  async processQuery(userQuery: string, onStep: (step: AgentStep) => void): Promise<void> {
    console.log('🎭 [Mock Agent] Processing query:', userQuery);

    // Simulate thinking
    onStep({ type: 'thought', content: 'Analyzing your request...' });
    await new Promise(r => setTimeout(r, 1000));

    // Generate mock response based on context
    let thought = '';
    let code = '';

    if (this.availableFiles.length > 0) {
      const file = this.availableFiles[0];
      thought = `I see you've uploaded ${file}. I'll read it and show you a summary of the data.`;

      const isExcel = file.endsWith('.xlsx') || file.endsWith('.xls');
      code = `import pandas as pd

# Read the file
df = pd.read_${isExcel ? 'excel' : 'csv'}('${file}')

# Show basic information
print("Dataset Overview:")
print(f"Shape: {df.shape[0]} rows × {df.shape[1]} columns")
print(f"\\nColumns: {list(df.columns)}")
print(f"\\nFirst 5 rows:")
print(df.head())

# Show data types
print(f"\\nData Types:")
print(df.dtypes)

# Show basic statistics for numeric columns
if len(df.select_dtypes(include=['number']).columns) > 0:
    print(f"\\nNumeric Statistics:")
    print(df.describe())`;
    } else {
      thought = `You haven't uploaded any files yet. Let me create a sample dataset to demonstrate my capabilities.`;
      code = `import pandas as pd
import numpy as np

# Create sample data
np.random.seed(42)
dates = pd.date_range('2024-01-01', periods=100, freq='D')
data = {
    'Date': dates,
    'Sales': np.random.randint(100, 1000, 100),
    'Customers': np.random.randint(10, 100, 100),
    'Region': np.random.choice(['North', 'South', 'East', 'West'], 100)
}
df = pd.DataFrame(data)

print("Sample Dataset Created:")
print(f"Shape: {df.shape}")
print(f"\\nFirst 5 rows:")
print(df.head())

print(f"\\nSummary Statistics:")
print(f"Total Sales: {df['Sales'].sum():,}")
print(f"Average Sales: {df['Sales'].mean():.2f}")
print(f"Total Customers: {df['Customers'].sum()}")

print(f"\\nSales by Region:")
print(df.groupby('Region')['Sales'].sum().sort_values(ascending=False))`;
    }

    console.log('💭 [Mock Agent] Generated thought:', thought);
    onStep({ type: 'thought', content: thought });
    await new Promise(r => setTimeout(r, 500));

    console.log('💻 [Mock Agent] Generated code:');
    console.log(code);
    onStep({ type: 'code', content: code });
    await new Promise(r => setTimeout(r, 500));

    // Execute the code
    try {
      await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      await this.pyodide.runPythonAsync(code);

      const stdout = await this.pyodide.runPythonAsync('sys.stdout.getvalue()');
      const stderr = await this.pyodide.runPythonAsync('sys.stderr.getvalue()');

      const result = stderr
        ? `⚠️ Warnings:\n${stderr}\n\nOutput:\n${stdout || '(no output)'}`
        : stdout || 'Code executed successfully (no output)';

      console.log('✅ [Mock Agent] Execution result:');
      console.log(result);
      onStep({ type: 'result', content: result });
    } catch (error: any) {
      console.error('❌ [Mock Agent] Execution error:', error);
      onStep({ type: 'error', content: `Execution error: ${error.message}` });
    }
  }

  reset() {
    // Nothing to reset in mock agent
  }
}
