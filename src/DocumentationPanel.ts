import * as vscode from "vscode";
import { BaseDocumentationPanel } from "./BaseDocumentationPanel";

export class DocumentationPanel extends BaseDocumentationPanel {
    private panel: vscode.WebviewPanel | undefined;

    public async show(viewColumn: vscode.ViewColumn = vscode.ViewColumn.One): Promise<void> {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                "DocViewer", // Identifies the type of the webview. Used internally
                "DocViewer - Documentation", // Title of the panel displayed to the user
                viewColumn, // Editor column to show the new webview panel in.
                {
                    // Enable scripts in the webview
                    enableScripts: true,
                },
            );

            this.panel.onDidDispose(
                () => {
                    this.panel = undefined;
                    this.stopServer();
                },
                undefined,
                this.context.subscriptions,
            );

            await this.startServer();
            this.panel.webview.html = this.getWebviewContent();
        } else {
            this.panel.reveal(viewColumn);
        }
    }

    public setUrl(url: string): void {
        this.uri = url;
        if (this.panel) {
            this.panel.webview.html = this.getWebviewContent();
        }
    }
}
