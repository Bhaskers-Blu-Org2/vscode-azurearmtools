// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IJsonDocument } from '../IDocumentLocation';
import * as Json from "../JSON";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a "parameters" JSON object in a deployment template or parameter file
 * which contains parameter values (not definitions) for a template file or
 * linked/nested template
 */
export interface IParameterValuesSource /*asdf?*/ {
    document: IJsonDocument;

    // case-insensitive
    getParameterValue(parameterName: string): ParameterValueDefinition | undefined;
    parameterValueDefinitions: ParameterValueDefinition[];

    parametersProperty: Json.Property | undefined; //asdf document
    parametersObjectValue: Json.ObjectValue | undefined;
}

export class ParameterValuesSource implements IParameterValuesSource { //asdf move
    public constructor(
        public readonly document: IJsonDocument,
        public readonly parametersProperty: Json.Property | undefined
    ) {

    }

    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        const parameterProperty =
            this.parametersProperty?.value?.asObjectValue?.getProperty(parameterName);
        return parameterProperty
            ? new ParameterValueDefinition(parameterProperty)
            : undefined;
    }

    public get parameterValueDefinitions(): ParameterValueDefinition[] {
        const parameterProperties = //asdf?
            this.parametersProperty?.value?.asObjectValue?.properties;
        return parameterProperties
            ? parameterProperties.map(p => new ParameterValueDefinition(p))
            : [];
    }

    public get parametersObjectValue(): Json.ObjectValue | undefined {
        return this.parametersProperty?.asObjectValue;
    }
}
