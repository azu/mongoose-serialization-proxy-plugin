import { createFilterSchema, createFilterSchemaOptions } from "./create-filter-schema";
import {
    FILTER_SCHEMA_ACCESS,
    FilterSchema,
    filterTargetWithFilterSchema,
    mergeOptionWithDefault,
    proxySchema,
    proxySchemaOptions
} from "./proxy-filter-schema";
import { Schema } from "mongoose";

const factoryShouldWrapProxy = (options?: proxySchemaOptions) => {
    return (filterValue: FilterSchema<any> | FILTER_SCHEMA_ACCESS | undefined): filterValue is FilterSchema<any> | FILTER_SCHEMA_ACCESS => {
        if (typeof filterValue === "object") {
            return true;
        }
        if (filterValue === "private") {
            return true;
        }
        if (filterValue === undefined && options && options.defaultFieldsAccess === "private") {
            return true;
        }
        // "public" then does not wrap
        return false;
    };
};

export function mongooseSerializeProxyPlugin(filterOptions?: createFilterSchemaOptions) {
    const shouldProxy = factoryShouldWrapProxy(filterOptions);
    const toJSONCallback = filterOptions && filterOptions.toJSONCallback;
    return (schema: Schema) => {
        const filterSchema = createFilterSchema(schema, filterOptions);
        // find hook - replace each items with proxy
        schema.post("find", function (docs) {
            if (!Array.isArray(docs)) {
                return;
            }
            // side-effect
            // replace array items with proxied items
            for (let index = 0; index < docs.length; index++) {
                docs[index] = proxySchema(docs[index], filterSchema, filterOptions);
            }
        });
        // findOne hook - replace each property object of item with proxy
        schema.post("findOne", function (doc: { [index: string]: any }) {
            if (doc === null || typeof doc !== "object") {
                return;
            }
            Object.keys(filterSchema).forEach(key => {
                const docProperty = doc[key];
                const filterSchemaValue = filterSchema[key];
                // if the access value is private, should proxy it
                if (typeof docProperty === "object" && shouldProxy(filterSchemaValue)) {
                    // replace with proxy
                    doc[key] = proxySchema(docProperty, filterSchemaValue, filterOptions);
                }
            });
            // post hook does not support return value
        });
        // toJSON hook - filter with schema
        const toJSONOptions: {} = schema.get("toJSON") || {};
        schema.set("toJSON", {
            ...toJSONOptions,
            transform: (_doc, ret, _options) => {
                const virtualKeys = Object.keys(ret).filter(key => {
                    return schema.pathType(key) === "virtual";
                });
                const defaultVirtualsAccess = filterOptions && filterOptions.defaultVirtualsAccess ? filterOptions.defaultVirtualsAccess : "private";
                const virtualFilterSchema = virtualKeys.reduce((result, key) => {
                    result[key] = defaultVirtualsAccess;
                    return result;
                }, {} as { [index: string]: FILTER_SCHEMA_ACCESS });
                const filteredJSON = filterTargetWithFilterSchema({
                    localTarget: ret,
                    localSchema: {...filterSchema, ...virtualFilterSchema},
                    localKeyStack: []
                }, mergeOptionWithDefault(filterOptions));
                if (toJSONCallback) {
                    toJSONCallback(ret, filteredJSON);
                }
                return filteredJSON;
            }
        });
    };
}
