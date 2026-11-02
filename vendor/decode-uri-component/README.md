# Temporary CommonJS compatibility backport

Source: https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.1 (MIT).

Expo Router 57 / query-string 7 require a CommonJS function. Upstream 0.5.1 fixes malicious percent-encoded input handling but only ships ESM. This copy changes its export to CommonJS and preserves the old dependency's plus-to-space behavior. The linear decoder algorithm is unchanged. Remove this override after upgrading to a supported Expo Router dependency tree that consumes the fixed decoder directly. Tests exercise valid UTF-8, malformed escapes and long hostile input through query-string.
