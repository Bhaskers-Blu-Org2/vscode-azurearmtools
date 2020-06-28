// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { CodeAction, CodeActionContext, CodeActionKind, Range, Selection, TextEditor } from "vscode";
import { Command } from "vscode-languageclient";
import { Json } from "../../extension.bundle";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { ext } from "../extensionVariables";
import { IParameterDefinition } from "../IParameterDefinition";
import * as language from "../Language";
import { createParameterFromTemplateParameter, defaultTabSize } from "../parameterFileGeneration";
import { TemplateScope } from "../TemplateScope";
import { indentMultilineString } from "../util/multilineStrings";
import { getVSCodePositionFromPosition, getVSCodeRangeFromSpan } from "../util/vscodePosition";
import { IParameterValuesSource } from "./IParameterValuesSource";

// /** asdf
//  * Represents a "parameters" object in a deployment template or parameter file
//  * which contains parameter values (not definitions) for a template file or
//  * linked/nested template
//  */
// export class ParameterValues extends IParameterValues {
//     public getParameterValue(parameterName: string): ParameterValueDefinition | undefined;
//     public parameterValuesDefiniitions: ParameterValueDefinition[];

//     public parametersProperty: Json.Property | undefined;
//     public parametersObjectValue: Json.ObjectValue | undefined;
// }

// tslint:disable-next-line: export-name asdf
export async function getParameterValuesCodeActions(
    parameterValues: IParameterValuesSource, //asdf naming seems weird?
    deploymentTemplate: DeploymentTemplate | undefined, //asdf interface?  scope?  asdf what does undefined mean?
    range: Range | Selection, //asdf what range?
    context: CodeActionContext
): Promise<(Command | CodeAction)[]> {
    //asdf const template: DeploymentTemplate | undefined = <DeploymentTemplate | undefined>associatedDocument;

    const actions: (Command | CodeAction)[] = [];
    const parametersProperty = parameterValues.parametersProperty;

    if (parametersProperty && deploymentTemplate/*asdf*/) {
        // Is the parameters property in the requested range?
        const lineIndexOfParametersProperty = deploymentTemplate/*asdf*/?.getDocumentPosition(parametersProperty.nameValue.span.startIndex).line;
        if (lineIndexOfParametersProperty >= range.start.line && lineIndexOfParametersProperty <= range.end.line) {
            const missingParameters: IParameterDefinition[] = getMissingParameters(deploymentTemplate.topLevelScope.parameterDefinitions, parameterValues, false);

            // Add missing required parameters
            if (missingParameters.some(isParameterRequired)) {
                const action = new CodeAction("Add missing required parameters", CodeActionKind.QuickFix);
                action.command = {
                    command: 'azurerm-vscode-tools.codeAction.addMissingRequiredParameters',
                    title: action.title,
                    arguments: [
                        deploymentTemplate.documentUri
                    ]
                };
                actions.push(action);
            }

            // Add all missing parameters
            if (missingParameters.length > 0) {
                const action = new CodeAction("Add all missing parameters", CodeActionKind.QuickFix);
                action.command = {
                    command: 'azurerm-vscode-tools.codeAction.addAllMissingParameters',
                    title: action.title,
                    arguments: [
                        deploymentTemplate.documentUri
                    ]
                };
                actions.push(action);
            }
        }
    }

    return actions;
}

function isParameterRequired(paramDef: IParameterDefinition): boolean {
    return !paramDef.defaultValue;
}

export function getMissingParameters(
    parameterDefinitions: IParameterDefinition[],
    parameterValues: IParameterValuesSource,
    onlyRequiredParameters: boolean
): IParameterDefinition[] {
    const results: IParameterDefinition[] = [];
    for (let paramDef of parameterDefinitions) {
        const paramValue = parameterValues.getParameterValue(paramDef.nameValue.unquotedValue);
        if (!paramValue) {
            results.push(paramDef);
        }
    }

    if (onlyRequiredParameters) {
        return results.filter(isParameterRequired);
    }

    return results;
}

export async function addMissingParameters(
    editor: TextEditor,

    //asdf combine these together in an interface? - IParameterValuesHost
    template: DeploymentTemplate, //asdf scope  - need this for docment position - need to add to scope
    scope: TemplateScope,
    parameterValuesHost: IParameterValuesSource,
    parametersProperty: Json.Property | undefined,
    jsonParseResult: Json.ParseResult, //asdf?

    onlyRequiredParameters: boolean
): Promise<void> {

    // asdf handle when no parameters property

    // Find the location to insert new stuff in the parameters section
    const parametersObjectValue = parametersProperty?.value?.asObjectValue;
    if (parametersProperty && parametersObjectValue) {
        // Where insert?
        // Find last non-whitespace token inside the parameters section
        let lastTokenInParameters: Json.Token | undefined;
        for (let i = parametersProperty.span.endIndex - 1; // Start before the closing "}"
            i >= parametersProperty.span.startIndex;
            --i) {
            lastTokenInParameters = jsonParseResult.getTokenAtCharacterIndex(i, Json.Comments.includeCommentTokens);
            if (lastTokenInParameters) {
                break;
            }
        }
        const insertIndex: number = lastTokenInParameters
            ? lastTokenInParameters.span.afterEndIndex
            : parametersObjectValue.span.endIndex;
        const insertPosition = template.getDocumentPosition(insertIndex);

        // Find missing params
        const missingParams: IParameterDefinition[] = template.topLevelScope.parameterValuesSource
            ? getMissingParameters(
                scope.parameterDefinitions/*asdf*/,
                parameterValuesHost, //asdf?
                onlyRequiredParameters)
            : [];
        if (missingParams.length === 0) {
            return;
        }

        // Create insertion text
        let paramsAsText: string[] = [];
        for (let param of missingParams) {
            const paramText = createParameterFromTemplateParameter(template, param, defaultTabSize);
            paramsAsText.push(paramText);
        }
        let newText = paramsAsText.join(`,${ext.EOL}`);

        // Determine indentation
        const parametersObjectIndent = template.getDocumentPosition(parametersProperty?.nameValue.span.startIndex).column;
        const lastParameter = parameterValuesHost.parameterValueDefinitions.length > 0 ? parameterValuesHost.parameterValueDefinitions[parameterValuesHost.parameterValueDefinitions.length - 1] : undefined;
        const lastParameterIndent = lastParameter ? template.getDocumentPosition(lastParameter?.fullSpan.startIndex).column : undefined;
        const newTextIndent = lastParameterIndent === undefined ? parametersObjectIndent + defaultTabSize : lastParameterIndent;
        let indentedText = indentMultilineString(newText, newTextIndent);
        let insertText = ext.EOL + indentedText;

        if (!parameterValuesHost.parametersObjectValue) {
            //asdf ??
            return;
        }
        // If insertion point is on the same line as the end of the parameters object, then add a newline
        // afterwards and indent it (e.g. parameters object = empty, {})
        if (template.getDocumentPosition(insertIndex).line
            === template.getDocumentPosition(parameterValuesHost.parametersObjectValue.span.endIndex).line
        ) {
            insertText += ext.EOL + ' '.repeat(defaultTabSize);
        }

        // Add comma before?
        let commaEdit = createEditToAddCommaBeforePosition(parameterValuesHost, jsonParseResult, insertIndex);
        assert(!commaEdit || commaEdit.span.endIndex <= insertIndex);
        if (commaEdit?.span.startIndex === insertIndex) {
            // vscode doesn't like both edits starting at the same location, so
            //   just add the comma directly to the string (this is the common case)
            commaEdit = undefined;
            insertText = `,${insertText}`;
        }

        await editor.edit(editBuilder => {

            editBuilder.insert(getVSCodePositionFromPosition(insertPosition), insertText);
            if (commaEdit) {
                editBuilder.replace(
                    getVSCodeRangeFromSpan(template, commaEdit.span),
                    commaEdit.insertText);
            }
        });
    }
}

export function createEditToAddCommaBeforePosition(
    parameterValuesHost: IParameterValuesSource,
    jsonParseResult: Json.ParseResult, //asdf? part of host?
    documentIndex: number
): { insertText: string; span: language.Span } | undefined {
    // Are there are any parameters before the one being inserted?
    const newParamIndex = parameterValuesHost.parameterValueDefinitions
        .filter(
            p => p.fullSpan.endIndex < documentIndex)
        .length;
    if (newParamIndex > 0) {
        const prevParameter = parameterValuesHost.parameterValueDefinitions[newParamIndex - 1];
        assert(prevParameter);

        // Is there already a comma after the last parameter?
        const firstIndexAfterPrev = prevParameter.fullSpan.afterEndIndex;
        const tokensBetweenParams = jsonParseResult.getTokensInSpan(
            new language.Span(
                firstIndexAfterPrev,
                documentIndex - firstIndexAfterPrev),
            Json.Comments.ignoreCommentTokens
        );
        if (tokensBetweenParams.some(t => t.type === Json.TokenType.Comma)) {
            // ... yes
            return undefined;
        }

        // Insert a new comma right after last item's full span
        const insertIndex = prevParameter.fullSpan.afterEndIndex;
        return {
            insertText: ',',
            span: new language.Span(insertIndex, 0)
        };
    }

    return undefined;
}
