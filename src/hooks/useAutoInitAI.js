/**
 * useAutoInitAI Hook
 * Automatically initializes the recommended AI agent when a tool component mounts
 * 
 * Usage:
 *   const { aiReady, aiInitializing, aiError } = useAutoInitAI('auditor');
 */

import { useState, useEffect } from 'react';
import { 
  isSwarmReady, 
  isSwarmInitializing, 
  initializeSwarm,
  getCurrentAgent,
  switchAgent,
  getAgentForTool 
} from '../utils/unifiedAIService';

export const useAutoInitAI = (toolId = null, agentId = null) => {
  const [aiReady, setAiReady] = useState(false);
  const [aiInitializing, setAiInitializing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [initProgress, setInitProgress] = useState(0);
  const [initMessage, setInitMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    console.log(`💎 useAutoInitAI hook mounted with toolId: ${toolId}, agentId: ${agentId}`);

    const initializeAI = async () => {
      try {
        // Determine which agent to use
        const targetAgent = agentId || (toolId ? getAgentForTool(toolId) : 'auditor');
        
        // Check if already ready
        if (isSwarmReady()) {
          const currentAgent = getCurrentAgent();
          if (currentAgent === targetAgent) {
            console.log(`💎 AI already ready with ${targetAgent} agent`);
            if (mounted) {
              setAiReady(true);
              setAiInitializing(false);
            }
            return;
          }
          
          // Switch to correct agent
          console.log(`💎 Switching to ${targetAgent} agent...`);
          await switchAgent(targetAgent, {
            onComplete: () => {
              if (mounted) {
                setAiReady(true);
                setAiInitializing(false);
              }
            }
          });
          return;
        }

        // Check if already initializing
        if (isSwarmInitializing()) {
          console.log('💎 AI initialization already in progress...');
          if (mounted) {
            setAiInitializing(true);
          }
          
          // Poll until ready
          const pollInterval = setInterval(() => {
            if (isSwarmReady()) {
              clearInterval(pollInterval);
              if (mounted) {
                setAiReady(true);
                setAiInitializing(false);
              }
            }
          }, 500);
          
          return () => clearInterval(pollInterval);
        }

        // Initialize Warrant Council
        console.log(`🎖️ Auto-initializing Warrant Council with ${targetAgent} agent...`);
        if (mounted) {
          setAiInitializing(true);
          setInitMessage(`Initializing AI agent...`);
        }

        await initializeSwarm(targetAgent, {
          onProgress: (progress) => {
            console.log('💎 Auto-init progress:', progress);
            if (mounted) {
              setInitProgress(progress.progress || 0);
              setInitMessage(progress.message || 'Loading...');
              console.log(`💎 Progress state updated: ${progress.progress}% - ${progress.message}`);
            }
          },
          onComplete: () => {
            console.log(`💎 Auto-initialization complete: ${targetAgent}`);
            if (mounted) {
              setAiReady(true);
              setAiInitializing(false);
              setInitProgress(100);
            }
          },
          onError: (error) => {
            console.error('💎 Auto-initialization failed:', error);
            if (mounted) {
              setAiError(error.message || 'AI initialization failed');
              setAiInitializing(false);
            }
          }
        });

      } catch (error) {
        console.error('💎 Auto-initialization error:', error);
        if (mounted) {
          setAiError(error.message || 'Failed to initialize AI');
          setAiInitializing(false);
        }
      }
    };

    initializeAI();

    return () => {
      mounted = false;
    };
  }, [toolId, agentId]);

  return {
    aiReady,
    aiInitializing,
    aiError,
    initProgress,
    initMessage
  };
};

export default useAutoInitAI;
