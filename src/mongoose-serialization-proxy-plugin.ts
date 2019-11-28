import { createFilterSchema } from "./create-filter-schema";
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

export type mongooseSerializeProxyPluginOptions = {
    /**
     * Default access level of auto schema like `_id`
     * Default: "private"
     */
    autoFieldAccess?: FILTER_SCHEMA_ACCESS;
    /**
     *  Default access level of versionKey like `__v`
     *  Default: "private"
     */
    versionKeyAccess?: FILTER_SCHEMA_ACCESS;
    /**
     * Default access level of virtual property
     * Default: "private"
     *
     * Note: defaultVirtualsAccess only support Schema#toJSON
     */
    defaultVirtualsAccess?: FILTER_SCHEMA_ACCESS;
    /**
     * Default access level of undefined property of filterSchema
     * Default: "private"
     */
    defaultFieldsAccess?: FILTER_SCHEMA_ACCESS;
    /**
     * callback function when call `toJSON` method
     */
    toJSONCallback?: (oldJSON: {}, newJSON: {}) => void
    /**
     * Enable dry-run mode
     * If it is true, does not transform json object on toJSON method.
     * It is useful for logging
     * Default: false
     */
    dryRun?: boolean;
};

export function mongooseSerializationProxyPlugin(filterOptions?: mongooseSerializeProxyPluginOptions) {
    const shouldProxy = factoryShouldWrapProxy(filterOptions);
    const toJSONCallback = filterOptions && filterOptions.toJSONCallback;
    const defaultVirtualsAccess = filterOptions && filterOptions.defaultVirtualsAccess ? filterOptions.defaultVirtualsAccess : "private";
    const dryRun = filterOptions && filterOptions.dryRun !== undefined ? filterOptions.dryRun : false;
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
                // early return when dry-run
                if (dryRun) {
                    if (toJSONCallback) {
                        toJSONCallback(ret, ret);
                    }
                    return ret;
                }
                const virtualKeys = Object.keys(ret).filter(key => {
                    return schema.pathType(key) === "virtual";
                });
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
