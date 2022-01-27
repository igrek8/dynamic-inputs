import { spawnSync } from "child_process";
import * as crypto from "crypto";
import * as jp from "jsonpath";
import * as path from "path";
import * as vscode from "vscode";

import { requireOperation } from "./requireOperation";

const serializers = {
  json: (...args: unknown[]) => {
    return JSON.stringify(args);
  },
  plain: (...args: unknown[]) => {
    let output = "";
    for (const arg of args) {
      output += `${arg}`;
      output += " ";
    }
    return output.trim();
  },
};

type ReadOperationOptions = {
  var: string;
  quickPickOptions?: vscode.QuickPickOptions;
};

type WriteOperationOptions = {
  var?: string;
  command: string;
  args: string[];
  unwrap?: string;
  serializer?: keyof typeof serializers;
  quickPickOptions?: vscode.QuickPickOptions;
};

const cache: Map<string, string> = new Map<string, string>();

function isWriteOperationOptions(opts: any): asserts opts is WriteOperationOptions {
  if (typeof opts !== "object") {
    throw new Error("Expected args to an object");
  }
  if (opts === null) {
    throw new Error("Expected args to be an object");
  }
  if (!Array.isArray(opts.args)) {
    throw new Error("Expected args to be string[]");
  }
  if (opts.serializer && !(opts.serializer in serializers)) {
    throw new Error("Expected serializer is not implemented");
  }
  if (!(opts.args as string[]).every((arg: unknown) => typeof arg === "string")) {
    throw new Error("Expected args to be string[]");
  }
  if ("var" in opts) {
    if (typeof opts.var !== "string") {
      throw new Error("Expected args.var to be string[]");
    }
    if (opts.var.trim() === "") {
      throw new Error("Expected args.var to be a non-empty string");
    }
  }
}

function isReadOperationOptions(opts: any): asserts opts is ReadOperationOptions {
  if (typeof opts !== "object") {
    throw new Error("Expected args to be an object");
  }
  if (opts === null) {
    throw new Error("Expected args to be not null");
  }
  if (typeof opts.var !== "string") {
    throw new Error("Expected args.var to be a string");
  }
  if (opts.var.trim() === "") {
    throw new Error("Expected args.var to be a non-empty string");
  }
}

function resolveVariables(str: string, vars: Record<string, string | undefined>) {
  return path.normalize(
    str.replace(/(\${([^}]+)})/g, (_, match, name) => {
      return vars[name] ?? match;
    })
  );
}

function sha256(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function truncate(str: string, n: number = 24) {
  return str.slice(0, n);
}

function getSubstitutedVariables(
  opts: ReadOperationOptions | WriteOperationOptions
): Record<string, string | undefined> {
  const currentWorkspace = vscode.workspace.workspaceFolders?.[0];
  if (!currentWorkspace) {
    throw new Error(`Failed to retrieve current workspace`);
  }
  return {
    configId: truncate(sha256(JSON.stringify(opts)), 8),
    workspaceId: truncate(sha256(currentWorkspace.uri.path), 8),
    workspaceFolder: currentWorkspace.uri.path,
    workspaceName: currentWorkspace.name,
  };
}

async function writeOperation(opts: WriteOperationOptions) {
  const variables = getSubstitutedVariables(opts);
  const resolvedArgs = opts.args.map((arg) => resolveVariables(arg, variables));

  const child = spawnSync(opts.command, resolvedArgs, {
    encoding: "utf-8",
    shell: true,
    cwd: variables.workspaceFolder,
  });

  const lines = child.stdout.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const line = lines[i];
      if (!line) {
        continue;
      }

      const items: vscode.QuickPickItem[] = JSON.parse(line);
      const selection = await vscode.window.showQuickPick<vscode.QuickPickItem>(items, opts.quickPickOptions);

      if (typeof selection === "undefined") {
        // reset cache after cancellation
        cache.clear();
        // skip when no selection was made
        return;
      }

      let value: string | undefined;

      const serialize = serializers[opts.serializer ?? "json"];

      if (typeof selection === "string") {
        value = serialize(selection);
      }

      if (typeof selection === "object") {
        if (selection === null) {
          value = serialize(selection);
        } else {
          if (opts.quickPickOptions?.canPickMany) {
            const unwrapped = jp.query(selection, opts.unwrap ?? "*");
            value = serialize(...unwrapped);
          } else {
            const unwrapped = jp.value(selection, opts.unwrap ?? "$");
            value = serialize(unwrapped);
          }
        }
      }

      if (typeof value === "undefined") {
        // reset cache after cancellation
        cache.clear();
        // skip when no selection was made
        return;
      }

      if (opts.var) {
        const variables = getSubstitutedVariables(opts);
        const key = resolveVariables(opts.var, variables);
        cache.set(key, value);
      }

      return value;
    } catch (err) {
      if (i === 0) {
        throw err;
      }
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("dynamic-inputs.write", async (opts: unknown) => {
      try {
        isWriteOperationOptions(opts);
        return await writeOperation(opts);
      } catch (err) {
        if (err instanceof Error) {
          await vscode.window.showErrorMessage(err.name, {
            modal: true,
            detail: err.message,
          });
          return;
        }
        throw err;
      }
    })
  );

  context.subscriptions.push(
    vscode.tasks.onDidStartTask(() => {
      return cache.clear();
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(() => {
      return cache.clear();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dynamic-inputs.read", async (opts: unknown) => {
      try {
        isReadOperationOptions(opts);
        const variables = getSubstitutedVariables(opts);
        const key = resolveVariables(opts.var, variables);
        if (cache.has(key)) {
          return cache.get(key);
        }
        isWriteOperationOptions(opts);
        return await writeOperation(opts);
      } catch (err) {
        if (err instanceof Error) {
          await vscode.window.showErrorMessage(err.name, {
            modal: true,
            detail: err.message,
          });
          return;
        }
        throw err;
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dynamic-inputs.require", (scriptPath: string) => {
      vscode.window.showWarningMessage("Deprecation: replace dynamic-inputs.require with dynamic-inputs.write");
      return requireOperation(scriptPath);
    })
  );
}

export function deactivate() {}
