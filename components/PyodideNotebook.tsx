'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import type { PyodideInterface } from 'pyodide';

interface Cell {
  id: string;
  code: string;
  output: string;
  error: string | null;
  isRunning: boolean;
  executionCount: number | null;
}

// Memoized Cell Component for better performance
const CellComponent = memo(({
  cell,
  index,
  onRun,
  onUpdate,
  onDelete,
  canDelete,
  pyodideReady
}: {
  cell: Cell;
  index: number;
  onRun: (id: string) => void;
  onUpdate: (id: string, code: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  pyodideReady: boolean;
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b">
        <span className="text-sm font-medium text-gray-700">
          Cell [{index + 1}] {cell.executionCount !== null && `[${cell.executionCount}]`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onRun(cell.id)}
            disabled={cell.isRunning || !pyodideReady}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {cell.isRunning ? 'Running...' : 'Run'}
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(cell.id)}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <textarea
          value={cell.code}
          onChange={(e) => onUpdate(cell.id, e.target.value)}
          className="w-full font-mono text-sm bg-gray-50 border border-gray-300 rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition-shadow"
          rows={Math.max(3, cell.code.split('\n').length)}
          placeholder="Enter Python code..."
        />

        {(cell.output || cell.error) && (
          <div className="mt-3">
            {cell.error ? (
              <div className="bg-red-50 border border-red-300 rounded p-3">
                <div className="text-xs font-semibold text-red-700 mb-1">
                  Error:
                </div>
                <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono">
                  {cell.error}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  Output:
                </div>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {cell.output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

CellComponent.displayName = 'CellComponent';

export default function PyodideNotebook() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [cells, setCells] = useState<Cell[]>([
    {
      id: '1',
      code: '# Welcome to Pyodide Notebook!\n# This is a Python environment running in your browser\n\nprint("Hello from Python in the browser!")\nimport sys\nprint(f"Python version: {sys.version}")',
      output: '',
      error: null,
      isRunning: false,
      executionCount: null,
    },
  ]);
  const [executionCounter, setExecutionCounter] = useState(0);
  const stdoutInitialized = useRef(false);

  // Load Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      try {
        console.log('Starting Pyodide load...');
        setLoadingProgress(10);

        // Load Pyodide from CDN directly
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js';
        script.async = true;

        script.onload = async () => {
          console.log('Pyodide script loaded');
          setLoadingProgress(50);

          try {
            // @ts-ignore - loadPyodide is loaded from CDN
            const pyodideInstance = await window.loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',
            });
            console.log('Pyodide instance created');

            setLoadingProgress(100);
            setPyodide(pyodideInstance);
            setIsLoading(false);
          } catch (err) {
            console.error('Failed to initialize Pyodide:', err);
            alert(`Failed to initialize Pyodide: ${err}`);
            setIsLoading(false);
          }
        };

        script.onerror = (err) => {
          console.error('Failed to load Pyodide script:', err);
          alert(`Failed to load Pyodide script: ${err}`);
          setIsLoading(false);
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error('Failed to load Pyodide:', err);
        alert(`Failed to load Pyodide: ${err}`);
        setIsLoading(false);
      }
    };

    loadPyodide();
  }, []);

  // Run Python code
  const runCell = useCallback(async (cellId: string) => {
    if (!pyodide) return;

    const cell = cells.find((c) => c.id === cellId);
    if (!cell) return;

    const newExecutionCount = executionCounter + 1;
    setExecutionCounter(newExecutionCount);

    // Set cell to running state
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId
          ? { ...c, isRunning: true, output: '', error: null, executionCount: newExecutionCount }
          : c
      )
    );

    try {
      // Capture stdout
      await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      // Run user code
      await pyodide.runPythonAsync(cell.code);

      // Get output
      const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
      const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');

      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                output: stdout || stderr || '',
                error: null,
                isRunning: false,
              }
            : c
        )
      );
    } catch (err: any) {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                output: '',
                error: err.message || String(err),
                isRunning: false,
              }
            : c
        )
      );
    }
  }, [pyodide, cells, executionCounter]);

  // Update cell code
  const updateCellCode = useCallback((cellId: string, code: string) => {
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, code } : c))
    );
  }, []);

  // Add new cell
  const addCell = useCallback(() => {
    const newCell: Cell = {
      id: Date.now().toString(),
      code: '# New cell\n',
      output: '',
      error: null,
      isRunning: false,
      executionCount: null,
    };
    setCells((prev) => [...prev, newCell]);
  }, []);

  // Delete cell
  const deleteCell = useCallback((cellId: string) => {
    setCells((prev) => prev.filter((c) => c.id !== cellId));
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Loading Pyodide...
          </h2>
          <p className="text-gray-600">
            Downloading Python runtime ({loadingProgress}%)
          </p>
          <p className="text-sm text-gray-500 mt-2">
            First load may take a few seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pyodide Notebook
          </h1>
          <p className="text-gray-600">
            Run Python code in your browser, no backend server required
          </p>
        </div>

        <div className="space-y-4">
          {cells.map((cell, index) => (
            <CellComponent
              key={cell.id}
              cell={cell}
              index={index}
              onRun={runCell}
              onUpdate={updateCellCode}
              onDelete={deleteCell}
              canDelete={cells.length > 1}
              pyodideReady={!!pyodide}
            />
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={addCell}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            + Add New Cell
          </button>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Supports most Python standard libraries</li>
            <li>• Can use scientific computing libraries like numpy, pandas, matplotlib</li>
            <li>• Code runs entirely in the browser, no backend server needed</li>
            <li>• Can be deployed directly via Vercel</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
