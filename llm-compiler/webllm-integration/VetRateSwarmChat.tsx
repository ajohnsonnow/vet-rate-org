/**
 * VetRate Swarm Chat Component
 * Example implementation of the useVetRateSwarm hook
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVetRateSwarm, SwarmRole, LoadProgress } from './useVetRateSwarm';

// ============================================================================
// Progress Bar Component
// ============================================================================
const ProgressBar: React.FC<{ progress: LoadProgress | null }> = ({ progress }) => {
  if (!progress) return null;

  const percentage = Math.round(progress.progress * 100);

  return (
    <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
      <div
        className="bg-blue-600 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium"
        style={{ width: `${percentage}%` }}
      >
        {percentage > 10 && `${percentage}%`}
      </div>
      <p className="text-sm text-gray-600 mt-1">{progress.text}</p>
    </div>
  );
};

// ============================================================================
// Role Selector Component
// ============================================================================
const RoleSelector: React.FC<{
  currentRole: SwarmRole | null;
  onSelect: (role: SwarmRole) => void;
  disabled: boolean;
}> = ({ currentRole, onSelect, disabled }) => {
  const roles: { role: SwarmRole; label: string; description: string; icon: string }[] = [
    {
      role: 'auditor',
      label: 'Auditor',
      description: 'Legal/regulatory analysis',
      icon: '⚖️',
    },
    {
      role: 'writer',
      label: 'Writer',
      description: 'Empathetic communication',
      icon: '✍️',
    },
    {
      role: 'rater',
      label: 'Rater',
      description: 'Rating calculations',
      icon: '🧮',
    },
  ];

  return (
    <div className="flex gap-2 mb-4">
      {roles.map(({ role, label, description, icon }) => (
        <button
          key={role}
          onClick={() => onSelect(role)}
          disabled={disabled}
          className={`
            flex-1 p-3 rounded-lg border-2 transition-all
            ${currentRole === role
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="text-2xl">{icon}</span>
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Main Chat Component
// ============================================================================
export const VetRateSwarmChat: React.FC = () => {
  const {
    // State
    isLoading,
    isReady,
    isInferring,
    currentRole,
    loadProgress,
    error,
    webGpuSupported,
    // Methods
    initEngine,
    switchRole,
    runInference,
    abortInference,
    getSystemPrompt,
  } = useVetRateSwarm({
    initialRole: 'auditor',
    modelBasePath: '/dist',
    debug: true,
  });

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [streamingResponse, setStreamingResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingResponse]);

  // Handle role selection
  const handleRoleSelect = async (role: SwarmRole) => {
    if (role === currentRole && isReady) return;

    setMessages([]);
    await switchRole(role, (progress) => {
      console.log(`Loading ${role}: ${(progress.progress * 100).toFixed(1)}%`);
    });
  };

  // Handle message send
  const handleSend = async () => {
    if (!input.trim() || !isReady || isInferring) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setStreamingResponse('');

    try {
      const response = await runInference(userMessage, {
        maxTokens: 1024,
        temperature: 0.7,
        onChunk: (chunk) => {
          setStreamingResponse((prev) => prev + chunk);
        },
      });

      setStreamingResponse('');
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error('Inference error:', err);
    }
  };

  // =========================================================================
  // Render: WebGPU Not Supported
  // =========================================================================
  if (!webGpuSupported && error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-800 mb-2">⚠️ WebGPU Not Available</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="text-sm text-gray-600">
            <p className="font-semibold mb-2">Supported Browsers:</p>
            <ul className="list-disc list-inside">
              <li>Chrome 113+ (recommended)</li>
              <li>Edge 113+</li>
              <li>Firefox Nightly (with WebGPU flag)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render: Main UI
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          🎖️ VetRate LLM Swarm
        </h1>
        <p className="text-sm text-gray-500">
          100% client-side VA claims assistance powered by WebGPU
        </p>
      </div>

      {/* Role Selector */}
      <RoleSelector
        currentRole={currentRole}
        onSelect={handleRoleSelect}
        disabled={isLoading || isInferring}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="font-medium mb-2">
            Loading {currentRole?.toUpperCase() || 'model'}...
          </p>
          <ProgressBar progress={loadProgress} />
        </div>
      )}

      {/* Not Initialized Prompt */}
      {!isReady && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => initEngine('auditor', (p) => console.log(`Loading: ${(p.progress * 100).toFixed(0)}%`))}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🚀 Initialize Swarm
          </button>
        </div>
      )}

      {/* Chat Messages */}
      {isReady && (
        <>
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
            {messages.length === 0 && !streamingResponse && (
              <div className="text-center text-gray-400 mt-8">
                <p className="text-4xl mb-2">
                  {currentRole === 'auditor' ? '⚖️' : currentRole === 'writer' ? '✍️' : '🧮'}
                </p>
                <p>{currentRole?.toUpperCase()} ready. Ask a VA claims question.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-100 ml-12'
                    : 'bg-white border mr-12'
                }`}
              >
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  {msg.role === 'user' ? '🎖️ You' : `🤖 ${currentRole?.toUpperCase()}`}
                </p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {/* Streaming Response */}
            {streamingResponse && (
              <div className="mb-4 p-3 rounded-lg bg-white border mr-12">
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  🤖 {currentRole?.toUpperCase()}
                </p>
                <p className="whitespace-pre-wrap">{streamingResponse}</p>
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`Ask the ${currentRole?.toUpperCase()} a question...`}
              disabled={isInferring}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isInferring ? (
              <button
                onClick={abortInference}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                ⏹️ Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            )}
          </div>
        </>
      )}

      {/* Error Display */}
      {error && !isLoading && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default VetRateSwarmChat;
