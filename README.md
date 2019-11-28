# mongoose-serialization-proxy-plugin [![Actions Status](https://github.com/azu/mongoose-serialization-proxy-plugin/workflows/ci/badge.svg)](https://github.com/azu/mongoose-serialization-proxy-plugin/actions?query=workflow%3Aci)

Hide secret properties of mongo model when serialize the model with `JSON.stringify`.

## Motivation

- [ ] TODO

## Features

- Support `Schema#toJSON`
- Support assignment value using Proxy

## Install

Install with [npm](https://www.npmjs.com/):

    npm install mongoose-serialization-proxy-plugin

## Usage

```js
import { mongooseSerializeProxyPlugin } from "mongoose-serialization-proxy-plugin";
(async function(){
    const UserSchema = new Schema({
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
    // Register plugin
    UserSchema.plugin(mongooseSerializeProxyPlugin({
        // No "access" defined value, will be "public" 
        defaultSchemaAccess: "public"
    }));
    // Create Model
    const User = model("User", UserSchema);
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
    // password and secretSettings should be omit
    assert.deepStrictEqual(user.toJSON(), { "name": "Joe", "email": "joe@example.com" });
    assert.strictEqual(JSON.stringify(user), `{"name":"Joe","email":"joe@example.com"}`);
    // Assignment value should be filtered
    // secretSettings should be omit
    const secretSettings = user.secretSettings;
    assert.strictEqual(JSON.stringify(secretSettings), `{}`);
})();
```

### Example: Only Logging
 
Pass through toJSON, but call `toJSONCallback` function.

```js
import { mongooseSerializeProxyPlugin } from "mongoose-serialization-proxy-plugin";
(async function(){
    const UserSchema = new Schema({
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
    // Register plugin
    UserSchema.plugin(mongooseSerializeProxyPlugin({
        // no modify json object
        dryRun: true,
        // callback
        toJSONCallback: (oldJSON, newJSON) => {
            // It is called when json stringify the mongo model
        }
    }));
    // Create Model
    const User = model("User", UserSchema);
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
    // it will call `toJSONCallback` callback
    JSON.stringify(user);
})();
```


## Changelog

See [Releases page](https://github.com/azu/mongoose-serialization-proxy-plugin/releases).

## Running tests

Install devDependencies and Run `npm test`:

    make up
    npm test

## Contributing

Pull requests and stars are always welcome.

For bugs and feature requests, [please create an issue](https://github.com/azu/mongoose-serialization-proxy-plugin/issues).

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## Author

- [github/azu](https://github.com/azu)
- [twitter/azu_re](https://twitter.com/azu_re)

## License

MIT © azu
