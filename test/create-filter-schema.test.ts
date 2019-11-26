import { Schema } from "mongoose";
import * as assert from "assert";
import { createFilterSchema } from "../src/create-filter-schema";

describe("create-filter-schema", function() {
    it("should create filter schema from mongoose schema object", () => {
        const schema = new Schema({
            name: String,
            email: String,
            password: {
                type: String,
                access: "private"
            },
            secretSettings: {
                type: Schema.Types.Mixed,
                access: "private"
            },
            secretObject: {
                child: {
                    type: Schema.Types.Mixed,
                    access: "private"
                }
            }
        });
        const filterSchema = createFilterSchema(schema, {
            defaultFieldsAccess: "public"
        });
        assert.deepStrictEqual(filterSchema, {
            "_id": "private",
            __v: "private",
            "email": "public",
            "name": "public",
            "password": "private",
            "secretObject": {
                "child": "private"
            },
            "secretSettings": "private"
        });
    });
    it("should create filter schema with defaultSchemaAccess", () => {
        const schema = new Schema({
            name: String,
            email: String
        });
        const filterSchema = createFilterSchema(schema, {
            defaultFieldsAccess: "public"
        });
        assert.deepStrictEqual(filterSchema, {
            "_id": "private",
            __v: "private",
            "email": "public",
            "name": "public"
        });
    });
    it("support auto field with autoSchemaAccess option", () => {
        const schema = new Schema({
            name: String,
            email: String
        });
        const filterSchema = createFilterSchema(schema, {
            autoFieldAccess: "public"
        });
        assert.deepStrictEqual(filterSchema, {
            "_id": "public",
            __v: "private",
            "email": "private",
            "name": "private"
        });
    });
    it("support auto versionKey with versionKeyAccess option", () => {
        const schema = new Schema({
            name: String,
            email: String
        });
        const filterSchema = createFilterSchema(schema, {
            versionKeyAccess: "public"
        });
        assert.deepStrictEqual(filterSchema, {
            "__v": "public",
            "_id": "private",
            "email": "private",
            "name": "private"
        });
    });
});
