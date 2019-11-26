"use strict";

import mongoose, { Document, model, Schema } from "mongoose";
import { mongooseSerializeProxyPlugin } from "../src/mongoose-serialization-proxy-plugin";
import * as assert from "assert";

interface User extends Document {
    name: string;
    email: string;
    password: string;
    secretSettings: Schema.Types.Mixed
    secretObject: {
        child: {
            type: Schema.Types.Mixed;
        }
    }
}

describe("mongoose-serialization-proxy-plugin", function() {
    before(function(done) {
        mongoose.connect("mongodb://localhost/mongoose-serialization-proxy-plugin", {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, function(err) {
            if (err) {
                console.error("MongoDB: " + err.message);
                console.error("MongoDB is running? Is it accessible by this application?");
                return done(err);
            }
            mongoose.connection.db.dropDatabase(done);
        });
    });

    afterEach(function(done) {
        mongoose.models = {};
        mongoose.connection.db.dropDatabase(done);
    });

    after(function(done) {
        mongoose.connection.close(done);
    });

    describe("A model with no hidden properties defined", function() {
        it("should return all properties", async function() {
            const UserSchema = new Schema<User>({
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
            UserSchema.plugin(mongooseSerializeProxyPlugin({
                defaultFieldsAccess: "public"
            }));
            const User = model<User>("User", UserSchema);
            const userJoe = new User({
                name: "Joe",
                email: "joe@example.com",
                password: "secret",
                secretSettings: {
                    age: 12
                }
            });
            await userJoe.save();
            const user = await User.findOne({
                name: "Joe"
            });
            if (!user) {
                throw new Error("Not found findUserJoe");
            }
            // property reference is ok
            assert.strictEqual(user.password, "secret");
            assert.deepStrictEqual(user.secretSettings, { age: 12 });
            // serialization should be filtered
            assert.deepStrictEqual(user.toJSON(), { "name": "Joe", "email": "joe@example.com" });
            assert.strictEqual(JSON.stringify(user), `{"name":"Joe","email":"joe@example.com"}`);
            // Assignment value should be filtered
            const secretSettings = user.secretSettings;
            assert.strictEqual(JSON.stringify(secretSettings), `{}`);
        });
        it("should support virtual", async function() {
            const UserSchema = new Schema<User>({
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
            }, {
                toJSON: {
                    virtuals: true
                }
            });
            // Define virtual
            UserSchema.virtual("v_v").get(() => {
                return "virtual value";
            });
            UserSchema.plugin(mongooseSerializeProxyPlugin({
                defaultFieldsAccess: "public",
                // allow virtual toJSON
                defaultVirtualsAccess: "public"
            }));
            const User = model<User & { v_v: string }>("User", UserSchema);
            const userJoe = new User({
                name: "Joe",
                email: "joe@example.com",
                password: "secret",
                secretSettings: {
                    age: 12
                }
            });
            await userJoe.save();
            const user = await User.findOne({
                name: "Joe"
            });
            if (!user) {
                throw new Error("Not found findUserJoe");
            }
            // property reference is ok
            assert.strictEqual(user.password, "secret");
            assert.strictEqual(user.v_v, "virtual value");
            assert.deepStrictEqual(user.secretSettings, { age: 12 });
            // serialization should be filtered
            const json = user.toJSON();
            json.id = "dummy";
            assert.deepStrictEqual(json, {
                "name": "Joe",
                "email": "joe@example.com",
                v_v: "virtual value",
                id: "dummy"
            });
            // Assignment value should be filtered
            const secretSettings = user.secretSettings;
            assert.strictEqual(JSON.stringify(secretSettings), `{}`);
        });
    });
});
