import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentationPanel } from "./DocumentationPanel";

let terminal: vscode.Terminal | undefined;

export function activate(context: vscode.ExtensionContext) {

  console.log("Activating Repository Sidebar Extension...");

  context.subscriptions.push(
    vscode.commands.registerCommand("docviewer.openSidebar", () => {
      RepoSidebarProvider.register(context);
    })
  );
  console.log("ExcuteCommand openSidebar");
  vscode.commands.executeCommand('docviewer.openSidebar');

  const disposable = vscode.commands.registerCommand('docviewer.openTerminal', () => {
    // 创建一个新的终端
    terminal = vscode.window.createTerminal({ name: "Doc Viewer" });
    terminal.show();

    // 监听终端关闭事件
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      // 比对关闭的终端是否是我们关心的终端
      if (terminal && closedTerminal === terminal) {
        vscode.window.showInformationMessage('The terminal "Doc Viewer" was closed.');
        terminal = undefined;  // 重置变量以避免误用关闭的终端引用
      }
    });
  });



}

export function deactivate() { }

// 提供 RepoSidebarProvider
class RepoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mySidebarView";
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  private _docviewerDir = path.join(process.env.HOME || process.env.USERPROFILE || '', 'vs_docviewer');
  private _docViewPannel?: DocumentationPanel;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    console.log("RepoSidebarProvider constructed");
  }

  public static register(context: vscode.ExtensionContext) {
    console.log("RepoSidebarProvider start registered");
    const provider = new RepoSidebarProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(RepoSidebarProvider.viewType, provider)
    );
    console.log("RepoSidebarProvider registered");
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    console.log("Resolving Webview View...");

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    console.log("Webview HTML set");

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        console.log("Received message from webview:", message);

        switch (message.command) {
          case 'requestRepoList':
            const repos = this._context.globalState.get('repos', []);
            webviewView.webview.postMessage({ command: 'updateRepoList', data: repos });
            break;
          case "addRepo":
            console.log("Add repo command received, name:", message.repoName, "path:", message.repoPath, "branch:", message.repoBranch);
            await this.addRepository(message.repoName, message.repoPath, message.repoBranch, message.repoSubDir);
            break;
          case "editRepo":
            console.log("Edit repo command received, index:", message.index, "name:", message.repoName, "path:", message.repoPath, "branch:", message.repoBranch, "subDir:", message.repoSubDir);
            await this.editRepository(message.index, message.repoName, message.repoPath, message.repoBranch, message.repoSubDir);
            break;
          case "deleteRepo":
            console.log("Delete repo command received, index:", message.index);
            await this.deleteRepository(message.index, message.repoName, message.repoSubDir);
            break;
          case "openRepo":
            console.log("Open repo command received, name:", message.repoName);
            await this.openRepository(message.repoName, message.repoSubDir);
            break;
          case 'updateRepo':
            await this.sparseCheckoutRepo(message.repoName, message.repoPath, message.repoBranch, message.repoSubDir);
            break;
        }
      },
      null,
      this._context.subscriptions
    );
  }

  private async addRepository(name: string, path: string, branch: string, subDir: string) {
    const repos = this._context.globalState.get<any>("repos", []);
    console.log("Current repos before add:", repos);

    repos.push({ name, path, branch, subDir });
    await this._context.globalState.update("repos", repos);
    console.log("Repo added, updated repos:", repos);

    if (this._view) {
      this._view.webview.postMessage({ command: "updateRepoList", data: repos });
    }
  }

  private async editRepository(index: number, name: string, path: string, branch: string, subDir: string) {
    const repos = this._context.globalState.get<any>("repos", []);
    console.log("Current repos before update:", repos);

    if (index >= 0 && index < repos.length) {
      repos[index] = { name, path, branch, subDir };
      console.log("Repo updated at index:", index);
    }

    await this._context.globalState.update("repos", repos);
    console.log("Updated repos:", repos);

    if (this._view) {
      this._view.webview.postMessage({ command: "updateRepoList", data: repos });
    }
  }

  private async deleteRepository(index: number, repoName: string, repoSubDir: string) {
    const repos = this._context.globalState.get<any>("repos", []);
    console.log("Current repos before delete:", repos);

    if (index >= 0 && index < repos.length) {
      repos.splice(index, 1);
      console.log("Repo deleted at index:", index);
    }

    await this._context.globalState.update("repos", repos);
    console.log("Updated repos after delete:", repos);

    const repoDir = path.join(this._docviewerDir, repoName, repoSubDir);
    if (fs.existsSync(repoDir)) {
      this.deleteDirectory(repoDir);
    }
    else {
      vscode.window.showInformationMessage(`Removed ${repoDir}!`);
    }


    if (this._view) {
      this._view.webview.postMessage({ command: "updateRepoList", data: repos });
    }
  }

  private async openRepository(repoName: string, subDir: string) {

    if (!this._docViewPannel) {
      this._docViewPannel = new DocumentationPanel(this._context);
    }

    const htmlRoot = path.join(this._docviewerDir, repoName, subDir);
    const filePath = path.join(htmlRoot, "index.html");
    const filePathNda = path.join(htmlRoot, "index_nda.html");
    const selectorJsFile = path.join(htmlRoot, "_static", "js", "selector.js");
    let indexFille = "";
    let uri = "";
    try {
      // if (fs.existsSync(selectorJsFile)) {
      //   fs.promises.rm(selectorJsFile); //remove selector.js
      // }
      if (fs.existsSync(filePath)) {
        indexFille = filePath;
        uri = `/${repoName}/${subDir}/index.html`;
      }
      else if (fs.existsSync(filePathNda)) {
        indexFille = filePathNda;
        uri = `/${repoName}/${subDir}/index_nda.html`;
      }
      else {
        vscode.window.showWarningMessage('Can not find index.html or index_nda.html!');
        return;
      }

      this._docViewPannel.show();
      this._docViewPannel.setUrl(uri);

      console.log("Opened index.html from path:", filePath);
    } catch (error) {
      console.error("Error opening repository path:", error);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "script.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "styles.css"));
    const addImgUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "images", "add.png"));

    // Generate paths for image URIs that the webview can use
    const viewImg = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "images", "view.png"));
    const editImg = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "images", "edit.png"));
    const minusImg = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "images", "minus.png"));
    const updateImg = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "images", "update.png"));


    console.log("Setting up HTML for webview with scriptUri:", scriptUri, "and styleUri:", styleUri);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Repository Sidebar</title>
      </head>
      <body>
        <div>
        <table style="width: 100%;">
        <tr>
          <td style="width: 80%;">
            <p>仓库列表</p>
          </td>
          <td style="width: 10%;">
            <!-- 第二个单元格，可以加入其他内容 -->
          </td>
          <td style="width: 10%;">
            <img src="${addImgUri}" id="addButton" alt="Add" title="Add">
          </td>
        </tr>
      </table>
          <hr>
          <table id="repoList"  style="width: 100%;">
            <tbody>
              <!-- 项目列表主体，将由 JavaScript 动态填充 -->
            </tbody>
          </table> 
        </div>
        <div id="modal" class="modal hidden">
          <div class="modal-content">
            <span class="close" id="closeModal">&times;</span>
            <h2 id="modalTitle">编辑仓库</h2>
            <label for="repoName">名称：</label>
            <input type="text" id="repoName"><br><br>
            <label for="repoPath">路径：</label>
            <input type="text" id="repoPath"><br><br>
            <label for="repoBranch">分支：</label>
            <input type="text" id="repoBranch"><br><br>
            <label for="repoSubDir">目录：</label>
            <input type="text" id="repoSubDir"><br><br>
            <table><tr>
            <td style="width: 60%;"><div id="error-message" style="color: red; display: none; margin-bottom: 10px;"></div></td>
            <td style="width: 20%;"><button id="cancelButton">放弃</button></td>
            <td style="width: 20%;"><button id="saveButton">保存</button></td>
            </tr></table>
          </div>
        </div>
        <script>
        const vscode = acquireVsCodeApi();
        const iconPaths = {
          view: '${viewImg}',
          edit: '${editImg}',
          minus: '${minusImg}',
          update: '${updateImg}'
        };
      </script>
      <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }


  // import vscode from 'vscode'; // 假设你有在实际代码中引入 VS Code API

  private async sparseCheckoutRepo(repoName: string, repoPath: string, repoBranch: string, repoSubDir: string) {
    const localRepoPath = path.join(this._docviewerDir, repoName);

    // 检查目录是否存在，不存在则创建
    if (!fs.existsSync(localRepoPath)) {
      fs.mkdirSync(localRepoPath, { recursive: true });
    }
    let commands: [string, string[]][] = [];

    const gitPath = path.join(localRepoPath, ".git");

    if (!terminal) {
      vscode.commands.executeCommand('docviewer.openTerminal');
    }


    if (fs.existsSync(gitPath)) {
      commands = [
        ['cd', [localRepoPath]],
        ['git', ['pull', 'origin', repoBranch]]
      ];
      try {
        for (const [cmd, args] of commands) {
         await this.executeCommandInTerminal(terminal as vscode.Terminal, cmd, args);
        }
      } catch (error) {
        const err = error as Error;
        vscode.window.showErrorMessage(`Failed to perform Update repo: ${err.message}`);
      }
    }
    else {
      commands = [
        ['cd', [localRepoPath]],
        ['git', ['init', localRepoPath]],
      ];

      for (const [cmd, args] of commands) {
       await this.executeCommandInTerminal(terminal as vscode.Terminal, cmd, args);
      }

      const sparseFileDir = path.join(localRepoPath, '.git', 'info');

      while (true) {
        if (fs.existsSync(sparseFileDir)) {
          break;
        }
        else
        { 
          await this.sleep(100);
        }
      }
      const sparseFile = path.join(sparseFileDir, 'sparse-checkout');
      fs.writeFileSync(sparseFile, repoSubDir, 'utf-8');


      commands = [
        ['cd', [localRepoPath]],
        ['git', ['remote', 'add', 'origin', repoPath]],
        ['git', ['config', 'core.sparseCheckout', 'true']],
        ['git', ['pull', 'origin', repoBranch]],
        ['git', ['checkout', repoBranch]]
      ];

      try {
        for (const [cmd, args] of commands) {
         await this.executeCommandInTerminal(terminal as vscode.Terminal, cmd, args);
        }
      } catch (error) {
        const err = error as Error;
        vscode.window.showErrorMessage(`Failed to perform sparse checkout: ${err.message}`);
      }
    }
  }

  private async executeCommandInTerminal(terminal: vscode.Terminal, command: string, args: string[]): Promise<void> {
    const cmdString = `${command} ${args.join(' ')}`;
    terminal.sendText(cmdString);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
      vscode.window.showInformationMessage(`Removed ${dirPath}!`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error while Removed ${dirPath}:${error}`);
    }
  }
}