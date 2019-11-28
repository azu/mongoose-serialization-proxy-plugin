"use strict";

import mongoose, { Document, model, Schema } from "mongoose";
import { mongooseSerializationProxyPlugin } from "../src/mongoose-serialization-proxy-plugin";
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

describe("mongoose-serialization-proxy-plugin", function () {
    before(function (done) {
        mongoose.connect("mongodb://localhost/mongoose-serialization-proxy-plugin", {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, function (err) {
            if (err) {
                console.error("MongoDB: " + err.message);
                console.error("MongoDB is running? Is it accessible by this application?");
                return done(err);
            }
            mongoose.connection.db.dropDatabase(done);
        });
    });

    afterEach(function (done) {
        mongoose.models = {};
        mongoose.connection.db.dropDatabase(done);
    });

    after(function (done) {
        mongoose.connection.close(done);
    });

    describe("When no define access field", function () {
        it("should hide all properties by default", async function () {
            const UserSchema = new Schema<User>({
                name: String,
                email: String,
                password: {
                    type: String,
                },
                secretSettings: {
                    type: Schema.Types.Mixed,
                },
                secretObject: {
                    child: {
                        type: Schema.Types.Mixed,
                    }
                }
            });
            UserSchema.plugin(mongooseSerializationProxyPlugin());
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
            assert.deepStrictEqual(user.secretSettings, {age: 12});
            // serialization should be filtered
            assert.deepStrictEqual(user.toJSON(), {});
            assert.strictEqual(JSON.stringify(user), `{}`);
            // Assignment value should be filtered
            const secretSettings = user.secretSettings;
            assert.strictEqual(JSON.stringify(secretSettings), `{}`);
        });
    });

    describe('when define access for field', function () {

        it("should hide all properties", async function () {
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
            UserSchema.plugin(mongooseSerializationProxyPlugin({
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
            assert.deepStrictEqual(user.secretSettings, {age: 12});
            // serialization should be filtered
            assert.deepStrictEqual(user.toJSON(), {"name": "Joe", "email": "joe@example.com"});
            assert.strictEqual(JSON.stringify(user), `{"name":"Joe","email":"joe@example.com"}`);
            // Assignment value should be filtered
            const secretSettings = user.secretSettings;
            assert.strictEqual(JSON.stringify(secretSettings), `{}`);
        });
        it("should support virtual", async function () {
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
            UserSchema.plugin(mongooseSerializationProxyPlugin({
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
            assert.deepStrictEqual(user.secretSettings, {age: 12});
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
        it("should toJSONCallback when stringify", async function () {
            const UserSchema = new Schema<User>({
                name: String,
                email: String,
                password: {
                    type: String,
                },
                secretSettings: {
                    type: Schema.Types.Mixed,
                },
                secretObject: {
                    child: {
                        type: Schema.Types.Mixed,
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
            let shouldCalled = false;
            UserSchema.plugin(mongooseSerializationProxyPlugin({
                defaultFieldsAccess: "public",
                defaultVirtualsAccess: "public",
                versionKeyAccess: "public",
                autoFieldAccess: "public",
                toJSONCallback: (oldJSON: any, newJSON: any) => {
                    shouldCalled = true;
                    assert.strictEqual(typeof oldJSON.id, "string");
                    assert.strictEqual(typeof oldJSON._id, "object");
                    assert.strictEqual(typeof newJSON.id, "string");
                    assert.strictEqual(typeof newJSON._id, "object");
                    delete oldJSON.id;
                    delete oldJSON._id;
                    delete newJSON.id;
                    delete newJSON._id;
                    assert.deepStrictEqual(oldJSON, {
                        name: 'Joe',
                        email: 'joe@example.com',
                        password: 'secret',
                        secretSettings: {age: 12},
                        __v: 0,
                        v_v: 'virtual value',
                    });
                    assert.deepStrictEqual(newJSON, {
                        name: 'Joe',
                        email: 'joe@example.com',
                        password: 'secret',
                        secretSettings: {age: 12},
                        __v: 0,
                        v_v: 'virtual value',
                    });
                }
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
            // serialization
            JSON.stringify(user);
            // then,
            assert.ok(shouldCalled, "toJSONCallback should be called");
        });
    });
    describe('When enable dry-run option', function () {
        it("should not modify json object", async () => {
            const UserSchema = new Schema<User>({
                name: String,
                email: String,
                password: {
                    type: String,
                },
                secretSettings: {
                    type: Schema.Types.Mixed,
                },
                secretObject: {
                    child: {
                        type: Schema.Types.Mixed,
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
            UserSchema.plugin(mongooseSerializationProxyPlugin({
                dryRun: true,
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
            const json = user.toJSON();
            json.id = "dummy";
            json._id = "dummy";
            assert.deepStrictEqual(json, {
                id: "dummy",
                _id: "dummy",
                __v: 0,
                "name": "Joe",
                "email": "joe@example.com",
                "password": "secret",
                "secretSettings": {
                    "age": 12
                },
                v_v: "virtual value"
            });
            // Assignment value should be filtered
            const secretSettings = user.secretSettings;
            assert.strictEqual(JSON.stringify(secretSettings), `{"age":12}`);
        });
        it("should call toJSONCallback", async () => {
            const UserSchema = new Schema<User>({
                name: String,
                email: String,
                password: {
                    type: String,
                },
                secretSettings: {
                    type: Schema.Types.Mixed,
                },
                secretObject: {
                    child: {
                        type: Schema.Types.Mixed,
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
            let toJSONCallbackCount = 0;
            UserSchema.plugin(mongooseSerializationProxyPlugin({
                dryRun: true,
                toJSONCallback: (oldJSON, newJSON) => {
                    toJSONCallbackCount++;
                    assert.strictEqual(oldJSON, newJSON, "should be same object");
                }
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
            // 1
            JSON.stringify(user);
            const secretSettings = user.secretSettings;
            // 2
            JSON.stringify(secretSettings);
            assert.strictEqual(toJSONCallbackCount, 2);
        });
    });
});
