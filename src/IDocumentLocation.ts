// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Uri } from "vscode";
import * as Json from "./JSON";
import * as language from './Language';

/**
 * Represents something that is contained inside a document with a URI location
 */

export interface IDocumentLocation {
    documentUri: Uri;
}

export interface IDocument extends IDocumentLocation {
    /**
     * Get the document text as a string.
     */
    documentText: string;

    /**
     * Retrieves a section of the document text
     */
    getDocumentText(span: language.Span, offsetIndex?: number): string;
}

export interface IJsonDocument extends IDocument {
    /**
     * Parse result for the JSON document as a whole
     */
    jsonParseResult: Json.ParseResult;

    /**
     * The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
     */
    topLevelValue: Json.ObjectValue | undefined;
}
