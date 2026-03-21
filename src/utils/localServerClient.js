/**
 * Local Diamond Server Client
 *
 * Connects to llama.cpp server running locally with VetRate models.
 * Provides OpenAI-compatible API interface.
 */

// Default server configuration
const DEFAULT_CONFIG = {
  host: "localhost",
  port: 8080,
  timeout: 60000,
};

// Storage key for server config
const SERVER_CONFIG_KEY = "vetrate_local_server_config";

/**
 * Get saved server configuration
 */
export const getServerConfig = () => {
  try {
    const saved = localStorage.getItem(SERVER_CONFIG_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

/**
 * Save server configuration
 */
export const saveServerConfig = (config) => {
  localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));
};

/**
 * Get server base URL
 */
const getBaseUrl = (config = getServerConfig()) => {
  return `http://${config.host}:${config.port}`;
};

/**
 * Check if local server is available
 */
export const checkServerHealth = async (config = getServerConfig()) => {
  try {
    const response = await fetch(`${getBaseUrl(config)}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        status: data.status || "ok",
        model: data.model || "unknown",
      };
    }
    return { available: false, reason: "Server returned error" };
  } catch (error) {
    return {
      available: false,
      reason:
        error.name === "TimeoutError" ? "Connection timeout" : error.message,
    };
  }
};

/**
 * Get server model info
 */
export const getModelInfo = async (config = getServerConfig()) => {
  try {
    const response = await fetch(`${getBaseUrl(config)}/props`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Generate completion via local server
 */
export const generateCompletion = async (prompt, options = {}) => {
  const {
    maxTokens = 1024,
    temperature = 0.7,
    topP = 0.9,
    stopTokens = ["<|end|>", "<|user|>"],
    onToken,
    signal,
    config = getServerConfig(),
  } = options;

  const body = {
    prompt,
    n_predict: maxTokens,
    temperature,
    top_p: topP,
    stop: stopTokens,
    stream: !!onToken,
  };

  try {
    const response = await fetch(`${getBaseUrl(config)}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    // Handle streaming response
    if (onToken && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                result += data.content;
                onToken(data.content);
              }
            } catch {}
          }
        }
      }

      return result;
    }

    // Non-streaming response
    const data = await response.json();
    return data.content;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("[LocalServer] Request aborted");
      return null;
    }
    throw error;
  }
};

/**
 * Chat completion with conversation history
 */
export const chatCompletion = async (messages, systemPrompt, options = {}) => {
  // Build prompt in Qwen/ChatML format
  let prompt = `<|system|>\n${systemPrompt}\n<|end|>\n`;

  for (const msg of messages) {
    if (msg.role === "user") {
      prompt += `<|user|>\n${msg.content}\n<|end|>\n`;
    } else if (msg.role === "assistant") {
      prompt += `<|assistant|>\n${msg.content}\n<|end|>\n`;
    }
  }

  prompt += "<|assistant|>\n";

  return generateCompletion(prompt, options);
};

/**
 * Cancel ongoing generation
 */
export const cancelGeneration = async (config = getServerConfig()) => {
  try {
    await fetch(`${getBaseUrl(config)}/cancel`, { method: "POST" });
    return true;
  } catch {
    return false;
  }
};

/**
 * Get generation slots info (for concurrent requests)
 */
export const getSlotsInfo = async (config = getServerConfig()) => {
  try {
    const response = await fetch(`${getBaseUrl(config)}/slots`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
};

export default {
  checkServerHealth,
  getModelInfo,
  generateCompletion,
  chatCompletion,
  cancelGeneration,
  getSlotsInfo,
  getServerConfig,
  saveServerConfig,
};
