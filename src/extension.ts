// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// @ts-ignore
const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;

function requireUncached(module: string) {
  delete requireFunc.cache[requireFunc.resolve(module)];
  return requireFunc(module);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("dynamic-inputs.require", async (scriptPath: string) => {
    // The code you place here will be executed every time your command is executed
    const cwd = vscode.workspace.rootPath;
    if (!cwd) return;
    const _scriptPath = scriptPath.replace("${workspaceFolder}", cwd);
    type Impl = (cwd: string) => Promise<string[]>;
    let fn: Impl | undefined;
    try {
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
      vscode.window.showErrorMessage(`dynamic-inputs: ${err.message}`, { modal: true });
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
