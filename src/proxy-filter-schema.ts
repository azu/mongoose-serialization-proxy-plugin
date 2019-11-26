import { isPlainObject } from "./is-plain-object";

/***
 * Schema value is public, pick the value
 * Schema value is private, omit the value
 */
export type FILTER_SCHEMA_ACCESS = "private" | "public";
export type FilterSchema<T> = {
    // if value is `true`, pick the key and value
    // if value is `false`, omit the key and value
    [P in keyof T]?: FilterSchema<T[P]> | FILTER_SCHEMA_ACCESS
}
export const isFilterSchemaAccess = (v: unknown): v is FILTER_SCHEMA_ACCESS => {
    return v === "private" || v === "public";

};
const pickSchema = <T extends { [index: string]: any }>(schema: FilterSchema<T>, keyStack: string[]): FilterSchema<T> => {
    let lastValue = schema;
    while (keyStack.length > 0) {
        const lastKey = keyStack.pop();
        // unexpected
        if (lastKey === undefined) {
            return {};
        }
        const _lastValue = lastValue[lastKey];
        if (typeof _lastValue === "object") {
            lastValue = _lastValue;
        }
    }
    return lastValue;
};
/**
 * toJSON with Schema
 * Return JSON object that includes schema's value is `true`
 * @param localTarget
 * @param localSchema
 * @param keyStack
 * @param options
 */
export const filterTargetWithFilterSchema = <T extends { [index: string]: any }>(
    {
        localTarget,
        localSchema,
        localKeyStack
    }: {
        localTarget: T,
        localSchema: FilterSchema<T> | FILTER_SCHEMA_ACCESS,
        localKeyStack: string[],
    }, options: Required<proxySchemaOptions>) => {
    // If the `localSchema` is true, just return target
    if (localSchema === "public") {
        return localTarget; //return
    } else if (localSchema === "private") {
        return {}; // empty
    }
    const schema = pickSchema(localSchema, localKeyStack);
    // should traverse target, because schema properties is optional
    return Object.keys(localTarget).reduce((obj, key) => {
        const childSchemaOrAccess = schema[key];
        // dig child for the object
        if (typeof childSchemaOrAccess === "object" && typeof localTarget[key] === "object" && localTarget.hasOwnProperty(key)) {
            // childSchemaValue is schema
            // reverse concat
            obj[key] = filterTargetWithFilterSchema({
                localTarget: localTarget[key],
                localSchema: childSchemaOrAccess,
                localKeyStack: localKeyStack.slice(0, -1)
            }, options);
        } else if (isFilterSchemaAccess(childSchemaOrAccess)) {
            if (childSchemaOrAccess === "public") {
                obj[key] = localTarget[key];
            }
        } else if (childSchemaOrAccess === undefined) {
            // if it is private value, hide the value
            if (options.defaultFieldsAccess === "public") {
                obj[key] = localTarget[key];
            }
        }
        return obj;
    }, {} as { [index: string]: any });
};

export interface proxySchemaOptions {
    /**
     * Default access level of undefined property of filterSchema
     * Default: "private"
     */
    defaultFieldsAccess?: FILTER_SCHEMA_ACCESS;
}

const DefaultOptions = {
    defaultFieldsAccess: "private"
} as const;

export const mergeOptionWithDefault = (options?: proxySchemaOptions): Required<proxySchemaOptions> => {
    const defaultSchemaAccess = options && options.defaultFieldsAccess !== undefined ? options.defaultFieldsAccess : DefaultOptions.defaultFieldsAccess;
    return { defaultFieldsAccess: defaultSchemaAccess };
};
/**
 * proxy with schema object
 * @param target
 * @param filterSchema
 * @param options
 */
export const proxySchema = <T extends { [index: string]: any }>(target: T, filterSchema: FilterSchema<T> | FILTER_SCHEMA_ACCESS, options?: proxySchemaOptions): T => {
    const { defaultFieldsAccess } = mergeOptionWithDefault(options);

    function innerProxy(localTarget: T, localSchema: FilterSchema<T> | FILTER_SCHEMA_ACCESS, keyStack: string[] = []): T {
        return new Proxy(localTarget, {
            get: (target: T, key: string | number | symbol, receiver: any) => {
                // Return SchemaProxy#toJSON instead of default toJSON
                if (key === "toJSON") {
                    // return dummy toJSON method that use original toJSON with filter by schema
                    const toJSON = Reflect.get(target, "toJSON", receiver);
                    return function toJSONByProxySchema() {
                        const originalJSON = toJSON ? toJSON.call(target) : target;
                        return filterTargetWithFilterSchema({
                            localTarget: originalJSON,
                            localSchema: localSchema,
                            localKeyStack: keyStack
                        }, {
                            defaultFieldsAccess
                        });
                    };
                }
                const childTarget = Reflect.get(target, key, receiver);
                // Avoid Proxy Error like follows
                // Can not proxy Set, Map, TypedArray ...
                // Just Proxy Object Literal(plain object)
                // TypeError: Method get TypedArray.prototype.length called on incompatible receiver [object Object]
                // https://stackoverflow.com/questions/43927933/why-is-set-incompatible-with-proxy
                const isObjectLiteral = isPlainObject(childTarget);
                if (childTarget !== null && isObjectLiteral && typeof key === "string") {
                    // localSchema value is boolean, convert to ParentSchema
                    // It aim to support assign object
                    const childSchema = (() => {
                        if (typeof localSchema === "object") {
                            const childSchema: FilterSchema<T> | FILTER_SCHEMA_ACCESS = Reflect.get(localSchema, key);
                            if (typeof childSchema === "object") {
                                return childSchema;
                            }
                            return childSchema;
                        } else {
                            // already boolean
                            return localSchema;
                        }
                    })();
                    return innerProxy(childTarget, childSchema, keyStack.concat(key));
                }
                return childTarget;
            }
        });
    }

    return innerProxy(target, filterSchema);
};
