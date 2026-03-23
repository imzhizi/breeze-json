import * as vscode from 'vscode';
import { JsonProcessor, JsonOperation } from './core/json-processor';
import { NestedHandler } from './core/nested-handler';
import { EditorHelper } from './utils/editor-helper';
import { ErrorHandler } from './utils/error-handler';

let jsonProcessor: JsonProcessor;
let nestedHandler: NestedHandler;
let editorHelper: EditorHelper;
let errorHandler: ErrorHandler;
let statusBarButton: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Breeze JSON is now active!');

    // Initialize components
    jsonProcessor = new JsonProcessor();
    nestedHandler = new NestedHandler(jsonProcessor);
    editorHelper = new EditorHelper();
    errorHandler = ErrorHandler.getInstance();

    // Register all commands
    const commands = [
        // Basic commands - entire document or selection
        vscode.commands.registerCommand('breezeJson.beauty', () => executeBasicCommand('beauty')),
        vscode.commands.registerCommand('breezeJson.ugly', () => executeBasicCommand('ugly')),
        vscode.commands.registerCommand('breezeJson.escape', () => executeBasicCommand('escape')),
        vscode.commands.registerCommand('breezeJson.unescape', () => executeBasicCommand('unescape')),
        vscode.commands.registerCommand('breezeJson.urlencode', () => executeBasicCommand('urlencode')),
        vscode.commands.registerCommand('breezeJson.urldecode', () => executeBasicCommand('urldecode')),
        
        // Selected value commands - for nested JSON
        vscode.commands.registerCommand('breezeJson.beautySelected', () => executeSelectedCommand('beauty')),
        vscode.commands.registerCommand('breezeJson.uglySelected', () => executeSelectedCommand('ugly')),
        vscode.commands.registerCommand('breezeJson.escapeSelected', () => executeSelectedCommand('escape')),
        vscode.commands.registerCommand('breezeJson.unescapeSelected', () => executeSelectedCommand('unescape')),

        // Quick pick command
        vscode.commands.registerCommand('breezeJson.quickPick', executeQuickPick)
    ];

    commands.forEach(command => context.subscriptions.push(command));

    // Create status bar button
    statusBarButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarButton.command = 'breezeJson.quickPick';
    statusBarButton.text = '$(json) Breeze JSON';
    statusBarButton.tooltip = 'Click to open Breeze JSON operations';
    statusBarButton.show();
    context.subscriptions.push(statusBarButton);
}

/**
 * Execute basic JSON command on entire document or selection
 */
async function executeBasicCommand(operation: JsonOperation) {
    const editor = editorHelper.getActiveEditor();
    if (!editor) {
        editorHelper.showError('No active editor found');
        return;
    }

    const { text, range, hasSelection } = editorHelper.getText(editor);

    // Check if text is large
    if (jsonProcessor.isLargeText(text)) {
        const config = vscode.workspace.getConfiguration('breezeJson');
        const maxSizeMB = config.get<number>('maxFileSizeMB', 10);
        const proceed = await vscode.window.showWarningMessage(
            `Large file detected (${(text.length / 1024 / 1024).toFixed(2)}MB > ${maxSizeMB}MB). Processing may take a while.`,
            'Continue',
            'Cancel'
        );
        
        if (proceed !== 'Continue') {
            return;
        }
    }

    try {
        let result;
        
        // Show progress for large files or operations that may take time
        if (text.length > 500000) {
            result = await editorHelper.withProgress(
                `Processing JSON: ${operation}...`,
                async (progress) => {
                    progress.report({ message: 'Parsing JSON...' });
                    const r = jsonProcessor.process(text, operation);
                    progress.report({ message: 'Applying changes...' });
                    return r;
                }
            );
        } else {
            result = jsonProcessor.process(text, operation);
        }

        if (result.success && result.data !== undefined) {
            const success = await editorHelper.replaceText(editor, range, result.data);
            
            if (success) {
                const message = hasSelection 
                    ? `JSON ${operation} completed on selection`
                    : `JSON ${operation} completed`;
                
                // Show warnings if any
                if (result.warnings && result.warnings.length > 0) {
                    editorHelper.showWarning(`${message}. ${result.warnings.join('. ')}`);
                } else {
                    editorHelper.showInfo(message);
                }
            } else {
                editorHelper.showError('Failed to apply changes');
            }
        } else {
            const errorMsg = errorHandler.handleError(operation, result.error, text.length);
            editorHelper.showError(errorMsg);
        }
    } catch (error) {
        const errorMsg = errorHandler.handleError(operation, error, text.length);
        editorHelper.showError(errorMsg);
    }
}

/**
 * Execute command on selected text (for nested JSON)
 * This detects if the selection is a key and processes its value
 */
async function executeSelectedCommand(operation: JsonOperation) {
    const editor = editorHelper.getActiveEditor();
    if (!editor) {
        editorHelper.showError('No active editor found');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        editorHelper.showWarning('Please select a key or JSON text to process');
        return;
    }

    const document = editor.document;
    const selectedText = document.getText(selection);
    const fullText = document.getText();

    try {
        const result = nestedHandler.processSelectedText(
            selectedText,
            fullText,
            selection.start,
            operation
        );

        if (result.success && result.data !== undefined) {
            // If it was a key-value, replace the value range
            // Otherwise replace the selection
            const targetRange = result.range || selection;
            
            const success = await editorHelper.replaceText(editor, targetRange, result.data);
            
            if (success) {
                const message = result.isKeyValue
                    ? `JSON ${operation} completed on selected value`
                    : `JSON ${operation} completed on selection`;
                
                // Show warnings if any
                if (result.warnings && result.warnings.length > 0) {
                    editorHelper.showWarning(`${message}. ${result.warnings.join('. ')}`);
                } else {
                    editorHelper.showInfo(message);
                }
            } else {
                editorHelper.showError('Failed to apply changes');
            }
        } else {
            const errorMsg = errorHandler.handleError(operation, result.error, selectedText.length);
            editorHelper.showError(errorMsg);
        }
    } catch (error) {
        const errorMsg = errorHandler.handleError(operation, error, selectedText.length);
        editorHelper.showError(errorMsg);
    }
}

/**
 * Show quick pick to select an operation
 */
async function executeQuickPick() {
    const operation = await editorHelper.showOperationPicker();
    
    if (operation) {
        executeBasicCommand(operation as JsonOperation);
    }
}

export function deactivate() {
    if (statusBarButton) {
        statusBarButton.dispose();
    }
    console.log('Breeze JSON deactivated');
}
