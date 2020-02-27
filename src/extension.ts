import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "custom-text-editor" is now active!');

	vscode.window.registerCustomEditorProvider('markdown.wysiwygEditor', new CustomMarkdownEditorProvider(), {
		retainContextWhenHidden: false
	});
}

export class CustomMarkdownEditorProvider implements vscode.CustomTextEditorProvider {

	private mapDocumentToEditor: Map<vscode.TextDocument, CustomMarkdownEditor> = new Map();

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		let editor = this.mapDocumentToEditor.get(document);
		if (!editor) {
			editor = new CustomMarkdownEditor(document, panel);
			this.mapDocumentToEditor.set(document, editor);

			panel.onDidDispose(() => {
				editor?.dispose();
				this.mapDocumentToEditor.delete(document);
			});
		}
	}
}

class CustomMarkdownEditor {

	private disposables: vscode.Disposable[] = [];
	private ignoreContentChanges = false;

	constructor(private document: vscode.TextDocument, private panel: vscode.WebviewPanel) {
		panel.webview.options = { enableScripts: true };

		panel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'webview->exthost:ready':
					this.whenEditorReady(document, panel);
					break;
				case 'webview->exthost:changeContent':
					this.changeContent(e.payload);
			}
		});

		panel.webview.html = this.getEditorHtml(panel);
	}

	private whenEditorReady(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {

		// initial text from document
		panel.webview.postMessage({
			type: 'exhost->webview:init',
			payload: document.getText()
		});

		// listen for changes and send over
		this.disposables.push(vscode.workspace.onDidChangeTextDocument(e => {
			if (this.ignoreContentChanges) {
				return;
			}

			panel.webview.postMessage({
				type: 'exhost->webview:updateContent',
				payload: document.getText()
			});
		}));
	}

	private getEditorHtml(panel: vscode.WebviewPanel): string {
		return `
		<html>
			<head>
				
			<!-- Styles -->
				<link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(__dirname, '..', 'node_modules', 'tui-editor', 'dist')))}/tui-editor.css"></link>
				<link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(__dirname, '..', 'node_modules', 'tui-editor', 'dist')))}/tui-editor-contents.css"></link>
				
				<!-- Scripts -->
				<script src="${panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(__dirname, '..', 'node_modules', 'tui-editor', 'dist')))}/tui-editor-Editor-full.js"></script>
			</head>	
			<body>
				<div id="editorSection"></div>
				<script src="${panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(__dirname, '..', 'static', 'editor.js')))}"></script>
			</body>
		</html>`;
	}

	private changeContent(newContent: string): void {
		(async () => {
			this.ignoreContentChanges = true;
			try {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(this.document.uri, this.document.validateRange(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(999999, 999999))), newContent);
				await vscode.workspace.applyEdit(edit);
			} finally {
				this.ignoreContentChanges = false;
			}
		})();
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}

		this.disposables = [];
	}
}