// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import { Language } from '../extension.bundle';
import { ResolvableCodeLens } from "./DeploymentDocument";
import { DeploymentTemplate } from './DeploymentTemplate';
import { ext } from './extensionVariables';
import { IParameterDefinition } from './IParameterDefinition';
import { IParameterValuesHost } from './parameterFiles/IParameterValuesHost';
import { getRelativeParameterFilePath } from './parameterFiles/parameterFiles';
import { TemplateScopeKind } from "./TemplateScope";

/**
 * A code lens to indicate the current parameter file and to open it
 */
export class ShowCurrentParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(dt: DeploymentTemplate, span: Language.Span) {
        super(dt, span);
    }

    public async resolve(): Promise<boolean> {
        const dpUri = ext.deploymentFileMapping.value.getParameterFile(this.deploymentDoc.documentUri);
        if (dpUri) {
            this.command = {
                title: `Parameter file: "${getRelativeParameterFilePath(this.deploymentDoc.documentUri, dpUri)}"`, //asdf
                command: 'azurerm-vscode-tools.openParameterFile',
                arguments: [this.deploymentDoc.documentUri]
            };
            return true;
        }

        return false;
    }
}

/**
 * A code lens to allow changing the current parameter file (or associating one if none currently)
 */
export class SelectParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(dt: DeploymentTemplate, span: Language.Span) {
        super(dt, span);
    }

    public async resolve(): Promise<boolean> {
        let title: string;
        const dpUri = ext.deploymentFileMapping.value.getParameterFile(this.deploymentDoc.documentUri);
        if (dpUri) {
            title = `Change...`;
        } else {
            title = "Select or create a parameter file to enable full validation...";
        }

        this.command = {
            title,
            command: 'azurerm-vscode-tools.selectParameterFile',
            arguments: [this.deploymentDoc.documentUri]
        };
        return true;
    }
}

export class ParameterDefinitionCodeLens extends ResolvableCodeLens {
    // Max # of characters to show for the value in the code lens
    private readonly _maxCharactersInValue: number = 120;

    public constructor(
        dt: DeploymentTemplate, //asdf doc - this is the parent template, not the parent scope //asdf needed?
        public readonly parameterDefinition: IParameterDefinition,
        public getParameterValues: () => Promise<IParameterValuesHost | undefined>
    ) {
        super(dt, parameterDefinition.nameValue.span);
    }

    public async resolve(): Promise<boolean> {
        const parameterValues = await this.getParameterValues();
        if (parameterValues) {
            //assert(parameterValues instanceof DeploymentParameters); asdf
            //const dp = associatedDocument as DeploymentParameters;

            const param = parameterValues.getParameterValue(this.parameterDefinition.nameValue.unquotedValue);
            const paramValue = param?.value;
            const paramReference = param?.reference;
            const givenValueAsString = paramValue?.toFullFriendlyString();
            const defaultValueAsString = this.parameterDefinition.defaultValue?.toFullFriendlyString();

            let title;
            if (!!paramReference) {
                title = 'Value: (KeyVault reference)';
            } else if (givenValueAsString !== undefined) {
                title = `Value: ${givenValueAsString}`;
            } else if (defaultValueAsString !== undefined) {
                title = `Using default value: ${defaultValueAsString}`;
            } else {
                title = "$(warning) No value found";
            }

            if (title.length > this._maxCharactersInValue) {
                // tslint:disable-next-line: prefer-template
                title = title.slice(0, this._maxCharactersInValue) + "...";
            }

            this.command = {
                title: title,
                command: "azurerm-vscode-tools.codeLens.gotoParameterValue",
                arguments: [
                    parameterValues,
                    this.parameterDefinition.nameValue.unquotedValue
                ]
            };
            return true;
        }

        return false;
    }
}

export class NestedTemplateCodeLen extends ResolvableCodeLens {
    private constructor(
        dt: DeploymentTemplate,
        span: Language.Span,
        title: string
    ) {
        super(dt, span);
        this.command = {
            title: title,
            command: ''
        };
    }

    public static create(dt: DeploymentTemplate, span: Language.Span, scopeKind: TemplateScopeKind): NestedTemplateCodeLen | undefined {
        switch (scopeKind) {
            case TemplateScopeKind.NestedDeploymentWithInnerScope:
                return new NestedTemplateCodeLen(dt, span, "Nested template with inner scope");
            case TemplateScopeKind.NestedDeploymentWithOuterScope:
                return new NestedTemplateCodeLen(dt, span, "Nested template with outer scope");
            default:
                return undefined;
        }
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}

export class LinkedTemplateCodeLens extends ResolvableCodeLens {
    private constructor(
        dt: DeploymentTemplate,
        span: Language.Span,
        title: string
    ) {
        super(dt, span);
        this.command = {
            title: title,
            command: ''
        };
    }

    public static create(dt: DeploymentTemplate, span: Language.Span): LinkedTemplateCodeLens {
        return new LinkedTemplateCodeLens(dt, span, "Linked template");
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}
