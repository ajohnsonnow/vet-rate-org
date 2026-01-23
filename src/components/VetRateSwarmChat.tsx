/**
 * VetRateSwarmChat.tsx
 * 
 * Example React component demonstrating useVetRateSwarm integration.
 * Shows complete implementation with loading states, error handling, and UI.
 * 
 * @author VetRate.org Development Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVetRateSwarm, SwarmMember } from '../hooks/useVetRateSwarm';

// ============================================================================
// COMPONENT
// ============================================================================

export const VetRateSwarmChat: React.FC = () => {
  const {
    currentSwarm,
    loadingProgress,
    isReady,
    error,
    conversationHistory,
    initEngine,
    switchSwarm,
    sendMessage,
    sendMessageStream,
    clearHistory,
    getSwarmConfig,
    isWebGPUSupported
  } = useVetRateSwarm();
  
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Initialize engine on mount
  useEffect(() => {
    if (!isWebGPUSupported()) {
      console.error('WebGPU not supported in this browser');
      return;
    }
    
    // Start with Auditor swarm
    initEngine('auditor').catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, streamingText]);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleSendMessage = async () => {
    if (!userInput.trim() || !isReady || isGenerating) {
      return;
    }
    
    const message = userInput.trim();
    setUserInput('');
    setIsGenerating(true);
    setStreamingText('');
    
    try {
      if (useStreaming) {
        // Streaming mode
        await sendMessageStream(
          message,
          (chunk) => {
            setStreamingText(prev => prev + chunk);
          },
          { temperature: 0.7, maxTokens: 1000 }
        );
        setStreamingText('');
      } else {
        // Non-streaming mode
        await sendMessage(message, { temperature: 0.7, maxTokens: 1000 });
      }
    } catch (err) {
      console.error('Message failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSwarmChange = async (newSwarm: SwarmMember) => {
    if (newSwarm === currentSwarm || !isReady) {
      return;
    }
    
    try {
      await switchSwarm(newSwarm);
    } catch (err) {
      console.error('Swarm switch failed:', err);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 
      ? `${minutes}m ${remainingSeconds}s` 
      : `${seconds}s`;
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  // WebGPU not supported
  if (!isWebGPUSupported()) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">WebGPU Not Supported</h2>
          <p className="mb-4">
            Your browser doesn't support WebGPU, which is required for local AI inference.
          </p>
          <p className="text-sm text-gray-400">
            Please use Chrome 113+ or Edge 113+ with hardware acceleration enabled.
          </p>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (!isReady && loadingProgress.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="max-w-md w-full p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Loading Neural Network
          </h2>
          
          {/* Progress bar */}
          <div className="mb-4">
            <div className="bg-gray-700 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${loadingProgress.progress}%` }}
              />
            </div>
          </div>
          
          {/* Status text */}
          <div className="text-center space-y-2">
            <p className="text-lg">{loadingProgress.text}</p>
            <p className="text-sm text-gray-400">
              {loadingProgress.progress}% complete
            </p>
            {loadingProgress.timeElapsed > 0 && (
              <p className="text-xs text-gray-500">
                Elapsed: {formatTime(loadingProgress.timeElapsed)}
                {loadingProgress.estimatedTimeRemaining && (
                  <> • ETA: {formatTime(loadingProgress.estimatedTimeRemaining)}</>
                )}
              </p>
            )}
          </div>
          
          {/* Technical details */}
          <div className="mt-6 p-4 bg-gray-800 rounded text-xs text-gray-400">
            <p>• Downloading ~2GB quantized model</p>
            <p>• Compiling WebGPU shaders</p>
            <p>• Initializing inference engine</p>
            <p className="mt-2 text-green-400">✓ Model cached for future visits</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Initialization Failed</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => initEngine('auditor')}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Main chat interface
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">VetRate AI Assistant</h1>
            {currentSwarm && (
              <p className="text-sm text-gray-400">
                {getSwarmConfig(currentSwarm).displayName}
              </p>
            )}
          </div>
          
          {/* Swarm selector */}
          <div className="flex gap-2">
            {(['auditor', 'writer', 'rater'] as SwarmMember[]).map(swarm => (
              <button
                key={swarm}
                onClick={() => handleSwarmChange(swarm)}
                disabled={!isReady || currentSwarm === swarm}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  currentSwarm === swarm
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {swarm.charAt(0).toUpperCase() + swarm.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {conversationHistory
            .filter(msg => msg.role !== 'system')
            .map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-xs mt-2 opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          
          {/* Streaming message */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 rounded-lg bg-gray-800 text-gray-100">
                <p className="whitespace-pre-wrap">{streamingText}</p>
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              </div>
            </div>
          )}
          
          {/* Generating indicator */}
          {isGenerating && !streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 rounded-lg bg-gray-800 text-gray-400">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Input area */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 mb-2">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about VA disability ratings..."
              disabled={!isReady || isGenerating}
              className="flex-1 bg-gray-700 text-white rounded px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              rows={3}
            />
            <button
              onClick={handleSendMessage}
              disabled={!isReady || isGenerating || !userInput.trim()}
              className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Send
            </button>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useStreaming}
                  onChange={(e) => setUseStreaming(e.target.checked)}
                  className="rounded"
                />
                <span>Streaming mode</span>
              </label>
              
              <button
                onClick={clearHistory}
                disabled={!isReady}
                className="hover:text-white disabled:opacity-50"
              >
                Clear history
              </button>
            </div>
            
            <div>
              {conversationHistory.filter(m => m.role !== 'system').length} messages
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VetRateSwarmChat;
