import * as vscode from "vscode";
import express from "express";
import * as http from "http";
import path from "path";

export abstract class BaseDocumentationPanel {
    private static server: http.Server | undefined;
    protected context: vscode.ExtensionContext;
    protected host: string;
    protected port: number;
    protected uri: string;

    constructor(context: vscode.ExtensionContext, host: string = "localhost", port: number = 3000, uri: string = "/index.html") {
        this.context = context;
        this.port = port;
        this.host = host;
        this.uri = uri;
    }

    protected getWebviewContent(): string {
        const fullUrl = this.uri.startsWith("http") ? this.uri : `http://${this.host}:${this.port}${this.uri}`;
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sphinx Documentation</title>
                <style>
                    html, body {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <iframe src="${fullUrl}"></iframe>
            </body>
            </html>
        `;
    }

    protected async startServer(): Promise<void> {
        const _docviewerDir = path.join(process.env.HOME || process.env.USERPROFILE || '', 'vs_docviewer');
        if (BaseDocumentationPanel.server) {
            return;
        }

        const app = express();
        const docsPath = path.resolve(_docviewerDir);
        app.use(express.static(docsPath));

        BaseDocumentationPanel.server = app.listen(this.port, () => {
            console.log(`Sphinx documentation server is running on http://localhost:${this.port}`);
        });
    }

    protected stopServer(): void {
        if (BaseDocumentationPanel.server) {
            BaseDocumentationPanel.server.close();
            BaseDocumentationPanel.server = undefined;
        }
    }
}