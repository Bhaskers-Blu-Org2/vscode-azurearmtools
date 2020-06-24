// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IDocumentLocation } from '../IDocumentLocation';
import * as Json from "../JSON";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a "parameters" object in a deployment template or parameter file
 * which contains parameter values (not definitions) for a template file or
 * linked/nested template
 */
export interface IProvideParameterValues extends IDocumentLocation/*asdf?*/ {
    // case-insensitive
    getParameterValue(parameterName: string): ParameterValueDefinition | undefined;
    parameterValuesDefinitions: ParameterValueDefinition[];

    parametersProperty: Json.Property | undefined; //asdf document
    parametersObjectValue: Json.ObjectValue | undefined;
}
