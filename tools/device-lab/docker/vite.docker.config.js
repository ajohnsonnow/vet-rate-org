import { fileURLToPath } from "node:url";
import base from "../../../vite.config.js";

const root = (p) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

// The import specs load these modules by their source URL
// (`import "/src/utils/musterCallProcessor.js"`), which only a dev server
// serves. Building them as extra entries of the same production build serves
// the same files at the same URLs, and they share chunks (and so module
// state) with the app.
const SOURCE_URL_MODULES = [
  "musterCallProcessor",
  "aiSystemPrompts",
  "advancedOCR",
];

// src/utils/logger.js forwards to the console only when import.meta.env.DEV is
// true, so a production build is silent. The specs wait for logger.info lines
// such as "[DKB] searchDKB called", so this one expression is flipped.
const LOGGER_DEV_CHECK = "Boolean(import.meta.env.DEV)";
const loggerConsolePlugin = {
  name: "device-lab-logger-console",
  enforce: "pre",
  transform(code, id) {
    if (!id.replaceAll("\\", "/").endsWith("/src/utils/logger.js")) return null;
    if (!code.includes(LOGGER_DEV_CHECK)) {
      throw new Error(
        "device-lab: logger.js no longer contains " + LOGGER_DEV_CHECK,
      );
    }
    return code.replace(LOGGER_DEV_CHECK, "true");
  },
};

export default (env) => {
  const config = base(env);
  config.plugins = [...config.plugins, loggerConsolePlugin];
  const entries = Object.fromEntries(
    SOURCE_URL_MODULES.map((name) => [
      `src/utils/${name}`,
      root(`src/utils/${name}.js`),
    ]),
  );

  config.build = {
    ...config.build,
    outDir: "dist-device-lab",
    // The shipped config drops console.log/debug/info calls. The specs wait
    // for log lines such as "Segmented C-File into", so they would hang.
    terserOptions: { compress: { pure_funcs: [] } },
    rollupOptions: {
      ...config.build.rollupOptions,
      input: { main: root("index.html"), ...entries },
      // An app build tree-shakes unused entry exports; the specs need all of them.
      preserveEntrySignatures: "strict",
      output: {
        ...config.build.rollupOptions.output,
        entryFileNames: (chunk) =>
          chunk.name.startsWith("src/utils/")
            ? "[name].js"
            : "assets/[name]-[hash].js",
      },
    },
  };
  config.preview = {
    headers: config.server.headers,
  };
  return config;
};
