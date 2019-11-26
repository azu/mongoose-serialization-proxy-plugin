import { Schema, SchemaOptions } from "mongoose";
import { FILTER_SCHEMA_ACCESS, FilterSchema, proxySchemaOptions } from "./proxy-filter-schema";

/**
 * Convert path parts into a nested object
 **/
const partsToValue = function(parts: string[], value: any) {
    if (parts.length === 0) {
        return value;
    }
    const obj: { [index: string]: any } = {};
    obj[parts[0]] = partsToValue(parts.slice(1), value);
    return obj;
};

export type createFilterSchemaOptions = proxySchemaOptions & {
    /**
     * Default access level of auto schema like `_id`
     * Default: "private"
     */
    autoSchemaAccess?: FILTER_SCHEMA_ACCESS;
    /**
     *  Default access level of versionKey like `__v`
     *  Default: "private"
     */
    versionKeyAccess?: FILTER_SCHEMA_ACCESS;
}
export const createFilterSchema = <T extends {}>(schema: Schema<T>, options?: createFilterSchemaOptions): FilterSchema<T> => {
    const versionKeyAccess = options && options.versionKeyAccess !== undefined ? options.versionKeyAccess : "private";
    const autoSchemaAccess = options && options.autoSchemaAccess !== undefined ? options.autoSchemaAccess : "private";
    const defaultSchemaAccess: FILTER_SCHEMA_ACCESS = options && options.defaultSchemaAccess !== undefined ? options.defaultSchemaAccess : "private";
    const schemaOptions: SchemaOptions = (schema as any).options;
    const versionKey = schemaOptions.versionKey !== undefined && typeof schemaOptions.versionKey === "string" ? schemaOptions.versionKey : "_v";
    const propSchema: FilterSchema<any> = {
        [versionKey]: versionKeyAccess
    };
    schema.eachPath((path, type) => {
        const parts = path.split(".");
        const typeOptions = (type as any).options;
        // auto property like `_id`
        if (typeOptions.auto) {
            const res = partsToValue(parts, autoSchemaAccess);
            return Object.assign(propSchema, res);
        }
        // default value
        const filterSchemaValue = typeOptions.access !== undefined
            ? typeOptions.access
            : defaultSchemaAccess;
        const res = partsToValue(parts, filterSchemaValue);
        return Object.assign(propSchema, res);
    });
    return propSchema;
};
