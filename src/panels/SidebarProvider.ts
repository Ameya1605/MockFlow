import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _callbacks: {
      onStart: () => void;
      onStop: () => void;
      onChaosUpdate: (latencyMs: number, errorRate: number) => void;
    },
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'start':
          this._callbacks.onStart();
          break;
        case 'stop':
          this._callbacks.onStop();
          break;
        case 'updateChaos':
          this._callbacks.onChaosUpdate(message.latencyMs, message.errorRate);
          break;
        default:
          console.log('Received message:', message);
          break;
      }
    });

    const nonce = this.getNonce();
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, nonce);
  }

  public postStatus(running: boolean, port?: number): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      command: 'statusUpdate',
      running,
      ...(port !== undefined ? { port } : {}),
    });
  }

  private getHtmlForWebview(webview: vscode.Webview, nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} 'self' data:; font-src ${webview.cspSource};" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MockFlow AI</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        padding: 12px;
        margin: 0;
      }

      .container {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .status-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      .button-row {
        display: flex;
        gap: 8px;
      }

      button,
      input {
        width: 100%;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
      }

      button {
        cursor: pointer;
        width: auto;
        flex: 1;
      }

      label {
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="status-row">
        <span>Status:</span>
        <span id="status">Stopped</span>
      </div>

      <div class="button-row">
        <button id="startBtn">Start Server</button>
        <button id="stopBtn">Stop Server</button>
      </div>

      <label for="latencyInput">Latency (ms)</label>
      <input id="latencyInput" type="number" min="0" step="1" value="0" />

      <label for="errorRateInput">Error Rate (%)</label>
      <input id="errorRateInput" type="number" min="0" max="100" step="0.1" value="0" />

      <button id="applyChaosBtn">Apply Chaos Settings</button>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();

      function onStartClick() {
        vscode.postMessage({ command: 'start' });
      }

      function onStopClick() {
        vscode.postMessage({ command: 'stop' });
      }

      function onApplyChaosClick() {
        const latencyInput = document.getElementById('latencyInput');
        const errorRateInput = document.getElementById('errorRateInput');

        const latencyMs = Number(latencyInput?.value ?? 0);
        const errorRate = Number(errorRateInput?.value ?? 0);

        vscode.postMessage({ command: 'updateChaos', latencyMs, errorRate });
      }

      document.getElementById('startBtn')?.addEventListener('click', onStartClick);
      document.getElementById('stopBtn')?.addEventListener('click', onStopClick);
      document.getElementById('applyChaosBtn')?.addEventListener('click', onApplyChaosClick);

      window.addEventListener('message', (event) => {
        const message = event.data;

        if (message?.command === 'statusUpdate') {
          const statusElement = document.getElementById('status');

          if (statusElement) {
            statusElement.textContent = message.running
              ? message.port !== undefined
                ? \`Running on port \${message.port}\`
                : 'Running'
              : 'Stopped';
          }
        }
      });
    </script>
  </body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
