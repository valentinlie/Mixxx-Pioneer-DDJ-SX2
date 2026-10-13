// Mixxx's controller lint rules (mixxxdj/mixxx 2.5 eslint.config.cjs), minus its TypeScript/JSDoc plugins.
const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 7,
            sourceType: "script",
        },
        rules: {
            "array-bracket-spacing": "warn",
            "block-spacing": "warn",
            "brace-style": ["warn", "1tbs", {allowSingleLine: true}],
            curly: "warn",
            camelcase: "warn",
            "comma-spacing": "warn",
            "computed-property-spacing": ["warn", "never", {enforceForClassMembers: true}],
            "dot-location": ["warn", "property"],
            "dot-notation": "warn",
            eqeqeq: ["error", "always"],
            "func-call-spacing": "warn",
            "func-style": ["error", "expression", {allowArrowFunctions: true}],
            indent: ["warn", 4],
            "key-spacing": "warn",
            "keyword-spacing": "warn",
            "linebreak-style": ["warn", "unix"],
            "newline-per-chained-call": "warn",
            "no-trailing-spaces": "warn",
            "no-unneeded-ternary": ["warn", {defaultAssignment: false}],
            "no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
            "no-useless-return": "warn",
            "no-var": "warn",
            "object-curly-newline": ["warn", {consistent: true, multiline: true}],
            "object-curly-spacing": "warn",
            "prefer-const": "warn",
            "prefer-template": "warn",
            quotes: ["warn", "double"],
            semi: "warn",
            "semi-spacing": "warn",
            "space-before-blocks": ["warn", "always"],
            "space-before-function-paren": ["warn", "never"],
            "space-in-parens": "warn",
            yoda: "warn",
        },
    },
    {
        files: ["bin/**/*.js"],
        languageOptions: {
            globals: {ColorMapper: "readonly", engine: "readonly", midi: "readonly"},
        },
    },
    {
        files: ["bin/**/*.js"],
        ignores: ["bin/PIONEER_DDJ-SX2-scripts.js"], // declares it
        languageOptions: {globals: {PioneerDDJSX2: "readonly"}},
    },
    {
        files: ["test/**/*.js", "eslint.config.cjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {require: "readonly", module: "writable", __dirname: "readonly", console: "readonly"},
        },
    },
];
