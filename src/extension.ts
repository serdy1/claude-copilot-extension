import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Claude Copilot extension is now active');
}

export function deactivate() {
	console.log('Claude Copilot extension deactivated');
}