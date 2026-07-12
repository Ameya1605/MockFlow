  import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
  import { SidebarProvider } from './panels/SidebarProvider';
  import { setChaosConfig, startServer, stopServer } from './server';

  let serverInstance: http.Server | undefined;
  const PORT = 3939;
  let sidebarProvider: SidebarProvider | undefined;

  export function activate(context: vscode.ExtensionContext): void {
    dotenv.config({ path: path.join(context.extensionPath, '.env') });

    sidebarProvider = new SidebarProvider(context.extensionUri, {
      onStart: async () => {
        if (serverInstance) {
          sidebarProvider?.postStatus(true, PORT);
          return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('Please open a folder/workspace before starting the MockFlow AI server.');
          return;
        }

        if (!process.env.GEMINI_API_KEY?.trim()) {
          vscode.window.showErrorMessage(
            'GEMINI_API_KEY is not set. Add it to a .env file in the extension folder, or set it as an environment variable, then reload VS Code.'
          );
          return;
        }

        try {
          serverInstance = startServer(PORT, workspaceFolder.uri.fsPath, process.env.GEMINI_API_KEY ?? '');
          sidebarProvider?.postStatus(true, PORT);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      onStop: async () => {
        if (!serverInstance) {
          sidebarProvider?.postStatus(false);
          return;
        }

        try {
          await stopServer(serverInstance);
          serverInstance = undefined;
          sidebarProvider?.postStatus(false);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to stop server: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      onChaosUpdate: (latencyMs: number, errorRate: number) => {
        setChaosConfig(latencyMs, errorRate);
      },
    });

    context.subscriptions.push(vscode.window.registerWebviewViewProvider('mockflowSidebar', sidebarProvider));
  }

  export function deactivate(): void {
    void (async () => {
      if (serverInstance) {
        try {
          await stopServer(serverInstance);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to stop server on deactivate: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })();
  }
