import * as vscode from 'vscode';

export class EditorHelper {
    /**
     * Get the current active editor
     */
    getActiveEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor;
    }

    /**
     * Get selected text or entire document text
     */
    getText(editor: vscode.TextEditor): { text: string; range: vscode.Range; hasSelection: boolean } {
        const selection = editor.selection;
        
        if (selection.isEmpty) {
            // Use entire document
            const text = editor.document.getText();
            return {
                text: text,
                range: new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(text.length)
                ),
                hasSelection: false
            };
        } else {
            // Use selected text
            return {
                text: editor.document.getText(selection),
                range: selection,
                hasSelection: true
            };
        }
    }

    /**
     * Replace text in editor
     */
    async replaceText(editor: vscode.TextEditor, range: vscode.Range, newText: string): Promise<boolean> {
        try {
            const success = await editor.edit(editBuilder => {
                editBuilder.replace(range, newText);
            });
            return success;
        } catch (error) {
            console.error('Failed to replace text:', error);
            return false;
        }
    }

    /**
     * Show error message
     */
    showError(message: string): Thenable<string | undefined> {
        return vscode.window.showErrorMessage(message);
    }

    /**
     * Show information message
     */
    showInfo(message: string): Thenable<string | undefined> {
        return vscode.window.showInformationMessage(message);
    }

    /**
     * Show warning message
     */
    showWarning(message: string): Thenable<string | undefined> {
        return vscode.window.showWarningMessage(message);
    }

    /**
     * Show progress indicator for long-running operations
     */
    async withProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: false
            },
            async (progress) => {
                return await task(progress);
            }
        );
    }

    /**
     * Show a quick pick for selecting an operation
     */
    async showOperationPicker(): Promise<string | undefined> {
        const operations = [
            { label: '$(beautify) Beauty (Format)', description: 'Format JSON with indentation', value: 'beauty' },
            { label: '$(collapse-all) Ugly (Minify)', description: 'Minify JSON (remove whitespace)', value: 'ugly' },
            { label: '$(quote) Escape', description: 'Escape JSON string', value: 'escape' },
            { label: '$(ungroup-by-ref-type) Unescape', description: 'Unescape JSON string', value: 'unescape' },
            { label: '$(link) URL Encode', description: 'URL encode JSON', value: 'urlencode' },
            { label: '$(unlink) URL Decode', description: 'URL decode JSON', value: 'urldecode' }
        ];

        const selected = await vscode.window.showQuickPick(operations, {
            placeHolder: 'Select JSON operation'
        });

        return selected?.value;
    }
}
