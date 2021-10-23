import * as vscode from "vscode";

// @ts-ignore
const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;

function requireUncached(module: string) {
  delete requireFunc.cache[requireFunc.resolve(module)];
  return requireFunc(module);
}

export async function requireOperation(scriptPath: string) {
  // The code you place here will be executed every time your command is executed
  const cwd = vscode.workspace.rootPath;
  if (!cwd) {
    return;
  }
  const _scriptPath = scriptPath.replace("${workspaceFolder}", cwd);
  type Impl = (cwd: string) => Promise<string[]>;
  let fn: Impl | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const module: { __esModule?: true; default: Impl } | Impl = requireUncached(_scriptPath);
    if (typeof module === "object" && module.__esModule === true) {
      fn = module.default;
    }
    if (typeof module === "function") {
      fn = module;
    }
    if (!fn) {
      throw new Error(`dynamic-inputs.require expects a function`);
    }
    const options = await fn(cwd);
    if (!Array.isArray(options)) {
      throw new Error(`dynamic-inputs.require expects to return string[]`);
    }
    if (!options.every((str) => typeof str === "string")) {
      throw new Error(`dynamic-inputs.require expects to return string[]`);
    }
    return vscode.window.showQuickPick(options);
  } catch (err) {
    // @ts-ignore
    vscode.window.showErrorMessage(err.name, {
      modal: true,
      // @ts-ignore
      detail: err.message,
    });
  }
}
