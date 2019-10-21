// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from '../extension.bundle';
import { CachedValue } from './CachedValue';
import { templateKeys } from './constants';
import { assert } from './fixed_assert';
import { IUsageInfo } from './Hover';
import { DefinitionKind, INamedDefinition } from './INamedDefinition';
import * as Json from "./JSON";

/**
 * This represents the definition of a top-level parameter in a deployment template.
 */
export interface IVariableDefinition extends INamedDefinition {
    nameValue: Json.StringValue;
    value: Json.Value | null;
    span: Language.Span;
    usageInfo: IUsageInfo;
}

export function isVariableDefinition(definition: INamedDefinition): definition is IVariableDefinition {
    return definition.definitionKind === DefinitionKind.Variable;
}

abstract class VariableDefinition implements IVariableDefinition {
    public readonly definitionKind: DefinitionKind = DefinitionKind.Variable;

    public abstract nameValue: Json.StringValue;
    public abstract value: Json.Value | null;
    public abstract span: Language.Span;
    public abstract usageInfo: IUsageInfo;
}

export class TopLevelVariableDefinition extends VariableDefinition {
    private readonly _value: CachedValue<Json.Value | null> = new CachedValue<Json.Value | null>();

    constructor(private readonly _property: Json.Property) {
        super();
        assert(_property);
    }

    public get nameValue(): Json.StringValue {
        return this._property.nameValue;
    }

    public get value(): Json.Value | null {
        return this._value.getOrCacheValue(() => {
            const value = this._property.value;
            const valueObject = Json.asObjectValue(value);
            if (valueObject) {
                const copyPropertyArray = Json.asArrayValue(valueObject.getPropertyValue(templateKeys.copy));
                if (copyPropertyArray) {
                    const copyKeyLC = templateKeys.copy.toLowerCase();

                    // Example:
                    //  "variable": {
                    //     "copy": [
                    //         {
                    //             "name": "disks",
                    //             "count": 5,
                    //             "input": {
                    //                 "name": "[concat('myDataDisk', copyIndex('disks', 1))]",
                    //                 "diskSizeGB": "1",
                    //                 "diskIndex": "[copyIndex('disks')]"
                    //             }
                    //         }
                    //     ],

                    // Start out with a list of the current members without the 'copy' value
                    const modifiedMembers: Json.Property[] = valueObject.properties
                        .filter(prop => prop.nameValue.unquotedValue.toLowerCase() !== copyKeyLC);

                    // Add a new array member for each element of the COPY block
                    for (let loopVar of copyPropertyArray.elements) {
                        const loopVarObject = Json.asObjectValue(loopVar);
                        if (loopVarObject) {
                            const name = Json.asStringValue(loopVarObject.getPropertyValue(templateKeys.loopVarName));
                            const input = loopVarObject.getPropertyValue(templateKeys.loopVarInput);
                            const count = loopVarObject.getPropertyValue(templateKeys.loopVarCount);

                            // If both name and count are there, ARM processes this as a copy block, otherwise it considers
                            //   it to simply be a member with the name "copy".
                            // If name and count are there, it then valides their types and gives an error if input is not there.
                            //   We're going to require input for now before considering it a copy block (delaying errors given to
                            //   the user until deployment).
                            // CONSIDER: Validate as ARM does and provide errors (we don't currently have the infrastructure to
                            //   easily provide errors during parse)
                            if (name && count && input) {

                                // We don't actually support expression evaluation in a meaningful way right now, so we don't
                                // need to be accurate with the representation, we just need to ensure we have an array of
                                // some value.  We'll create an array with a single element using the 'input' expression.
                                const array = new Json.ArrayValue(input.span, [input]);

                                // NOTE: Nested copy arrays are not supported by ARM, so we don't have to check
                                //   the 'input' property value for a COPY block

                                // Wrap the array in a property
                                const loopValueProperty = new Json.Property(input.span, name, array);
                                modifiedMembers.push(loopValueProperty);
                            }
                        }
                    }

                    const modifiedObjectValue = new Json.ObjectValue(valueObject.span, modifiedMembers);
                    return modifiedObjectValue;
                }
            }

            // No valid COPY block found - just return the value as is
            return value;
        });
    }

    public get span(): Language.Span {
        return this._property.span;
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.nameValue.unquotedValue,
            friendlyType: "variable",
            description: undefined
        };
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return `${this.nameValue.toString()} (var)`;
    }
}

/**
 * This class represents the definition of a top-level parameter in a deployment template.
 */
export class TopLevelCopyBlockVariableDefinition extends VariableDefinition {
    public readonly value: Json.Value | null;

    public constructor(
        /**
         * The "copy" block array element corresponding to this variable (see below)
         */
        private readonly _copyVariableObject: Json.ObjectValue,

        /**
         * StringValue representing the "name" property of the copy block
         */
        public readonly nameValue: Json.StringValue,

        /**
         * The "input" property from the copy block, represents the value of each instance of the
         * resulting variable array
         */
        input: Json.Value | null
    ) {
        super();

        // The value will be an array (of the given count) of the value of the "input" property resolved
        // with 'copyIndex' resolved with the current index
        // test: can count be expression?
        // We don't actually support expression evaluation in a meaningful way right now, so we don't
        // need to be accurate with the representation, we just need to ensure we have an array of
        // some value.  We'll create an array with a single element using the 'input' expression.
        this.value = input ? new Json.ArrayValue(input.span, [input]) : null;
    }

    public static createIfValid(copyVariableObject: Json.Value): IVariableDefinition | undefined {
        // E.g.
        //   "variables": {
        //         "copy": [
        //             { <<<< This is passed to constructor
        //                 "name": "top-level-string-array",
        //                 "count": 5,
        //                 "input": "[concat('myDataDisk', copyIndex('top-level-string-array', 1))]"
        //             }
        //         ]
        //   }

        const asObject = Json.asObjectValue(copyVariableObject);
        if (asObject) {
            const nameValue = Json.asStringValue(asObject.getPropertyValue(templateKeys.loopVarName));
            if (nameValue) {
                const value = asObject.getPropertyValue(templateKeys.loopVarInput);
                return new TopLevelCopyBlockVariableDefinition(asObject, nameValue, value);
            }
        }

        return undefined;
    }

    public get span(): Language.Span {
        return this._copyVariableObject.span;
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.nameValue.unquotedValue,
            friendlyType: "iteration variable",
            description: undefined
        };
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return `${this.nameValue.toString()} (iter var)`;
    }
}