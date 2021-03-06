import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "custom-text-editor" is now active!');

	vscode.window.registerCustomEditorProvider('markdown.wysiwygEditor', new CustomMarkdownEditorProvider(), {	});
}

export class CustomMarkdownEditorProvider implements vscode.CustomTextEditorProvider {

	private mapDocumentToEditor: Map<vscode.TextDocument, CustomMarkdownEditor> = new Map();

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
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
					break;
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
			if (e.document !== this.document) {
				return;
			}

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
				<link rel="stylesheet" href="https://uicdn.toast.com/tui-editor/latest/tui-editor.css"></link>
				<link rel="stylesheet" href="https://uicdn.toast.com/tui-editor/latest/tui-editor-contents.css"></link>
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.48.4/codemirror.css"></link>
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/github.min.css"></link>
				
				<!-- Scripts -->
				<script src="https://uicdn.toast.com/tui-editor/latest/tui-editor-Editor-full.js"></script>
			</head>	
			<body>
				<div id="editorSection"></div>
				<script src="${panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(__dirname, '..', 'static', 'editor.js')))}"></script>
			</body>
		</html>`;
	}

	private changeContent(newContent: string): void {
		if (newContent === this.document.getText()) {
			return; // ignore changes that are not a change actually
		}

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