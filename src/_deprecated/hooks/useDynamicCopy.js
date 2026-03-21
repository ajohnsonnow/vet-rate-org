/**
 * Dynamic Copy Hook
 * Replaces {{placeholders}} with actual project statistics
 *
 * Usage:
 *   const { replace, stats } = useDynamicCopy();
 *   const text = replace("Built on {{total_hours}} hours...");
 */

import { useMemo } from "react";
import projectStats from "../data/projectStats.json";
import dynamicCopy from "../data/dynamicCopy.json";

export const useDynamicCopy = () => {
  // Replace all {{variable}} placeholders with actual values
  const replace = useMemo(() => {
    return (template) => {
      if (typeof template !== "string") return template;

      let result = template;

      // Replace all {{key}} with stats[key]
      Object.entries(projectStats).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        result = result.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          value,
        );
      });

      return result;
    };
  }, []);

  // Replace placeholders in objects/arrays recursively
  const replaceDeep = useMemo(() => {
    return (obj) => {
      if (typeof obj === "string") {
        return replace(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => replaceDeep(item));
      }

      if (obj && typeof obj === "object") {
        const result = {};
        Object.entries(obj).forEach(([key, value]) => {
          result[key] = replaceDeep(value);
        });
        return result;
      }

      return obj;
    };
  }, [replace]);

  // Provide ready-to-use copy sections
  const copy = useMemo(
    () => ({
      aboutUs: replaceDeep(dynamicCopy.aboutUs),
      buyMeACoffee: replaceDeep(dynamicCopy.buyMeACoffee),
      uiMessages: replaceDeep(dynamicCopy.uiMessages),
      socialProof: replaceDeep(dynamicCopy.socialProof),
      metadata: replaceDeep(dynamicCopy.metadata),
    }),
    [replaceDeep],
  );

  return {
    stats: projectStats,
    copy,
    replace,
    replaceDeep,
  };
};

// Export individual sections for convenience
export const useAboutUsContent = () => {
  const { copy } = useDynamicCopy();
  return copy.aboutUs;
};

export const useBuyMeACoffeeContent = () => {
  const { copy } = useDynamicCopy();
  return copy.buyMeACoffee;
};

export const useUIMessages = () => {
  const { copy } = useDynamicCopy();
  return copy.uiMessages;
};

export const useSocialProof = () => {
  const { copy } = useDynamicCopy();
  return copy.socialProof;
};

export default useDynamicCopy;
