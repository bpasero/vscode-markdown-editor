import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "custom-text-editor" is now active!');

	vscode.window.registerCustomEditorProvider('markdown.wysiwygEditor', new CustomTextProvider(), {
		retainContextWhenHidden: false
	});
}

export class CustomTextProvider implements vscode.CustomTextEditorProvider {

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true
		};

		panel.webview.onDidReceiveMessage(e => {
			if (e === 'markdown:ready') {
				panel.webview.postMessage({
					id: 'markdown:contents',
					value: document.getText()
				});
			}
		});

		panel.webview.html = `
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
</html>
`;
	}
}
